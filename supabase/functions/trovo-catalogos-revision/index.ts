import { withSupabase } from "npm:@supabase/server@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-import-action, x-file-name",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_BYTES = 1_200_000;
const BATCH_SIZE = 100;
type Row = Record<string, string>;

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}
function parseCsv(source: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (quoted) throw new Error("CSV invÃƒÆ’Ã‚Â¡lido: comillas sin cerrar.");
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const headers = rows.shift()?.map((value, i) => (i === 0 ? value.replace(/^\uFEFF/, "") : value).trim()) ?? [];
  if (!headers.length || new Set(headers).size !== headers.length) throw new Error("CSV invÃƒÆ’Ã‚Â¡lido: encabezados vacÃƒÆ’Ã‚Â­os o repetidos.");
  return rows.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}
function field(row: Row, key: string) { return String(row[key] ?? "").trim(); }
function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.trim().replace(/\s/g, "").replace(/,(?=\d{1,2}$)/, ".");
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}
function pageFrom(value: string): number | null {
  const match = value.match(/(?:p[aÃƒÆ’Ã‚Â¡]gina\s*(?:pdf)?\s*|p\.\s*)(\d+)/i);
  return match ? Number(match[1]) : null;
}
function summarize(rows: Row[]) {
  const codeCounts = new Map<string, number>();
  for (const row of rows) {
    const code = field(row, "codigo_proveedor");
    if (code) codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
  }
  const duplicated = [...codeCounts.values()].filter((n) => n > 1);
  return {
    filas: rows.length,
    codigos_distintos: codeCounts.size,
    grupos_codigo_repetido: duplicated.length,
    filas_en_grupos_repetidos: duplicated.reduce((sum, count) => sum + count, 0),
    stock_negativo_referencial: rows.filter((r) => (numberOrNull(field(r, "stock_referencial")) ?? 0) < 0).length,
    precio_pendiente_o_vacio: rows.filter((r) => !field(r, "precio_publicado_clp") || /pendiente|por_asignar/i.test(field(r, "estado_precio"))).length,
    iva_pendiente: rows.filter((r) => !field(r, "tratamiento_iva") || /pendiente|desconocido/i.test(field(r, "tratamiento_iva"))).length,
    proveedor_sin_confirmar: rows.filter((r) => /por confirmar|pendiente/i.test(field(r, "identidad_proveedor"))).length,
    unidad_precio_sin_confirmar: rows.filter((r) => !field(r, "presentacion") || /por identificar|pendiente/i.test(field(r, "presentacion"))).length,
  };
}

