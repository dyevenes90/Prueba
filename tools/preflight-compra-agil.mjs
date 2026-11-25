import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrations = [
  "20261123000100_compra_agil_sync_priority_checkpoints.sql",
  "20261123000200_compra_agil_sync_atomic_commit.sql",
  "20261123000300_compra_agil_sync_checkpoint_date_mode.sql",
];
const checks = [];
async function exists(relative) {
  try { await access(path.join(root, relative), constants.R_OK); return true; }
  catch { return false; }
}
async function source(relative) {
  try { return await readFile(path.join(root, relative), "utf8"); }
  catch { return null; }
}
function report(label, state, detail) {
  checks.push({ label, state, detail });
}

for (const migration of migrations) {
  report(`Migración ${migration}`, await exists(`supabase/migrations/${migration}`) ? "PRESENTE" : "FALTA",
    "Solo verifica el archivo local; no consulta ni modifica la base.");
}

const config = await source("supabase/config.toml") ?? "";
const normalizedConfig = config.replace(/\r\n/g, "\n");
for (const [name, expected] of [["compra-agil-sync", "false"], ["compra-agil-seguimiento", "true"], ["cresce-dashboard", "true"]]) {
  const configured = normalizedConfig.includes(`[functions.${name}]\nverify_jwt = ${expected}`);
  const configuredOther = normalizedConfig.includes(`[functions.${name}]\nverify_jwt = ${expected === "true" ? "false" : "true"}`);
  report(`verify_jwt ${name}`, configured ? "OK" : configuredOther ? "REVISAR" : "SIN CONFIGURAR",
    `Configuración local esperada: ${expected}. No prueba el valor desplegado.`);
}

const sync = await source("supabase/functions/compra-agil-sync/index.ts");
const auth = await source("supabase/functions/_shared/compra-agil-sync-auth.ts");
const followup = await source("supabase/functions/compra-agil-seguimiento/index.ts");
const dashboard = await source("supabase/functions/cresce-dashboard/index.ts");
report("Autorizacion sync por UUID", sync && auth && /userId:\s*ctx\.userClaims\?\.id/.test(sync) && /allowedUserIds\.includes\(context\.userId\)/.test(auth) ? "OK" : "REVISAR",
  "Inspección estática del código local; no revela secretos ni valida el despliegue.");
report("Autorizacion dashboard por UUID", dashboard && /userId\s*=\s*ctx\.userClaims\?\.id/.test(dashboard) && /allowedIds\.includes\(userId\)/.test(dashboard) ? "OK" : "REVISAR",
  "Inspeccion estatica del codigo local; el UUID del secreto no es legible desde este preflight.");
report("Clave de Mercado Publico solo servidor", sync && /Deno\.env\.get\([\"']MERCADOPUBLICO_TICKET[\"']\)/.test(sync) && !/MERCADOPUBLICO_TICKET/.test(await source("app.js") ?? "") ? "OK" : "REVISAR",
  "Inspección estática del código local.");
report("Cron limitado a acciones programadas", auth && /authMode === \"secret\" && context\.authKeyName === \"cron\"/.test(auth) && /CRON_ACTIONS\.has\(context\.action\)/.test(auth) ? "OK" : "REVISAR",
  "Las pruebas unitarias cubren el rechazo de acciones manuales con la credencial Cron.");
report("Seguimiento exige usuario autorizado", followup && /withSupabase\(\{\s*auth:\s*[\"']user[\"']/.test(followup) && /allowed\.includes\(userId\)/.test(followup) ? "OK" : "REVISAR",
  "Inspección estática del código local.");
report("Dashboard local", await exists("supabase/functions/cresce-dashboard/index.ts") ? "PRESENTE" : "NO ESTA EN ESTA RAMA",
  "No se puede auditar o desplegar una función cuyo fuente no está en el worktree.");
report("UUID del usuario en CRESCE_ALLOWED_USER_IDS", "NO VERIFICABLE LOCALMENTE",
  "Supabase no entrega el valor secreto por la CLI. Comprueba el UUID de Auth y el valor configurado en Dashboard de forma privada; no pegues el secreto en chat ni en logs.");

for (const item of checks) console.log(`${item.state}\t${item.label}\t${item.detail}`);
if (checks.some(({ state }) => ["FALTA", "REVISAR", "SIN CONFIGURAR", "NO ESTA EN ESTA RAMA"].includes(state))) process.exitCode = 1;
