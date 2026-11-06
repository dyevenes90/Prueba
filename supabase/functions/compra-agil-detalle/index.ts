import { withSupabase } from "npm:@supabase/server@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return reply({ error: "Método no permitido" }, 405);
  }

  const userId = ctx.userClaims?.id;
  const allowedIds = (Deno.env.get("CRESCE_ALLOWED_USER_IDS") ?? "")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (
    !allowedIds.length || typeof userId !== "string" ||
    !allowedIds.includes(userId)
  ) {
    return reply(
      { error: "No autorizado para consultar detalles comerciales" },
      403,
    );
  }

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return reply({ error: "Cuerpo JSON inválido" }, 400);
  }
  if (!isRecord(input) || input.accion !== "consultar") {
    return reply({ error: "Acción no válida" }, 400);
  }
  const codigo = typeof input.codigo === "string" ? input.codigo.trim() : "";
  if (!/^\d+-\d+-COT\d{2}$/.test(codigo)) {
    return reply({ error: "Código de Compra Ágil inválido" }, 400);
  }

  const db = ctx.supabaseAdmin;
  const opportunity = await db.from("compra_agil_oportunidades")
    .select("codigo")
    .eq("codigo", codigo)
    .maybeSingle();
  if (opportunity.error) {
    return reply({ error: "No se pudo validar la oportunidad" }, 500);
  }
  if (!opportunity.data) {
    return reply({ error: "La oportunidad no está registrada en CRESCE" }, 404);
  }

  const current = await db.from("compra_agil_detalles")
    .select("codigo, fecha_consulta, fecha_actualizacion")
    .eq("codigo", codigo)
    .maybeSingle();
  if (current.error) {
    return reply({ error: "No se pudo revisar el detalle existente" }, 500);
  }
  if (current.data) {
    return reply({ guardado: true, ya_existia: true, codigo });
  }

  const ticket = Deno.env.get("MERCADOPUBLICO_TICKET");
  if (!ticket) {
    return reply({ error: "Servicio de detalle no configurado" }, 500);
  }
  try {
    const url = new URL(
      `https://api2.mercadopublico.cl/v2/compra-agil/${
        encodeURIComponent(codigo)
      }`,
    );
    const upstream = await fetch(url, {
      method: "GET",
      headers: { ticket, Accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!upstream.ok) {
      const status = upstream.status === 404
        ? 404
        : upstream.status === 429
        ? 429
        : 502;
      return reply({
        error:
          `Mercado Público no entregó el detalle (HTTP ${upstream.status})`,
      }, status);
    }
    const response: unknown = await upstream.json();
    if (
      !isRecord(response) || response.success !== "OK" ||
      !isRecord(response.payload) || response.payload.codigo !== codigo
    ) {
      return reply({
        error: "La respuesta oficial del detalle está incompleta",
      }, 502);
    }

    const timestamp = new Date().toISOString();
    const saved = await db.from("compra_agil_detalles").upsert({
      codigo,
      datos_detalle: response.payload,
      fecha_consulta: timestamp,
      fecha_actualizacion: timestamp,
    }, { onConflict: "codigo", ignoreDuplicates: true });
    if (saved.error) {
      return reply({ error: "No se pudo guardar el detalle oficial" }, 500);
    }
    return reply({ guardado: true, codigo });
  } catch {
    return reply({
      error: "Error o tiempo de espera al consultar Mercado Público",
    }, 502);
  }
}));
