import { buildOpportunityRows, parseSourceDate, runPriorityRegion, type ApiItem, type Checkpoint, type PrioritySyncRepository } from "./compra-agil-sync-engine.ts";

function fixture(pages: Array<{ status?: number; items?: ApiItem[]; total?: number }>) {
  const state: Checkpoint = { region_id: 9, cursor_success: null, window_from: null, window_to: null, next_page: 1, total_pages: null };
  let lockOwner: string | null = null;
  let lockUntil = 0;
  let validatedOwner: string | null = null;
  const clock = { value: Date.now() };
  const saved: ApiItem[] = [];
  const calls: number[] = [];
  const requests: Array<{ from: string; to: string; page: number }> = [];
  const commits: number[] = [];
  let failCommit = false;
  const repo: PrioritySyncRepository = {
    readCheckpoint: async () => ({ ...state }),
    acquireRegionLock: async (_r, runId, now, until) => {
      if (lockOwner && lockUntil > Date.parse(now)) return false;
      lockOwner = runId; lockUntil = Date.parse(until); validatedOwner = null; return true;
    },
    assertRegionLock: async (_r, runId, now, until) => {
      if (lockOwner !== runId || lockUntil <= Date.parse(now)) return false;
      lockUntil = Date.parse(until); validatedOwner = runId; return true;
    },
    startWindow: async (_r, from, to, runId, timestamp) => { if (lockOwner !== runId || lockUntil <= Date.parse(timestamp)) throw new Error("not owner"); state.window_from = from; state.window_to = to; state.next_page = 1; state.total_pages = null; },
    commitPage: async (input) => {
      if (lockOwner !== input.runId || validatedOwner !== input.runId || lockUntil <= clock.value) throw new Error("not owner or expired lease");
      commits.push(input.page);
      const rows = buildOpportunityRows(input.items, saved, "Araucania", new Date(clock.value).toISOString(), "priority");
      const nextSaved = saved.map((item) => ({ ...item }));
      let inserted = 0, updated = 0;
      for (const row of rows) {
        const index = nextSaved.findIndex((item) => item.codigo === row.codigo);
        if (index < 0) { nextSaved.push(row); inserted++; }
        else { nextSaved[index] = row; updated++; }
      }
      if (failCommit) throw new Error("simulated transaction failure before commit");
      saved.splice(0, saved.length, ...nextSaved);
      state.total_pages = input.complete ? null : input.totalPages;
      state.next_page = input.complete ? 1 : input.page + 1;
      if (input.complete) {
        state.cursor_success = input.windowTo;
        state.window_from = null;
        state.window_to = null;
      }
      return { inserted, updated };
    },
    recordError: async () => {},
    releaseRegionLock: async (_r, runId) => { if (lockOwner === runId) { lockOwner = null; lockUntil = 0; validatedOwner = null; } },
  };
  const fetchPage = async ({ page, from, to }: { page: number; from: string; to: string; pageSize?: number; regionId?: number }) => {
    calls.push(page);
    requests.push({ from, to, page });
    const result = pages[page - 1] ?? { items: [] };
    return { ok: (result.status ?? 200) >= 200 && (result.status ?? 200) < 300, status: result.status ?? 200, headers: { get: () => null }, json: async () => ({ success: "OK", payload: { items: result.items ?? [], paginacion: result.total ? { total_paginas: result.total } : undefined } }) };
  };
  return { state, repo, fetchPage, saved, calls, requests, commits, clock, failCommit: () => { failCommit = true; }, setLocked: () => { lockOwner = "other"; lockUntil = clock.value + 60_000; } };
}

const start = "2026-11-23T15:15:00.000Z";

