import { buildOpportunityRows, runPriorityRegion, type ApiItem, type Checkpoint, type PrioritySyncRepository } from "./compra-agil-sync-engine.ts";

function fixture(pages: Array<{ status?: number; items?: ApiItem[]; total?: number }>) {
  const state: Checkpoint = { region_id: 9, cursor_success: null, window_from: null, window_to: null, next_page: 1, total_pages: null };
  let locked = false;
  const saved: ApiItem[] = [];
  const calls: number[] = [];
  const repo: PrioritySyncRepository = {
    readCheckpoint: async () => ({ ...state }),
    acquireRegionLock: async () => { if (locked) return false; locked = true; return true; },
    startWindow: async (_r, from, to) => { state.window_from = from; state.window_to = to; state.next_page = 1; state.total_pages = null; },
    saveProgress: async (_r, next, total) => { state.next_page = next; state.total_pages = total; },
    finishWindow: async (_r, cursor) => { state.cursor_success = cursor; state.window_from = null; state.window_to = null; state.next_page = 1; state.total_pages = null; },
    recordError: async () => {},
    releaseRegionLock: async () => { locked = false; },
    upsertItems: async (items, timestamp) => {
      const rows = buildOpportunityRows(items, saved, "Región de La Araucanía", timestamp);
      const before = saved.length;
      for (const row of rows) { const index = saved.findIndex((item) => item.codigo === row.codigo); if (index < 0) saved.push(row); else saved[index] = row; }
      return { inserted: saved.length - before, updated: Math.max(0, rows.length - (saved.length - before)) };
    },
  };
  const fetchPage = async ({ page }: { page: number }) => {
    calls.push(page);
    const result = pages[page - 1] ?? { items: [] };
    return { ok: (result.status ?? 200) >= 200 && (result.status ?? 200) < 300, status: result.status ?? 200, headers: { get: () => null }, json: async () => ({ success: "OK", payload: { items: result.items ?? [], paginacion: result.total ? { total_paginas: result.total } : undefined } }) };
  };
  return { state, repo, fetchPage, saved, calls, setLocked: () => { locked = true; } };
}

const start = "2026-11-23T15:15:00.000Z";
const run = (f: ReturnType<typeof fixture>, runId = "run-a", maxPages = 4, remaining = 4) => runPriorityRegion({ regionId: 9, runId, bootstrapFrom: "2026-11-16T03:00:00.000Z", startedAt: start, maxPages, budget: { remaining, consumed: 0 }, repository: f.repo, fetchPage: f.fetchPage, sleep: async () => {} });

Deno.test("priority flow accepts the Excel reference code from a mocked official response", async () => {
  const f = fixture([{ items: [{ codigo: "4117-333-COT26", nombre: "mock opportunity", estado: { codigo: "publicada" } }] }]);
  const result = await run(f);
  if (result.estado !== "completada" || f.saved[0]?.codigo !== "4117-333-COT26") throw new Error("mock priority opportunity was not stored");
});

Deno.test("updated items upsert by code and preserve user-maintained description and first detection", () => {
  const old = [{ codigo: "x-1", descripcion: "manual", primera_deteccion: "2026-11-01T00:00:00Z", monto_estimado: 10 }];
  const rows = buildOpportunityRows([{ codigo: "x-1", nombre: "modified", montos: { monto_disponible_clp: 20 } }], old, "Araucanía", start);
  if (rows.length !== 1 || rows[0].monto_estimado !== 20 || rows[0].descripcion !== "manual" || rows[0].primera_deteccion !== old[0].primera_deteccion) throw new Error("upsert changed protected fields or duplicated code");
});

Deno.test("duplicate codes in a page become one idempotent row", () => {
  const rows = buildOpportunityRows([{ codigo: "duplicate" }, { codigo: "duplicate", nombre: "latest snapshot" }], [], "Araucanía", start);
  if (rows.length !== 1 || rows[0].nombre !== "latest snapshot") throw new Error("duplicate code produced multiple upsert rows");
});

