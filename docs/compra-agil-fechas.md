# Fechas de Compra Ágil v2

`COMPRA_AGIL_API_DATE_MODE` es configuración exclusiva del servidor Edge Function. Su valor por defecto es `strict_utc`; solo admite `strict_utc` o `chile_wall_z`. Un valor desconocido detiene la sincronización antes de consultar la API.

- `strict_utc`: conserva el significado ISO-8601 documentado de las marcas con `Z` y envía `cambio_desde`/`cambio_hasta` como instantes UTC.
- `chile_wall_z`: aplica la hipótesis empírica solo a `fechas.fecha_ultimo_cambio` con sufijo `Z`, tratándolo como hora civil de `America/Santiago`. También serializa ambos límites de consulta como hora civil chilena con `Z`, para que el filtro de la API compare el mismo formato. Los offsets numéricos explícitos siguen siendo instantes absolutos.

`fecha_publicacion` y `fecha_cierre` conservan su tratamiento independiente: offsets explícitos son instantes y las fechas sin zona se convierten desde hora civil chilena. El JSON original de Mercado Público nunca se reescribe. Los cursores/checkpoints siguen guardándose como instantes UTC y permanecen separados entre los flujos prioritario e histórico.

Mantener `strict_utc` hasta validar la discrepancia de una ficha oficial para el mismo proceso y hora. Después de esa verificación, se puede configurar `COMPRA_AGIL_API_DATE_MODE=chile_wall_z` en el entorno servidor de Supabase Edge Functions antes de iniciar una sincronización controlada. No exponer esta configuración ni el ticket al frontend.
