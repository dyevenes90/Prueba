#!/usr/bin/env node
// Sanitize one public Compra Ágil v2 page for deterministic local/CI tests.
// This tool never stores request headers, tickets, buyer contacts, descriptions,
// attachments, or other unreviewed API fields.
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { formatChangeWindowForApi, parseSourceDate, sourceModifiedAt } from "./functions/_shared/compra-agil-sync-engine.ts";
import { classifyOpportunity } from "./functions/_shared/compra-agil-radar.ts";

async function main() {
const args = parseArgs(process.argv.slice(2));
let regionId = Number(args.region ?? 9);
let page = Number(args.page ?? 1);
let pageSize = Number(args["page-size"] ?? 10);
if (![9, 14].includes(regionId) || page !== 1 || pageSize !== 10) {
  fail("Solo se admite una muestra pequeña: región 9 o 14, página 1, tamaño 10.");
}

let body;
let fixture;
let requestCount = 0;
let windowFrom;
let windowTo;
if (args.fetch === "true") {
  const ticket = process.env.MERCADOPUBLICO_TICKET?.trim();
  if (!ticket) {
    console.error("No se encontró MERCADOPUBLICO_TICKET; no se hizo ninguna solicitud.");
    console.error("PowerShell: $secure = Read-Host 'Ticket ChileCompra' -AsSecureString; $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { $env:MERCADOPUBLICO_TICKET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr); node --experimental-strip-types ./supabase/ops_compra_agil_fixture.mjs --fetch --output ./supabase/tests/fixtures/compra-agil-real-page.json } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); Remove-Item Env:MERCADOPUBLICO_TICKET -ErrorAction SilentlyContinue; $secure.Dispose() }");
    fail("No se inicia el modo --fetch sin MERCADOPUBLICO_TICKET.");
  }
  const hours = Number(args.hours ?? 48);
  if (!Number.isInteger(hours) || hours < 1 || hours > 48) fail("--hours debe ser entero entre 1 y 48.");
  windowTo = new Date().toISOString();
  windowFrom = new Date(Date.parse(windowTo) - hours * 3_600_000).toISOString();
  const url = new URL("https://api2.mercadopublico.cl/v2/compra-agil");
  url.searchParams.set("region", String(regionId));
  url.searchParams.set("cambio_desde", windowFrom);
  url.searchParams.set("cambio_hasta", windowTo);
  url.searchParams.set("tamano_pagina", String(pageSize));
  url.searchParams.set("numero_pagina", String(page));
  url.searchParams.set("ordenar_por", "FechaUltimaModificacion");
  requestCount++;
  const response = await fetch(url, { headers: { ticket, Accept: "application/json" }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) fail(`ChileCompra respondió HTTP ${response.status}; solicitudes consumidas: ${requestCount}.`);
  body = await response.json();
  if (body?.success !== "OK") fail(`Respuesta no válida de ChileCompra; solicitudes consumidas: ${requestCount}.`);
} else {
  if (!args.input) fail("Indica --input <respuesta-api.json> o --fetch.");
  body = JSON.parse(await readFile(resolve(args.input), "utf8"));
  if (body?.schema === "cresce.compra-agil.real-page.v1") {
    fixture = validateFixture(body);
    regionId = fixture.regionId;
    page = fixture.page;
    pageSize = fixture.pageSize;
    windowFrom = fixture.windowFrom;
    windowTo = fixture.windowTo;
  } else {
    windowFrom = args["window-from"];
    windowTo = args["window-to"];
    if (!validInstant(windowFrom) || !validInstant(windowTo)) {
      fail("Para una respuesta API original indica --window-from y --window-to ISO-8601.");
    }
  }
}

if (!fixture) fixture = buildFixtureFromApiBody(body, { regionId, page, pageSize, windowFrom, windowTo });

const inputPath = args.input ? resolve(args.input) : null;
const explicitOutput = typeof args.output === "string" && args.output !== "true";
const output = resolve(args.output && explicitOutput ? args.output : "supabase/tests/fixtures/compra-agil-real-page.json");
const reuseFixtureOffline = Boolean(inputPath && body?.schema === "cresce.compra-agil.real-page.v1");
const writeOutput = shouldWriteFixture({ reuseFixtureOffline, explicitOutput });
if (writeOutput) {
  try { assertDistinctOutput(inputPath, output); } catch (error) { fail(error.message); }
  try {
    await access(output);
    if (args.overwrite !== "true") fail("El fixture de salida ya existe; elige otra ruta o indica --overwrite para reemplazarlo.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(fixture, null, 2) + "\n", { encoding: "utf8", flag: "w" });
  console.log(`Fixture saneado: ${output}`);
} else {
  console.log(`Fixture saneado reutilizado sin reescritura: ${inputPath}`);
}
printComparison(fixture);
console.log(`Solicitudes API consumidas: ${requestCount}`);
if (args.postgres === "true") {
  if (!fixture.totalPages) fail("La API no informó paginación total; no se puede afirmar si esta página es final ni probar el avance SQL con seguridad.");
  const sql = buildPostgresSql(fixture);
  const result = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] });
  if (result.error) fail(`No se pudo ejecutar psql: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log("Prueba PostgreSQL aislada con ambos modos: aprobada.");
}
}

export function validateFixture(value) {
  assertOnlyKeys(value, ["schema", "regionId", "page", "pageSize", "totalPages", "windowFrom", "windowTo", "capturedAt", "items"], "fixture");
  if (value.schema !== "cresce.compra-agil.real-page.v1") fail("El esquema del fixture no es compatible.");
  if (![9, 14].includes(value.regionId) || value.page !== 1 || value.pageSize !== 10) fail("El fixture debe ser página 1, tamaño 10 y región 9 o 14.");
  if (value.totalPages !== null && (!Number.isInteger(value.totalPages) || value.totalPages < 1 || value.totalPages < value.page)) fail("El fixture debe incluir totalPages válido o null.");
  for (const field of ["windowFrom", "windowTo", "capturedAt"]) {
    if (!validInstant(value[field])) fail(`El fixture contiene ${field} inválido.`);
  }
  if (Date.parse(value.windowFrom) > Date.parse(value.windowTo)) fail("La ventana del fixture está invertida.");
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > value.pageSize) fail("El fixture debe contener entre 1 y 10 oportunidades.");
  const seen = new Set();
  const items = value.items.map((item, index) => {
    const prefix = `items[${index}]`;
    assertOnlyKeys(item, ["codigo", "estado", "institucion", "fechas", "montos"], prefix);
    assertOnlyKeys(item.estado, ["codigo", "glosa"], `${prefix}.estado`);
    assertOnlyKeys(item.institucion, ["region", "nombre_region"], `${prefix}.institucion`);
    assertOnlyKeys(item.fechas, ["fecha_publicacion", "fecha_cierre", "fecha_ultimo_cambio"], `${prefix}.fechas`);
    assertOnlyKeys(item.montos, ["monto_disponible_clp"], `${prefix}.montos`);
    const safe = sanitizeItem(item);
    if (safe.institucion.region !== undefined && safe.institucion.region !== value.regionId) {
      fail(`La oportunidad ${safe.codigo} no corresponde a la región del fixture.`);
    }
    if (seen.has(safe.codigo)) fail(`El fixture contiene el código duplicado ${safe.codigo}.`);
    seen.add(safe.codigo);
    return safe;
  });
  return { ...value, items };
}

export function shouldWriteFixture({ reuseFixtureOffline, explicitOutput }) {
  return !reuseFixtureOffline || explicitOutput;
}

export function assertDistinctOutput(inputPath, outputPath) {
  if (inputPath && resolve(inputPath).toLowerCase() === resolve(outputPath).toLowerCase()) {
    throw new Error("La salida no puede sobrescribir el archivo de entrada; elige otra ruta.");
  }
}

export function buildFixtureFromApiBody(body, { regionId, page, pageSize, windowFrom, windowTo, capturedAt = new Date().toISOString() }) {
  const rawItems = body?.payload?.items;
  if (!Array.isArray(rawItems) || rawItems.length > pageSize) fail("La respuesta no contiene una página válida de hasta diez oportunidades.");
  const rawTotalPages = body?.payload?.paginacion?.total_paginas;
  const totalPages = Number.isInteger(Number(rawTotalPages)) && Number(rawTotalPages) > 0 ? Number(rawTotalPages) : null;
  const seen = new Set();
  const items = rawItems.map((item) => sanitizeItem(item)).filter((item) => {
    if (seen.has(item.codigo)) return false;
    seen.add(item.codigo);
    return true;
  });
  if (!items.length) fail("La respuesta no contiene códigos válidos de Compra Ágil.");
  return validateFixture({ schema: "cresce.compra-agil.real-page.v1", regionId, page, pageSize, totalPages, windowFrom, windowTo, capturedAt, items });
}

function assertOnlyKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} debe ser un objeto válido.`);
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected) fail(`${label} contiene un campo no permitido: ${unexpected}.`);
}

