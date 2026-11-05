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

function safeProjection(row: Record<string, unknown>, allowed: string[]) {
  return Object.fromEntries(
    allowed.filter((key) => key in row).map((key) => [key, row[key]]),
  );
}

function text(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return reply({ error: "Método no permitido" }, 405);
  }

  const userId = ctx.userClaims?.id;
  const allowedRaw = Deno.env.get("CRESCE_ALLOWED_USER_IDS")?.trim() ?? "";
  const allowedIds = allowedRaw.split(/[\s,]+/).filter(Boolean);
  if (!allowedIds.length) {
    return reply({ error: "Acceso comercial no configurado" }, 403);
  }
  if (typeof userId !== "string" || !allowedIds.includes(userId)) {
    return reply({ error: "No autorizado para datos comerciales" }, 403);
  }

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return reply({ error: "Cuerpo JSON inválido" }, 400);
  }
  if (!isRecord(input)) {
    return reply({ error: "El cuerpo debe ser un objeto JSON" }, 400);
  }
  const db = ctx.supabaseAdmin;

  if (input.consulta === "resumen") {
    const now = new Date().toISOString();
    const [allCount, upcomingCount, regions, executions] = await Promise.all([
      db.from("compra_agil_oportunidades").select("codigo", {
        count: "exact",
        head: true,
      }),
      db.from("compra_agil_oportunidades").select("codigo", {
        count: "exact",
        head: true,
      }).gt("fecha_cierre", now),
      db.from("compra_agil_oportunidades").select("region").not(
        "region",
        "is",
        null,
      ).limit(1000),
      db.from("compra_agil_ejecuciones").select(
        "inicio, termino, estado, oportunidades_encontradas, oportunidades_nuevas",
      ).order("inicio", { ascending: false }).limit(5),
    ]);
    const error = allCount.error ?? upcomingCount.error ?? regions.error ??
      executions.error;
    if (error) {
      return reply({ error: "No se pudo cargar el resumen comercial" }, 500);
    }
    const counts = new Map<string, number>();
    const rows = [...(regions.data ?? [])];
    for (
      let offset = rows.length;
      rows.length === offset && offset < 10_000;
      offset += 1000
    ) {
      const { data, error: pageError } = await db.from(
        "compra_agil_oportunidades",
      )
        .select("region").not("region", "is", null).range(offset, offset + 999);
      if (pageError) {
        return reply(
          { error: "No se pudo completar el resumen por región" },
          500,
        );
      }
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
    for (const row of rows) {
      const name = text(row.region, 100);
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return reply({
      oportunidades: allCount.count ?? 0,
      cierres_futuros_verificables: upcomingCount.count ?? 0,
      compras_por_region: [...counts].map(([region, cantidad]) => ({
        region,
        cantidad,
      })).sort((a, b) => b.cantidad - a.cantidad),
      regiones_parcial: rows.length >= 10_000,
      consultas_recientes: executions.data ?? [],
    });
  }

  if (input.consulta === "oportunidades") {
    const page =
      typeof input.pagina === "number" && Number.isInteger(input.pagina)
        ? input.pagina
        : 1;
    if (page < 1 || page > 10000) {
      return reply({ error: "Página fuera de rango" }, 400);
    }
    const region = text(input.region, 100);
    const from = text(input.desde, 10);
    const to = text(input.hasta, 10);
    const min = input.monto_minimo === "" || input.monto_minimo == null
      ? null
      : Number(input.monto_minimo);
    const max = input.monto_maximo === "" || input.monto_maximo == null
      ? null
      : Number(input.monto_maximo);
    const query = text(input.texto, 100).toLocaleLowerCase("es");
    const sortColumns: Record<string, string> = {
      fecha_publicacion: "fecha_publicacion",
      fecha_cierre: "fecha_cierre",
      monto_estimado: "monto_estimado",
      nombre: "nombre",
    };
    const sort = sortColumns[String(input.orden ?? "fecha_publicacion")] ??
      sortColumns.fecha_publicacion;
    const ascending = input.direccion === "asc";
    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return reply({ error: "Fecha inicial inválida" }, 400);
    }
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return reply({ error: "Fecha final inválida" }, 400);
    }
    if (
      (min !== null && (!Number.isFinite(min) || min < 0)) ||
      (max !== null && (!Number.isFinite(max) || max < 0)) ||
      (min !== null && max !== null && min > max)
    ) {
      return reply({ error: "Rango de monto inválido" }, 400);
    }

    const { data, error } = await db.from("compra_agil_oportunidades")
      .select(
        "codigo, nombre, descripcion, organismo, region, monto_estimado, fecha_publicacion, fecha_cierre, estado, datos_originales, primera_deteccion, ultima_revision",
        { count: "exact" },
      )
      .order(sort, { ascending, nullsFirst: false })
      .range(0, 999);
    if (error) {
      return reply(
        { error: "No se pudieron consultar las oportunidades" },
        500,
      );
    }

    let rows = (data ?? []).filter((row) => {
      if (region && row.region !== region) return false;
      const publication = typeof row.fecha_publicacion === "string"
        ? row.fecha_publicacion.slice(0, 10)
        : "";
      if (from && publication < from) return false;
      if (to && publication > to) return false;
      if (
        min !== null &&
        (typeof row.monto_estimado !== "number" || row.monto_estimado < min)
      ) return false;
      if (
        max !== null &&
        (typeof row.monto_estimado !== "number" || row.monto_estimado > max)
      ) return false;
      if (
        query &&
        ![row.codigo, row.nombre, row.organismo].some((value) =>
          typeof value === "string" &&
          value.toLocaleLowerCase("es").includes(query)
        )
      ) return false;
      return true;
    });
    if (
      sort === "monto_estimado" || sort === "fecha_publicacion" ||
      sort === "fecha_cierre" || sort === "nombre"
    ) {
      rows.sort((a, b) => {
        const left = a[sort];
        const right = b[sort];
        if (left == null) return 1;
        if (right == null) return -1;
        const cmp = typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "es");
        return ascending ? cmp : -cmp;
      });
    }
    const totalFiltrado = rows.length;
    const limit = 25;
    rows = rows.slice((page - 1) * limit, page * limit);
    return reply({
      items: rows,
      total: totalFiltrado,
      pagina: page,
      por_pagina: limit,
      parcial: (data?.length ?? 0) >= 1000,
    });
  }

  if (input.consulta === "detalle") {
    const codigo = text(input.codigo, 40);
    if (!/^\d+-\d+-COT\d{2}$/.test(codigo)) {
      return reply({ error: "Código de oportunidad inválido" }, 400);
    }
    const { data, error } = await db.from("compra_agil_detalles")
      .select("codigo, datos_detalle, fecha_consulta, fecha_actualizacion")
      .eq("codigo", codigo)
      .maybeSingle();
    if (error) return reply({ error: "No se pudo consultar el detalle" }, 500);
    if (!data) {
      return reply({
        detalle: null,
        mensaje: "Aún no hay detalle almacenado para esta oportunidad",
      });
    }
    return reply({ detalle: data });
  }

  if (input.consulta === "proveedores") {
    const query = text(input.texto, 100).toLocaleLowerCase("es");
    const requestedProvider = text(input.proveedor, 40).toLocaleLowerCase("es");
    // Las columnas de estas fuentes varían por catálogo; se leen páginas acotadas y se proyecta en memoria.
    const [providersResult, productsResult, pricesResult, coneResult] =
      await Promise.all([
        db.from("trovo_proveedores").select("*").limit(50),
        db.from("trovo_productos_proveedor").select("*").limit(1000),
        db.from("trovo_precios_proveedor").select("*").limit(2000),
        db.from("trovo_cone_catalogo_revisado").select(
          "proveedor_clave, codigo_proveedor, nombre_producto, pagina_pdf, precio_catalogo_iva, costo_iva_verificado, unidad_precio, estado_validacion",
        ).limit(1000),
      ]);
    const errors = [providersResult, productsResult, pricesResult, coneResult]
      .flatMap((result, index) =>
        result.error
          ? [["proveedores", "productos", "precios", "catalogo_cone"][index]]
          : []
      );
    if (errors.length === 4) {
      return reply({ error: "No se pudieron consultar los catálogos" }, 500);
    }

    const providers = new Map<string, Record<string, unknown>>(
      (providersResult.data ?? []).filter(isRecord).map((
        row,
      ): [string, Record<string, unknown>] => [String(row.id), row]),
    );
    const pricesByProduct = new Map<string, Record<string, unknown>[]>();
    for (const raw of pricesResult.data ?? []) {
      if (!isRecord(raw) || raw.producto_id == null) continue;
      const key = String(raw.producto_id);
      pricesByProduct.set(key, [...(pricesByProduct.get(key) ?? []), raw]);
    }
    const safeKeys = [
      "id",
      "clave",
      "codigo",
      "codigo_proveedor",
      "clave_articulo",
      "nombre",
      "descripcion",
      "marca",
      "estado_revision",
      "stock_proveedor",
      "precio_publicado_clp",
      "presentacion_precio",
      "cantidad_minima",
      "tratamiento_iva",
      "precio_confirmado",
      "observaciones",
      "unidad",
      "formato",
    ];
    const items: Record<string, unknown>[] = [];
    for (const raw of productsResult.data ?? []) {
      if (!isRecord(raw)) continue;
      const provider = providers.get(String(raw.proveedor_id));
      const providerKey = text(provider?.clave, 40).toLocaleLowerCase("es");
      if (requestedProvider && providerKey !== requestedProvider) continue;
      const product = safeProjection(raw, safeKeys);
      const productPrices = (pricesByProduct.get(String(raw.id)) ?? []).map((
        price,
      ) => safeProjection(price, safeKeys));
      const searchable = JSON.stringify([product, provider?.clave])
        .toLocaleLowerCase("es");
      if (query && !searchable.includes(query)) continue;
      items.push({
        proveedor: provider?.clave ?? "Proveedor no identificado",
        producto: product,
        precios: productPrices,
      });
    }
    for (const raw of coneResult.data ?? []) {
      if (!isRecord(raw)) continue;
      const row = safeProjection(raw, [
        "proveedor_clave",
        "codigo_proveedor",
        "nombre_producto",
        "pagina_pdf",
        "precio_catalogo_iva",
        "costo_iva_verificado",
        "unidad_precio",
        "estado_validacion",
      ]);
      const searchable = JSON.stringify(row).toLocaleLowerCase("es");
      const providerKey = text(row.proveedor_clave, 40).toLocaleLowerCase("es");
      if (requestedProvider && requestedProvider !== "cone") continue;
      if (query && !searchable.includes(query)) continue;
      items.push({
        proveedor: "cone",
        producto: row,
        precios: [],
        origen: "trovo_cone_catalogo_revisado",
      });
    }
    return reply({
      items: items.slice(0, 300),
      errores_fuentes: errors,
      parcial: items.length > 300,
    });
  }

  return reply({ error: "Consulta no válida" }, 400);
}));
