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

La verificación incluye la lista de archivo de `pg_restore`, cantidad de tablas públicas, conteo de `compra_agil_oportunidades`, conteo y fingerprint de `compra_agil_sync_state`, y la tabla/checkpoints prioritarios si existen en el respaldo. Revisa `restore-verification.json` y los logs privados para conocer el alcance exacto y cualquier dependencia gestionada detectada. Si una dependencia impide la restauración transaccional, el script falla y no declara éxito.

Una prueba fallida puede dejar la carpeta temporal de diagnóstico para inspeccionar el error. No la publiques ni la agregues a Git: contiene datos restaurados del respaldo.
