# Restauración local aislada de CRESCE en Windows

El respaldo generado por `tools/backup-cresce.ps1` contiene un dump lógico PostgreSQL custom del esquema `public`. No incluye Supabase Auth, bytes de Storage, configuración del proyecto, secretos/Vault ni despliegues de Edge Functions; una restauración exitosa de `public` no equivale a restaurar el proyecto Supabase completo.

## Requisitos y ejecución

Usa PostgreSQL 17 portátil extraído localmente. No requiere servicio instalado ni privilegios de administrador. Desde PowerShell en el checkout de la PR:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\restore-cresce-local.ps1 -PgBinDirectory 'D:\Programar\pgsql\bin'
```

El script elige el manifiesto `validated_stable` más reciente de `%LOCALAPPDATA%\CRESCE\backups`, comprueba SHA-256, restaura en un clúster temporal de `%LOCALAPPDATA%\CRESCE\restore-tests` y solo escucha en `127.0.0.1`. El dump original no se modifica. Los datos restaurados y logs quedan localmente en esa carpeta protegida; el script detiene el servidor al finalizar y elimina los archivos temporales de contraseña.

## Dependencia encontrada en el respaldo actual

El dump `cresce-public-20261125T152908226Z-c7021b33.dump` contiene dos claves foráneas de tablas de importación (`trovo_importaciones_proveedor.cargado_por` y `revisado_por`) que apuntan a `auth.users(id)`. El manifiesto confirma que el respaldo no contiene el esquema ni los usuarios de Supabase Auth. Por eso una restauración completa de `public` en PostgreSQL vanilla se detiene con `schema "auth" does not exist`; el script conserva el error y no desactiva ni omite las restricciones.

El paso mínimo para una restauración completa es disponer de un destino aislado que incluya el esquema Auth compatible y los registros Auth referenciados, o generar un respaldo privado y controlado que incluya esas dependencias. El respaldo `public` por sí solo permite comprobar el archivo y estabilidad de origen, pero no satisface esa dependencia referencial para restaurar todo el esquema. No crees tablas ficticias de Auth ni elimines las claves foráneas para etiquetar la prueba como completa.

### Procedimiento seguro para validar todas las FK de `public`

En un entorno aislado, el mínimo para satisfacer estas FK es que exista `auth.users` con los UUID auténticos referenciados por `cargado_por` y `revisado_por`. Obtener solo esos UUID mediante una consulta de lectura en Supabase; no exportar email, contraseña, hash, teléfono, metadata ni tokens:

```sql
select distinct cargado_por as user_id
from public.trovo_importaciones_proveedor
where cargado_por is not null
union
select distinct revisado_por
from public.trovo_importaciones_proveedor
where revisado_por is not null;
```

El dato debe mantenerse local. Para validar únicamente integridad referencial de `public`, una tabla local mínima `auth.users(id uuid primary key)` con esos UUID reales sirve como destino de FK, pero **no restaura Supabase Auth**. No la describas como restauración completa de CRESCE. Para recuperar Auth íntegramente se necesita un backup/restauración compatible con Supabase Auth en un proyecto aislado.

### Recuperación de datos por etapas ya ejecutada

El 25-11-2026 se restauró el dump real en PostgreSQL 17.12 local, solo en loopback, con `pg_restore --single-transaction`. Se omitieron exactamente las dos FK anteriores mediante una lista TOC privada explícita; el resto del dump se restauró. Resultado: 15 tablas públicas, 1.414 oportunidades, códigos únicos, 16 checkpoints históricos y fingerprint idéntico (`bc40aa7b2de110d81bc9b8be3d6e43ea`); 22/22 restricciones PK/UNIQUE y 11/13 FK restauradas. `trovo_importaciones_proveedor` recuperó 2 filas: 2 con `cargado_por` y 0 con `revisado_por`. No hay tabla prioritaria en este respaldo. Estado: `public_data_restored_with_auth_foreign_keys_omitted`, **no una restauración completa**. El servidor local se detuvo y el dump original mantuvo su SHA-256.

Para repetir esa comprobación parcial, usa explícitamente:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\restore-cresce-local.ps1 -PgBinDirectory 'D:\Programar\pgsql\bin' -AllowOmittingAuthForeignKeys
```

