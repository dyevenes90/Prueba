import { buildOpportunityRows, runPriorityRegion, type ApiItem, type Checkpoint, type PrioritySyncRepository, type RequestBudget } from "./compra-agil-sync-engine.ts";

type Db = any;
const MAX_REQUESTS = 4;
const REGIONS: Record<number, string> = { 9: "Región de La Araucanía", 14: "Región de Los Ríos" };

export async function runPrioritySync(options: { db: Db; ticket: string; regions: number[]; bootstrapFrom: string | null; bootstrapWindowHours?: number | null; scheduled: boolean }) {
  const { db, ticket, bootstrapFrom, scheduled } = options;
  const regions = scheduled ? [9, 14] : [...new Set(options.regions)];
  if (!regions.length || regions.length > 2 || regions.some((id) => !REGIONS[id])) {
    return { error: "El flujo prioritario admite Araucanía (9) y Los Ríos (14), hasta dos regiones" };
  }
  const budget: RequestBudget = { remaining: MAX_REQUESTS, consumed: 0 };
  const runId = crypto.randomUUID();
  const summaries: Record<string, unknown>[] = [];
  for (const regionId of regions) {
    if (budget.remaining <= 0) {
      summaries.push({ region: regionId, nombre: REGIONS[regionId], estado: "pendiente_por_limite", paginas_consultadas: 0, continuable: true });
      continue;
    }
    const startedAt = new Date().toISOString();
    const stateResult = await db.from("compra_agil_sync_priority_state")
      .select("region_id, cursor_success, window_from, window_to, next_page, total_pages, last_attempt_at")
      .eq("region_id", regionId).maybeSingle();
    if (stateResult.error || !stateResult.data) return { error: "Falta aplicar y verificar la migración de checkpoints prioritarios" };

    // Shared mutex guarantees one writer per region across priority and historic flows.
    const lockResult = await db.from("compra_agil_sync_state")
      .update({ lock_until: new Date(Date.parse(startedAt) + 5 * 60_000).toISOString(), lock_token: runId, updated_at: startedAt })
      .eq("region_id", regionId).lte("lock_until", startedAt).select("region_id").maybeSingle();
    if (lockResult.error || !lockResult.data) {
      summaries.push({ region: regionId, nombre: REGIONS[regionId], estado: "otra_sincronizacion_en_curso", paginas_consultadas: 0 });
      continue;
    }
    const execution = await db.from("compra_agil_ejecuciones").insert({ estado: "iniciada" }).select("id").single();
    if (execution.error || !execution.data) {
      await db.from("compra_agil_sync_state").update({ lock_until: new Date(0).toISOString(), lock_token: null }).eq("region_id", regionId).eq("lock_token", runId);
      return { error: "No se pudo registrar la ejecución prioritaria" };
    }

    const assertLease = async (timestamp: string) => {
      const until = new Date(Date.parse(timestamp) + 5 * 60_000).toISOString();
      const lease = await db.from("compra_agil_sync_state").update({ lock_until: until, updated_at: timestamp })
        .eq("region_id", regionId).eq("lock_token", runId).gt("lock_until", timestamp)
        .select("region_id").maybeSingle();
      return !lease.error && Boolean(lease.data);
    };
    const assertOwnedLease = async (timestamp: string) => {
      if (!await assertLease(timestamp)) return false;
      const owner = await db.from("compra_agil_sync_priority_state")
        .select("lock_token").eq("region_id", regionId).maybeSingle();
      return !owner.error && owner.data?.lock_token === runId;
    };

    const repository: PrioritySyncRepository = {
      readCheckpoint: async () => {
        const result = await db.from("compra_agil_sync_priority_state").select("region_id, cursor_success, window_from, window_to, next_page, total_pages, last_attempt_at").eq("region_id", regionId).single();
        if (result.error || !result.data) throw new Error("No se pudo leer el checkpoint prioritario");
        return result.data as Checkpoint;
      },
      acquireRegionLock: async (_id, ownerRunId, timestamp) => {
        if (!await assertLease(timestamp)) return false;
        const claim = await db.from("compra_agil_sync_priority_state")
          .update({ lock_token: ownerRunId, updated_at: timestamp })
          .eq("region_id", regionId).select("region_id").maybeSingle();
        return !claim.error && Boolean(claim.data);
      },
      assertRegionLock: async (_id, ownerRunId, timestamp) => {
        return ownerRunId === runId && await assertOwnedLease(timestamp);
      },
      startWindow: async (_id, from, to, _run, timestamp) => {
        if (!await assertLease(timestamp)) throw new Error("Se perdió el bloqueo regional antes de iniciar la ventana");
        const result = await db.from("compra_agil_sync_priority_state").update({ window_from: from, window_to: to, next_page: 1, total_pages: null, last_attempt_at: timestamp, last_error: null, updated_at: timestamp }).eq("region_id", regionId).eq("lock_token", runId).is("window_from", null).is("window_to", null).select("region_id").maybeSingle();
        if (result.error || !result.data) throw new Error("No se pudo guardar la ventana prioritaria");
      },
      saveProgress: async (_id, next, total, _run, timestamp) => {
        if (!await assertLease(timestamp)) throw new Error("Se perdió el bloqueo regional; el checkpoint no avanzó");
        const progress = await db.from("compra_agil_sync_priority_state").update({ next_page: next, total_pages: total, last_attempt_at: timestamp, updated_at: timestamp }).eq("region_id", regionId).eq("lock_token", runId).select("region_id").maybeSingle();
        if (progress.error || !progress.data) throw new Error("No se pudo guardar el checkpoint prioritario con el bloqueo vigente");
      },
      finishWindow: async (_id, cursor, _run, timestamp) => {
        if (!await assertLease(timestamp)) throw new Error("Se perdió el bloqueo regional; el cursor exitoso no avanzó");
        const finish = await db.from("compra_agil_sync_priority_state").update({ cursor_success: cursor, window_from: null, window_to: null, next_page: 1, total_pages: null, last_success_at: timestamp, last_attempt_at: timestamp, last_error: null, updated_at: timestamp }).eq("region_id", regionId).eq("lock_token", runId).select("region_id").maybeSingle();
        if (finish.error || !finish.data) throw new Error("No se pudo confirmar la ventana prioritaria con el bloqueo vigente");
      },
      recordError: async (_id, error, timestamp) => {
        if (!await assertLease(timestamp)) return;
        await db.from("compra_agil_sync_priority_state").update({ last_attempt_at: timestamp, last_error: error, updated_at: timestamp }).eq("region_id", regionId).eq("lock_token", runId);
      },
      releaseRegionLock: async () => {
        await db.from("compra_agil_sync_priority_state").update({ lock_token: null, updated_at: new Date().toISOString() }).eq("region_id", regionId).eq("lock_token", runId);
        await db.from("compra_agil_sync_state").update({ lock_until: new Date(0).toISOString(), lock_token: null, updated_at: new Date().toISOString() }).eq("region_id", regionId).eq("lock_token", runId);
      },
      upsertItems: async (items: ApiItem[], timestamp) => {
        if (!await assertOwnedLease(timestamp)) throw new Error("Se perdió el bloqueo regional antes de guardar oportunidades");
        const unique = new Map(items.flatMap((item) => typeof item.codigo === "string" && item.codigo.trim() ? [[item.codigo.trim(), item] as const] : []));
        const codes = [...unique.keys()];
        const existingResult = codes.length ? await db.from("compra_agil_oportunidades").select("codigo, nombre, descripcion, primera_deteccion, ultima_revision, datos_originales, estado, organismo, region, monto_estimado, fecha_publicacion, fecha_cierre").in("codigo", codes) : { data: [], error: null };
        if (existingResult.error) throw new Error("No se pudieron revisar las oportunidades existentes");
        const existing = existingResult.data ?? [];
        const rows = buildOpportunityRows([...unique.values()], existing, REGIONS[regionId], timestamp, "priority");
        if (rows.length) {
          if (!await assertOwnedLease(new Date().toISOString())) throw new Error("Se perdió el bloqueo regional antes de confirmar oportunidades");
          const saved = await db.from("compra_agil_oportunidades").upsert(rows, { onConflict: "codigo" });
          if (saved.error) throw new Error("No se pudieron guardar oportunidades de forma idempotente");
        }
        return {
          inserted: rows.filter((row) => !existing.some((prior: Record<string, unknown>) => prior.codigo === row.codigo)).length,
          updated: rows.filter((row) => existing.some((prior: Record<string, unknown>) => prior.codigo === row.codigo)).length,
        };
      },
    };
    let result: Awaited<ReturnType<typeof runPriorityRegion>>;
    try {
      result = await runPriorityRegion({
        regionId, runId, bootstrapFrom, bootstrapWindowHours: scheduled ? options.bootstrapWindowHours ?? 48 : null, startedAt, maxPages: Math.max(1, Math.floor(MAX_REQUESTS / regions.length)), budget, repository,
        fetchPage: async ({ regionId: id, from, to, page, pageSize }) => {
          const url = new URL("https://api2.mercadopublico.cl/v2/compra-agil");
          url.searchParams.set("region", String(id)); url.searchParams.set("cambio_desde", from); url.searchParams.set("cambio_hasta", to);
          url.searchParams.set("tamano_pagina", String(pageSize)); url.searchParams.set("numero_pagina", String(page)); url.searchParams.set("ordenar_por", "FechaUltimaModificacion");
          return await fetch(url, { method: "GET", headers: { ticket, Accept: "application/json" }, signal: AbortSignal.timeout(25_000) });
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error durante la sincronización prioritaria";
      await repository.releaseRegionLock(regionId, runId);
      await db.from("compra_agil_ejecuciones").update({ estado: "error", termino: new Date().toISOString(), error_detalle: message }).eq("id", execution.data.id);
      summaries.push({ region: regionId, nombre: REGIONS[regionId], estado: "error", paginas_consultadas: 0, error: message });
      continue;
    }
    summaries.push({ ...result, nombre: REGIONS[regionId] });
    await db.from("compra_agil_ejecuciones").update({ estado: result.estado, termino: new Date().toISOString(), oportunidades_encontradas: result.oportunidades_encontradas, oportunidades_nuevas: result.nuevas, error_detalle: result.error ?? (result.estado === "parcial_por_limite" ? "Límite por ejecución; checkpoint prioritario conservado" : null) }).eq("id", execution.data.id);
  }
  return { sincronizacion: "prioritaria", regiones: summaries, solicitudes_maximas_por_ejecucion: MAX_REQUESTS, cuota_agotada: summaries.some((row) => row.estado === "cuota_agotada") };
}