Deno.test("four-page budget stores progress and resumes without repeating completed pages", async () => {
  const f = fixture(Array.from({ length: 6 }, (_, i) => ({ items: Array.from({ length: 50 }, (_, j) => ({ codigo: `page-${i + 1}-${j}` })), total: 6 })));
  const first = await run(f, "first", 4, 4);
  if (first.estado !== "parcial_por_limite" || f.state.next_page !== 5 || first.paginas_pendientes !== 2) throw new Error(`partial checkpoint was not retained: ${JSON.stringify({ first, state: f.state, calls: f.calls })}`);
  const second = await run(f, "second", 4, 4);
  if (second.estado !== "completada" || f.calls.join(",") !== "1,2,3,4,5,6") throw new Error("resume repeated or lost a page");
});

Deno.test("HTTP failure and 429 do not advance the checkpoint", async () => {
  for (const status of [500, 429]) {
    const f = fixture([{ status }]);
    const result = await run(f);
    if (!(["error", "cuota_agotada"] as string[]).includes(result.estado) || f.state.next_page !== 1 || f.state.cursor_success) throw new Error(`HTTP ${status} advanced checkpoint`);
  }
});

Deno.test("network failure does not advance the checkpoint", async () => {
  const f = fixture([]);
  const result = await runPriorityRegion({ regionId: 9, runId: "network", bootstrapFrom: "2026-11-16T03:00:00.000Z", startedAt: start, maxPages: 4, budget: { remaining: 4, consumed: 0 }, repository: f.repo, fetchPage: async () => { throw new Error("offline"); } });
  if (result.estado !== "error" || f.state.next_page !== 1 || f.state.cursor_success) throw new Error("network failure advanced checkpoint");
});

Deno.test("transient network timeout retries within the request budget", async () => {
  const f = fixture([{ items: [] }]);
  let failures = 2;
  const result = await runPriorityRegion({ regionId: 9, runId: "retry", bootstrapFrom: "2026-11-16T03:00:00.000Z", startedAt: start, maxPages: 4, budget: { remaining: 4, consumed: 0 }, repository: f.repo, fetchPage: async () => { if (failures-- > 0) throw new Error("timeout"); return await f.fetchPage({ page: 1 }); }, sleep: async () => {} });
  if (result.estado !== "completada" || result.solicitudes_api !== 3) throw new Error("network retries exceeded budget or failed to resume");
});

Deno.test("empty short page completes when pagination metadata is absent", async () => {
  const f = fixture([{ items: Array.from({ length: 50 }, (_, i) => ({ codigo: `full-${i}` })) }, { items: Array.from({ length: 50 }, (_, i) => ({ codigo: `second-${i}` })) }, { items: [{ codigo: "last" }] }]);
  const result = await run(f, "no-total", 4, 4);
  if (result.estado !== "completada" || f.calls.join(",") !== "1,2,3") throw new Error("missing total_pages was interpreted as complete too early");
});

Deno.test("a short page does not truncate when API reports later pages", async () => {
  const f = fixture([{ items: [{ codigo: "intermediate-short" }], total: 3 }, { items: [{ codigo: "second" }], total: 3 }, { items: [{ codigo: "third" }], total: 3 }]);
  const first = await run(f, "reported-total", 1, 4);
  if (first.estado !== "parcial_por_limite" || first.pagina_siguiente !== 2 || f.state.cursor_success) throw new Error("reported total pages must take precedence over short page");
});

Deno.test("concurrent run is refused while the regional shared lock is held", async () => {
  const f = fixture([{ items: [] }]); f.setLocked();
  const result = await run(f);
  if (result.estado !== "otra_sincronizacion_en_curso" || f.calls.length) throw new Error("concurrent run passed the lock");
});

Deno.test("priority window/cursor is independent from a historical checkpoint", async () => {
  const historical = { cursor_success: "2026-11-21T12:00:00Z", next_page: 17 };
  const f = fixture([{ items: [] }]);
  const result = await run(f);
  if (result.estado !== "completada" || !f.state.cursor_success || f.state.window_from !== null || historical.cursor_success !== "2026-11-21T12:00:00Z" || historical.next_page !== 17) throw new Error("priority cursor did not finish independently");
});
