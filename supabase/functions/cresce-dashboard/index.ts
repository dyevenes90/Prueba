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

function normalizeRegion(value: unknown) {
  return text(value, 100)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/^region\s+de\s+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value: unknown) {
  return text(value, 100).replace(/\s+/g, "").toLocaleUpperCase("es");
}

async function readPages(
  makePage: (from: number, to: number) => PromiseLike<{
    data: Record<string, unknown>[] | null;
    error: unknown;
  }>,
) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 10_000; from += 1000) {
    const { data, error } = await makePage(from, from + 999);
    if (error) return { rows, error: true, parcial: false };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < 1000) return { rows, error: false, parcial: false };
  }
  return { rows, error: false, parcial: true };
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
    const counts = new Map<string, { region: string; cantidad: number }>();
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
      const rawName = text(row.region, 100);
      const key = normalizeRegion(rawName);
      if (!key) continue;
      const name = rawName.replace(/^regi[oó]n\s+de\s+/iu, "").trim();
      const count = counts.get(key);
      if (count) {
        count.cantidad++;
        if (name.length < count.region.length) count.region = name;
      } else counts.set(key, { region: name, cantidad: 1 });
    }
    return reply({
      oportunidades: allCount.count ?? 0,
      cierres_futuros_verificables: upcomingCount.count ?? 0,
      compras_por_region: [...counts.values()].sort((a, b) =>
        b.cantidad - a.cantidad
      ),
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

    const result = await readPages((start, end) => {
      let request = db.from("compra_agil_oportunidades")
        .select(
          "codigo, nombre, descripcion, organismo, region, monto_estimado, fecha_publicacion, fecha_cierre, estado, datos_originales, primera_deteccion, ultima_revision",
        )
        .order(sort, { ascending, nullsFirst: false })
        .order("codigo", { ascending: true });
      if (from) {
        request = request.gte(
          "fecha_publicacion",
          `${from}T00:00:00.000Z`,
        );
      }
      if (to) {
        const dayAfter = new Date(`${to}T00:00:00.000Z`);
        dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
        request = request.lt("fecha_publicacion", dayAfter.toISOString());
      }
      if (min !== null) request = request.gte("monto_estimado", min);
      if (max !== null) request = request.lte("monto_estimado", max);
      const safeQuery = query.replace(/[,*()%_\\]/g, " ").trim();
      if (safeQuery) {
        request = request.or(
          `codigo.ilike.%${safeQuery}%,nombre.ilike.%${safeQuery}%,organismo.ilike.%${safeQuery}%`,
        );
      }
      return request.range(start, end);
    });
    if (result.error) {
      return reply(
        { error: "No se pudieron consultar las oportunidades" },
        500,
      );
    }

    const regionKey = normalizeRegion(region);
    const rows = regionKey
      ? result.rows.filter((row) => normalizeRegion(row.region) === regionKey)
      : result.rows;
    const totalFiltrado = rows.length;
    const limit = 25;
    const items = rows.slice((page - 1) * limit, page * limit);
    return reply({
      items,
      total: totalFiltrado,
      pagina: page,
      por_pagina: limit,
      parcial: result.parcial,
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
    if (
      requestedProvider &&
      !["cone", "herbanatura", "silcam"].includes(requestedProvider)
    ) {
      return reply({ error: "Proveedor no vÃ¡lido" }, 400);
    }
    const safeQuery = query.replace(/[,*()%_\\]/g, " ").trim();
    const providersResult = await readPages((start, end) => {
      let request = db.from("trovo_proveedores").select("id, clave").order(
        "clave",
      );
      if (requestedProvider) {
        request = request.ilike("clave", requestedProvider);
      }
      return request.range(start, end);
    });
    const errors: string[] = [];
    if (providersResult.error) errors.push("proveedores");
    const providers = new Map<string, Record<string, unknown>>(
      providersResult.rows.map((row) => [String(row.id), row]),
    );
    const providerIds = providersResult.rows
      .filter((row) =>
        !requestedProvider ||
        text(row.clave, 40).toLocaleLowerCase("es") === requestedProvider
      )
      .map((row) => row.id);
    const productsResult = !requestedProvider || providerIds.length
      ? await readPages((start, end) => {
        let request = db.from("trovo_productos_proveedor").select("*").order(
          "id",
        );
        if (requestedProvider) {
          request = request.in("proveedor_id", providerIds);
        }
        if (safeQuery) {
          request = request.or(
            `codigo_proveedor.ilike.%${safeQuery}%,clave_articulo.ilike.%${safeQuery}%,nombre.ilike.%${safeQuery}%`,
          );
        }
        return request.range(start, end);
      })
      : { rows: [], error: false, parcial: false };
    const coneResult = !requestedProvider || requestedProvider === "cone"
      ? await readPages((start, end) => {
        let request = db.from("trovo_cone_catalogo_revisado").select("*").order(
          "codigo_proveedor",
        );
        if (safeQuery) {
          request = request.or(
            `codigo_proveedor.ilike.%${safeQuery}%,nombre_producto.ilike.%${safeQuery}%,proveedor_clave.ilike.%${safeQuery}%`,
          );
        }
        return request.range(start, end);
      })
      : { rows: [], error: false, parcial: false };
    if (productsResult.error) errors.push("productos");
    if (coneResult.error) errors.push("catalogo_cone");
    if (errors.length >= 3) {
      return reply({ error: "No se pudieron consultar los catálogos" }, 500);
    }

    const pricesByProduct = new Map<string, Record<string, unknown>[]>();
    let pricesParcial = false;
    const productIds = productsResult.rows.map((row) => row.id).filter((id) =>
      id != null
    );
    for (let offset = 0; offset < productIds.length; offset += 250) {
      const ids = productIds.slice(offset, offset + 250);
      const priceResult = await readPages((start, end) =>
        db.from("trovo_precios_proveedor").select("*").in("producto_id", ids)
          .order("producto_id").range(start, end)
      );
      if (priceResult.error) {
        if (!errors.includes("precios")) errors.push("precios");
        continue;
      }
      pricesParcial ||= priceResult.parcial;
      for (const raw of priceResult.rows) {
        if (raw.producto_id == null) continue;
        const key = String(raw.producto_id);
        pricesByProduct.set(key, [...(pricesByProduct.get(key) ?? []), raw]);
      }
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
    type CatalogItem = {
      proveedor: string;
      codigo: string;
      producto: Record<string, unknown>;
      precios: Record<string, unknown>[];
      fuentes: Set<string>;
    };
    const grouped = new Map<string, CatalogItem>();
    const getItem = (provider: string, code: unknown, fallback: unknown) => {
      const displayCode = text(code, 100);
      const keyCode = normalizeCode(displayCode) || `id:${String(fallback)}`;
      const key = `${provider.toLocaleLowerCase("es")}\u0000${keyCode}`;
      let item = grouped.get(key);
      if (!item) {
        item = {
          proveedor: provider,
          codigo: displayCode,
          producto: {},
          precios: [],
          fuentes: new Set<string>(),
        };
        grouped.set(key, item);
      }
      return item;
    };
    const mergeProduct = (
      target: Record<string, unknown>,
      source: Record<string, unknown>,
      preferSource: boolean,
    ) => {
      for (const [key, value] of Object.entries(source)) {
        if (value === null || value === undefined || value === "") continue;
        if (
          preferSource || target[key] === null || target[key] === undefined ||
          target[key] === ""
        ) {
          target[key] = value;
        }
      }
    };
    for (const raw of productsResult.rows) {
      const provider = providers.get(String(raw.proveedor_id));
      const providerKey = text(provider?.clave, 40).toLocaleLowerCase("es");
      if (requestedProvider && providerKey !== requestedProvider) continue;
      const product = safeProjection(raw, safeKeys);
      const productPrices = (pricesByProduct.get(String(raw.id)) ?? []).map((
        price,
      ) => ({
        ...safeProjection(price, safeKeys),
        fuente_origen: "trovo_precios_proveedor",
      }));
      const item = getItem(
        providerKey || "Proveedor no identificado",
        raw.codigo_proveedor ?? raw.clave_articulo,
        raw.id,
      );
      mergeProduct(item.producto, product, false);
      item.fuentes.add("trovo_productos_proveedor");
      if (productPrices.length) item.fuentes.add("trovo_precios_proveedor");
      item.precios.push(...productPrices);
    }
    const coneKeys = [
      "proveedor_clave",
      "codigo_proveedor",
      "nombre_producto",
      "pagina_pdf",
      "precio_catalogo_iva",
      "costo_iva_verificado",
      "unidad_precio",
      "estado_validacion",
      "fecha_vigencia",
    ];
    for (const raw of coneResult.rows) {
      const row = safeProjection(raw, coneKeys);
      const providerKey = text(row.proveedor_clave, 40).toLocaleLowerCase("es");
      if (requestedProvider && requestedProvider !== "cone") continue;
      const item = getItem(
        providerKey || "cone",
        row.codigo_proveedor,
        row.codigo_proveedor,
      );
      const mapped = {
        ...row,
        nombre: row.nombre_producto,
        estado_revision: row.estado_validacion,
        presentacion_precio: row.unidad_precio,
      };
      mergeProduct(item.producto, mapped, true);
      item.fuentes.add("trovo_cone_catalogo_revisado");
      if (
        row.precio_catalogo_iva !== null &&
        row.precio_catalogo_iva !== undefined
      ) {
        item.precios.push({
          precio_publicado_clp: row.precio_catalogo_iva,
          presentacion_precio: row.unidad_precio,
          estado_validacion: row.estado_validacion,
          fecha_vigencia: row.fecha_vigencia,
          fuente_origen: "trovo_cone_catalogo_revisado",
        });
      }
    }
    const needle = query.normalize("NFD").replace(/\p{M}/gu, "");
    const items = [...grouped.values()].filter((item) => {
      if (!needle) return true;
      const contents = JSON.stringify(item.producto).normalize("NFD")
        .replace(/\p{M}/gu, "").toLocaleLowerCase("es");
      return normalizeCode(item.codigo).includes(normalizeCode(query)) ||
        contents.includes(needle);
    }).map((item) => {
      const prices = [
        ...new Set(
          item.precios.map((price) => {
            const value = Number(price.precio_publicado_clp);
            return Number.isFinite(value) ? value : null;
          }).filter((value): value is number => value !== null),
        ),
      ];
      const conflicto = prices.length > 1;
      const reviewedValue = item.proveedor.toLocaleLowerCase("es") === "cone"
        ? item.producto.precio_catalogo_iva
        : null;
      const reviewed = reviewedValue == null || reviewedValue === ""
        ? Number.NaN
        : Number(reviewedValue);
      const candidate = Number.isFinite(reviewed)
        ? reviewed
        : prices[0] ?? null;
      return {
        proveedor: item.proveedor,
        codigo: item.codigo,
        producto: item.producto,
        precios: item.precios,
        fuentes: [...item.fuentes],
        conflicto_precios: conflicto,
        precio_publicado_con_iva: conflicto ? null : candidate,
        parcial: productsResult.parcial || coneResult.parcial || pricesParcial,
      };
    });
    return reply({
      items: items.slice(0, 300),
      errores_fuentes: errors,
      parcial: productsResult.parcial || coneResult.parcial || pricesParcial ||
        items.length > 300,
    });
  }

  return reply({ error: "Consulta no válida" }, 400);
}));
