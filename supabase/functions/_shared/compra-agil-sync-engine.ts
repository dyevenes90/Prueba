export const SYNC_PAGE_SIZE = 50;
export const SYNC_MAX_PAGES_PER_RUN = 4;
export const SYNC_MAX_RETRIES = 2;
const LOCK_MS = 5 * 60_000;
const RETRY_LIMIT_MS = 10_000;
const OVERLAP_MS = 5 * 60_000;

export type Checkpoint = {
  region_id: number;
  cursor_success: string | null;
  window_from: string | null;
  window_to: string | null;
  next_page: number;
  total_pages: number | null;
  last_attempt_at?: string | null;
};

export type ApiItem = Record<string, unknown> & { codigo?: unknown };
export type ApiPageResponse = {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
};
export type RequestBudget = { remaining: number; consumed: number };

export interface PrioritySyncRepository {
  readCheckpoint(regionId: number): Promise<Checkpoint | null>;
  acquireRegionLock(regionId: number, runId: string, nowIso: string, lockUntilIso: string): Promise<boolean>;
  startWindow(regionId: number, from: string, to: string, runId: string, timestamp: string): Promise<void>;
  saveProgress(regionId: number, nextPage: number, totalPages: number | null, runId: string, timestamp: string): Promise<void>;
  finishWindow(regionId: number, cursorSuccess: string, runId: string, timestamp: string): Promise<void>;
  recordError(regionId: number, error: string | null, timestamp: string): Promise<void>;
  releaseRegionLock(regionId: number, runId: string): Promise<void>;
  upsertItems(items: ApiItem[], timestamp: string): Promise<{ inserted: number; updated: number }>;
}

export function uniqueApiItems(items: ApiItem[]): ApiItem[] {
  const byCode = new Map<string, ApiItem>();
  for (const item of items) {
    if (typeof item.codigo !== "string" || !item.codigo.trim()) continue;
    byCode.set(item.codigo.trim(), { ...item, codigo: item.codigo.trim() });
  }
  return [...byCode.values()];
}

export function buildOpportunityRows(items: ApiItem[], existingRows: ApiItem[], region: string, timestamp: string) {
  const prior = new Map(existingRows.flatMap((row) => typeof row.codigo === "string" ? [[row.codigo, row] as const] : []));
  return uniqueApiItems(items).map((item) => {
    const code = String(item.codigo);
    const old = prior.get(code) ?? {};
    const state = isRecord(item.estado) ? item.estado : {};
    const institution = isRecord(item.institucion) ? item.institucion : {};
    const amounts = isRecord(item.montos) ? item.montos : {};
    const dates = isRecord(item.fechas) ? item.fechas : {};
    const validDate = (value: unknown, fallback: unknown) =>
      typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : fallback ?? null;
    return {
      codigo: code,
      nombre: typeof item.nombre === "string" ? item.nombre : null,
      descripcion: old.descripcion ?? null,
      estado: typeof state.codigo === "string" ? state.codigo : old.estado ?? null,
      organismo: typeof institution.organismo_comprador === "string" ? institution.organismo_comprador : old.organismo ?? null,
      region: region,
      monto_estimado: typeof amounts.monto_disponible_clp === "number" && Number.isFinite(amounts.monto_disponible_clp) ? amounts.monto_disponible_clp : old.monto_estimado ?? null,
      fecha_publicacion: validDate(dates.fecha_publicacion, old.fecha_publicacion),
      fecha_cierre: validDate(dates.fecha_cierre, old.fecha_cierre),
      datos_originales: item,
      primera_deteccion: old.primera_deteccion ?? timestamp,
      ultima_revision: timestamp,
    };
  });
}

