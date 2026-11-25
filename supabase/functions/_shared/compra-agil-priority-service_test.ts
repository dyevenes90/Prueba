import { getPriorityRunLimits, MANUAL_ONE_PAGE_REQUEST_LIMIT, priorityCheckpointHasSuccessfulPage } from "./compra-agil-priority-service.ts";

Deno.test("manual one-page priority action has exactly one request and one page regardless of requested regions", () => {
  const limits = getPriorityRunLimits(2, true, false);
  if (limits.requests !== 1 || limits.requests !== MANUAL_ONE_PAGE_REQUEST_LIMIT || limits.pagesPerRegion !== 1) {
    throw new Error("manual action can exceed one request or page");
  }
});

Deno.test("one-page manual limits cannot be combined with scheduled execution", () => {
  let rejected = false;
  try { getPriorityRunLimits(1, true, true); } catch { rejected = true; }
  if (!rejected) throw new Error("manual one-page action accepted Cron/scheduled mode");
});

Deno.test("ordinary priority budget and pagination remain unchanged", () => {
  const limits = getPriorityRunLimits(2, false, false);
  if (limits.requests !== 4 || limits.pagesPerRegion !== 2) throw new Error("regular priority sync limits changed");
});

Deno.test("regular manual priority sync stays blocked until the one-page proof has committed", () => {
  if (priorityCheckpointHasSuccessfulPage(null)) throw new Error("missing checkpoint was treated as tested");
  if (priorityCheckpointHasSuccessfulPage({ cursor_success: null, window_from: "2026-11-23T00:00:00Z", window_to: "2026-11-24T00:00:00Z", next_page: 1 })) throw new Error("uncommitted/failed page was treated as successful");
  if (!priorityCheckpointHasSuccessfulPage({ cursor_success: null, window_from: "2026-11-23T00:00:00Z", window_to: "2026-11-24T00:00:00Z", next_page: 2 })) throw new Error("committed partial page was not recognized");
  if (!priorityCheckpointHasSuccessfulPage({ cursor_success: "2026-11-24T00:00:00Z", window_from: null, window_to: null, next_page: 1 })) throw new Error("completed cursor was not recognized");
});
