# Compra Ágil — registro de activación limitada (2026-11-25)

## Estado

**PARCIAL — listo para ejecutar la prueba de una página desde una sesión CRESCE autorizada.** La operación real no se ejecutó desde este entorno: el Preview redirige al inicio de sesión de Vercel y no hay una sesión de CRESCE accesible aquí. No se utilizaron credenciales privilegiadas para eludir la autorización.

## Evidencia revisada

- PR #4 permanece abierta y en borrador en `review/compra-agil-doble-flujo-20261123`, head `71a0f738668e3dff151f7ac0170e8cbc559fbee8`.
- GitHub Actions del commit `71a0f73`: integración PostgreSQL completada con éxito (run `45712159873`).
- Vercel generó deployment `READY` para ese mismo SHA: `https://registro-datos-araucania-8byzw4ie7-prueba-araucania.vercel.app`. Una solicitud sin autenticación termina en la pantalla de login de Vercel.
- Supabase mantiene activas las migraciones prioritarias `20261123000100`, `20261123000200` y `20261123000300`. `compra-agil-sync` está en versión 16 con `verify_jwt=false`; el fuente desplegado de `index.ts`, motor, autorización y servicio prioritario coincide con la rama.
- Las solicitudes al handler están autorizadas internamente con `auth: ["user", "secret:cron"]`, UUID contra `CRESCE_ALLOWED_USER_IDS` para usuarios y restricción de la clave Cron a acciones programadas. Los nombres de los secretos `CRESCE_ALLOWED_USER_IDS` y `MERCADOPUBLICO_TICKET` existen; sus valores no se leyeron.
- Las comprobaciones de solo lectura registraron 1.414 oportunidades, 16 checkpoints históricos y 2 prioritarios. Las ventanas históricas de regiones 9 y 14 permanecen en páginas 31/99 y 7/36, modo `strict_utc`; ambos bloqueos están liberados. Los checkpoints prioritarios de ambas regiones siguen sin página exitosa.
- Los logs de `compra-agil-sync` muestran respuestas HTTP 409 el 25-11 a las 22:15:34, 22:16:57 y 22:23:19 UTC. El único `409` del handler se devuelve para `buscar_compras_nuevas` antes de que Araucanía tenga una página prioritaria exitosa. No hay evidencia de una llamada a `prueba_prioritaria_una_pagina` en esos registros.
- En el frontend publicado, `Probar 1 página - Araucanía` envía `{"accion":"prueba_prioritaria_una_pagina"}`. El backend fuerza región 9, una página y presupuesto de **una solicitud total**, incluidos reintentos; cualquier error o 429 detiene el avance de esa página. Se conserva separada la ventana histórica.

## Verificaciones locales

- Deno 2.8.0: **39/39 pruebas** de motor, autorización y servicio prioritario aprobadas.
- Fixture saneado offline: **4/4 pruebas** aprobadas.
- `node --check app.js`: OK.
- `git diff --check`: OK.
- GitHub Actions PostgreSQL: éxito (arriba). No se ejecutó llamada a ChileCompra ni escritura de producción.

## Siguiente operación

En el Preview, iniciar sesión normalmente con el usuario autorizado, abrir Compra Ágil y pulsar una vez **“Probar 1 página - Araucanía”**. Revisar que el resumen muestre una solicitud, una página, códigos, conteos y checkpoint. Si falla, detenerse y conservar el mensaje; no repetir ni pulsar “Buscar compras nuevas” hasta ver la página prioritaria exitosa. No activar Cron ni continuar el histórico como parte de esta prueba.

La respuesta 409 de “Buscar compras nuevas” es la precondición deliberada, no una prueba fallida de ChileCompra. No se cambió código ni datos productivos en esta revisión.