function sanitizeItem(item) {
  if (!item || typeof item !== "object" || typeof item.codigo !== "string" || !/^\d+-\d+-COT\d{2}$/.test(item.codigo.trim())) {
    fail("La respuesta contiene un código de oportunidad inválido.");
  }
  const dates = item.fechas && typeof item.fechas === "object" ? item.fechas : {};
  const state = item.estado && typeof item.estado === "object" ? item.estado : {};
  const institution = item.institucion && typeof item.institucion === "object" ? item.institucion : {};
  const amounts = item.montos && typeof item.montos === "object" ? item.montos : {};
  const allowedDates = {};
  for (const key of ["fecha_publicacion", "fecha_cierre", "fecha_ultimo_cambio"]) {
    if (typeof dates[key] === "string") allowedDates[key] = dates[key];
  }
  const safe = {
    codigo: item.codigo.trim(),
    estado: {
      ...(typeof state.codigo === "string" ? { codigo: state.codigo } : {}),
      ...(typeof state.glosa === "string" ? { glosa: state.glosa } : {}),
    },
    institucion: {
      ...(institution.region !== undefined && Number.isInteger(Number(institution.region)) ? { region: Number(institution.region) } : {}),
      ...(typeof institution.nombre_region === "string" ? { nombre_region: institution.nombre_region } : {}),
    },
    fechas: allowedDates,
    montos: {},
  };
  const amount = amounts.monto_disponible_clp;
  if (typeof amount === "number" && Number.isFinite(amount)) safe.montos.monto_disponible_clp = amount;
  else if (typeof amount === "string" && /^\d+(?:\.\d+)?$/.test(amount)) safe.montos.monto_disponible_clp = amount;
  return safe;
}

