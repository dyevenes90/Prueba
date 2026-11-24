# Fechas de Compra Ágil v2

`COMPRA_AGIL_API_DATE_MODE` es configuración exclusiva del servidor Edge Function. Su valor por defecto es `strict_utc`; solo admite `strict_utc` o `chile_wall_z`. Un valor desconocido detiene la sincronización antes de consultar la API.

- `strict_utc`: conserva el significado ISO-8601 documentado de las marcas con `Z` y envía `cambio_desde`/`cambio_hasta` como instantes UTC.
- `chile_wall_z`: aplica la hipótesis empírica solo a `fechas.fecha_ultimo_cambio` con sufijo `Z`, tratándolo como hora civil de `America/Santiago`. También serializa ambos límites de consulta como hora civil chilena con `Z`, para que el filtro de la API compare el mismo formato. Los offsets numéricos explícitos siguen siendo instantes absolutos.

`fecha_publicacion` y `fecha_cierre` conservan su tratamiento independiente: offsets explícitos son instantes y las fechas sin zona se convierten desde hora civil chilena. El JSON original de Mercado Público nunca se reescribe. Los cursores/checkpoints siguen guardándose como instantes UTC y permanecen separados entre los flujos prioritario e histórico.

Mantener `strict_utc` hasta validar la discrepancia de una ficha oficial para el mismo proceso y hora. Después de esa verificación, se puede configurar `COMPRA_AGIL_API_DATE_MODE=chile_wall_z` en el entorno servidor de Supabase Edge Functions antes de iniciar una sincronización controlada. No exponer esta configuración ni el ticket al frontend.

## Modo fijo por checkpoint

La migración `20261123000300_compra_agil_sync_checkpoint_date_mode.sql` registra `date_mode` en ambos checkpoints. Las ventanas existentes se inicializan como `strict_utc`, que era el comportamiento anterior. El inicio de una ventana nueva fija su modo; las continuaciones con otro modo se rechazan antes de llamar a la API. Para terminar una ventana en curso, vuelva temporalmente a su modo guardado, deje que complete, y cambie la configuración solo antes de abrir otra ventana. No edite cursores a mano.

## Captura y prueba de una página real

`supabase/ops_compra_agil_fixture.mjs` consulta una sola página pequeña (región 9 por defecto, 48 horas, página 1, tamaño 10) con el ticket exclusivamente desde `MERCADOPUBLICO_TICKET`. Emite un fixture con códigos, estado, región, fechas originales y monto. Omite descripción, comprador, contactos, adjuntos, cabeceras y campos desconocidos. No muestra ni guarda el ticket.

Desde PowerShell, el ticket se solicita de forma oculta; la variable se elimina al terminar:

```powershell
$secure = Read-Host 'Ticket ChileCompra' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:MERCADOPUBLICO_TICKET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  node --experimental-strip-types .\supabase\ops_compra_agil_fixture.mjs --fetch --output .\supabase\tests\fixtures\compra-agil-real-page.json
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  Remove-Item Env:MERCADOPUBLICO_TICKET -ErrorAction SilentlyContinue
  $secure.Dispose()
}
```

El comando hace una solicitud. Si ya existe el JSON de respuesta, use `--input <archivo>` y proporcione `--window-from` y `--window-to` originales para no consumir cuota otra vez. Revise el fixture saneado antes de incluirlo en la rama de revisión. Actions lo detecta y ejecuta la misma página contra PostgreSQL efímero en ambos modos, verificando clasificación/paginación, rechazo de cambio de modo, idempotencia, duplicados y conservación del checkpoint histórico; toda la transacción termina en rollback.

Sin un snapshot previo almacenado, el comparador puede mostrar si el cambio queda después de la publicación en cada modo, pero no afirmar que la oportunidad se actualizó respecto a CRESCE.