export async function runPriorityRegion(options: {
  regionId: number;
  runId: string;
  bootstrapFrom: string | null;
  startedAt: string;
  maxPages: number;
  budget: RequestBudget;
  repository: PrioritySyncRepository;
  fetchPage: (params: { regionId: number; from: string; to: string; page: number; pageSize: number }) => Promise<ApiPageResponse>;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { regionId, runId, repository, budget } = options;
  const requestsAtStart = budget.consumed;
  const empty = { region: regionId, estado: "error", paginas_consultadas: 0, oportunidades_encontradas: 0, nuevas: 0, actualizadas: 0, paginas_pendientes: 0, continuable: false };
  const initial = await repository.readCheckpoint(regionId);
  if (!initial) return { ...empty, error: "No existe checkpoint prioritario para la región; aplique la migración revisada" };

  const startedMs = Date.parse(options.startedAt);
  const nowIso = options.startedAt;
  const acquired = await repository.acquireRegionLock(
    regionId,
    runId,
    nowIso,
    new Date(startedMs + LOCK_MS).toISOString(),
  );
  if (!acquired) return { ...empty, estado: "otra_sincronizacion_en_curso" };

  let found = 0, inserted = 0, updated = 0, successfulPages = 0;
  let state: Checkpoint | null;
  try {
    state = await repository.readCheckpoint(regionId);
  } catch (error) {
    await repository.releaseRegionLock(regionId, runId);
    throw error;
  }
  let failure: string | null = null;
  let quotaExhausted = false;
  let complete = false;
  let windowFrom = state?.window_from ?? null;
  let windowTo = state?.window_to ?? null;
  let page = Number(state?.next_page || 1);
  let totalPages = state?.total_pages == null ? null : Number(state.total_pages);

  try {
    if (!state) throw new Error("No se pudo volver a leer el checkpoint prioritario");
    if ((windowFrom === null) !== (windowTo === null)) throw new Error("El checkpoint prioritario tiene una ventana incompleta");
    if (!windowFrom || !windowTo) {
      const proposedFrom = state.cursor_success
        ? new Date(Date.parse(state.cursor_success) - OVERLAP_MS).toISOString()
        : options.bootstrapFrom;
      if (!proposedFrom || !Number.isFinite(Date.parse(proposedFrom))) {
        await repository.recordError(regionId, "Primera sincronización prioritaria: indique cambio_desde ISO-8601", nowIso);
        failure = "Indique desde qué fecha iniciar la consulta prioritaria";
      } else {
        windowFrom = new Date(proposedFrom).toISOString();
        windowTo = options.startedAt;
        page = 1;
        totalPages = null;
        await repository.startWindow(regionId, windowFrom, windowTo, runId, nowIso);
      }
    }

    while (!failure && budget.remaining > 0 && successfulPages < options.maxPages && !complete) {
      if (!windowFrom || !windowTo) { failure = "El checkpoint no contiene una ventana válida"; break; }
      let response: ApiPageResponse | null = null;
      let lastRequestError: string | null = null;
      for (let retry = 0; retry <= SYNC_MAX_RETRIES && budget.remaining > 0; retry++) {
        budget.remaining--;
        budget.consumed++;
        try {
          response = await options.fetchPage({
            regionId,
            from: windowFrom,
            to: windowTo,
            page,
            pageSize: SYNC_PAGE_SIZE,
          });
        } catch {
          lastRequestError = "No hubo respuesta de ChileCompra; checkpoint sin avanzar";
          if (retry >= SYNC_MAX_RETRIES || budget.remaining <= 0) break;
          const delay = 1000 * (retry + 1);
          if (delay > RETRY_LIMIT_MS) break;
          await (options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(delay);
          continue;
        }
        if (response.ok || response.status === 429 || ![502, 503, 504].includes(response.status) || retry === SYNC_MAX_RETRIES) break;
        const retryAfter = response.headers?.get("Retry-After") ?? "";
        const seconds = Number(retryAfter);
        const date = Date.parse(retryAfter);
        const delay = Number.isFinite(seconds) && seconds > 0
          ? seconds * 1000
          : Number.isFinite(date) && date > Date.now()
          ? date - Date.now()
          : 1000 * (retry + 1);
        if (delay > RETRY_LIMIT_MS || budget.remaining <= 0) break;
        await (options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(delay);
      }
      if (!response?.ok) {
        quotaExhausted = response?.status === 429;
        if (quotaExhausted) budget.remaining = 0;
        failure = quotaExhausted
          ? "Cuota diaria de ChileCompra agotada; cursor sin avanzar"
          : lastRequestError ?? `ChileCompra respondió HTTP ${response?.status ?? "sin respuesta"}; cursor sin avanzar`;
        break;
      }

      const body: unknown = await response.json();
      if (!isRecord(body) || body.success !== "OK" || !isRecord(body.payload) || !Array.isArray(body.payload.items)) {
        throw new Error("Respuesta inválida de Compra Ágil v2; checkpoint sin avanzar");
      }
      const items = body.payload.items as ApiItem[];
      if (items.length > SYNC_PAGE_SIZE) throw new Error("La API excedió el tamaño de página; checkpoint sin avanzar");
      found += items.length;
      const uniqueItems = uniqueApiItems(items);
      const counts = await repository.upsertItems(uniqueItems, new Date().toISOString());
      inserted += counts.inserted;
      updated += counts.updated;
      successfulPages++;

      const pagination = body.payload.paginacion;
      const reportedPages = isRecord(pagination) ? pagination.total_paginas : null;
      const hasReportedTotal = Number.isInteger(reportedPages) && Number(reportedPages) > 0;
      totalPages = hasReportedTotal
        ? Number(reportedPages)
        : items.length < SYNC_PAGE_SIZE ? page : totalPages;
      complete = totalPages !== null ? page >= totalPages : items.length < SYNC_PAGE_SIZE;
      const timestamp = new Date().toISOString();
      if (complete) {
        await repository.finishWindow(regionId, windowTo, runId, timestamp);
      } else {
        await repository.saveProgress(regionId, page + 1, totalPages, runId, timestamp);
      }
      page++;
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : "Error durante la sincronización";
  } finally {
    try {
      await repository.recordError(regionId, failure ?? (!complete ? "Límite de páginas por ejecución; checkpoint conservado" : null), new Date().toISOString());
    } catch (error) {
      failure ??= error instanceof Error ? error.message : "No se pudo registrar el resultado del checkpoint";
    }
    try {
      await repository.releaseRegionLock(regionId, runId);
    } catch (error) {
      failure ??= error instanceof Error ? error.message : "No se pudo liberar el bloqueo; expirará automáticamente";
    }
  }

  const stateLabel = failure
    ? failure.startsWith("Indique desde") ? "requiere_fecha_inicial" : quotaExhausted ? "cuota_agotada" : "error"
    : complete ? "completada" : "parcial_por_limite";
  const pagesPending = complete ? 0 : totalPages === null ? null : Math.max(0, totalPages - page + 1);
  return {
    region: regionId,
    estado: stateLabel,
    paginas_consultadas: successfulPages,
    solicitudes_api: budget.consumed - requestsAtStart,
    oportunidades_encontradas: found,
    nuevas: inserted,
    actualizadas: updated,
    cambio_desde: windowFrom,
    cambio_hasta: windowTo,
    pagina_siguiente: complete ? 1 : page,
    total_paginas: totalPages,
    paginas_pendientes: pagesPending,
    error: failure,
    continuable: !complete,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