function printComparison(value) {
  const rows = value.items.map((item) => {
    const publication = parseSourceDate(item.fechas.fecha_publicacion);
    const closing = parseSourceDate(item.fechas.fecha_cierre);
    const strictModified = sourceModifiedAt(item, "strict_utc");
    const localModified = sourceModifiedAt(item, "chile_wall_z");
    const makeRow = (modified) => ({
      estado: item.estado.codigo ?? item.estado.glosa ?? "",
      fecha_cierre: closing,
      ultima_revision: value.capturedAt,
      datos_originales: item,
    });
    const strictClass = classifyOpportunity(makeRow(strictModified), Date.parse(value.capturedAt));
    const localClass = classifyOpportunity(makeRow(localModified), Date.parse(value.capturedAt));
    return {
      codigo: item.codigo,
      estado: item.estado.codigo ?? item.estado.glosa ?? null,
      publicacion_original: item.fechas.fecha_publicacion ?? null,
      publicacion_utc: publication,
      cierre_original: item.fechas.fecha_cierre ?? null,
      cierre_utc: closing,
      cambio_original: item.fechas.fecha_ultimo_cambio ?? null,
      cambio_strict_utc: strictModified === null ? null : new Date(strictModified).toISOString(),
      cambio_chile_wall_z: localModified === null ? null : new Date(localModified).toISOString(),
      cambio_despues_publicacion: {
        strict_utc: publication !== null && strictModified !== null ? strictModified > Date.parse(publication) : null,
        chile_wall_z: publication !== null && localModified !== null ? localModified > Date.parse(publication) : null,
      },
      vigencia: { strict_utc: strictClass, chile_wall_z: localClass },
    };
  });
  const counts = (mode) => rows.reduce((out, row) => {
    out[row.vigencia[mode]] = (out[row.vigencia[mode]] ?? 0) + 1;
    return out;
  }, {});
  console.log(JSON.stringify({
    regionId: value.regionId,
    pagina: value.page,
    ventanas_api: {
      strict_utc: { cambio_desde: formatChangeWindowForApi(value.windowFrom, "strict_utc"), cambio_hasta: formatChangeWindowForApi(value.windowTo, "strict_utc") },
      chile_wall_z: { cambio_desde: formatChangeWindowForApi(value.windowFrom, "chile_wall_z"), cambio_hasta: formatChangeWindowForApi(value.windowTo, "chile_wall_z") },
    },
    totalPaginas: value.totalPages,
    pendientes: value.totalPages === null ? null : Math.max(0, value.totalPages - value.page),
    recibidas: value.items.length,
    unicas: new Set(value.items.map((item) => item.codigo)).size,
    clasificaciones: { strict_utc: counts("strict_utc"), chile_wall_z: counts("chile_wall_z") },
    notas: [
      "Las fechas de publicación/cierre se interpretan igual en ambos modos.",
      "La clasificación de vigencia depende del cierre, estado oficial y revisión; cambia solo si esos campos cambian.",
      "La página/paginación procede de la misma respuesta API y no cambia por el modo horario.",
      "La detección de una versión nueva frente a una versión ya almacenada requiere comparar contra ese snapshot previo; esta página no contiene dicho histórico.",
    ],
    oportunidades: rows,
  }, null, 2));
}

