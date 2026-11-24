import { authorizeSyncAction, MANUAL_ONE_PAGE_ACTION } from "./compra-agil-sync-auth.ts";

const allowed = ["user-authorized"];

Deno.test("sync auth allows an allowlisted user for a manual action", () => {
  const result = authorizeSyncAction({ authMode: "user", userId: "user-authorized", allowedUserIds: allowed, action: "buscar_compras_nuevas" });
  if (!result.allowed) throw new Error("authorized user was rejected");
});

Deno.test("sync auth rejects a user outside the UUID allowlist", () => {
  const result = authorizeSyncAction({ authMode: "user", userId: "user-other", allowedUserIds: allowed, action: "buscar_compras_nuevas" });
  if (result.allowed || result.status !== 403) throw new Error("unauthorized user was accepted");
});

Deno.test("sync auth rejects missing credentials and publishable key without a session", () => {
  for (const authMode of [null, "publishable"] as const) {
    const result = authorizeSyncAction({ authMode, allowedUserIds: allowed, action: "buscar_compras_nuevas" });
    if (result.allowed || result.status !== 401) throw new Error(`${authMode} context was accepted`);
  }
});

Deno.test("sync auth permits only the named cron key for scheduled actions", () => {
  const result = authorizeSyncAction({ authMode: "secret", authKeyName: "cron", allowedUserIds: allowed, action: "sincronizacion_prioritaria_programada" });
  if (!result.allowed) throw new Error("valid named cron key was rejected");
});

Deno.test("sync auth rejects an incorrectly named cron credential", () => {
  const result = authorizeSyncAction({ authMode: "secret", authKeyName: "other", allowedUserIds: allowed, action: "sincronizacion_prioritaria_programada" });
  if (result.allowed || result.status !== 401) throw new Error("wrong named cron key was accepted");
});

Deno.test("sync auth rejects manual actions with valid cron credentials", () => {
  const result = authorizeSyncAction({ authMode: "secret", authKeyName: "cron", allowedUserIds: allowed, action: "buscar_compras_nuevas" });
  if (result.allowed || result.status !== 403) throw new Error("cron key invoked a manual action");
});

Deno.test("sync auth allows only an allowlisted user for the one-page manual action", () => {
  const result = authorizeSyncAction({ authMode: "user", userId: "user-authorized", allowedUserIds: allowed, action: MANUAL_ONE_PAGE_ACTION });
  if (!result.allowed) throw new Error("authorized user was rejected from one-page action");
  for (const authMode of [null, "publishable"] as const) {
    const anonymous = authorizeSyncAction({ authMode, allowedUserIds: allowed, action: MANUAL_ONE_PAGE_ACTION });
    if (anonymous.allowed || anonymous.status !== 401) throw new Error(`${authMode} context invoked one-page action`);
  }
});

Deno.test("sync auth rejects Cron credentials for the one-page manual action", () => {
  const result = authorizeSyncAction({ authMode: "secret", authKeyName: "cron", allowedUserIds: allowed, action: MANUAL_ONE_PAGE_ACTION });
  if (result.allowed || result.status !== 403) throw new Error("Cron credential invoked the manual one-page action");
});