Deno.test("source dates preserve explicit offsets and interpret naive values in Santiago across DST", () => {
  const cases: Array<[unknown, string | null]> = [
    ["2026-11-17 16:28", "2026-11-17T19:28:00.000Z"],
    ["2026-07-17T16:28", "2026-07-17T20:28:00.000Z"],
    ["2026-11-17T16:28:00-03:00", "2026-11-17T19:28:00.000Z"],
    ["2026-11-17 16:28:00-0300", "2026-11-17T19:28:00.000Z"],
    ["2026-11-17T19:28:00Z", "2026-11-17T19:28:00.000Z"],
    ["2026-11-17", null],
  ];
  for (const [input, expected] of cases) {
    const actual = parseSourceDate(input);
    if (actual !== expected) throw new Error(`${String(input)} parsed as ${actual}; expected ${expected}`);
  }
});
const run = (f: ReturnType<typeof fixture>, runId = "run-a", maxPages = 4, remaining = 4, bootstrapFrom: string | null = "2026-11-16T03:00:00.000Z", bootstrapWindowHours: number | null = null, startedAt = start) => runPriorityRegion({ regionId: 9, runId, bootstrapFrom, bootstrapWindowHours, startedAt, maxPages, budget: { remaining, consumed: 0 }, repository: f.repo, fetchPage: f.fetchPage, sleep: async () => {}, clock: () => f.clock.value });

Deno.test("priority flow accepts the Excel reference code from a mocked official response", async () => {
  const f = fixture([{ items: [{ codigo: "4117-333-COT26", nombre: "mock opportunity", estado: { codigo: "publicada" } }] }]);
  const result = await run(f);
  if (result.estado !== "completada" || f.saved[0]?.codigo !== "4117-333-COT26" || f.state.cursor_success !== start || f.state.window_to !== null) throw new Error("mock page and checkpoint were not committed together");
});

Deno.test("updated items upsert by code and preserve user-maintained description and first detection", () => {
  const old = [{ codigo: "x-1", descripcion: "manual", primera_deteccion: "2026-11-01T00:00:00Z", monto_estimado: 10, datos_originales: { fechas: { fecha_ultimo_cambio: "2026-11-20T00:00:00Z" } } }];
  const rows = buildOpportunityRows([{ codigo: "x-1", nombre: "modified", fechas: { fecha_ultimo_cambio: "2026-11-21T00:00:00Z" }, montos: { monto_disponible_clp: 20 } }], old, "Araucanía", start);
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
  const savedFrom = f.requests[0].from, savedTo = f.requests[0].to;
  const second = await run(f, "second", 4, 4, "2026-11-23T00:00:00.000Z", 1);
  if (second.estado !== "completada" || f.calls.join(",") !== "1,2,3,4,5,6" || f.requests[4].from !== savedFrom || f.requests[4].to !== savedTo || f.requests[4].page !== 5) throw new Error("resume repeated, reset its window, or lost a page");
});

Deno.test("scheduled first run uses a configurable 48-hour window", async () => {
  const f = fixture([{ items: [] }]);
  const result = await run(f, "bootstrap", 4, 4, null, 48);
  const expectedFrom = new Date(Date.parse(start) - 48 * 60 * 60_000).toISOString();
  if (result.estado !== "completada" || f.requests[0]?.from !== expectedFrom || f.requests[0]?.to !== start) throw new Error("scheduled bootstrap window was not created from the configured lookback");
});

Deno.test("an existing successful cursor takes precedence over bootstrap configuration", async () => {
  const f = fixture([{ items: [] }]);
  f.state.cursor_success = "2026-11-23T14:00:00.000Z";
  const result = await run(f, "existing-cursor", 4, 4, "2026-11-01T00:00:00.000Z", 48);
  if (result.estado !== "completada" || f.requests[0]?.from !== "2026-11-23T13:55:00.000Z") throw new Error("bootstrap reset an existing successful cursor");
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
  const result = await runPriorityRegion({ regionId: 9, runId: "retry", bootstrapFrom: "2026-11-16T03:00:00.000Z", startedAt: start, maxPages: 4, budget: { remaining: 4, consumed: 0 }, repository: f.repo, fetchPage: async () => { if (failures-- > 0) throw new Error("timeout"); return await f.fetchPage({ page: 1, from: start, to: start }); }, sleep: async () => {}, clock: () => f.clock.value });
  if (result.estado !== "completada" || result.solicitudes_api !== 3) throw new Error("network retries exceeded budget or failed to resume");
});

