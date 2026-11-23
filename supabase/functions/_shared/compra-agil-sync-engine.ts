export const SYNC_PAGE_SIZE = 50;
export const SYNC_MAX_PAGES_PER_RUN = 4;
export const SYNC_MAX_RETRIES = 2;
const LOCK_MS = 5 * 60_000;
const RETRY_LIMIT_MS = 10_000;
const OVERLAP_MS = 5 * 60_000;
export const DEFAULT_PRIORITY_BOOTSTRAP_HOURS = 48;
export const MAX_PRIORITY_BOOTSTRAP_HOURS = 168;

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
export type PageCommit = {
  regionId: number;
  runId: string;
  page: number;
  totalPages: number | null;
  complete: boolean;
  windowTo: string;
  items: ApiItem[];
};

export interface PrioritySyncRepository {
  readCheckpoint(regionId: number): Promise<Checkpoint | null>;
  acquireRegionLock(regionId: number, runId: string, nowIso: string, lockUntilIso: string): Promise<boolean>;
  assertRegionLock(regionId: number, runId: string, nowIso: string, lockUntilIso: string): Promise<boolean>;
  startWindow(regionId: number, from: string, to: string, runId: string, timestamp: string): Promise<void>;
  commitPage(input: PageCommit): Promise<{ inserted: number; updated: number; observed?: number }>;
  recordError(regionId: number, error: string | null, timestamp: string): Promise<void>;
  releaseRegionLock(regionId: number, runId: string): Promise<void>;
}

export function uniqueApiItems(items: ApiItem[]): ApiItem[] {
  const byCode = new Map<string, ApiItem>();
  for (const item of items) {
    if (typeof item.codigo !== "string" || !item.codigo.trim()) continue;
    byCode.set(item.codigo.trim(), { ...item, codigo: item.codigo.trim() });
  }
  return [...byCode.values()];
}

export function sourceModifiedAt(item: unknown): number | null {
  if (!isRecord(item)) return null;
  const dates = isRecord(item.fechas) ? item.fechas : {};
  const value = dates.fecha_ultimo_cambio;
  return typeof value === "string" && /(Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value))
    ? Date.parse(value)
    : null;
}

/**
 * Parses API date fields without treating a timezone-less timestamp as UTC.
 * Explicit offsets remain authoritative; naive ISO datetimes are interpreted
 * as Chilean civil time. DST gaps are rejected and repeated times choose the
 * later instant (standard-time side), matching PostgreSQL's AT TIME ZONE.
 * Date-only and undocumented shapes remain unverifiable.
 */
export function parseSourceDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  if (/[T ]\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const normalized = /[+-]\d{4}$/.test(text) ? text.replace(/([+-]\d{2})(\d{2})$/, "$1:$2") : text;
    const instant = Date.parse(normalized);
    return Number.isFinite(instant) ? new Date(instant).toISOString() : null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?$/.exec(text);
  if (!match) return null;
  const [, ys, mos, ds, hs, mis, ss = "0", fraction = ""] = match;
  const parts = [Number(ys), Number(mos), Number(ds), Number(hs), Number(mis), Number(ss)];
  const [year, month, day, hour, minute, second] = parts;
  const millisecond = Number((fraction + "000").slice(0, 3));
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const desired = new Date(wallAsUtc);
  if (desired.getUTCFullYear() !== year || desired.getUTCMonth() + 1 !== month || desired.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const candidates = new Set<number>();
  for (const seed of [wallAsUtc - 6 * 3_600_000, wallAsUtc, wallAsUtc + 6 * 3_600_000]) {
    let candidate = seed;
    for (let attempt = 0; attempt < 4; attempt++) {
      const fields = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map(({ type, value }) => [type, Number(value)]));
      const localAsUtc = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second, millisecond);
      candidate += wallAsUtc - localAsUtc;
    }
    const fields = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map(({ type, value }) => [type, Number(value)]));
    if (fields.year === year && fields.month === month && fields.day === day && fields.hour === hour && fields.minute === minute && fields.second === second) candidates.add(candidate);
  }
  const latest = [...candidates].sort((a, b) => b - a)[0];
  return latest === undefined ? null : new Date(latest).toISOString();
}

