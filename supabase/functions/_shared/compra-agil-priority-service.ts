import { formatChangeWindowForApi, runPriorityRegion, type ApiDateMode, type Checkpoint, type PageCommit, type PrioritySyncRepository, type RequestBudget } from "./compra-agil-sync-engine.ts";

type Db = any;
const MAX_REQUESTS = 4;
export const MANUAL_ONE_PAGE_REQUEST_LIMIT = 1;
const REGIONS: Record<number, string> = { 9: "Región de La Araucanía", 14: "Región de Los Ríos" };

export function getPriorityRunLimits(regionCount: number, onePageManual = false, scheduled = false) {
  if (onePageManual && scheduled) throw new Error("La prueba manual de una página no admite ejecución programada");
  if (onePageManual) return { requests: MANUAL_ONE_PAGE_REQUEST_LIMIT, pagesPerRegion: 1 };
  return { requests: MAX_REQUESTS, pagesPerRegion: Math.max(1, Math.floor(MAX_REQUESTS / Math.max(1, regionCount))) };
}

export function priorityCheckpointHasSuccessfulPage(checkpoint: Pick<Checkpoint, "cursor_success" | "window_from" | "window_to" | "next_page"> | null | undefined) {
  if (!checkpoint) return false;
  return Boolean(checkpoint.cursor_success) || Boolean(checkpoint.window_from && checkpoint.window_to && Number(checkpoint.next_page) > 1);
}