Deno.test("page data and checkpoint roll back together when the transaction fails", async () => {
  const f = fixture([{ items: [{ codigo: "atomic-code" }], total: 2 }]);
  f.failCommit();
  const result = await run(f, "atomic-fail", 1, 4);
  if (result.estado !== "error" || f.saved.length || f.state.next_page !== 1 || f.state.cursor_success || f.commits.length !== 1) {
    throw new Error("failed page commit left opportunity data or checkpoint changes behind");
  }
});

Deno.test("only one simultaneous writer can commit a regional page", async () => {
  const f = fixture([{ items: [{ codigo: "single-writer" }] }]);
  let release!: (value: Awaited<ReturnType<typeof f.fetchPage>>) => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => { started = resolve; });
  const first = runPriorityRegion({
    regionId: 9, runId: "writer-one", bootstrapFrom: "2026-11-16T03:00:00.000Z", startedAt: start,
    maxPages: 1, budget: { remaining: 1, consumed: 0 }, repository: f.repo,
    fetchPage: async () => { started(); return await new Promise((resolve) => { release = resolve; }); },
    sleep: async () => {}, clock: () => f.clock.value,
  });
  await waiting;
  const second = await run(f, "writer-two", 1, 1);
  if (second.estado !== "otra_sincronizacion_en_curso") throw new Error("second simultaneous writer acquired the live regional lease");
  release(await f.fetchPage({ page: 1, from: start, to: start }));
  const firstResult = await first;
  if (firstResult.estado !== "completada" || f.commits.length !== 1 || f.saved.length !== 1) throw new Error("concurrent writers produced duplicate or missing commits");
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

Deno.test("expired first owner cannot write after a second run acquires the lease", async () => {
  const f = fixture([{ items: [{ codigo: "current-owner" }] }]);
  let markFetchStarted!: () => void;
  let releaseOldResponse!: (value: Awaited<ReturnType<typeof f.fetchPage>>) => void;
  const fetchStarted = new Promise<void>((resolve) => { markFetchStarted = resolve; });
  const oldRun = runPriorityRegion({
    regionId: 9, runId: "old-owner", bootstrapFrom: "2026-11-16T03:00:00.000Z", startedAt: start,
    maxPages: 4, budget: { remaining: 4, consumed: 0 }, repository: f.repo,
    fetchPage: async () => { markFetchStarted(); return await new Promise((resolve) => { releaseOldResponse = resolve; }); },
    sleep: async () => {}, clock: () => f.clock.value,
  });
  await fetchStarted;
  f.clock.value += 6 * 60_000;
  const newStartedAt = new Date(f.clock.value).toISOString();
  const newRun = await run(f, "new-owner", 4, 4, null, 48, newStartedAt);
  if (newRun.estado !== "completada" || f.saved.length !== 1 || f.saved[0].codigo !== "current-owner") throw new Error("second owner failed to finish while holding the new lease");
  const finishedCursor = f.state.cursor_success;
  releaseOldResponse(await f.fetchPage({ page: 1, from: start, to: start }));
  const oldResult = await oldRun;
  if (oldResult.estado !== "error" || f.saved.length !== 1 || f.state.cursor_success !== finishedCursor) throw new Error("expired owner wrote opportunities or changed the current checkpoint");
});

Deno.test("historical older source data cannot replace a priority snapshot", () => {
  const priority = buildOpportunityRows([{
    codigo: "shared-code", nombre: "Newest name", estado: { codigo: "publicada" },
    fechas: { fecha_ultimo_cambio: "2026-11-23T15:14:00.000Z", fecha_cierre: "2026-11-25T18:00:00.000Z" },
    montos: { monto_disponible_clp: 500 },
  }], [], "Araucanía", "2026-11-23T15:15:00.000Z", "priority");
  const historical = buildOpportunityRows([{
    codigo: "shared-code", nombre: "Older name", estado: { codigo: "publicada" },
    fechas: { fecha_ultimo_cambio: "2026-11-22T15:14:00.000Z" },
    montos: { monto_disponible_clp: 100 },
  }], priority, "Araucanía", "2026-11-23T16:00:00.000Z", "historical");
  if (historical.length !== 0 || priority[0].nombre !== "Newest name" || priority[0].monto_estimado !== 500 || priority[0].ultima_revision !== "2026-11-23T15:15:00.000Z") throw new Error("historical response overwrote a newer priority snapshot");
});

Deno.test("newer source revisions merge incomplete fields and keep source/query times distinct", () => {
  const old = [{
    codigo: "merge-code", nombre: "Existing name", descripcion: "manual", primera_deteccion: "2026-11-20T00:00:00.000Z",
    ultima_revision: "2026-11-23T15:00:00.000Z", monto_estimado: 500, fecha_cierre: "2026-11-25T18:00:00.000Z",
    datos_originales: { fechas: { fecha_ultimo_cambio: "2026-11-23T14:00:00.000Z", fecha_cierre: "2026-11-25T18:00:00.000Z" }, montos: { monto_disponible_clp: 500 }, detail: { keep: "value" } },
  }];
  const rows = buildOpportunityRows([{
    codigo: "merge-code", nombre: "", fechas: { fecha_ultimo_cambio: "2026-11-23T15:30:00.000Z" },
    detail: { add: "value" },
  }], old, "Araucanía", "2026-11-23T15:31:00.000Z", "priority");
  if (rows.length !== 1 || rows[0].nombre !== "Existing name" || rows[0].monto_estimado !== 500 || rows[0].fecha_cierre !== old[0].fecha_cierre || rows[0].descripcion !== "manual" || rows[0].primera_deteccion !== old[0].primera_deteccion || rows[0].ultima_revision !== "2026-11-23T15:31:00.000Z") throw new Error("incomplete response erased existing values or query time was lost");
  const original = rows[0].datos_originales as Record<string, unknown>;
  const detail = original.detail as Record<string, unknown>;
  const dates = original.fechas as Record<string, unknown>;
  if (detail.keep !== "value" || detail.add !== "value" || dates.fecha_ultimo_cambio !== "2026-11-23T15:30:00.000Z") throw new Error("source fields were not recursively preserved/merged");
});

Deno.test("an official update newer than the stored source timestamp is accepted", () => {
  const old = [{ codigo: "newer-code", nombre: "Old official name", monto_estimado: 100, datos_originales: { fechas: { fecha_ultimo_cambio: "2026-11-22T10:00:00Z" } } }];
  const rows = buildOpportunityRows([{ codigo: "newer-code", nombre: "New official name", fechas: { fecha_ultimo_cambio: "2026-11-23T10:00:00Z" } }], old, "Araucanía", start, "priority");
  if (rows.length !== 1 || rows[0].nombre !== "New official name") throw new Error("newer official source update was not accepted");
});

Deno.test("missing source modification time preserves existing data despite later fetch time", () => {
  const old = [{ codigo: "unknown-date", nombre: "Known stored value", ultima_revision: "2020-01-01T00:00:00Z", datos_originales: { fechas: { fecha_ultimo_cambio: "2026-11-23T12:00:00Z" } } }];
  const rows = buildOpportunityRows([{ codigo: "unknown-date", nombre: "Unversioned response" }], old, "Araucanía", "2030-01-01T00:00:00Z", "historical");
  if (rows.length) throw new Error("query time was incorrectly used to accept an unversioned official response");
});
