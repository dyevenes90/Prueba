import { withSupabase } from "npm:@supabase/server@1";
import { DEFAULT_PRIORITY_BOOTSTRAP_HOURS, formatChangeWindowForApi, MAX_PRIORITY_BOOTSTRAP_HOURS, parseApiDateMode } from "../_shared/compra-agil-sync-engine.ts";
import { authorizeSyncAction } from "../_shared/compra-agil-sync-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAGE_SIZE = 50;
const MAX_PAGES_PER_RUN = 4;
const MAX_RETRIES = 2;
const REGIONS: Record<number, string> = {
  1: "Región de Tarapacá", 2: "Región de Antofagasta", 3: "Región de Atacama",
  4: "Región de Coquimbo", 5: "Región de Valparaíso",
  6: "Región del Libertador General Bernardo O'Higgins", 7: "Región del Maule",
  8: "Región del Biobío", 9: "Región de La Araucanía", 10: "Región de Los Lagos",
  11: "Región de Aysén del General Carlos Ibáñez del Campo",
  12: "Región de Magallanes y de la Antártica Chilena",
  13: "Región Metropolitana de Santiago", 14: "Región de Los Ríos",
  15: "Región de Arica y Parinacota", 16: "Región de Ñuble",
};

function normalizeRegion(value: unknown, regionId?: number): string | null {
  if (regionId && REGIONS[regionId]) return REGIONS[regionId];
  if (typeof value !== "string") return null;
  const key = value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/^region\s+(de|del)\s+/u, "").replace(/\s+/g, " ").trim();
  const aliases: Record<string, number> = {
    tarapaca: 1, antofagasta: 2, atacama: 3, coquimbo: 4, valparaiso: 5,
    "o'higgins": 6, "libertador general bernardo o'higgins": 6, ohiggins: 6,
    maule: 7, biobio: 8, araucania: 9, "la araucania": 9, "los lagos": 10,
    aysen: 11, "aysen del general carlos ibanez del campo": 11,
    magallanes: 12, "magallanes y la antartica": 12,
    "magallanes y de la antartica chilena": 12, metropolitana: 13,
    "metropolitana de santiago": 13, santiago: 13, "los rios": 14,
    "arica y parinacota": 15, nuble: 16,
  };
  const id = aliases[key];
  return id ? REGIONS[id] : value.trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

type ApiItem = Record<string, unknown>;
type ApiResponse = {
  success?: string;
  payload?: {
    items?: ApiItem[];
    paginacion?: { numero_pagina?: number; total_paginas?: number; total_resultados?: number };
  } | null;
};

type DetailResponse = {
  success?: string;
  payload?: ApiItem | null;
};