function mergeIncomplete(existing: unknown, incoming: unknown): unknown {
  if (incoming === null || incoming === undefined) return existing;
  if (isRecord(existing) && isRecord(incoming)) {
    const merged: Record<string, unknown> = { ...existing };
    for (const [key, value] of Object.entries(incoming)) {
      merged[key] = value === null || value === undefined
        ? existing[key]
        : mergeIncomplete(existing[key], value);
    }
    return merged;
  }
  return incoming;
}

export function buildOpportunityRows(
  items: ApiItem[],
  existingRows: ApiItem[],
  region: string,
  timestamp: string,
  source: "priority" | "historical" = "priority",
) {
  const prior = new Map(existingRows.flatMap((row) => typeof row.codigo === "string" ? [[row.codigo, row] as const] : []));
  return uniqueApiItems(items).flatMap((item) => {
    const code = String(item.codigo);
    const old = prior.get(code) ?? {};
    const sourceModified = sourceModifiedAt(item);
    const oldSourceModified = sourceModifiedAt(old.datos_originales);
    // Compare only source timestamps. Fetch time is never a proxy for version
    // order; if either source timestamp is absent, preserve the existing row.
    if (old.codigo && source === "historical" && (
      sourceModified === null ||
      oldSourceModified === null ||
      sourceModified < oldSourceModified
    )) return [];
    if (old.codigo && source === "priority" && (
      sourceModified === null || oldSourceModified === null || sourceModified < oldSourceModified
    )) return [];
    const state = isRecord(item.estado) ? item.estado : {};
    const institution = isRecord(item.institucion) ? item.institucion : {};
    const amounts = isRecord(item.montos) ? item.montos : {};
    const dates = isRecord(item.fechas) ? item.fechas : {};
    const validDate = (value: unknown, fallback: unknown) => parseSourceDate(value) ?? fallback ?? null;
    return [{
      codigo: code,
      nombre: typeof item.nombre === "string" && item.nombre.trim() ? item.nombre : old.nombre ?? null,
      descripcion: old.descripcion ?? null,
      estado: typeof state.codigo === "string" ? state.codigo : old.estado ?? null,
      organismo: typeof institution.organismo_comprador === "string" ? institution.organismo_comprador : old.organismo ?? null,
      region: region || old.region || null,
      monto_estimado: typeof amounts.monto_disponible_clp === "number" && Number.isFinite(amounts.monto_disponible_clp) ? amounts.monto_disponible_clp : old.monto_estimado ?? null,
      fecha_publicacion: validDate(dates.fecha_publicacion, old.fecha_publicacion),
      fecha_cierre: validDate(dates.fecha_cierre, old.fecha_cierre),
      datos_originales: mergeIncomplete(old.datos_originales, item),
      primera_deteccion: old.primera_deteccion ?? timestamp,
      ultima_revision: timestamp,
    }];
  });
}

