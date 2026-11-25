import { parseSourceDate } from "./functions/_shared/compra-agil-sync-engine.ts";

const ticket = process.env.MERCADOPUBLICO_TICKET?.trim();
if (!ticket) {
  console.error("Falta MERCADOPUBLICO_TICKET. No se realizó ninguna solicitud.");
  console.error("Desde la raíz del repositorio, pega este bloque en PowerShell. El ticket se solicita oculto y se elimina al terminar:");
  console.error(`$secure = Read-Host 'Ticket ChileCompra (entrada oculta)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:MERCADOPUBLICO_TICKET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  node .\\supabase\\ops_compra_agil_api_diagnostic.mjs
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  Remove-Item Env:MERCADOPUBLICO_TICKET -ErrorAction SilentlyContinue
  $secure.Dispose()
}`);
  process.exit(2);
}

const rawHours = process.env.COMPRA_AGIL_DIAGNOSTIC_WINDOW_HOURS;
const hours = rawHours === undefined ? 48 : Number(rawHours);
if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
  console.error("COMPRA_AGIL_DIAGNOSTIC_WINDOW_HOURS debe ser un entero entre 1 y 168.");
  process.exit(2);
}

const now = new Date();
const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
const url = new URL("https://api2.mercadopublico.cl/v2/compra-agil");
url.searchParams.set("region", "9");
url.searchParams.set("cambio_desde", from.toISOString());
url.searchParams.set("cambio_hasta", now.toISOString());
url.searchParams.set("tamano_pagina", "10");
url.searchParams.set("numero_pagina", "1");
url.searchParams.set("ordenar_por", "FechaUltimaModificacion");

let requests = 0;
try {
  requests++;
  const response = await fetch(url, {
    method: "GET",
    headers: { ticket, Accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = null;
  }

  console.log(`HTTP: ${response.status} ${response.statusText}`);
  console.log(`Ventana de cambios UTC: ${from.toISOString()} — ${now.toISOString()} (${hours} h)`);
  console.log("Filtro región API: 9 (La Araucanía); página: 1; tamaño: 10");

  if (!response.ok || body?.success !== "OK" || !Array.isArray(body?.payload?.items)) {
    const errors = Array.isArray(body?.errors)
      ? body.errors.map((entry) => ({ codigo: entry?.codigo ?? null, mensaje: redact(entry?.mensaje, ticket) }))
      : [];
    console.error("La API no devolvió una página válida.");
    if (errors.length) console.error(JSON.stringify(errors));
    else if (!body) console.error("Respuesta no JSON; no se imprime el cuerpo recibido.");
    console.log(`Solicitudes consumidas: ${requests}`);
    process.exitCode = 1;
  } else {
    const items = body.payload.items.slice(0, 10).map((item) => {
      const dates = item?.fechas && typeof item.fechas === "object" ? item.fechas : {};
      return {
        codigo: item?.codigo ?? null,
        estado: item?.estado?.codigo ?? item?.estado?.glosa ?? null,
        fechas_originales: {
          publicacion: dates.fecha_publicacion ?? null,
          cierre: dates.fecha_cierre ?? null,
          ultimo_cambio: dates.fecha_ultimo_cambio ?? null,
        },
        fechas_parseadas_UTC: {
          publicacion: parseSourceDate(dates.fecha_publicacion),
          cierre: parseSourceDate(dates.fecha_cierre),
          ultimo_cambio: parseSourceDate(dates.fecha_ultimo_cambio),
        },
      };
    });
    console.log(`Resultados en la página: ${body.payload.items.length}; mostrados: ${items.length}`);
    console.log("Códigos, estados y fechas (valor API original y salida del parser CRESCE):");
    console.log(JSON.stringify(items, null, 2));
    console.log(`Solicitudes consumidas: ${requests}`);
  }
} catch (error) {
  console.error(`Error de transporte/API: ${redact(error instanceof Error ? error.message : String(error), ticket)}`);
  console.log(`Solicitudes consumidas: ${requests}`);
  process.exitCode = 1;
}

function redact(value, secret) {
  if (typeof value !== "string") return null;
  return value.replaceAll(secret, "[REDACTADO]").slice(0, 400);
}