function isRecord(value: unknown): value is ApiItem {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickDetail(payload: ApiItem) {
  const institution = isRecord(payload.institucion) ? payload.institucion : {};
  const dates = isRecord(payload.fechas) ? payload.fechas : {};
  const delivery = isRecord(payload.entrega) ? payload.entrega : {};
  const flags = isRecord(payload.flags) ? payload.flags : {};
  const products = Array.isArray(payload.productos_solicitados) ? payload.productos_solicitados : [];
  const attachments = Array.isArray(payload.documentos) ? payload.documentos : [];

  return {
    codigo: payload.codigo,
    nombre: payload.nombre,
    descripcion: payload.descripcion,
    organismo: institution.organismo_comprador,
    fecha_cierre: dates.fecha_cierre,
    productos_requeridos: products.map((raw) => {
      if (!isRecord(raw)) return null;
      return {
        nombre: raw.nombre,
        descripcion: raw.descripcion,
        cantidad: raw.cantidad,
        unidad_medida: raw.unidad_medida,
      };
    }).filter((item) => item !== null),
    lugar_entrega: delivery.direccion_entrega,
    plazo_entrega_dias: delivery.plazo_entrega_dias,
    adjuntos: attachments.map((raw) => {
      if (!isRecord(raw)) return null;
      return { id: raw.id, nombre: raw.nombre };
    }).filter((item) => item !== null),
    condiciones_solicitud: {
      considera_requisitos_medioambientales: flags.considera_requisitos_medioambientales,
      considera_requisitos_impacto_social_economico: flags.considera_requisitos_impacto_social_economico,
    },
  };
}

Deno.serve(withSupabase({ auth: ["user", "secret:cron"], cors: { headers: corsHeaders } }, async (req, ctx) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let requestBody: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) requestBody = JSON.parse(text);
  } catch {
    return json({ error: "Cuerpo JSON inválido" }, 400);
  }
  if (!isRecord(requestBody)) return json({ error: "El cuerpo debe ser un objeto JSON" }, 400);
  const allowedIds = (Deno.env.get("CRESCE_ALLOWED_USER_IDS") ?? "").split(/[\s,]+/).filter(Boolean);
  const authorization = authorizeSyncAction({
    authMode: ctx.authMode ?? null,
    authKeyName: ctx.authKeyName,
    userId: ctx.userClaims?.id,
    allowedUserIds: allowedIds,
    action: typeof requestBody.accion === "string" ? requestBody.accion : undefined,
  });
  if (!authorization.allowed) return json({ error: authorization.error }, authorization.status);
  if (requestBody.accion !== undefined && !["detalle", "sincronizar_regiones", "buscar_compras_nuevas", "continuar_historico", "sincronizacion_programada", "sincronizacion_prioritaria_programada"].includes(String(requestBody.accion))) {
    return json({ error: "Acción no válida" }, 400);
  }

  if (requestBody.accion === "detalle") {
    const codigo = requestBody.codigo;
    if (typeof codigo !== "string" || !/^\d+-\d+-COT\d{2}$/.test(codigo)) {
      return json({ error: "Código de Compra Ágil inválido" }, 400);
    }
    const ticket = Deno.env.get("MERCADOPUBLICO_TICKET");
    if (!ticket) return json({ error: "Configuración del servicio incompleta" }, 500);

    try {
      const detailUrl = new URL(`https://api2.mercadopublico.cl/v2/compra-agil/${encodeURIComponent(codigo)}`);
      const upstream = await fetch(detailUrl, {
        method: "GET",
        headers: { ticket, Accept: "application/json" },
        signal: AbortSignal.timeout(35_000),
      });
      if (!upstream.ok) {
        const status = upstream.status === 404 ? 404 : upstream.status === 429 ? 429 : 502;
        return json({ error: `No se pudo consultar el detalle de Compra Ágil (HTTP ${upstream.status})` }, status);
      }

      const response: unknown = await upstream.json();
      if (!isRecord(response)) return json({ error: "Respuesta inválida de Compra Ágil" }, 502);
      const detail = response as DetailResponse;
      if (detail.success !== "OK" || !isRecord(detail.payload) || detail.payload.codigo !== codigo) {
        return json({ error: "Respuesta incompleta de Compra Ágil" }, 502);
      }
      const { data: opportunity, error: opportunityError } = await ctx.supabaseAdmin
        .from("compra_agil_oportunidades")
        .select("codigo")
        .eq("codigo", codigo)
        .maybeSingle();
      if (opportunityError) {
        return json({ error: "No se pudo comprobar la oportunidad; el detalle no fue almacenado" }, 500);
      }
      if (!opportunity) {
        return json({ error: "La oportunidad no existe en CRESCE; el detalle no fue almacenado" }, 404);
      }

      const timestamp = new Date().toISOString();
      const { error: saveError } = await ctx.supabaseAdmin
        .from("compra_agil_detalles")
        .upsert({
          codigo,
          datos_detalle: detail.payload,
          fecha_consulta: timestamp,
          fecha_actualizacion: timestamp,
        }, { onConflict: "codigo" });
      if (saveError) {
        return json({ error: "No se pudo almacenar el detalle de Compra Ágil" }, 500);
      }

      return json({ detalle: pickDetail(detail.payload), guardado: true });
    } catch {
      return json({ error: "Error o tiempo de espera al consultar el detalle" }, 502);
    }
  }

  if (requestBody.accion === undefined) return json({ error: "Se requiere una acción explícita" }, 400);

  if (["buscar_compras_nuevas", "sincronizacion_prioritaria_programada"].includes(String(requestBody.accion))) {
    const ticket = Deno.env.get("MERCADOPUBLICO_TICKET");
    if (!ticket) return json({ error: "Configuración del servicio incompleta" }, 500);
    let dateMode;
    try { dateMode = parseApiDateMode(Deno.env.get("COMPRA_AGIL_API_DATE_MODE")); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Configuración de fechas inválida" }, 500); }
    const scheduled = requestBody.accion === "sincronizacion_prioritaria_programada";
    const regions = Array.isArray(requestBody.regiones) ? requestBody.regiones.map(Number) : [9, 14];
    const requestedBootstrapFrom = typeof requestBody.cambio_desde === "string" && Number.isFinite(Date.parse(requestBody.cambio_desde))
      ? new Date(requestBody.cambio_desde).toISOString() : null;
    const rawBootstrapHours = Deno.env.get("COMPRA_AGIL_PRIORITY_BOOTSTRAP_HOURS");
    const bootstrapWindowHours = scheduled
      ? rawBootstrapHours === undefined ? DEFAULT_PRIORITY_BOOTSTRAP_HOURS : Number(rawBootstrapHours)
      : null;
    if (scheduled && (!Number.isInteger(bootstrapWindowHours) || bootstrapWindowHours! < 1 || bootstrapWindowHours! > MAX_PRIORITY_BOOTSTRAP_HOURS)) {
      return json({ error: `COMPRA_AGIL_PRIORITY_BOOTSTRAP_HOURS debe ser entero de 1 a ${MAX_PRIORITY_BOOTSTRAP_HOURS}` }, 500);
    }
    const bootstrapFrom = scheduled ? null : requestedBootstrapFrom;
    const result = await import("../_shared/compra-agil-priority-service.ts").then(({ runPrioritySync }) => runPrioritySync({
      db: ctx.supabaseAdmin, ticket, regions, bootstrapFrom, bootstrapWindowHours, scheduled,
      dateMode,
    }));
    return json(result, "error" in result ? 503 : 200);
  }

  if (["continuar_historico", "sincronizacion_programada", "sincronizar_regiones"].includes(String(requestBody.accion))) {
    const db = ctx.supabaseAdmin;
    let dateMode;
    try { dateMode = parseApiDateMode(Deno.env.get("COMPRA_AGIL_API_DATE_MODE")); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Configuración de fechas inválida" }, 500); }
    const scheduled = requestBody.accion === "sincronizacion_programada";
    const requestedRegions = scheduled ? Object.keys(REGIONS).map(Number)
      : Array.isArray(requestBody.regiones) ? requestBody.regiones
      : Number.isInteger(requestBody.region) ? [requestBody.region as number]
      : [9, 14];
    const regions = [...new Set(requestedRegions)];
    if (!regions.length || regions.some((id) => !Number.isInteger(id) || !REGIONS[id])) {
      return json({ error: "Indique códigos de región entre 1 y 16" }, 400);
    }
    if (!scheduled && regions.length > 2) return json({ error: "La búsqueda manual admite hasta dos regiones por vez" }, 400);
    const bootstrapFrom = typeof requestBody.cambio_desde === "string" && Number.isFinite(Date.parse(requestBody.cambio_desde))
      ? new Date(requestBody.cambio_desde).toISOString() : null;
    const ticket = Deno.env.get("MERCADOPUBLICO_TICKET");
    if (!ticket) return json({ error: "Configuración del servicio incompleta" }, 500);
    const runId = crypto.randomUUID();
    const summaries: Record<string, unknown>[] = [];
    let requestsLeft = MAX_PAGES_PER_RUN;
    if (scheduled) {
      const orderResult = await db.from("compra_agil_sync_state").select("region_id, last_attempt_at").in("region_id", regions);
      if (orderResult.error) return json({ error: "No se pudo planificar el turno de regiones" }, 500);
      const attempted = new Map((orderResult.data ?? []).map((row) => [Number(row.region_id), row.last_attempt_at ? Date.parse(row.last_attempt_at) : 0]));
      regions.sort((a, b) => (attempted.get(a) ?? 0) - (attempted.get(b) ?? 0) || a - b);
    }

    for (const regionId of regions) {
      if (requestsLeft <= 0) {
        summaries.push({ region: regionId, estado: "pendiente_por_limite", paginas_consultadas: 0 });
        continue;
      }
      let { data: state, error: stateError } = await db.from("compra_agil_sync_state")
        .select("cursor_success, window_from, window_to, next_page, total_pages, lock_until")
        .eq("region_id", regionId).maybeSingle();
      if (stateError || !state) return json({ error: "Falta aplicar la migración local de checkpoints compra_agil_sync_state" }, 503);
      const now = new Date();
      if (state.lock_until && Date.parse(state.lock_until) > now.getTime()) {
        summaries.push({ region: regionId, estado: "otra_sincronizacion_en_curso", paginas_consultadas: 0 });
        continue;
      }
      const lockUntil = new Date(now.getTime() + 5 * 60_000).toISOString();
      const { data: locked } = await db.from("compra_agil_sync_state")
        .update({ lock_until: lockUntil, lock_token: runId, last_attempt_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("region_id", regionId).lte("lock_until", now.toISOString()).select("region_id").maybeSingle();
      if (!locked) {
        summaries.push({ region: regionId, estado: "otra_sincronizacion_en_curso", paginas_consultadas: 0 });
        continue;
      }

      const lockedStateResult = await db.from("compra_agil_sync_state")
        .select("cursor_success, window_from, window_to, next_page, total_pages, lock_until")
        .eq("region_id", regionId).eq("lock_token", runId).single();
      if (lockedStateResult.error || !lockedStateResult.data) {
        await db.from("compra_agil_sync_state").update({ lock_until: new Date(0).toISOString(), lock_token: null }).eq("region_id", regionId).eq("lock_token", runId);
        summaries.push({ region: regionId, estado: "error", paginas_consultadas: 0, error: "No se pudo releer checkpoint luego de obtener el bloqueo" });
        continue;
      }
      state = lockedStateResult.data;

      const executionResult = await db.from("compra_agil_ejecuciones").insert({ estado: "iniciada" }).select("id").single();
      if (executionResult.error || !executionResult.data) {
        await db.from("compra_agil_sync_state").update({ lock_until: new Date(0).toISOString(), lock_token: null }).eq("region_id", regionId).eq("lock_token", runId);
        return json({ error: "No se pudo registrar la ejecución" }, 500);
      }
      const executionId = executionResult.data.id;
      const finish = async (status: string, found: number, inserted: number, error: string | null) => {
        await db.from("compra_agil_ejecuciones").update({
          estado: status, termino: new Date().toISOString(), oportunidades_encontradas: found,
          oportunidades_nuevas: inserted, error_detalle: error,
        }).eq("id", executionId);
      };
      let windowFrom = state.window_from as string | null;
      let windowTo = state.window_to as string | null;
      let page = Number(state.next_page || 1);
      let totalPages = state.total_pages == null ? null : Number(state.total_pages);
      if (!windowFrom || !windowTo) {
        const proposedFrom = state.cursor_success
          ? new Date(Date.parse(state.cursor_success) - 5 * 60_000).toISOString()
          : bootstrapFrom;
        windowFrom = proposedFrom;
        if (!windowFrom) {
          await finish("error", 0, 0, "Primera sincronización: indique cambio_desde (ISO-8601)");
          await db.from("compra_agil_sync_state").update({ lock_until: new Date(0).toISOString(), lock_token: null }).eq("region_id", regionId).eq("lock_token", runId);
          summaries.push({ region: regionId, estado: "requiere_fecha_inicial", paginas_consultadas: 0 });
          continue;
        }
        windowTo = now.toISOString();
        page = 1;
        totalPages = null;
        const { data: savedWindow, error: windowError } = await db.from("compra_agil_sync_state")
          .update({ window_from: windowFrom, window_to: windowTo, next_page: 1, total_pages: null })
          .eq("region_id", regionId).eq("lock_token", runId).is("window_from", null).is("window_to", null)
          .select("window_from, window_to, next_page, total_pages").maybeSingle();
        if (windowError) {
          await finish("error", 0, 0, "No se pudo guardar el rango incremental inicial");
          await db.from("compra_agil_sync_state").update({ lock_until: new Date(0).toISOString(), lock_token: null }).eq("region_id", regionId).eq("lock_token", runId);
          summaries.push({ region: regionId, estado: "error", paginas_consultadas: 0, error: "No se pudo guardar el rango incremental inicial" });
          continue;
        }
        // Another manual/cron invocation may have persisted the range before this lock was acquired.
        if (!savedWindow) {
          const { data: currentWindow, error: currentWindowError } = await db.from("compra_agil_sync_state")
            .select("window_from, window_to, next_page, total_pages")
            .eq("region_id", regionId).eq("lock_token", runId).single();
          if (currentWindowError || !currentWindow?.window_from || !currentWindow?.window_to) {
            await finish("error", 0, 0, "No se pudo recuperar el rango incremental guardado");
            await db.from("compra_agil_sync_state").update({ lock_until: new Date(0).toISOString(), lock_token: null }).eq("region_id", regionId).eq("lock_token", runId);
            summaries.push({ region: regionId, estado: "error", paginas_consultadas: 0, error: "No se pudo recuperar el rango incremental guardado" });
            continue;
          }
          windowFrom = currentWindow.window_from;
          windowTo = currentWindow.window_to;
          page = Number(currentWindow.next_page || 1);
          totalPages = currentWindow.total_pages == null ? null : Number(currentWindow.total_pages);
        }
      }

      if (!windowFrom || !windowTo) {
        await finish("error", 0, 0, "El rango incremental está incompleto");
        await db.from("compra_agil_sync_state").update({ lock_until: new Date(0).toISOString(), lock_token: null }).eq("region_id", regionId).eq("lock_token", runId);
        summaries.push({ region: regionId, estado: "error", paginas_consultadas: 0, error: "El rango incremental está incompleto" });
        continue;
      }

      let pages = 0, apiRequests = 0, found = 0, inserted = 0, updated = 0;
      let complete = false, failure: string | null = null;
      try {
        while (requestsLeft > 0 && pages < Math.max(1, Math.floor(MAX_PAGES_PER_RUN / regions.length)) && !complete) {
          const url = new URL("https://api2.mercadopublico.cl/v2/compra-agil");
          url.searchParams.set("region", String(regionId));
          url.searchParams.set("cambio_desde", formatChangeWindowForApi(windowFrom, dateMode));
          url.searchParams.set("cambio_hasta", formatChangeWindowForApi(windowTo, dateMode));
          url.searchParams.set("tamano_pagina", String(PAGE_SIZE));
          url.searchParams.set("numero_pagina", String(page));
          url.searchParams.set("ordenar_por", "FechaUltimaModificacion");
          let upstream: Response | null = null;
          for (let retry = 0; retry <= MAX_RETRIES && requestsLeft > 0; retry++) {
            requestsLeft--;
            apiRequests++;
            upstream = await fetch(url, { method: "GET", headers: { ticket, Accept: "application/json" }, signal: AbortSignal.timeout(25_000) });
            if (upstream.ok || upstream.status === 429 || ![502, 503, 504].includes(upstream.status) || retry === MAX_RETRIES) break;
            const retryAfterHeader = upstream.headers.get("Retry-After");
            const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
            const retryAfterDate = retryAfterHeader ? Date.parse(retryAfterHeader) : NaN;
            const delay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
              ? retryAfterSeconds * 1000
              : Number.isFinite(retryAfterDate) && retryAfterDate > Date.now()
              ? retryAfterDate - Date.now()
              : 1000 * (retry + 1);
            if (delay > 10_000) break;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          if (!upstream?.ok) {
            failure = upstream?.status === 429 ? "Cuota diaria de ChileCompra agotada; cursor sin avanzar"
              : `API ChileCompra respondió HTTP ${upstream?.status ?? "sin respuesta"}; cursor sin avanzar`;
            break;
          }
          pages++;
          const body: unknown = await upstream.json();
          if (!isRecord(body) || body.success !== "OK" || !isRecord(body.payload) || !Array.isArray(body.payload.items)) throw new Error("Respuesta inválida de Compra Ágil v2");
          const payload = body.payload as ApiResponse["payload"] & { items: ApiItem[] };
          const items = payload.items;
          if (items.length > PAGE_SIZE) throw new Error("La API excedió el tamaño máximo de página");
          found += items.length;
          const validByCode = new Map<string, ApiItem>();
          for (const item of items) if (typeof item.codigo === "string" && item.codigo.trim()) validByCode.set(item.codigo.trim(), { ...item, codigo: item.codigo.trim() });
          const validItems = [...validByCode.values()];
          const reportedPages = payload.paginacion?.total_paginas;
          const hasReportedTotal = Number.isInteger(reportedPages) && Number(reportedPages) > 0;
          totalPages = hasReportedTotal
            ? Number(reportedPages)
            : items.length < PAGE_SIZE ? page : totalPages;
          complete = totalPages !== null ? page >= totalPages : items.length < PAGE_SIZE;
          const { data: committed, error: commitError } = await db.rpc("compra_agil_sync_commit_page", {
            p_flow: "historical", p_region_id: regionId, p_run_token: runId,
            p_page: page, p_total_pages: totalPages, p_complete: complete,
            p_window_to: windowTo, p_items: validItems,
            p_last_change_z_is_chile_local: dateMode === "chile_wall_z",
          });
          if (commitError || !committed || !Number.isInteger(committed.inserted) || !Number.isInteger(committed.updated)) {
            throw new Error("El commit transaccional del flujo histórico falló; oportunidades y checkpoint quedaron sin cambios");
          }
          inserted += committed.inserted;
          updated += committed.updated;
          page++;
        }
      } catch (error) {
        failure = error instanceof Error ? error.message : "Error durante la sincronización";
      }
      const quotaExhausted = failure === "Cuota diaria de ChileCompra agotada; cursor sin avanzar";
      const stateLabel = failure ? quotaExhausted ? "cuota_agotada" : "error"
        : complete ? "completada" : "parcial_por_limite";
      const executionNote = failure ?? (!complete
        ? "Límite seguro de páginas por ejecución; checkpoint conservado para continuar"
        : null);
      await finish(stateLabel, found, inserted, executionNote);
      await db.from("compra_agil_sync_state").update({
        lock_until: new Date(0).toISOString(), lock_token: null, last_error: executionNote, updated_at: new Date().toISOString(),
      }).eq("region_id", regionId).eq("lock_token", runId);
      summaries.push({ region: regionId, nombre: REGIONS[regionId], estado: stateLabel, paginas_consultadas: pages, solicitudes_api: apiRequests, oportunidades_encontradas: found, nuevas: inserted, actualizadas: updated, cambio_desde: windowFrom, cambio_hasta: windowTo, pagina_siguiente: complete ? 1 : page, total_paginas: totalPages, paginas_pendientes: complete ? 0 : totalPages === null ? null : Math.max(0, totalPages - page + 1), error: failure, continuable: !complete && !failure });
    }
    return json({ sincronizacion: "incremental", regiones: summaries, paginas_maximas_por_ejecucion: MAX_PAGES_PER_RUN, cuota_agotada: summaries.some((row) => row.estado === "cuota_agotada") });
  }

  return json({ error: "Acción no válida" }, 400);
}));
