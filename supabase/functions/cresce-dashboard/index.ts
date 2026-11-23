import { withSupabase } from "npm:@supabase/server@1";
import {
  classifyOpportunity,
  filterRadarOpportunities,
  normalizeRegionKey,
  santiagoDayAfterStartIso,
  santiagoDayStartIso,
} from "../_shared/compra-agil-radar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeProjection(row: Record<string, unknown>, allowed: string[]) {
  return Object.fromEntries(
    allowed.filter((key) => key in row).map((key) => [key, row[key]]),
  );
}

function text(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeRegion(value: unknown) {
  return normalizeRegionKey(text(value, 100));
}

const OFFICIAL_REGIONS: Record<string, string> = {
  tarapaca: "Región de Tarapacá", antofagasta: "Región de Antofagasta",
  atacama: "Región de Atacama", coquimbo: "Región de Coquimbo",
  valparaiso: "Región de Valparaíso", "o'higgins": "Región del Libertador General Bernardo O'Higgins",
  "libertador general bernardo o'higgins": "Región del Libertador General Bernardo O'Higgins",
  ohiggins: "Región del Libertador General Bernardo O'Higgins", maule: "Región del Maule",
  biobio: "Región del Biobío", araucania: "Región de La Araucanía",
  "la araucania": "Región de La Araucanía", "los lagos": "Región de Los Lagos",
  aysen: "Región de Aysén del General Carlos Ibáñez del Campo",
  "aysen del general carlos ibanez del campo": "Región de Aysén del General Carlos Ibáñez del Campo",
  magallanes: "Región de Magallanes y de la Antártica Chilena",
  "magallanes y la antartica": "Región de Magallanes y de la Antártica Chilena",
  "magallanes y de la antartica chilena": "Región de Magallanes y de la Antártica Chilena",
  metropolitana: "Región Metropolitana de Santiago", "metropolitana de santiago": "Región Metropolitana de Santiago",
  santiago: "Región Metropolitana de Santiago", "los rios": "Región de Los Ríos",
  "arica y parinacota": "Región de Arica y Parinacota", nuble: "Región de Ñuble",
};

function officialRegionName(value: unknown) {
  const key = normalizeRegion(value);
  return OFFICIAL_REGIONS[key] ?? text(value, 100);
}

function normalizeCode(value: unknown) {
  return text(value, 100).replace(/\s+/g, "").toLocaleUpperCase("es");
}

async function readPages(
  makePage: (from: number, to: number) => PromiseLike<{
    data: Record<string, unknown>[] | null;
    error: unknown;
  }>,
) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 10_000; from += 1000) {
    const { data, error } = await makePage(from, from + 999);
    if (error) return { rows, error: true, parcial: false };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < 1000) return { rows, error: false, parcial: false };
  }
  return { rows, error: false, parcial: true };
}

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return reply({ error: "Método no permitido" }, 405);
  }

  const userId = ctx.userClaims?.id;
  const allowedRaw = Deno.env.get("CRESCE_ALLOWED_USER_IDS")?.trim() ?? "";
  const allowedIds = allowedRaw.split(/[\s,]+/).filter(Boolean);
  if (!allowedIds.length) {
    return reply({ error: "Acceso comercial no configurado" }, 403);
  }
  if (typeof userId !== "string" || !allowedIds.includes(userId)) {
    return reply({ error: "No autorizado para datos comerciales" }, 403);
  }

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return reply({ error: "Cuerpo JSON inválido" }, 400);
  }
  if (!isRecord(input)) {
    return reply({ error: "El cuerpo debe ser un objeto JSON" }, 400);
  }
  const db = ctx.supabaseAdmin;

  if (input.consulta === "resumen") {
    const now = new Date().toISOString();
    const [allCount, regions, executions, lastSuccessResult, syncStateResult, partialResult, priorityStateResult] = await Promise.all([
      db.from("compra_agil_oportunidades").select("codigo", {
        count: "exact",
        head: true,
      }),
      db.from("compra_agil_oportunidades").select("region").not(
        "region",
        "is",
        null,
      ).limit(1000),
      db.from("compra_agil_ejecuciones").select(
        "inicio, termino, estado, oportunidades_encontradas, oportunidades_nuevas, error_detalle",
      ).order("inicio", { ascending: false }).limit(5),
      db.from("compra_agil_ejecuciones").select("termino").eq("estado", "completada").not("termino", "is", null).order("termino", { ascending: false }).limit(1).maybeSingle(),
      db.from("compra_agil_sync_state").select("region_id, cursor_success, window_from, window_to, next_page, total_pages, lock_until, last_success_at, last_attempt_at, last_error").order("last_attempt_at", { ascending: false, nullsFirst: false }).limit(16),
      db.from("compra_agil_ejecuciones").select("inicio, termino, estado, oportunidades_encontradas, oportunidades_nuevas, error_detalle").eq("estado", "parcial_por_limite").order("inicio", { ascending: false }).limit(1).maybeSingle(),
      db.from("compra_agil_sync_priority_state").select("region_id, cursor_success, window_from, window_to, next_page, total_pages, last_success_at, last_attempt_at, last_error").order("last_attempt_at", { ascending: false, nullsFirst: false }).limit(2),
    ]);
    const error = allCount.error ?? regions.error ?? executions.error ??
      lastSuccessResult.error;
    if (error) {
      return reply({ error: "No se pudo cargar el resumen comercial" }, 500);
    }
    const opportunityDates = await readPages((start, end) =>
      db.from("compra_agil_oportunidades").select(
        "fecha_cierre, estado, ultima_revision, datos_originales",
      ).range(start, end)
    );
    if (opportunityDates.error) {
      return reply({ error: "No se pudo verificar la actualidad de las oportunidades" }, 500);
    }
    const nowMs = Date.now();
    const dateStatus = (row: Record<string, unknown>) => classifyOpportunity(row, nowMs);
    const opportunityRows = opportunityDates.rows;
    const lastSuccessful = lastSuccessResult.data;
    const syncStates = syncStateResult.error ? [] : syncStateResult.data ?? [];
    const latestCheckpointSuccess = syncStates.map((row) => row.last_success_at)
      .filter((value): value is string => typeof value === "string")
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
    const latestPrioritySuccess = (priorityStateResult.error ? [] : priorityStateResult.data ?? [])
      .map((row) => row.last_success_at).filter((value): value is string => typeof value === "string")
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
    const latestSuccessAt = [latestCheckpointSuccess, lastSuccessful?.termino ?? null, latestPrioritySuccess]
      .filter((value): value is string => typeof value === "string")
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
    const pendingCheckpoints = syncStates.filter((row) => row.window_from && row.window_to)
      .map((row) => ({ region_id: row.region_id, window_from: row.window_from, window_to: row.window_to, next_page: row.next_page, total_pages: row.total_pages, last_error: row.last_error }));
    const priorityCheckpoints = priorityStateResult.error ? [] : (priorityStateResult.data ?? [])
      .filter((row) => row.window_from && row.window_to)
      .map((row) => ({ region_id: row.region_id, window_from: row.window_from, window_to: row.window_to, next_page: row.next_page, total_pages: row.total_pages, last_error: row.last_error }));
    const inProgressCheckpoints = syncStates.filter((row) => row.lock_until && Date.parse(row.lock_until) > nowMs);
    const latestPartial = partialResult.error ? null : partialResult.data;
    const counts = new Map<string, { region: string; cantidad: number }>();
    const rows = [...(regions.data ?? [])];
    for (
      let offset = rows.length;
      rows.length === offset && offset < 10_000;
      offset += 1000
    ) {
      const { data, error: pageError } = await db.from(
        "compra_agil_oportunidades",
      )
        .select("region").not("region", "is", null).range(offset, offset + 999);
      if (pageError) {
        return reply(
          { error: "No se pudo completar el resumen por región" },
          500,
        );
      }
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
    for (const row of rows) {
      const rawName = text(row.region, 100);
      const key = normalizeRegion(rawName);
      if (!key) continue;
      const name = officialRegionName(rawName);
      const count = counts.get(key);
      if (count) {
        count.cantidad++;
        if (name.length < count.region.length) count.region = name;
      } else counts.set(key, { region: name, cantidad: 1 });
    }
    return reply({
      oportunidades: allCount.count ?? 0,
      cierres_futuros_verificables: opportunityRows.filter((row) => dateStatus(row) === "abierta_confirmada").length,
      abiertas_confirmadas: opportunityRows.filter((row) => dateStatus(row) === "abierta_confirmada").length,
      cierres_futuros_pendientes_verificar: opportunityRows.filter((row) => dateStatus(row) === "cierre_futuro_pendiente_verificar").length,
      vencidas: opportunityRows.filter((row) => dateStatus(row) === "vencida").length,
      fecha_no_verificable: opportunityRows.filter((row) => dateStatus(row) === "no_verificable").length,
      vigencia_parcial: opportunityDates.parcial,
      ultima_sincronizacion_exitosa: latestSuccessAt,
      ultima_sincronizacion_prioritaria_exitosa: latestPrioritySuccess,
      ultima_ejecucion: executions.data?.[0] ?? null,
      ultimo_avance_parcial: latestPartial,
      checkpoints_disponibles: !syncStateResult.error,
      regiones_pendientes: pendingCheckpoints,
      prioridad_regiones_pendientes: priorityCheckpoints,
      prioridad_checkpoints_disponibles: !priorityStateResult.error,
      regiones_en_progreso: inProgressCheckpoints.map((row) => ({ region_id: row.region_id, lock_until: row.lock_until })),
      ejecucion_en_progreso: Boolean(inProgressCheckpoints.length || (executions.data?.[0]?.estado === "iniciada" && nowMs - Date.parse(String(executions.data[0].inicio)) < 5 * 60 * 1000)),
      paginas_pendientes: pendingCheckpoints.some((row) => row.total_pages == null) ? null : pendingCheckpoints.reduce((sum, row) => sum + Math.max(0, Number(row.total_pages) - Number(row.next_page) + 1), 0),
      sincronizacion_antigua: !latestSuccessAt || nowMs - Date.parse(String(latestSuccessAt)) > 24 * 60 * 60 * 1000,
      compras_por_region: [...counts.values()].sort((a, b) =>
        b.cantidad - a.cantidad
      ),
      regiones_parcial: rows.length >= 10_000,
      consultas_recientes: executions.data ?? [],
    });
  }

  if (input.consulta === "oportunidades") {
    const page =
      typeof input.pagina === "number" && Number.isInteger(input.pagina)
        ? input.pagina
        : 1;
    if (page < 1 || page > 10000) {
      return reply({ error: "Página fuera de rango" }, 400);
    }
    const region = text(input.region, 100);
    const from = text(input.desde, 10);
    const to = text(input.hasta, 10);
    const min = input.monto_minimo === "" || input.monto_minimo == null
      ? null
      : Number(input.monto_minimo);
    const max = input.monto_maximo === "" || input.monto_maximo == null
      ? null
      : Number(input.monto_maximo);
    const query = text(input.texto, 100).toLocaleLowerCase("es");
    const sortColumns: Record<string, string> = {
      fecha_publicacion: "fecha_publicacion",
      fecha_cierre: "fecha_cierre",
      monto_estimado: "monto_estimado",
      nombre: "nombre",
    };
    const sort = sortColumns[String(input.orden ?? "fecha_publicacion")] ??
      sortColumns.fecha_publicacion;
    const ascending = input.direccion === "asc";
    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return reply({ error: "Fecha inicial inválida" }, 400);
    }
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return reply({ error: "Fecha final inválida" }, 400);
    }
    if (from && to && from > to) return reply({ error: "El inicio del periodo debe ser anterior o igual al final" }, 400);
    let fromIso: string | null = null, toExclusiveIso: string | null = null;
    try {
      if (from) fromIso = santiagoDayStartIso(from);
      if (to) toExclusiveIso = santiagoDayAfterStartIso(to);
    } catch {
      return reply({ error: "La fecha seleccionada no existe en el calendario" }, 400);
    }
    if (
      (min !== null && (!Number.isFinite(min) || min < 0)) ||
      (max !== null && (!Number.isFinite(max) || max < 0)) ||
      (min !== null && max !== null && min > max)
    ) {
      return reply({ error: "Rango de monto inválido" }, 400);
    }

    const result = await readPages((start, end) => {
      let request = db.from("compra_agil_oportunidades")
        .select(
          "codigo, nombre, descripcion, organismo, region, monto_estimado, fecha_publicacion, fecha_cierre, estado, datos_originales, primera_deteccion, ultima_revision",
        )
        .order(sort, { ascending, nullsFirst: false })
        .order("codigo", { ascending: true });
      if (from) request = request.gte("fecha_publicacion", fromIso!);
      if (to) request = request.lt("fecha_publicacion", toExclusiveIso!);
      if (min !== null) request = request.gte("monto_estimado", min);
      if (max !== null) request = request.lte("monto_estimado", max);
      const safeQuery = query.replace(/[,*()%_\\]/g, " ").trim();
      if (safeQuery) {
        request = request.or(
          `codigo.ilike.%${safeQuery}%,nombre.ilike.%${safeQuery}%,organismo.ilike.%${safeQuery}%`,
        );
      }
      return request.range(start, end);
    });
    if (result.error) {
      return reply(
        { error: "No se pudieron consultar las oportunidades" },
        500,
      );
    }

    const currentTime = Date.now();
    const rows = filterRadarOpportunities(
      result.rows,
      region,
      input.solo_vigentes === true,
      currentTime,
    );
    const totalFiltrado = rows.length;
    const limit = 25;
    const items = rows.slice((page - 1) * limit, page * limit);
    return reply({
      items: items.map((row) => ({
        ...row,
        vigencia: classifyOpportunity(row, currentTime),
      })),
      total: totalFiltrado,
      pagina: page,
      por_pagina: limit,
      parcial: result.parcial,
    });
  }

  if (input.consulta === "detalle") {
    const codigo = text(input.codigo, 40);
    if (!/^\d+-\d+-COT\d{2}$/.test(codigo)) {
      return reply({ error: "Código de oportunidad inválido" }, 400);
    }
    const { data, error } = await db.from("compra_agil_detalles")
      .select("codigo, datos_detalle, fecha_consulta, fecha_actualizacion")
      .eq("codigo", codigo)
      .maybeSingle();
    if (error) return reply({ error: "No se pudo consultar el detalle" }, 500);
    if (!data) {
      return reply({
        detalle: null,
        mensaje: "Aún no hay detalle almacenado para esta oportunidad",
      });
    }
    return reply({ detalle: data });
  }

  if (input.consulta === "proveedores") {
    const query = text(input.texto, 100).toLocaleLowerCase("es");
    const requestedProvider = text(input.proveedor, 120).toLocaleLowerCase("es");
    // Las columnas de estas fuentes varían por catálogo; se leen páginas acotadas y se proyecta en memoria.
    const safeQuery = query.replace(/[,*()%_\\]/g, " ").trim();
    const providersResult = await readPages((start, end) => {
      let request = db.from("trovo_proveedores").select("id, clave").order(
        "clave",
      );
      return request.range(start, end);
    });
    const errors: string[] = [];
    if (providersResult.error) errors.push("proveedores");
    const providers = new Map<string, Record<string, unknown>>(
      providersResult.rows.map((row) => [String(row.id), row]),
    );
    const providerIds = providersResult.rows
      .filter((row) =>
        !requestedProvider ||
        text(row.clave, 120).toLocaleLowerCase("es") === requestedProvider
      )
      .map((row) => row.id);
    const productsResult = !requestedProvider || providerIds.length
      ? await readPages((start, end) => {
        let request = db.from("trovo_productos_proveedor").select("*").order(
          "id",
        );
        if (requestedProvider) {
          request = request.in("proveedor_id", providerIds);
        }
        if (safeQuery) {
          request = request.or(
            `codigo_proveedor.ilike.%${safeQuery}%,clave_articulo.ilike.%${safeQuery}%,nombre.ilike.%${safeQuery}%`,
          );
        }
        return request.range(start, end);
      })
      : { rows: [], error: false, parcial: false };
    const coneResult = await readPages((start, end) => {
        let request = db.from("trovo_cone_catalogo_revisado").select("*").order(
          "codigo_proveedor",
        );
        if (safeQuery) {
          request = request.or(
            `codigo_proveedor.ilike.%${safeQuery}%,nombre_producto.ilike.%${safeQuery}%,proveedor_clave.ilike.%${safeQuery}%`,
          );
        }
        return request.range(start, end);
      });
    if (productsResult.error) errors.push("productos");
    if (coneResult.error) errors.push("catalogo_cone");
    if (errors.length >= 3) {
      return reply({ error: "No se pudieron consultar los catálogos" }, 500);
    }

    const pricesByProduct = new Map<string, Record<string, unknown>[]>();
    let pricesParcial = false;
    const productIds = productsResult.rows.map((row) => row.id).filter((id) =>
      id != null
    );
    for (let offset = 0; offset < productIds.length; offset += 250) {
      const ids = productIds.slice(offset, offset + 250);
      const priceResult = await readPages((start, end) =>
        db.from("trovo_precios_proveedor").select("*").in("producto_id", ids)
          .order("producto_id").range(start, end)
      );
      if (priceResult.error) {
        if (!errors.includes("precios")) errors.push("precios");
        continue;
      }
      pricesParcial ||= priceResult.parcial;
      for (const raw of priceResult.rows) {
        if (raw.producto_id == null) continue;
        const key = String(raw.producto_id);
        pricesByProduct.set(key, [...(pricesByProduct.get(key) ?? []), raw]);
      }
    }
    const safeKeys = [
      "id",
      "clave",
      "codigo",
      "codigo_proveedor",
      "clave_articulo",
      "nombre",
      "descripcion",
      "marca",
      "estado_revision",
      "stock_proveedor",
      "precio_publicado_clp",
      "presentacion_precio",
      "cantidad_minima",
      "tratamiento_iva",
      "precio_confirmado",
      "observaciones",
      "unidad",
      "formato",
    ];
    type CatalogItem = {
      proveedor: string;
      codigo: string;
      producto: Record<string, unknown>;
      precios: Record<string, unknown>[];
      fuentes: Set<string>;
    };
    const grouped = new Map<string, CatalogItem>();
    const getItem = (provider: string, code: unknown, fallback: unknown) => {
      const displayCode = text(code, 100);
      const keyCode = normalizeCode(displayCode) || `id:${String(fallback)}`;
      const key = `${provider.toLocaleLowerCase("es")}\u0000${keyCode}`;
      let item = grouped.get(key);
      if (!item) {
        item = {
          proveedor: provider,
          codigo: displayCode,
          producto: {},
          precios: [],
          fuentes: new Set<string>(),
        };
        grouped.set(key, item);
      }
      return item;
    };
    const mergeProduct = (
      target: Record<string, unknown>,
      source: Record<string, unknown>,
      preferSource: boolean,
    ) => {
      for (const [key, value] of Object.entries(source)) {
        if (value === null || value === undefined || value === "") continue;
        if (
          preferSource || target[key] === null || target[key] === undefined ||
          target[key] === ""
        ) {
          target[key] = value;
        }
      }
    };
    for (const raw of productsResult.rows) {
      const provider = providers.get(String(raw.proveedor_id));
      const providerKey = text(provider?.clave, 40).toLocaleLowerCase("es");
      if (requestedProvider && providerKey !== requestedProvider) continue;
      const product = safeProjection(raw, safeKeys);
      const productPrices = (pricesByProduct.get(String(raw.id)) ?? []).map((
        price,
      ) => ({
        ...safeProjection(price, safeKeys),
        fuente_origen: "trovo_precios_proveedor",
      }));
      const item = getItem(
        providerKey || "Proveedor no identificado",
        raw.codigo_proveedor ?? raw.clave_articulo,
        raw.id,
      );
      mergeProduct(item.producto, product, false);
      item.fuentes.add("trovo_productos_proveedor");
      if (productPrices.length) item.fuentes.add("trovo_precios_proveedor");
      item.precios.push(...productPrices);
    }
    const coneKeys = [
      "proveedor_clave",
      "codigo_proveedor",
      "nombre_producto",
      "pagina_pdf",
      "precio_catalogo_iva",
      "costo_iva_verificado",
      "unidad_precio",
      "estado_validacion",
      "fecha_vigencia",
    ];
    for (const raw of coneResult.rows) {
      const row = safeProjection(raw, coneKeys);
      const providerKey = text(row.proveedor_clave, 40).toLocaleLowerCase("es");
      if (requestedProvider && ![providerKey, "cone"].includes(requestedProvider)) continue;
      const item = getItem(
        providerKey || "cone",
        row.codigo_proveedor,
        row.codigo_proveedor,
      );
      const mapped = {
        ...row,
        nombre: row.nombre_producto,
        estado_revision: row.estado_validacion,
        presentacion_precio: row.unidad_precio,
      };
      mergeProduct(item.producto, mapped, true);
      item.fuentes.add("trovo_cone_catalogo_revisado");
      if (
        row.precio_catalogo_iva !== null &&
        row.precio_catalogo_iva !== undefined
      ) {
        item.precios.push({
          precio_publicado_clp: row.precio_catalogo_iva,
          presentacion_precio: row.unidad_precio,
          estado_validacion: row.estado_validacion,
          fecha_vigencia: row.fecha_vigencia,
          fuente_origen: "trovo_cone_catalogo_revisado",
        });
      }
    }
    const needle = query.normalize("NFD").replace(/\p{M}/gu, "");
    const items = [...grouped.values()].filter((item) => {
      if (!needle) return true;
      const contents = JSON.stringify(item.producto).normalize("NFD")
        .replace(/\p{M}/gu, "").toLocaleLowerCase("es");
      return normalizeCode(item.codigo).includes(normalizeCode(query)) ||
        contents.includes(needle);
    }).map((item) => {
      const prices = [
        ...new Set(
          item.precios.map((price) => {
            const value = Number(price.precio_publicado_clp);
            return Number.isFinite(value) ? value : null;
          }).filter((value): value is number => value !== null),
        ),
      ];
      const conflicto = prices.length > 1;
      const reviewedValue = item.proveedor.toLocaleLowerCase("es") === "cone"
        ? item.producto.precio_catalogo_iva
        : null;
      const reviewed = reviewedValue == null || reviewedValue === ""
        ? Number.NaN
        : Number(reviewedValue);
      const candidate = Number.isFinite(reviewed)
        ? reviewed
        : prices[0] ?? null;
      return {
        proveedor: item.proveedor,
        codigo: item.codigo,
        producto: item.producto,
        precios: item.precios,
        fuentes: [...item.fuentes],
        conflicto_precios: conflicto,
        precio_publicado_con_iva: conflicto ? null : candidate,
        parcial: productsResult.parcial || coneResult.parcial || pricesParcial,
      };
    });
    return reply({
      items: items.slice(0, 300),
      proveedores: providersResult.rows.map((row) => ({ clave: text(row.clave, 120) })).filter((row) => row.clave),
      proveedores_parcial: providersResult.parcial,
      errores_fuentes: errors,
      parcial: productsResult.parcial || coneResult.parcial || pricesParcial ||
        items.length > 300,
    });
  }

  return reply({ error: "Consulta no válida" }, 400);
}));
