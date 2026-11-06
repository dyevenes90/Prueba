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

function retryDelayMs(response: Response): number | null {
  const value = response.headers.get("retry-after");
  if (!value) return 500;
  const seconds = Number(value);
  const dateDelay = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - Date.now();
  return Number.isFinite(dateDelay) && dateDelay >= 0 && dateDelay <= 5000
    ? Math.max(500, dateDelay)
    : null;
}

function apiFailureClass(status: number): string {
  if (status === 401 || status === 403) return "autenticacion";
  if (status === 404) return "no_encontrado";
  if (status === 429) return "cuota_agotada";
  if ([502, 503, 504].includes(status)) return "fallo_transitorio";
  if (status >= 500) return "fallo_servidor";
  return "error_http";
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
    const requestStarted = performance.now();
    let upstream: Response | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const attemptStarted = performance.now();
      upstream = await fetch(url, {
        method: "GET",
        headers: { ticket, Accept: "application/json" },
        signal: AbortSignal.timeout(45_000),
      });
      const retryable = [502, 503, 504].includes(upstream.status);
      if (!retryable || attempt === 2) break;
      const delay = retryDelayMs(upstream);
      console.warn("CRESCE_DETALLE_API_ERROR", {
        httpStatus: upstream.status,
        durationMs: Math.round(performance.now() - attemptStarted),
        classification: delay === null
          ? "fallo_transitorio_sin_reintento_por_retry_after"
          : "fallo_transitorio_reintentando",
      });
      if (delay === null) break;
      await upstream.body?.cancel().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (!upstream) {
      return reply(
        { error: "No se recibió respuesta de Mercado Público." },
        502,
      );
    }
    const response: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const apiError = isRecord(response) && Array.isArray(response.errors)
        ? response.errors.find(isRecord)
        : undefined;
      const apiCode = apiError && typeof apiError.codigo === "string"
        ? apiError.codigo
        : String(upstream.status);
      const cause = apiCode === "404"
        ? "La API oficial no encuentra ese código; verifica que el proceso exista y sea visible."
        : apiCode === "429"
        ? "La cuota diaria de la API se agotó; reintenta cuando se restablezca."
        : apiCode === "401" || apiCode === "403"
        ? "La API rechazó la autenticación del servidor; revisa la configuración privada."
        : upstream.status >= 500
        ? "La API oficial está temporalmente indisponible; reintenta más tarde."
        : `La API oficial rechazó la consulta (código ${apiCode}).`;
      console.error("CRESCE_DETALLE_API_ERROR", {
        httpStatus: upstream.status,
        durationMs: Math.round(performance.now() - requestStarted),
        classification: apiFailureClass(upstream.status),
      });
      const status = apiCode === "404" ? 404 : apiCode === "429" ? 429 : 502;
      const error = [502, 503, 504].includes(upstream.status)
        ? `Detalle oficial pendiente: Mercado Público continúa con HTTP ${upstream.status} tras un reintento.`
        : cause;
      return reply({ error, codigo_error_api: apiCode }, status);
    }
    if (!isRecord(response)) {
      console.warn("CRESCE_DETALLE_API_INVALID_JSON", {
        httpStatus: upstream.status,
        durationMs: Math.round(performance.now() - requestStarted),
        classification: "respuesta_no_json",
      });
      return reply({
        error: "La API oficial devolvió una respuesta que no es JSON válido.",
      }, 502);
    }
    if (response.success === "NOK") {
      const apiError = Array.isArray(response.errors)
        ? response.errors.find(isRecord)
        : undefined;
      const apiCode = apiError && typeof apiError.codigo === "string"
        ? apiError.codigo
        : "NOK";
      const cause = apiCode === "404"
        ? "La API oficial no encuentra ese código; verifica que el proceso exista y sea visible."
        : apiCode === "429"
        ? "La cuota diaria de la API se agotó; reintenta cuando se restablezca."
        : apiCode === "401" || apiCode === "403"
        ? "La API rechazó la autenticación del servidor; revisa la configuración privada."
        : `La API oficial rechazó la consulta (código ${apiCode}).`;
      console.error("CRESCE_DETALLE_API_ERROR", {
        httpStatus: upstream.status,
        durationMs: Math.round(performance.now() - requestStarted),
        classification: "respuesta_nok",
        apiCode,
      });
      return reply(
        { error: cause, codigo_error_api: apiCode },
        apiCode === "404" ? 404 : apiCode === "429" ? 429 : 502,
      );
    }
    if (response.success !== "OK" || !isRecord(response.payload)) {
      console.warn("CRESCE_DETALLE_API_INCOMPLETE", {
        httpStatus: upstream.status,
        durationMs: Math.round(performance.now() - requestStarted),
        classification: "respuesta_incompleta",
      });
      return reply(
        { error: "La API oficial no incluyó un detalle completo." },
        502,
      );
    }
    if (response.payload.codigo !== codigo) {
      console.warn("CRESCE_DETALLE_CODE_MISMATCH", {
        httpStatus: upstream.status,
        durationMs: Math.round(performance.now() - requestStarted),
        classification: "codigo_no_coincide",
      });
      return reply({
        error:
          "La API oficial devolvió un detalle para otro código; no se guardó.",
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
  } catch (error) {
    const tipo = error instanceof Error ? error.name : "ErrorDesconocido";
    const timeout = tipo === "TimeoutError";
    console.error("CRESCE_DETALLE_ERROR", { codigo, tipo });
    return reply({
      error: timeout
        ? "La consulta a Mercado Público superó el tiempo límite; puedes reintentar."
        : "No se pudo conectar con Mercado Público; puedes reintentar.",
      tipo,
    }, 502);
  }
}));