Deno.serve(withSupabase({ auth: "user", cors: { headers: corsHeaders } }, async (req, ctx) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "MÃƒÆ’Ã‚Â©todo no permitido" }, 405);
  const userId = ctx.userClaims?.id;
  const allowlist = (Deno.env.get("CRESCE_ALLOWED_USER_IDS") ?? "").split(/[\s,]+/).filter(Boolean);
  if (!allowlist.length || typeof userId !== "string" || !allowlist.includes(userId)) {
    return reply({ error: "Usuario no autorizado para catÃƒÆ’Ã‚Â¡logos comerciales" }, 403);
  }
  const action = req.headers.get("x-import-action") ?? "";
  const db = ctx.supabaseAdmin;

  if (action === "listar") {
    let input: unknown;
    try { input = await req.json(); } catch { return reply({ error: "Solicitud JSON invÃƒÆ’Ã‚Â¡lida" }, 400); }
    const importId = input && typeof input === "object" && typeof (input as Record<string, unknown>).importacion_id === "string"
      ? String((input as Record<string, unknown>).importacion_id) : null;
    const { data: imports, error: importsError } = await db.from("trovo_importaciones_proveedor")
      .select("id, nombre_archivo, tipo_archivo, huella_archivo, estado, estado_carga, fecha_carga, resumen_importacion")
      .order("fecha_carga", { ascending: false }).limit(20);
    if (importsError) return reply({ error: "Zona privada de revisiÃƒÆ’Ã‚Â³n aÃƒÆ’Ã‚Âºn no estÃƒÆ’Ã‚Â¡ preparada" }, 503);
    const selected = importId ?? imports?.[0]?.id;
    if (!selected) return reply({ importaciones: [], filas: [] });
    const { data: rows, error: rowsError } = await db.from("trovo_importacion_proveedor_filas")
      .select("id, numero_fila, proveedor_clave, codigo_proveedor, nombre_producto, precio, tratamiento_iva, fuente_original, identidad_proveedor, codigo_barras, marca, categoria, linea, presentacion, pagina_fuente, ubicacion_fuente, estado_precio, stock_referencial, stock_confirmado, transito_referencial, codigo_repetido, estado_iva, cantidad_precio, unidad_precio, proveedor_confirmado, datos_originales")
      .eq("importacion_id", selected).order("numero_fila").range(0, 499);
    if (rowsError) return reply({ error: "No se pudieron leer las filas privadas en revisiÃƒÆ’Ã‚Â³n" }, 500);
    return reply({ importaciones: imports ?? [], importacion_id: selected, filas: rows ?? [] });
  }

  if (action !== "previsualizar" && action !== "guardar") return reply({ error: "AcciÃƒÆ’Ã‚Â³n no vÃƒÆ’Ã‚Â¡lida" }, 400);
  const declaredName = req.headers.get("x-file-name") ?? "catalogo.csv";
  let fileName = "catalogo.csv";
  try { fileName = decodeURIComponent(declaredName).replace(/[\\/\r\n]/g, "_").slice(0, 180); } catch { return reply({ error: "Nombre de archivo invÃƒÆ’Ã‚Â¡lido" }, 400); }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) return reply({ error: "El archivo debe pesar entre 1 byte y 1,2 MB por solicitud" }, 413);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  let rows: Row[];
  try { rows = parseCsv(text); } catch (error) { return reply({ error: error instanceof Error ? error.message : "CSV invÃƒÆ’Ã‚Â¡lido" }, 400); }
  if (!rows.length || rows.length > 5000) return reply({ error: "El CSV debe contener entre 1 y 5.000 filas" }, 400);
  const headers = Object.keys(rows[0]);
  if (!headers.includes("codigo_proveedor") || !headers.includes("nombre") || !headers.includes("archivo_fuente")) {
    return reply({ error: "Faltan columnas normalizadas: codigo_proveedor, nombre o archivo_fuente" }, 400);
  }
  const summary = summarize(rows);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (action === "previsualizar") return reply({ archivo: fileName, sha256: hash, resumen: summary, muestras: rows.slice(0, 5) });

  const { data: existing, error: findError } = await db.from("trovo_importaciones_proveedor")
    .select("id, estado, estado_carga").eq("huella_archivo", hash).maybeSingle();
  if (findError) return reply({ error: "No se pudo comprobar la huella del archivo" }, 500);
  let importId = existing?.id as string | undefined;
  if (existing?.estado_carga === "completa") {
    return reply({ importacion_id: importId, idempotente: true, resumen: summary });
  }
  if (!importId) {
    const { data: created, error: createError } = await db.from("trovo_importaciones_proveedor").insert({
      nombre_archivo: fileName, tipo_archivo: "csv", huella_archivo: hash,
      estado: "pendiente_revision", estado_carga: "en_carga", cargado_por: userId,
      resumen_importacion: summary,
    }).select("id").single();
    if (createError || !created) return reply({ error: "No se pudo iniciar la importaciÃƒÆ’Ã‚Â³n privada (archivo duplicado o esquema aÃƒÆ’Ã‚Âºn no actualizado)" }, 409);
    importId = created.id;
  } else {
    const { error: resumeError } = await db.from("trovo_importaciones_proveedor").update({
      estado_carga: "en_carga", resumen_importacion: summary,
    }).eq("id", importId);
    if (resumeError) return reply({ error: "No se pudo reanudar la importaciÃƒÆ’Ã‚Â³n privada" }, 500);
  }

  const codeCounts = new Map<string, number>();
  for (const row of rows) { const code = field(row, "codigo_proveedor"); if (code) codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1); }
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE).map((row, index) => {
      const rowNumber = offset + index + 2;
      const location = field(row, "ubicacion_fuente");
      const price = numberOrNull(field(row, "precio_publicado_clp"));
      const iva = field(row, "tratamiento_iva").toLocaleLowerCase("es");
      const tratamientoIva = iva === "incluido" || iva === "excluido" ? iva : "desconocido";
      return {
        importacion_id: importId, numero_fila: rowNumber,
        proveedor_clave: field(row, "proveedor_clave_provisional") || "proveedor_pendiente",
        codigo_proveedor: field(row, "codigo_proveedor") || null,
        nombre_producto: field(row, "nombre") || "Sin nombre informado",
        precio: price, tratamiento_iva: tratamientoIva,
        fuente_original: field(row, "archivo_fuente") || fileName,
        identidad_proveedor: field(row, "identidad_proveedor") || "POR CONFIRMAR",
        codigo_barras: field(row, "codigo_barras") || null,
        marca: field(row, "marca") || null, categoria: field(row, "categoria") || null,
        linea: field(row, "linea") || null, presentacion: field(row, "presentacion") || null,
        pagina_fuente: pageFrom(location), ubicacion_fuente: location || `Fila ${rowNumber}`,
        estado_precio: field(row, "estado_precio") || "pendiente",
        stock_referencial: field(row, "stock_referencial") || null, stock_confirmado: false,
        transito_referencial: field(row, "transito_referencial") || null,
        codigo_repetido: (codeCounts.get(field(row, "codigo_proveedor")) ?? 0) > 1,
        estado_iva: field(row, "tratamiento_iva") || "pendiente",
        cantidad_precio: field(row, "cantidad_precio") || null,
        unidad_precio: "por_identificar", proveedor_confirmado: false,
        datos_originales: row,
      };
    });
    const { error: batchError } = await db.from("trovo_importacion_proveedor_filas")
      .upsert(batch, { onConflict: "importacion_id,numero_fila", ignoreDuplicates: true });
    if (batchError) {
      await db.from("trovo_importaciones_proveedor").update({ estado_carga: "error" }).eq("id", importId);
      return reply({ error: `No se pudo guardar el lote desde la fila ${offset + 2}; puedes reintentar el mismo archivo sin duplicarlo` }, 500);
    }
  }
  const { error: finishError } = await db.from("trovo_importaciones_proveedor").update({
    estado_carga: "completa", estado: "pendiente_revision", resumen_importacion: summary,
  }).eq("id", importId);
  if (finishError) return reply({ error: "Filas guardadas, pero el cierre quedÃƒÆ’Ã‚Â³ pendiente; reintenta el mismo archivo" }, 500);
  return reply({ importacion_id: importId, idempotente: false, resumen: summary });
}));