El switch omite solo las dos FK Auth conocidas, requiere que ambas entradas estén en el archivo, y deja sus nombres y cantidades en `restore-verification.json`. Sin el switch, se mantienen todas las restricciones y la restauración falla visiblemente por la dependencia faltante.

La verificación incluye la lista de archivo de `pg_restore`, cantidad de tablas públicas, conteo de `compra_agil_oportunidades`, conteo y fingerprint de `compra_agil_sync_state`, y la tabla/checkpoints prioritarios si existen en el respaldo. Revisa `restore-verification.json` y los logs privados para conocer el alcance exacto y cualquier dependencia gestionada detectada. Si una dependencia impide la restauración transaccional, el script falla y no declara éxito.

Una prueba fallida puede dejar la carpeta temporal de diagnóstico para inspeccionar el error. No la publiques ni la agregues a Git: contiene datos restaurados del respaldo.

## Precondiciones para una activación gradual de Compra Ágil

No se ejecutan como parte de este procedimiento. Completar y registrar cada control antes de cambiar producción:

1. **Autorización del usuario:** en Supabase Auth localizar `d.yevenes90@gmail.com` y comprobar su UUID verificado. En Edge Function Secrets confirmar que `CRESCE_ALLOWED_USER_IDS` contiene ese UUID exacto; no comparar por correo ni copiar el secreto a logs/chat. Confirmar también la separación de credenciales de usuario y Cron. La función de sincronización mantiene `verify_jwt = false`, por lo que su controlador debe seguir validando JWT, modo de autenticación y allowlist.
2. **Migraciones:** comprobar el respaldo validado y su alcance parcial conocido; comparar `supabase migration list --linked` con las tres migraciones versionadas y revisar el dry-run antes de aplicar, en este orden: `20261123000100_compra_agil_sync_priority_checkpoints.sql`, `20261123000200_compra_agil_sync_atomic_commit.sql`, `20261123000300_compra_agil_sync_checkpoint_date_mode.sql`. Revisar cualquier diferencia de historial y detenerse si aparece una migración adicional.
3. **Funciones:** publicar solo después de que las migraciones estén verificadas: `compra-agil-sync`, `cresce-dashboard` y `compra-agil-seguimiento`. Comprobar respuestas autenticadas y que JWT/allowlist denieguen usuarios no autorizados. Mantener `strict_utc` para ventanas históricas existentes.
4. **Cron:** comprobar que no se creó ni activó ningún trabajo programado. No configurar el secreto de Cron durante la prueba manual.
5. **Única consulta real:** iniciar sesión como usuario autorizado y ejecutar `prueba_prioritaria_una_pagina` para región 9. La implementación fija Araucanía, una página y una solicitud HTTP máxima por ejecución; no habilitar recuperación histórica ni Los Ríos. Guardar el resumen devuelto: solicitud consumida, página, códigos, insertados/actualizados/omitidos, estado y checkpoint final. Si no se puede demostrar `solicitudes_maximas_por_ejecucion=1`, `paginas_maximas_por_region=1` y la ejecución terminada con una sola solicitud, detener.
6. **Comparación Radar:** justo antes de la consulta, guardar privadamente el listado ordenado de los 1.414 códigos actuales y los 16 checkpoints/fingerprint; después comparar ambos listados, confirmar que ningún código preexistente desapareció ni se duplicó, y que la única página nueva aparece con región 9 y filtros de vigencia adecuados. Mantener cualquier exportación local fuera de Git.
7. **Detención y recuperación:** si falla una validación, no repetir la solicitud. Mantener Cron apagado y detener nuevas acciones manuales; redeplegar las versiones previas de esas tres funciones. No borrar ni reiniciar checkpoints: revisar el registro y preparar una migración correctiva reversible si fuera necesario. El respaldo de `public` está comprobado para recuperar datos comerciales por etapas, pero no restaura Auth; conservar esa limitación en el plan de recuperación.
