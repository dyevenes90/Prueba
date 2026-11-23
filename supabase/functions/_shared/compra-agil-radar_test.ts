import {
  classifyOpportunity,
  filterRadarOpportunities,
  normalizeRegionKey,
  santiagoDayAfterStartIso,
  santiagoDayStartIso,
} from "./compra-agil-radar.ts";

const now = Date.parse("2026-11-23T15:15:00.000Z");
const future = "2026-11-24T12:00:00-03:00";

Deno.test("diagnostic counts separate confirmed and stale future closures", () => {
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => ({
      codigo: `confirmada-${i}`,
      region: "Región de Los Ríos",
      estado: "publicada",
      fecha_cierre: future,
      ultima_revision: "2026-11-23T15:00:00.000Z",
    })),
    ...Array.from({ length: 7 }, (_, i) => ({
      codigo: `pendiente-${i}`,
      region: "La Araucanía",
      estado: "publicada",
      fecha_cierre: future,
      ultima_revision: "2026-11-21T15:00:00.000Z",
    })),
  ];
  const visible = filterRadarOpportunities(rows, "", true, now);
  const confirmed = visible.filter((row) => classifyOpportunity(row, now) === "abierta_confirmada");
  const pending = visible.filter((row) => classifyOpportunity(row, now) === "cierre_futuro_pendiente_verificar");
  if (visible.length !== 13 || confirmed.length !== 6 || pending.length !== 7) {
    throw new Error(`Expected 13 total (6 confirmed, 7 pending); got ${visible.length} (${confirmed.length}, ${pending.length})`);
  }
});

Deno.test("region aliases match Araucanía and Los Ríos, all regions do not filter", () => {
  const rows = [
    { region: "Región de La Araucanía", fecha_cierre: future, estado: "publicada", ultima_revision: "2026-11-23T15:00:00.000Z" },
    { region: "Los Ríos", fecha_cierre: future, estado: "publicada", ultima_revision: "2026-11-23T15:00:00.000Z" },
  ];
  if (normalizeRegionKey("Araucanía") !== normalizeRegionKey("Región de La Araucanía")) throw new Error("Araucanía alias mismatch");
  if (filterRadarOpportunities(rows, "Araucanía", false, now).length !== 1) throw new Error("Araucanía filter lost its result");
  if (filterRadarOpportunities(rows, "Los Ríos", false, now).length !== 1) throw new Error("Los Ríos filter lost its result");
  if (filterRadarOpportunities(rows, "", false, now).length !== 2) throw new Error("All regions unexpectedly filtered rows");
});

Deno.test("historical mode retains expired and unverifiable rows; future-only pages after filtering", () => {
  const rows = [
    { codigo: "past", region: "Los Ríos", fecha_cierre: "2026-11-20T12:00:00-03:00", estado: "publicada" },
    { codigo: "future-a", region: "Los Ríos", fecha_cierre: future, estado: "publicada", ultima_revision: "2026-11-21T15:00:00.000Z" },
    { codigo: "unknown", region: "Los Ríos", fecha_cierre: "sin zona" },
    { codigo: "future-b", region: "La Araucanía", fecha_cierre: future, estado: "publicada", ultima_revision: "2026-11-23T15:00:00.000Z" },
    { codigo: "future-terminal", region: "Los Ríos", fecha_cierre: future, estado: "cancelada", ultima_revision: "2026-11-23T15:00:00.000Z" },
  ];
  if (filterRadarOpportunities(rows, "", false, now).length !== 5) throw new Error("Historical mode dropped stored rows");
  const futureRows = filterRadarOpportunities(rows, "", true, now);
  if (futureRows.length !== 2 || futureRows[0].codigo !== "future-a" || futureRows[1].codigo !== "future-b") {
    throw new Error("Future filter/pagination input is inconsistent");
  }
});

Deno.test("publication-date boundaries use the America/Santiago calendar", () => {
  if (santiagoDayStartIso("2026-11-23") !== "2026-11-23T03:00:00.000Z") throw new Error("November start must use Chile summer time");
  if (santiagoDayAfterStartIso("2026-11-23") !== "2026-11-24T03:00:00.000Z") throw new Error("November end must stop at next Chile midnight");
  if (santiagoDayStartIso("2026-04-06") !== "2026-04-06T04:00:00.000Z") throw new Error("April start must use Chile standard time");
});

Deno.test("filtered radar pagination keeps all rows without overlap", () => {
  const rows = Array.from({ length: 31 }, (_, i) => ({
    codigo: `page-${String(i).padStart(2, "0")}`,
    region: i % 2 ? "Región de Los Ríos" : "Región de La Araucanía",
    fecha_cierre: future,
    estado: "publicada",
    ultima_revision: i < 6 ? "2026-11-23T15:00:00.000Z" : "2026-11-21T15:00:00.000Z",
  }));
  const filtered = filterRadarOpportunities(rows, "", true, now);
  const page1 = filtered.slice(0, 25), page2 = filtered.slice(25, 50);
  const codes = [...page1, ...page2].map((row) => row.codigo);
  if (filtered.length !== 31 || page1.length !== 25 || page2.length !== 6 || new Set(codes).size !== 31) {
    throw new Error("Filtered radar pages lost or duplicated results");
  }
});
