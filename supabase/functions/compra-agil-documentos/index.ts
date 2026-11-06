import { withSupabase } from "npm:@supabase/server@1";

const bucket = "compra-agil-documentos";
const maxBytes = 25 * 1024 * 1024;
const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "image/jpeg",
  "image/png",
]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validCode = (value: unknown) =>
  typeof value === "string" && /^\d+-\d+-COT\d{2}$/.test(value);
const cleanName = (value: string) =>
  value.normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120) || "documento";

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return reply({ error: "Método no permitido" }, 405);
  }
  const userId = ctx.userClaims?.id;
  const allowlist = (Deno.env.get("CRESCE_ALLOWED_USER_IDS") ?? "")
    .split(/[\s,]+/).filter(Boolean);
  if (
    !allowlist.length || typeof userId !== "string" ||
    !allowlist.includes(userId)
  ) {
    return reply({ error: "No autorizado para documentos comerciales" }, 403);
  }
  const db = ctx.supabaseAdmin;
  const store = db.storage.from(bucket);

  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return reply({ error: "Formulario de archivo inválido" }, 400);
    }
    const code = form.get("codigo");
    const file = form.get("archivo");
    if (!validCode(code) || !(file instanceof File)) {
      return reply({ error: "Código o archivo inválido" }, 400);
    }
    if (!file.size || file.size > maxBytes || !allowedTypes.has(file.type)) {
      return reply(
        { error: "Formato no permitido o archivo superior a 25 MB" },
        400,
      );
    }
    const opportunity = await db.from("compra_agil_oportunidades")
      .select("codigo").eq("codigo", code).maybeSingle();
    if (opportunity.error) {
      return reply({ error: "No se pudo validar la oportunidad" }, 500);
    }
    if (!opportunity.data) {
      return reply({ error: "La oportunidad no existe en CRESCE" }, 404);
    }
    const key = `${code}/${crypto.randomUUID()}-${cleanName(file.name)}`;
    const upload = await store.upload(key, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upload.error) {
      return reply({ error: "No se pudo guardar el documento privado" }, 500);
    }
    return reply({
      guardado: true,
      documento: { key, nombre: file.name, tipo: file.type, bytes: file.size },
    });
  }

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return reply({ error: "Cuerpo JSON inválido" }, 400);
  }
  if (!isRecord(input) || !validCode(input.codigo)) {
    return reply({ error: "Código de oportunidad inválido" }, 400);
  }
  const code = input.codigo;
  if (input.accion === "listar") {
    const result = await store.list(`${code}/`, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (result.error) {
      return reply(
        { error: "No se pudieron listar los documentos privados" },
        500,
      );
    }
    return reply({
      documentos: (result.data ?? []).map((entry) => ({
        key: `${code}/${entry.name}`,
        nombre: entry.name.replace(/^[0-9a-f-]{36}-/i, ""),
        updated_at: entry.updated_at,
      })),
    });
  }
  if (input.accion === "descargar") {
    const key = typeof input.key === "string" ? input.key : "";
    const prefix = `${code}/`;
    const filename = key.slice(prefix.length);
    if (
      !key.startsWith(prefix) || !filename || filename.includes("/") ||
      filename.includes("..")
    ) {
      return reply({ error: "Documento inválido para esta oportunidad" }, 400);
    }
    const result = await store.download(key);
    if (result.error || !result.data) {
      return reply({ error: "No se pudo recuperar el documento privado" }, 404);
    }
    return new Response(result.data, {
      headers: {
        ...corsHeaders,
        "Content-Type": result.data.type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${
          cleanName(filename.replace(/^[0-9a-f-]{36}-/i, ""))
        }"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return reply({ error: "Acción no válida" }, 400);
}));
