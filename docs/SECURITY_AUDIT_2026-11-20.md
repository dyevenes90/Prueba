# CRESCE — auditoría defensiva (20-11-2026)

> **Alcance:** inspección estática de la rama `desarrollo-comercial` y documentación de verificaciones seguras. **No es un pentest ni certifica la seguridad de producción.** No se ha ejecutado ninguna sentencia sobre la base de datos de producción.

## 1. Estado observado y evidencias

- Frontend: `index.html`, `app.js`, `styles.css`, `supabase-config.js`; Vercel.
- Backend: seis Edge Functions en Supabase; `supabase/config.toml`.
- El frontend usa una clave `sb_publishable_` (normal para cliente); no se constató una clave de servicio o una clave OpenAI incrustada en los principales archivos inspeccionados. **No sustituye un escaneo de todo el repositorio e historial Git.**
- `cresce-dashboard`, `compra-agil-detalle`, `compra-agil-seguimiento`, `compra-agil-documentos` y `trovo-catalogos-revision` tienen `verify_jwt = true`, `auth: "user"`, allowlist `CRESCE_ALLOWED_USER_IDS`, y acceso posterior a `ctx.supabaseAdmin`.
- `compra-agil-sync` tiene `verify_jwt = false` para admitir `auth: ["user", "secret:cron"]`; comprueba identidad allowlist para usuario y limita la modalidad cron a `sincronizacion_programada`. **Revalidar en entorno desplegado y probar rechazo de llamadas anónimas.**
- Las Edge Functions devuelven actualmente `Access-Control-Allow-Origin: *`; esto no desactiva JWT ni autoriza por sí mismo, pero debería restringirse a orígenes conocidos tras probar previews y localhost.
- El frontend carga `@supabase/supabase-js@2` desde CDN sin versión exacta; el HTML tiene un script inline. Antes de imponer `script-src` estricta, separar ese script y fijar versión e integridad o servir localmente.
- Las consultas `ctx.supabaseAdmin` **omiten RLS**. Con allowlist pueden ser justificadas para una única empresa, pero NO son aislamiento entre empresas ni reemplazan RLS. Antes de habilitar usuarios de distintos módulos/empresas, implementar autorización por módulo/empresa y filtrado de registros en servidor.
- No se ha verificado RLS ni grants del PostgreSQL desplegado, almacenamiento de secretos en el entorno, buckets, ni las cabeceras HTTP efectivamente desplegadas.
- La nueva PR de endurecimiento incluye un `.gitignore` y cabeceras de Vercel conservadoras. No está fusionada ni desplegada.

## 2. SQL de diagnóstico de SOLO LECTURA

Ejecutar en **Supabase Dashboard > SQL Editor** del proyecto correcto. Estas consultas muestran metadatos, no modifican datos ni configuración. Revisar el resultado antes de compartirlo; si hay nombres de tablas sensibles, pueden redactarse.

### 2.1 Tablas y RLS

```sql
SELECT
  n.nspname AS schema,
  c.relname AS tabla,
  CASE c.relkind WHEN 'p' THEN 'particionada' ELSE 'tabla' END AS tipo,
  c.relrowsecurity AS rls_activado,
  c.relforcerowsecurity AS rls_forzado,
  has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
  has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
  has_table_privilege('anon', c.oid, 'UPDATE') AS anon_update,
  has_table_privilege('anon', c.oid, 'DELETE') AS anon_delete,
  has_table_privilege('authenticated', c.oid, 'SELECT') AS autenticado_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') AS autenticado_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') AS autenticado_update,
  has_table_privilege('authenticated', c.oid, 'DELETE') AS autenticado_delete
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
ORDER BY c.relrowsecurity ASC, n.nspname, c.relname;
```

**Importante:** que haya un GRANT no significa que RLS permita leer filas; **ambos** deben evaluarse. RLS desactivado en una tabla expuesta con grants para anon/authenticated es crítico. Si todas las consultas se hacen con `supabaseAdmin`, RLS no detiene el acceso por esa vía.

### 2.2 Políticas RLS

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;
```

Prestar atención a `USING (true)`, `WITH CHECK (true)`, políticas para `public` o `anon`, y comparaciones contra `auth.uid()`. Una política abierta podría ser intencional para datos públicos, pero necesita justificación.

### 2.3 Almacenamiento

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets ORDER BY name;
```

El bucket `compra-agil-documentos` debe ser privado. Revisar además las políticas de `storage.objects` y si se usan enlaces firmados con expiración limitada.

### 2.4 Vistas potencialmente expositoras

