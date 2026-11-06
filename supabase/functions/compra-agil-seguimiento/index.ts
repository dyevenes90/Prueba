import { withSupabase } from "npm:@supabase/server@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const states = [
  "SIN_EVALUAR",
  "POSIBLE_COINCIDENCIA",
  "PROVEEDOR_CONFIRMADO",
  "BUSCAR_PROVEEDOR",
  "NO_DISPONIBLE",
];
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
function productKey(
  product: Record<string, unknown>,
  seen: Map<string, number>,
) {
  const parts = [
    product.nombre,
    product.descripcion,
    product.cantidad,
    product.unidad_medida,
  ].map((value) => value == null ? "" : String(value).trim());
  const fingerprint = parts.join("\u001f").normalize("NFD").replace(
    /\p{M}/gu,
    "",
  ).toLocaleLowerCase("es");
  const occurrence = seen.get(fingerprint) ?? 0;
  seen.set(fingerprint, occurrence + 1);
  let hash = 2166136261;
  let secondHash = 0x01234567;
  for (let i = 0; i < fingerprint.length; i++) {
    hash = Math.imul(hash ^ fingerprint.charCodeAt(i), 16777619);
    secondHash = Math.imul(secondHash ^ fingerprint.charCodeAt(i), 0x01000193);
  }
  return `${(hash >>> 0).toString(16)}${
    (secondHash >>> 0).toString(16)
  }-${occurrence}`;
}
function lines(detail: unknown) {
  const products =
    isRecord(detail) && Array.isArray(detail.productos_solicitados)
      ? detail.productos_solicitados
      : [];
  const seen = new Map<string, number>();
  return products.filter(isRecord).map((product) => ({
    key: productKey(product, seen),
    product,
  }));
}
function classify(total: number, records: Record<string, unknown>[]) {
  const byKey = new Map(
    records.map((row) => [str(row.producto_key, 150), row]),
  );
  let confirmed = 0, possible = 0;
  const statesForLines = [...byKey.values()].map((row) => str(row.estado));
  confirmed =
    statesForLines.filter((state) => state === "PROVEEDOR_CONFIRMADO").length;
  possible =
    statesForLines.filter((state) => state === "POSIBLE_COINCIDENCIA").length;
  const pending = Math.max(0, total - confirmed);
  const unevaluated = statesForLines.length === 0 ||
    statesForLines.every((state) => state === "SIN_EVALUAR");
  const classification = total === 0
    ? "SIN_EVALUAR"
    : confirmed === total
    ? "COBERTURA_COMPLETA"
    : confirmed === 0 && unevaluated
    ? "SIN_EVALUAR"
    : "COBERTURA_PARCIAL";
  return {
    confirmadas: confirmed,
    posibles: possible,
    pendientes: pending,
    total,
    cobertura_confirmada_pct: total
      ? Math.round(confirmed * 100 / total)
      : null,
    clasificacion: classification,
  };
}
async function allPages(
  make: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>,
) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 10_000; from += 1000) {
    const { data, error } = await make(from, from + 999);
    if (error) return { rows, error: true, partial: false };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < 1000) return { rows, error: false, partial: false };
  }
  return { rows, error: false, partial: true };
}

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return reply({ error: "Método no permitido" }, 405);
  }
  const userId = ctx.userClaims?.id;
  const allowed = (Deno.env.get("CRESCE_ALLOWED_USER_IDS") ?? "").split(
    /[\s,]+/,
  ).filter(Boolean);
  if (
    !allowed.length || typeof userId !== "string" || !allowed.includes(userId)
  ) return reply({ error: "No autorizado" }, 403);
  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return reply({ error: "JSON inválido" }, 400);
  }
  if (!isRecord(input) || typeof input.accion !== "string") {
    return reply({ error: "Solicitud inválida" }, 400);
  }
  const db = ctx.supabaseAdmin;

  if (input.accion === "decision_leer" || input.accion === "decision_guardar") {
    const codigo = str(input.codigo, 40);
    if (!/^\d+-\d+-COT\d{2}$/.test(codigo)) {
      return reply({ error: "Código de oportunidad inválido" }, 400);
    }
    if (input.accion === "decision_leer") {
      const { data, error } = await db.from("compra_agil_decisiones")
        .select("codigo, tipo, clave, datos, updated_at").eq("codigo", codigo);
      if (error) return reply({ error: "No se pudo leer la evaluación" }, 500);
      return reply({ decisions: data ?? [] });
    }
    const tipo = str(input.tipo, 20);
    const clave = str(input.clave, 180);
    if (
      !(["producto", "gastos", "requisito"].includes(tipo)) || !clave ||
      !isRecord(input.datos) || JSON.stringify(input.datos).length > 12_000
    ) {
      return reply({ error: "Datos de evaluación inválidos" }, 400);
    }
    const opportunity = await db.from("compra_agil_oportunidades")
      .select("codigo").eq("codigo", codigo).maybeSingle();
    if (opportunity.error) {
      return reply({ error: "No se pudo validar la oportunidad" }, 500);
    }
    if (!opportunity.data) {
      return reply({ error: "La oportunidad no existe" }, 404);
    }
    const { data, error } = await db.from("compra_agil_decisiones").upsert({
      codigo,
      tipo,
      clave,
      datos: input.datos,
      updated_at: new Date().toISOString(),
    }, { onConflict: "codigo,tipo,clave" }).select(
      "codigo, tipo, clave, datos, updated_at",
    ).single();
    if (error) return reply({ error: "No se pudo guardar la evaluación" }, 500);
    return reply({ decision: data });
  }

  if (input.accion === "proveedores") {
    const result = await allPages((from, to) =>
      db.from("trovo_proveedores").select("id, clave").order("clave")
        .range(from, to)
    );
    if (result.error) {
      return reply({ error: "No se pudo consultar proveedores" }, 500);
    }
    return reply({
      proveedores: result.rows.map(({ id, clave }) => ({
        id,
        clave,
      })),
    });
  }
  if (input.accion === "leer" || input.accion === "guardar") {
    const codigo = str(input.codigo, 40);
    if (!/^\d+-\d+-COT\d{2}$/.test(codigo)) {
      return reply({ error: "Código de oportunidad inválido" }, 400);
    }
    if (input.accion === "leer") {
      const { data, error } = await db.from("compra_agil_seguimiento_productos")
        .select(
          "codigo, producto_key, producto_nombre, cantidad, unidad_medida, especificacion, estado, proveedor_id, proveedor_nombre_manual, observaciones, precio_compra_referencial, condiciones_abastecimiento, fecha_confirmacion, updated_at",
        ).eq("codigo", codigo);
      if (error) return reply({ error: "No se pudo leer el seguimiento" }, 500);
      return reply({ seguimiento: data ?? [] });
    }
    const row = input.seguimiento;
    if (
      !isRecord(row) || !str(row.producto_key, 150) ||
      !states.includes(String(row.estado))
    ) return reply({ error: "Producto o estado inválido" }, 400);
    const opportunity = await db.from("compra_agil_oportunidades").select(
      "codigo",
    ).eq("codigo", codigo).maybeSingle();
    if (opportunity.error) {
      return reply({ error: "No se pudo validar la oportunidad" }, 500);
    }
    if (!opportunity.data) {
      return reply({
        error: "La oportunidad no existe; no se guardó el seguimiento",
      }, 404);
    }
    const proveedorId = str(row.proveedor_id, 80) || null;
    const proveedorManual = str(row.proveedor_nombre_manual, 160) || null;
    if (
      proveedorId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(proveedorId)
    ) {
      return reply({ error: "Identificador de proveedor inválido" }, 400);
    }
    if (proveedorId && proveedorManual) {
      return reply({
        error: "Selecciona proveedor existente o nombre manual, no ambos",
      }, 400);
    }
    if (
      row.estado === "PROVEEDOR_CONFIRMADO" && !proveedorId &&
      !proveedorManual
    ) {
      return reply({
        error: "Asigna un proveedor antes de confirmar el abastecimiento",
      }, 400);
    }
    if (proveedorId) {
      const check = await db.from("trovo_proveedores").select("id").eq(
        "id",
        proveedorId,
      ).maybeSingle();
      if (check.error) {
        return reply({ error: "No se pudo validar el proveedor" }, 500);
      }
      if (!check.data) {
        return reply({ error: "El proveedor seleccionado no existe" }, 400);
      }
    }
    const price = row.precio_compra_referencial === "" ||
        row.precio_compra_referencial == null
      ? null
      : Number(row.precio_compra_referencial);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      return reply({ error: "Precio referencial inválido" }, 400);
    }
    const date = str(row.fecha_confirmacion, 10) || null;
    const parsedDate = date ? new Date(`${date}T00:00:00.000Z`) : null;
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !parsedDate ||
        !Number.isFinite(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== date)
    ) {
      return reply({ error: "Fecha inválida" }, 400);
    }
    const saved = await db.from("compra_agil_seguimiento_productos").upsert({
      codigo,
      producto_key: str(row.producto_key, 150),
      producto_nombre: str(row.producto_nombre, 500) || null,
      cantidad: str(row.cantidad, 100) || null,
      unidad_medida: str(row.unidad_medida, 100) || null,
      especificacion: str(row.especificacion, 3000) || null,
      estado: String(row.estado),
      proveedor_id: proveedorId,
      proveedor_nombre_manual: proveedorManual,
      observaciones: str(row.observaciones, 3000) || null,
      precio_compra_referencial: price,
      condiciones_abastecimiento: str(row.condiciones_abastecimiento, 3000) ||
        null,
      fecha_confirmacion: date,
      updated_at: new Date().toISOString(),
    }, { onConflict: "codigo,producto_key" }).select(
      "codigo, producto_key, estado, proveedor_id, proveedor_nombre_manual, observaciones, precio_compra_referencial, condiciones_abastecimiento, fecha_confirmacion, updated_at",
    ).single();
    if (saved.error) {
      return reply({ error: "No se pudo guardar el seguimiento" }, 500);
    }
    return reply({ seguimiento: saved.data });
  }
  if (input.accion === "resumen_lote") {
    const codigos = Array.isArray(input.codigos)
      ? [
        ...new Set(
          input.codigos.map((v) => str(v, 40)).filter((v) =>
            /^\d+-\d+-COT\d{2}$/.test(v)
          ),
        ),
      ].slice(0, 50)
      : [];
    if (!codigos.length) return reply({ resumen: {} });
    const [details, tracking] = await Promise.all([
      db.from("compra_agil_detalles").select("codigo, datos_detalle").in(
        "codigo",
        codigos,
      ),
      db.from("compra_agil_seguimiento_productos").select(
        "codigo, producto_key, estado",
      ).in("codigo", codigos),
    ]);
    if (details.error || tracking.error) {
      return reply({ error: "No se pudo leer la cobertura" }, 500);
    }
    const byCode = new Map<string, Record<string, unknown>[]>();
    for (const row of tracking.data ?? []) {
      byCode.set(String(row.codigo), [
        ...(byCode.get(String(row.codigo)) ?? []),
        row,
      ]);
    }
    const resumen: Record<string, unknown> = {};
    for (const detail of details.data ?? []) {
      const productLines = lines(detail.datos_detalle);
      const records = byCode.get(String(detail.codigo)) ?? [];
      const byKey = new Map(records.map((r) => [String(r.producto_key), r]));
      const expanded = productLines.map((line) =>
        byKey.get(line.key) ?? { producto_key: line.key, estado: "SIN_EVALUAR" }
      );
      resumen[String(detail.codigo)] = {
        tiene_detalle: true,
        ...classify(productLines.length, expanded),
      };
    }
    return reply({ resumen });
  }
  if (input.accion === "radar") {
    const filters = isRecord(input.filtros) ? input.filtros : {};
    const query = str(filters.texto, 100).replace(/[,*()%_\\]/g, " ").trim();
    const fromDate = str(filters.desde, 10), toDate = str(filters.hasta, 10);
    const min = filters.monto_minimo === "" || filters.monto_minimo == null
      ? null
      : Number(filters.monto_minimo);
    const max = filters.monto_maximo === "" || filters.monto_maximo == null
      ? null
      : Number(filters.monto_maximo);
    const orderColumns: Record<string, string> = {
      fecha_publicacion: "fecha_publicacion",
      fecha_cierre: "fecha_cierre",
      monto_estimado: "monto_estimado",
      nombre: "nombre",
    };
    const order = orderColumns[String(filters.orden)] ?? "fecha_publicacion";
    const page = Number.isInteger(filters.pagina) && Number(filters.pagina) > 0
      ? Number(filters.pagina)
      : 1;
    if (
      page > 10000 || (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) ||
      (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) ||
      (min !== null && (!Number.isFinite(min) || min < 0)) ||
      (max !== null && (!Number.isFinite(max) || max < 0)) ||
      (min !== null && max !== null && min > max)
    ) return reply({ error: "Filtros inválidos" }, 400);
    const opportunities = await allPages((start, end) => {
      let request = db.from("compra_agil_oportunidades").select(
        "codigo, nombre, organismo, region, monto_estimado, fecha_publicacion, fecha_cierre, estado",
      ).order(order, {
        ascending: filters.direccion === "asc",
        nullsFirst: false,
      }).order("codigo");
      if (fromDate) {
        request = request.gte("fecha_publicacion", `${fromDate}T00:00:00.000Z`);
      }
      if (toDate) {
        const after = new Date(`${toDate}T00:00:00.000Z`);
        after.setUTCDate(after.getUTCDate() + 1);
        request = request.lt("fecha_publicacion", after.toISOString());
      }
      if (min !== null) request = request.gte("monto_estimado", min);
      if (max !== null) request = request.lte("monto_estimado", max);
      if (query) {
        request = request.or(
          `codigo.ilike.%${query}%,nombre.ilike.%${query}%,organismo.ilike.%${query}%`,
        );
      }
      return request.range(start, end);
    });
    if (opportunities.error) {
      return reply({ error: "No se pudieron consultar oportunidades" }, 500);
    }
    const region = str(filters.region, 100).normalize("NFD").replace(
      /\p{M}/gu,
      "",
    ).toLocaleLowerCase("es").replace(/^region\s+de\s+/u, "").replace(
      /\s+/g,
      " ",
    ).trim();
    let rows = opportunities.rows.filter((r) =>
      !region ||
      str(r.region, 100).normalize("NFD").replace(/\p{M}/gu, "")
          .toLocaleLowerCase("es").replace(/^region\s+de\s+/u, "").replace(
            /\s+/g,
            " ",
          ).trim() === region
    );
    const codes = rows.map((r) => String(r.codigo));
    const detailRows: Record<string, unknown>[] = [],
      trackRows: Record<string, unknown>[] = [];
    for (let i = 0; i < codes.length; i += 500) {
      const part = codes.slice(i, i + 500);
      const [d, t] = await Promise.all([
        db.from("compra_agil_detalles").select("codigo, datos_detalle").in(
          "codigo",
          part,
        ),
        db.from("compra_agil_seguimiento_productos").select(
          "codigo, producto_key, estado",
        ).in("codigo", part),
      ]);
      if (d.error || t.error) {
        return reply({ error: "No se pudo calcular la cobertura" }, 500);
      }
      detailRows.push(...(d.data ?? []));
      trackRows.push(...(t.data ?? []));
    }
    const details = new Map(
      detailRows.map((r) => [String(r.codigo), r.datos_detalle]),
    );
    const tracks = new Map<string, Record<string, unknown>[]>();
    for (const r of trackRows) {
      tracks.set(String(r.codigo), [
        ...(tracks.get(String(r.codigo)) ?? []),
        r,
      ]);
    }
    const trackingFilter = String(input.filtro_cobertura ?? "");
    rows = rows.map((r) => {
      const code = String(r.codigo), detail = details.get(code);
      if (!detail) {
        return {
          ...r,
          tiene_detalle: false,
          clasificacion_cobertura: "SIN_DETALLE",
          productos_total: null,
          productos_confirmados: 0,
          productos_posibles: 0,
          productos_pendientes: null,
          cobertura_confirmada_pct: null,
        };
      }
      const productLines = lines(detail),
        saved = tracks.get(code) ?? [],
        byKey = new Map(saved.map((x) => [String(x.producto_key), x]));
      const expanded = productLines.map((line) =>
        byKey.get(line.key) ?? { producto_key: line.key, estado: "SIN_EVALUAR" }
      );
      const coverage = classify(productLines.length, expanded);
      return {
        ...r,
        tiene_detalle: true,
        clasificacion_cobertura: coverage.clasificacion,
        productos_total: coverage.total,
        productos_confirmados: coverage.confirmadas,
        productos_posibles: coverage.posibles,
        productos_pendientes: coverage.pendientes,
        cobertura_confirmada_pct: coverage.cobertura_confirmada_pct,
      };
    });
    if (trackingFilter === "parcial") {
      rows = rows.filter((r) =>
        r.clasificacion_cobertura === "COBERTURA_PARCIAL"
      );
    }
    if (trackingFilter === "pendientes") {
      rows = rows.filter((r) =>
        r.tiene_detalle === true && Number(r.productos_pendientes) > 0
      );
    }
    if (trackingFilter === "sin_detalle") {
      rows = rows.filter((r) => r.tiene_detalle === false);
    }
    const total = rows.length, size = 25;
    return reply({
      items: rows.slice((page - 1) * size, page * size),
      total,
      pagina: page,
      por_pagina: size,
      parcial: opportunities.partial,
    });
  }
  return reply({ error: "Acción no válida" }, 400);
}));
