export type RadarVigencia =
  | "abierta_confirmada"
  | "cierre_futuro_pendiente_verificar"
  | "estado_no_confirmado"
  | "vencida"
  | "no_verificable";

const REGION_ALIASES: Record<string, string> = {
  "la araucania": "araucania",
  araucania: "araucania",
  "los rios": "los rios",
  "region de los rios": "los rios",
  "region del libertador general bernardo o'higgins": "ohiggins",
  "libertador general bernardo o'higgins": "ohiggins",
  "o'higgins": "ohiggins",
  ohiggins: "ohiggins",
  "aysen del general carlos ibanez del campo": "aysen",
  "magallanes y la antartica": "magallanes",
  "magallanes y de la antartica chilena": "magallanes",
  "metropolitana de santiago": "metropolitana",
  santiago: "metropolitana",
};

export function normalizeRegionKey(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/^region\s+(de|del)\s+/u, "")
    .replace(/\s+/g, " ")
    .trim();
  return REGION_ALIASES[normalized] ?? normalized;
}

function santiagoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function santiagoDayStartIso(dateValue: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) throw new Error("Fecha local inválida");
  const [year, month, day] = match.slice(1).map(Number);
  const target = Date.UTC(year, month - 1, day);
  const check = new Date(target);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) {
    throw new Error("Fecha local inválida");
  }
  const localAsUtc = (instant: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const values = Object.fromEntries(
      parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
    );
    return Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  };
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const delta = target - localAsUtc(new Date(guess));
    if (!delta) break;
    guess += delta;
  }
  if (santiagoDate(new Date(guess)) !== dateValue) {
    let first: number | null = null;
    for (let instant = guess - 6 * 60 * 60_000; instant <= guess + 6 * 60 * 60_000; instant += 15 * 60_000) {
      if (santiagoDate(new Date(instant)) === dateValue) {
        first = instant;
        break;
      }
    }
    if (first === null) throw new Error("No se pudo resolver el día de America/Santiago");
    first = Math.floor(first / 60_000) * 60_000;
    for (let instant = first - 15 * 60_000; instant <= first; instant += 60_000) {
      if (santiagoDate(new Date(instant)) === dateValue) {
        first = instant;
        break;
      }
    }
    guess = first;
  }
  return new Date(guess).toISOString();
}

export function santiagoDayAfterStartIso(dateValue: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) throw new Error("Fecha local inválida");
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1));
  return santiagoDayStartIso(next.toISOString().slice(0, 10));
}

function officialState(row: Record<string, unknown>): string {
  const original = row.datos_originales;
  const originalState = typeof original === "object" && original !== null && !Array.isArray(original)
    ? (original as Record<string, unknown>).estado
    : null;
  const originalCode = typeof originalState === "object" && originalState !== null && !Array.isArray(originalState)
    ? (originalState as Record<string, unknown>).codigo
    : null;
  const state = typeof row.estado === "string" && row.estado.trim()
    ? row.estado
    : typeof originalCode === "string" ? originalCode : "";
  return state.trim().toLocaleLowerCase("es");
}

export function classifyOpportunity(
  row: Record<string, unknown>,
  nowMs = Date.now(),
): RadarVigencia {
  const closing = row.fecha_cierre;
  if (typeof closing !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(closing)) {
    return "no_verificable";
  }
  const closingMs = Date.parse(closing);
  if (!Number.isFinite(closingMs)) return "no_verificable";
  if (closingMs <= nowMs) return "vencida";

  const state = officialState(row);
  if (state && state !== "publicada") return "estado_no_confirmado";
  const checkedMs = typeof row.ultima_revision === "string"
    ? Date.parse(row.ultima_revision)
    : NaN;
  const recentlyChecked = Number.isFinite(checkedMs) &&
    checkedMs <= nowMs + 30_000 && nowMs - checkedMs <= 24 * 60 * 60 * 1000;
  return state === "publicada" && recentlyChecked
    ? "abierta_confirmada"
    : "cierre_futuro_pendiente_verificar";
}

export function filterRadarOpportunities<T extends Record<string, unknown>>(
  rows: T[],
  region: unknown,
  onlyFutureClosures: boolean,
  nowMs = Date.now(),
): T[] {
  const regionKey = normalizeRegionKey(region);
  return rows.filter((row) => {
    if (regionKey && normalizeRegionKey(row.region) !== regionKey) return false;
    if (!onlyFutureClosures) return true;
    const status = classifyOpportunity(row, nowMs);
    return status === "abierta_confirmada" ||
      status === "cierre_futuro_pendiente_verificar";
  });
}