```sql
SELECT n.nspname AS schema, c.relname AS vista, c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
ORDER BY vista;
```

Revisar vistas que omiten `security_invoker=true` y funciones `SECURITY DEFINER` expuestas, especialmente si devuelven datos comerciales.

## 3. Verificaciones manuales en paneles (sin revelar secretos)

1. **Supabase > Database > Advisors > Security Advisor:** guardar hallazgos; en particular RLS desactivado, políticas permisivas, vistas `security definer`, permisos `anon`.
2. **Supabase > Authentication > Providers:** confirmar que registro público no está permitido y que solo se han invitado usuarios autorizados; activar MFA donde sea posible.
3. **Supabase > Edge Functions:** confirmar cuáles funciones están desplegadas, `verify_jwt` efectivo y errores 401/403 para llamadas sin permisos. Especial atención a `compra-agil-sync`.
4. **Supabase > Project Settings > Edge Functions/Secrets:** confirmar **solo existencia y uso** de `CRESCE_ALLOWED_USER_IDS`, `MERCADOPUBLICO_TICKET` y credenciales necesarias. Nunca pegar valores en chats, consola compartida ni Git. No se observó prueba suficiente para afirmar que una clave OpenAI está activa.
5. **Supabase > Storage > Buckets:** confirmar privacidad del bucket documental.
6. **Vercel > Project > Settings:** confirmar protección de previews, dominio de producción, Environment Variables por ambiente y protección de despliegues. Revisar que GitHub Preview no exponga datos productivos sin Auth.
7. **Vercel Preview > DevTools > Network > index.html > Response Headers:** comprobar `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, y `Content-Security-Policy`. La PR de cabeceras debe desplegarse primero en su preview.
8. **GitHub > Settings > Security:** activar detección de secretos, Dependabot y protección de rama en la medida en que el plan lo permita. Ejecutar escaneo de todo el historial; `.gitignore` no borra secretos históricos.

## 4. Pruebas negativas defensivas (entorno de staging y usuario de prueba)

- Navegador sin sesión: solicitudes a funciones comerciales responden 401 o 403, nunca entregan registros.
- Sesión Supabase válida pero usuario NO incluido en `CRESCE_ALLOWED_USER_IDS`: acceso denegado para todas las funciones.
- Usuario autorizado: solo puede ver información de la empresa y módulo que corresponda. **Hoy la allowlist es general:** antes de multiempresa, añadir control server-side por empresa.
- Cron: una llamada de usuario no debe poder invocar `sincronizacion_programada`; el secreto de Cron no debe autorizar operaciones interactivas.
- Storage: no existe listado ni descarga pública de los anexos comerciales.
- Importaciones: rechazar archivos demasiado grandes, MIME no permitido y archivos corruptos. Confirmar validación de contenido, no solo el `file.type` declarado por navegador.
- Cierre de sesión: limpiar datos y estados visuales privados y verificar que una sesión revocada no puede recuperar archivos.
- Probar cambios con cuenta de baja autorización; **no hacer ataques de fuerza bruta, carga masiva o borrados sobre producción**.

## 5. Hallazgos a priorizar

| Prioridad | Hallazgo | Acción propuesta |
|---|---|---|
| P0 por verificar | Estado RLS/grants y buckets desplegados desconocido | Ejecutar SQL de solo lectura y Security Advisor; corregir según resultados, con migración revisada |
| P1 | `ctx.supabaseAdmin` con allowlist general | Preparar separación por empresa/módulo; acceso basado en usuario/empresa y usar `ctx.supabase` donde sea posible |
| P1 | Claves e historial no auditados | Escaneo integral de historial Git + Vercel/Supabase Secrets + rotación si hay fuga confirmada |
| P1 | `verify_jwt = false` en sync | Confirmar despliegue y negativos para secret cron/usuario/no autenticado |
| P2 | CORS comodín en funciones privadas | Restringir orígenes autorizados tras pruebas de previews |
| P2 | Dependencia CDN sin versión fija | Fijar versión, servir localmente o fijar integridad, eliminar inline JS y luego CSP más estricta |
| P2 | Headers de seguridad ausentes del código base antes de PR | Revisar, fusionar solo tras prueba de Preview y verificar respuesta HTTP real |

## 6. No perder funcionalidad

Nada de esto implica cambiar módulos, destruir tablas, desactivar APIs o hacer push a `main`. Revisar cambios en la PR de seguridad separada. El objetivo es que Trovofarma siga funcionando para Ximena y avanzar a rentabilidad/cotizaciones, manteniendo aprobación humana antes de publicar una oferta.


## 7. Verificación conectada del proyecto (20-11-2026)

Se confirmó por acceso de solo lectura a Supabase que el proyecto CRESCE está activo (`ACTIVE_HEALTHY`). Edge Functions desplegadas:
- `compra-agil-sync`: ACTIVE, versión 11, `verify_jwt=false` (modalidades `user` y `secret:cron` en código desplegado).
- `cresce-dashboard`: ACTIVE, versión 6, `verify_jwt=true`.
- `compra-agil-detalle`: ACTIVE, versión 5, `verify_jwt=true`.
- `compra-agil-seguimiento`: ACTIVE, versión 4, `verify_jwt=true`.
- `compra-agil-documentos`: ACTIVE, versión 3, `verify_jwt=true`.
- `trovo-catalogos-revision`: ACTIVE, versión 4, `verify_jwt=true`.

**Security Advisor (producción):**
- 15 hallazgos INFO: RLS activado sin políticas sobre las 15 tablas de `public`. Coherente con acceso por Edge Functions privilegiadas y sin permisos directos de lectura a `anon`/`authenticated`; no agregar políticas permisivas solo para suprimir el aviso.
- WARN: `public.rls_auto_enable()`, función `SECURITY DEFINER`, es ejecutable por `anon` y `authenticated`. Existe el event trigger `ensure_rls` activo (`ddl_command_end`), que utiliza esa función para habilitar RLS al crear tablas. **Revisar y revocar permisos EXECUTE de roles no privilegiados sin borrar función ni trigger.** La exposición de EXECUTE es confirmada; esto no demuestra explotación ni que pueda ejecutarse como RPC normal, dado su tipo `event_trigger`.
- WARN: protección contra contraseñas filtradas desactivada en Auth. Activar en panel si el plan lo permite y verificar funcionamiento de inicio y recuperación de sesión.

**No se realizó cambio de permisos ni despliegue en producción.** Tras revisar impacto, sentencia propuesta:
```sql
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
FROM PUBLIC, anon, authenticated;
```
Validación posterior, solo lectura:
```sql
SELECT has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') AS anon_execute,
       has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') AS authenticated_execute;
