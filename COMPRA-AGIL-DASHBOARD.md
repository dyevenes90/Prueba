# Habilitar Compra Ágil privada

1. En Supabase Auth desactiva el registro público y crea manualmente cada usuario autorizado.
2. Configura el secreto de la Edge Function `CRESCE_ALLOWED_USER_IDS` con los UUID autorizados, separados por comas. La función deniega el acceso si no está configurado.
3. Completa `supabase-config.js` con la URL del proyecto y su clave pública `sb_publishable_`. Nunca pongas ahí `service_role`, claves secretas ni el ticket de Mercado Público.
4. Despliega manualmente `cresce-dashboard` cuando corresponda. `supabase/config.toml` conserva `verify_jwt = true`; la función valida el usuario y su UUID antes de acceder a `ctx.supabaseAdmin`.

El navegador solo llama la función con la sesión Supabase Auth. No hay formulario de registro. El panel no automatiza ni envía ofertas.

La función consulta las tablas de Compra Ágil con columnas conocidas. Para los catálogos consulta `trovo_proveedores`, `trovo_productos_proveedor` y `trovo_precios_proveedor` con límites y proyecta campos permitidos. Para `trovo_cone_catalogo_revisado`, solicita solamente `proveedor_clave`, `codigo_proveedor`, `nombre_producto`, `pagina_pdf`, `precio_catalogo_iva`, `costo_iva_verificado`, `unidad_precio` y `estado_validacion`; si la estructura real difiere, informa error de esa fuente. Los conteos por región recorren hasta 10.000 registros y señalan si alcanzan ese límite; el Radar también marca conjuntos de más de 1.000 como parciales.

La fecha se muestra en hora de Chile solo cuando Supabase devuelve zona horaria explícita. El cálculo de cierre futuro usa `fecha_cierre` en la base y no sustituye la revisión de vigencia de la oportunidad.
