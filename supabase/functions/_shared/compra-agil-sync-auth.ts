const CRON_ACTIONS = new Set([
  "sincronizacion_programada",
  "sincronizacion_prioritaria_programada",
]);

export const MANUAL_ONE_PAGE_ACTION = "prueba_prioritaria_una_pagina";

export type SyncAuthContext = {
  authMode: "user" | "secret" | "publishable" | "none" | null;
  authKeyName?: string | null;
  userId?: string | null;
  allowedUserIds: string[];
  action?: string;
};

export type SyncAuthDecision = { allowed: true } | {
  allowed: false;
  status: 401 | 403;
  error: string;
};

export function authorizeSyncAction(context: SyncAuthContext): SyncAuthDecision {
  if (context.authMode === "user") {
    if (!context.userId || !context.allowedUserIds.includes(context.userId)) {
      return { allowed: false, status: 403, error: "Usuario no autorizado para Compra Ágil" };
    }
    if (context.action && CRON_ACTIONS.has(context.action)) {
      return { allowed: false, status: 403, error: "Acción reservada para Cron" };
    }
    return { allowed: true };
  }

  if (context.authMode === "secret" && context.authKeyName === "cron") {
    if (!context.action || !CRON_ACTIONS.has(context.action)) {
      return { allowed: false, status: 403, error: "La clave de Cron solo permite sincronizaciones programadas" };
    }
    return { allowed: true };
  }

  return { allowed: false, status: 401, error: "Se requiere una sesión autorizada o la credencial Cron válida" };
}