export async function runPrioritySync(options: { db: Db; ticket: string; regions: number[]; bootstrapFrom: string | null; bootstrapWindowHours?: number | null; scheduled: boolean; onePageManual?: boolean; dateMode?: ApiDateMode; fetchPage?: (url: URL, ticket: string) => Promise<Response> }) {
  const { db, ticket, bootstrapFrom, scheduled } = options;
  const onePageManual = options.onePageManual === true;
  if (onePageManual && scheduled) return { error: "La prueba manual de una página no admite ejecución programada" };
  const regions = onePageManual ? [9] : scheduled ? [9, 14] : [...new Set(options.regions)];
  if (!regions.length || regions.length > 2 || regions.some((id) => !REGIONS[id])) {
    return { error: "El flujo prioritario admite Araucanía (9) y Los Ríos (14), hasta dos regiones" };
  }
  const limits = getPriorityRunLimits(regions.length, onePageManual, scheduled);
  const budget: RequestBudget = { remaining: limits.requests, consumed: 0 };
  const runId = crypto.randomUUID();
  const summaries: Record<string, unknown>[] = [];
  for (const regionId of regions) {
    if (budget.remaining <= 0) {
      summaries.push({ region: regionId, nombre: REGIONS[regionId], estado: "pendiente_por_limite", paginas_consultadas: 0, continuable: true });
      continue;
    }
    const startedAt = new Date().toISOString();
    const stateResult = await db.from("compra_agil_sync_priority_state")
      .select("region_id, cursor_success, window_from, window_to, next_page, total_pages, last_attempt_at, date_mode")
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
        const result = await db.from("compra_agil_sync_priority_state").select("region_id, cursor_success, window_from, window_to, next_page, total_pages, last_attempt_at, date_mode").eq("region_id", regionId).single();
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
      startWindow: async (_id, from, to, _run, timestamp, dateMode) => {
        if (!await assertLease(timestamp)) throw new Error("Se perdió el bloqueo regional antes de iniciar la ventana");
        const result = await db.from("compra_agil_sync_priority_state").update({ window_from: from, window_to: to, date_mode: dateMode, next_page: 1, total_pages: null, last_attempt_at: timestamp, last_error: null, updated_at: timestamp }).eq("region_id", regionId).eq("lock_token", runId).is("window_from", null).is("window_to", null).select("region_id").maybeSingle();
        if (result.error || !result.data) throw new Error("No se pudo guardar la ventana prioritaria");
      },
      commitPage: async (input: PageCommit) => {
        const { data, error } = await db.rpc("compra_agil_sync_commit_page_with_mode", {
          p_flow: "priority",
          p_region_id: input.regionId,
          p_run_token: input.runId,
          p_page: input.page,
          p_total_pages: input.totalPages,
          p_complete: input.complete,
          p_window_to: input.windowTo,
          p_items: input.items,
          p_date_mode: input.dateMode,
        });
        if (error || !data || !Number.isInteger(data.inserted) || !Number.isInteger(data.updated)) {
          throw new Error("La operación transaccional del flujo prioritario falló; datos y checkpoint no se confirmaron");
        }
        return { inserted: data.inserted, updated: data.updated, observed: data.observed };
      },
      recordError: async (_id, error, timestamp) => {
        if (!await assertLease(timestamp)) return;
        await db.from("compra_agil_sync_priority_state").update({ last_attempt_at: timestamp, last_error: error, updated_at: timestamp }).eq("region_id", regionId).eq("lock_token", runId);
      },
      releaseRegionLock: async () => {
        await db.from("compra_agil_sync_priority_state").update({ lock_token: null, updated_at: new Date().toISOString() }).eq("region_id", regionId).eq("lock_token", runId);
        await db.from("compra_agil_sync_state").update({ lock_until: new Date(0).toISOString(), lock_token: null, updated_at: new Date().toISOString() }).eq("region_id", regionId).eq("lock_token", runId);
      },
    };
    let result: Awaited<ReturnType<typeof runPriorityRegion>>;
    try {
      result = await runPriorityRegion({
        regionId, runId, bootstrapFrom, bootstrapWindowHours: scheduled || onePageManual ? options.bootstrapWindowHours ?? 48 : null, dateMode: options.dateMode, startedAt, maxPages: limits.pagesPerRegion, budget, repository,
        fetchPage: async ({ regionId: id, from, to, page, pageSize }) => {
          const url = new URL("https://api2.mercadopublico.cl/v2/compra-agil");
          url.searchParams.set("region", String(id)); url.searchParams.set("cambio_desde", formatChangeWindowForApi(from, options.dateMode)); url.searchParams.set("cambio_hasta", formatChangeWindowForApi(to, options.dateMode));
          url.searchParams.set("tamano_pagina", String(pageSize)); url.searchParams.set("numero_pagina", String(page)); url.searchParams.set("ordenar_por", "FechaUltimaModificacion");
          return await (options.fetchPage ?? ((target, secret) => fetch(target, { method: "GET", headers: { ticket: secret, Accept: "application/json" }, signal: AbortSignal.timeout(25_000) })))(url, ticket);
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error durante la sincronización prioritaria";
      await repository.releaseRegionLock(regionId, runId);
      await db.from("compra_agil_ejecuciones").update({ estado: "error", termino: new Date().toISOString(), error_detalle: message }).eq("id", execution.data.id);
      summaries.push({ region: regionId, nombre: REGIONS[regionId], estado: "error", paginas_consultadas: 0, error: message });
      continue;
    }
    let checkpointFinal: Record<string, unknown> | null = null;
    try {
      const checkpoint = await repository.readCheckpoint(regionId);
      if (checkpoint) checkpointFinal = {
        cursor_success: checkpoint.cursor_success,
        window_from: checkpoint.window_from,
        window_to: checkpoint.window_to,
        next_page: checkpoint.next_page,
        total_pages: checkpoint.total_pages,
        date_mode: checkpoint.date_mode ?? "strict_utc",
      };
    } catch { /* Summary remains useful if checkpoint readback fails. */ }
    summaries.push({ ...result, nombre: REGIONS[regionId], checkpoint_final: checkpointFinal });
    await db.from("compra_agil_ejecuciones").update({ estado: result.estado, termino: new Date().toISOString(), oportunidades_encontradas: result.oportunidades_encontradas, oportunidades_nuevas: result.nuevas, error_detalle: result.error ?? (result.estado === "parcial_por_limite" ? "Límite por ejecución; checkpoint prioritario conservado" : null) }).eq("id", execution.data.id);
  }
  return { sincronizacion: onePageManual ? "prueba_prioritaria_una_pagina" : "prioritaria", regiones: summaries, solicitudes_maximas_por_ejecucion: limits.requests, paginas_maximas_por_region: limits.pagesPerRegion, cuota_agotada: summaries.some((row) => row.estado === "cuota_agotada") };
}