```
Deben ser `false`. Verificar además que `ensure_rls` siga `evtenabled='O'`.

**Referencia del Advisor:** https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable


## 8. Corrección confirmada en Supabase (20-11-2026)

El usuario ejecutó en producción `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;`. Se verificó con `has_function_privilege(...,'EXECUTE')` que tanto `anon` como `authenticated` devuelven `false`. Consulta posterior a `pg_event_trigger`: el evento `ensure_rls` sigue presente y habilitado (`evtenabled='O'`), asociado a `rls_auto_enable()`. **No se ha probado crear tablas nuevas**, para evitar cambios adicionales en producción.

Security Advisor, consultado tras la revocación: desaparecieron las dos advertencias sobre ejecución pública de `SECURITY DEFINER`. Persisten solo (a) 15 hallazgos informativos sobre RLS activado sin políticas, coherentes con el diseño restringido, y (b) un WARN: `auth_leaked_password_protection` desactivado. Según la documentación oficial actual de Supabase, la protección contra contraseñas filtradas está disponible en el plan Pro o superior; no asumir que un proyecto Free puede activarla.

**Próxima comprobación:** configuración de seguridad de Supabase Auth, aprobación/registro de usuarios, opciones de contraseñas, y pruebas no destructivas para rechazar solicitudes no autenticadas a las Edge Functions.


## 9. Prueba negativa autenticación Edge Function (20-11-2026)

- Sin cabecera apikey y sin sesión: las seis funciones devolvieron HTTP 401. **Esto puede corresponder a rechazo del gateway por ausencia de apikey; por sí solo no acredita validación interna.**
- Con `apikey` pública, sin `Authorization`, cuerpo JSON `{}`, `compra-agil-sync` devolvió **HTTP 500** a las `2026-11-20T19:45:54.845Z` (UTC). Logs en `function_edge_logs`: `response.headers.sb_error_code=EDGE_FUNCTION_ERROR`, no respuesta 401/403 como esperado. No se observó entrega de datos; esto es un error de robustez/autenticación que requiere diagnóstico.
- `function_logs` en la ventana muestra inicio de worker sin mensaje detallado de excepción. Pendiente revisar cuerpo de respuesta y traza sin compartir credenciales.
- **No modificar `verify_jwt` ni secretos sin comprobar efecto sobre `auth:['user','secret:cron']`; no desplegar cambios a ciegas.**