function buildPostgresSql(value) {
  const jsonLiteral = JSON.stringify(value).replaceAll("'", "''");
  return `\\set ON_ERROR_STOP on
SET ROLE service_role;
BEGIN;
CREATE TEMP TABLE ca_real_fixture (body jsonb);
INSERT INTO ca_real_fixture VALUES (:'fixture_json'::jsonb);
-- psql variable is supplied below by the caller through a temporary setting.
DO $$
DECLARE
  f jsonb;
  items jsonb;
  hist_page integer;
  hist_to timestamptz;
  mode text;
  run_token uuid;
  result jsonb;
  expected_count integer;
  actual_count integer;
  expected_next_page integer;
  is_complete boolean;
  old_mode text;
BEGIN
  SELECT body INTO f FROM ca_real_fixture;
  items := f->'items';
  expected_count := jsonb_array_length(items);
  SELECT next_page, window_to INTO hist_page, hist_to FROM public.compra_agil_sync_state WHERE region_id = (f->>'regionId')::smallint;
  DELETE FROM public.compra_agil_sync_observations WHERE codigo IN (SELECT x->>'codigo' FROM jsonb_array_elements(items) x);
  DELETE FROM public.compra_agil_oportunidades WHERE codigo IN (SELECT x->>'codigo' FROM jsonb_array_elements(items) x);
  is_complete := (f->>'page')::integer >= (f->>'totalPages')::integer;
  expected_next_page := CASE WHEN is_complete THEN 1 ELSE (f->>'page')::integer + 1 END;
  FOREACH mode IN ARRAY ARRAY['strict_utc','chile_wall_z'] LOOP
    -- This reset is confined to the disposable CI transaction. Production never
    -- switches an in-progress checkpoint; the RPC below verifies the pinned mode.
    DELETE FROM public.compra_agil_sync_observations WHERE codigo IN (SELECT x->>'codigo' FROM jsonb_array_elements(items) x);
    DELETE FROM public.compra_agil_oportunidades WHERE codigo IN (SELECT x->>'codigo' FROM jsonb_array_elements(items) x);
    run_token := md5(mode || clock_timestamp()::text)::uuid;
    UPDATE public.compra_agil_sync_state SET lock_token=run_token, lock_until=clock_timestamp()+interval '5 minutes' WHERE region_id=(f->>'regionId')::smallint;
    UPDATE public.compra_agil_sync_priority_state SET lock_token=run_token, window_from=(f->>'windowFrom')::timestamptz, window_to=(f->>'windowTo')::timestamptz,
      next_page=(f->>'page')::integer, total_pages=(f->>'totalPages')::integer, date_mode=mode WHERE region_id=(f->>'regionId')::smallint;
    old_mode := CASE WHEN mode='strict_utc' THEN 'chile_wall_z' ELSE 'strict_utc' END;
    BEGIN
      PERFORM public.compra_agil_sync_commit_page_with_mode('priority',(f->>'regionId')::smallint,run_token,(f->>'page')::integer,(f->>'totalPages')::integer,is_complete,
        (f->>'windowTo')::timestamptz,items,old_mode);
      RAISE EXCEPTION 'RPC permitió cambiar modo durante ventana activa';
    EXCEPTION WHEN SQLSTATE '40001' THEN NULL;
    END;
    IF EXISTS (SELECT 1 FROM public.compra_agil_oportunidades WHERE codigo IN (SELECT x->>'codigo' FROM jsonb_array_elements(items) x)) THEN
      RAISE EXCEPTION 'Cambio de modo rechazado dejó escrituras';
    END IF;
    result := public.compra_agil_sync_commit_page_with_mode('priority',(f->>'regionId')::smallint,run_token,(f->>'page')::integer,(f->>'totalPages')::integer,is_complete,
      (f->>'windowTo')::timestamptz,items,mode);
    IF (result->>'inserted')::integer <> expected_count THEN RAISE EXCEPTION 'RPC no guardó todos los códigos únicos para %', mode; END IF;
    SELECT count(*) INTO actual_count FROM public.compra_agil_oportunidades WHERE codigo IN (SELECT x->>'codigo' FROM jsonb_array_elements(items) x);
    IF actual_count <> expected_count THEN RAISE EXCEPTION 'La muestra tiene duplicados o registros perdidos para %', mode; END IF;
    IF (SELECT next_page FROM public.compra_agil_sync_priority_state WHERE region_id=(f->>'regionId')::smallint) <> expected_next_page THEN
      RAISE EXCEPTION 'El checkpoint no avanzó la página de forma coherente';
    END IF;
    -- Replaying the same first page is an idempotent update, not another row.
    UPDATE public.compra_agil_sync_state SET lock_until=clock_timestamp()+interval '5 minutes' WHERE region_id=(f->>'regionId')::smallint;
    UPDATE public.compra_agil_sync_priority_state SET window_from=(f->>'windowFrom')::timestamptz, window_to=(f->>'windowTo')::timestamptz,
      next_page=(f->>'page')::integer, total_pages=(f->>'totalPages')::integer WHERE region_id=(f->>'regionId')::smallint;
    result := public.compra_agil_sync_commit_page_with_mode('priority',(f->>'regionId')::smallint,run_token,(f->>'page')::integer,(f->>'totalPages')::integer,is_complete,
      (f->>'windowTo')::timestamptz,items,mode);
    SELECT count(*) INTO actual_count FROM public.compra_agil_oportunidades WHERE codigo IN (SELECT x->>'codigo' FROM jsonb_array_elements(items) x);
    IF actual_count <> expected_count THEN RAISE EXCEPTION 'Repetición creó duplicados para %', mode; END IF;
    IF (SELECT date_mode FROM public.compra_agil_sync_priority_state WHERE region_id=(f->>'regionId')::smallint) <> mode THEN
      RAISE EXCEPTION 'El checkpoint no conservó el modo %', mode;
    END IF;
    RAISE NOTICE 'Fixture %: % oportunidades guardadas una sola vez; modo=%; página=%/%; estado=%', f->>'regionId', expected_count, mode, f->>'page', f->>'totalPages', CASE WHEN is_complete THEN 'completa' ELSE 'parcial' END;
  END LOOP;
  IF (SELECT next_page FROM public.compra_agil_sync_state WHERE region_id=(f->>'regionId')::smallint) <> hist_page
     OR (SELECT window_to FROM public.compra_agil_sync_state WHERE region_id=(f->>'regionId')::smallint) IS DISTINCT FROM hist_to THEN
    RAISE EXCEPTION 'La prueba alteró el checkpoint histórico';
  END IF;
END $$;
ROLLBACK;
RESET ROLE;
`.replace("INSERT INTO ca_real_fixture VALUES (:'fixture_json'::jsonb);", `INSERT INTO ca_real_fixture VALUES ('${jsonLiteral}'::jsonb);`);
}

function validInstant(value) { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [key, inline] = arg.slice(2).split("=", 2);
    parsed[key] = inline ?? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true");
  }
  return parsed;
}
function fail(message) { throw new Error(message); }

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Error al procesar la muestra Compra Ágil.");
    process.exitCode = 2;
  }
}