export async function runPriorityRegion(options: {
  regionId: number;
  runId: string;
  bootstrapFrom: string | null;
  bootstrapWindowHours?: number | null;
  startedAt: string;
  maxPages: number;
  budget: RequestBudget;
  repository: PrioritySyncRepository;
  fetchPage: (params: { regionId: number; from: string; to: string; page: number; pageSize: number }) => Promise<ApiPageResponse>;
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
}) {
  const { regionId, runId, repository, budget } = options;
  const requestsAtStart = budget.consumed;
  const empty = { region: regionId, estado: "error", paginas_consultadas: 0, oportunidades_encontradas: 0, nuevas: 0, actualizadas: 0, paginas_pendientes: 0, continuable: false };
  const clock = options.clock ?? Date.now;
  const initial = await repository.readCheckpoint(regionId);
  if (!initial) return { ...empty, error: "No existe checkpoint prioritario para la región; aplique la migración revisada" };

  const nowIso = new Date(clock()).toISOString();
  const acquired = await repository.acquireRegionLock(
    regionId,
    runId,
    nowIso,
    new Date(clock() + LOCK_MS).toISOString(),
  );
  if (!acquired) return { ...empty, estado: "otra_sincronizacion_en_curso" };

  let found = 0, inserted = 0, updated = 0, successfulPages = 0;
  let state: Checkpoint | null = null;
  let failure: string | null = null;
  let quotaExhausted = false;
  let complete = false;
  let windowFrom: string | null = null;
  let windowTo: string | null = null;
  let page = 1;
  let totalPages: number | null = null;

  try {
    const assertLock = async () => {
      const now = new Date(clock()).toISOString();
      const until = new Date(clock() + LOCK_MS).toISOString();
      if (!await repository.assertRegionLock(regionId, runId, now, until)) {
        throw new Error("Se perdió el bloqueo regional; se detuvo la ejecución sin guardar cambios");
      }
    };
    await assertLock();
    state = await repository.readCheckpoint(regionId);
    windowFrom = state?.window_from ?? null;
    windowTo = state?.window_to ?? null;
    page = Number(state?.next_page || 1);
    totalPages = state?.total_pages == null ? null : Number(state.total_pages);
    if (!state) throw new Error("No se pudo volver a leer el checkpoint prioritario");
    if ((windowFrom === null) !== (windowTo === null)) throw new Error("El checkpoint prioritario tiene una ventana incompleta");
    if (!windowFrom || !windowTo) {
      let proposedFrom = state.cursor_success
        ? new Date(Date.parse(state.cursor_success) - OVERLAP_MS).toISOString()
        : options.bootstrapFrom;
      if (!state.cursor_success && !proposedFrom && options.bootstrapWindowHours != null) {
        const hours = options.bootstrapWindowHours;
        if (!Number.isInteger(hours) || hours < 1 || hours > MAX_PRIORITY_BOOTSTRAP_HOURS) {
          throw new Error(`La ventana inicial debe ser un número entero de 1 a ${MAX_PRIORITY_BOOTSTRAP_HOURS} horas`);
        }
        proposedFrom = new Date(Date.parse(options.startedAt) - hours * 60 * 60_000).toISOString();
      }
      if (!proposedFrom || !Number.isFinite(Date.parse(proposedFrom))) {
        await repository.recordError(regionId, "Primera sincronización prioritaria: indique cambio_desde ISO-8601", nowIso);
        failure = "Indique desde qué fecha iniciar la consulta prioritaria";
      } else {
        await assertLock();
        windowFrom = new Date(proposedFrom).toISOString();
        windowTo = options.startedAt;
        page = 1;
        totalPages = null;
        await repository.startWindow(regionId, windowFrom, windowTo, runId, nowIso);
      }
    }

    while (!failure && budget.remaining > 0 && successfulPages < options.maxPages && !complete) {
      if (!windowFrom || !windowTo) { failure = "El checkpoint no contiene una ventana válida"; break; }
      await assertLock();
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
      const pagination = body.payload.paginacion;
      const reportedPages = isRecord(pagination) ? pagination.total_paginas : null;
      const hasReportedTotal = Number.isInteger(reportedPages) && Number(reportedPages) > 0;
      totalPages = hasReportedTotal
        ? Number(reportedPages)
        : items.length < SYNC_PAGE_SIZE ? page : totalPages;
      complete = totalPages !== null ? page >= totalPages : items.length < SYNC_PAGE_SIZE;
      await assertLock();
      const committed = await repository.commitPage({
        regionId, runId, page, totalPages, complete, windowTo, items: uniqueItems,
      });
      inserted += committed.inserted;
      updated += committed.updated;
      successfulPages++;
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
