# Respaldo lógico de CRESCE en Windows

Este procedimiento crea un archivo PostgreSQL custom del esquema `public`. Es una protección previa útil para datos/tablas públicas; **no es un respaldo integral del proyecto Supabase ni garantiza restauración punto-en-tiempo**.

## Preparación (sin instalar servidor ni usar Docker)

1. Desde la página oficial de [binarios PostgreSQL de EDB](https://www.enterprisedb.com/download-postgresql-binaries), descarga el archivo binario para Windows x64 correspondiente a PostgreSQL 17 y extráelo, por ejemplo, en `%LOCALAPPDATA%\CRESCE\pgsql17`. No ejecutes instaladores. El script busca `bin\pg_dump.exe`, `pg_restore.exe` y `psql.exe` en esa carpeta. También acepta `-PgBinDirectory`.
2. En Supabase Dashboard abre **Connect** y usa los campos individuales de **Session Pooler** si la red no soporta IPv6 (host, puerto, base y usuario). No pegues una URL completa.
3. Desde PowerShell integrado de VS Code en una copia limpia de la rama PR, ejecuta el formulario nativo (si trabajas con PowerShell 5.1):

   ```powershell
   powershell.exe -STA -NoProfile -File .\tools\backup-cresce.ps1 -PgBinDirectory 'D:\Programar\pgsql\bin'
   ```

   El formulario permite pegar los campos, enmascara la contraseña y muestra los errores. También puedes ejecutarlo sin `-PgBinDirectory`; detecta `D:\Programar\pgsql\bin` y varias carpetas privadas comunes.

   Alternativa de consola (sin formulario):

   ```powershell
   .\tools\backup-cresce.ps1 -Console -PgBinDirectory 'D:\Programar\pgsql\bin'
   ```

4. Los campos no sensibles se pueden recordar opcionalmente en `%LOCALAPPDATA%\CRESCE\backup-settings\connection.json`, con ACL limitada a tu cuenta Windows. **No guarda la contraseña.** La carpeta predeterminada del dump es `%LOCALAPPDATA%\CRESCE\backups`, fuera del repositorio. El script restringe también el archivo libpq temporal, exige TLS (`PGSSLMODE=require`) y lo elimina al salir; la contraseña no aparece en argumentos ni logs. No guarda host, usuario ni contraseña en el manifiesto.

Antes de cualquier preparación de activación, se puede revisar el estado estático local, sin conectar a Supabase:

```powershell
node .\tools\preflight-compra-agil.mjs
```

El preflight informa archivos de migración y `verify_jwt`, y revisa en el código la autorización por UUID, la separación de acciones Cron y el ticket de ChileCompra. No valida qué está desplegado ni revela/lee secretos. `CRESCE_ALLOWED_USER_IDS` es write-only desde la CLI: en Supabase Dashboard ve a **Authentication > Users**, localiza `d.yevenes90@gmail.com` y copia su UUID solo a tu bloc privado; contrástalo allí con la lista que administra el responsable del proyecto. No pegues el secreto en chat, terminal compartida ni logs. Si no puedes inspeccionar su valor, la membresía sigue sin confirmar; una prueba real de login y llamada autorizada a la función también la verifica sin mostrar el secreto.

## Validación

El script exige versión mayor 17 para las tres herramientas, ejecuta `pg_dump` de solo lectura para `public`, comprueba `pg_restore --list`, tamaño y SHA-256. Lee el conteo de `compra_agil_oportunidades` y cuenta/fingerprint de checkpoints históricos y prioritarios (si la tabla prioritaria existe) antes y después del dump. Informa si esos datos cambiaron durante la operación; un resultado inestable no se presenta como captura estable. El manifiesto JSON contiene rutas relativas/nombre de archivo, versiones, huella y conteos, nunca datos de conexión.

Las pruebas automatizadas del helper Windows se ejecutan sin conectar con `pwsh -NoProfile -File .\tools\backup-cresce.tests.ps1`. En este equipo la ejecución local de scripts PowerShell quedó bloqueada por la política vigente; no se elude. GitHub Actions ejecuta esas pruebas en Windows y restaura un custom dump **sintético** en una base PostgreSQL aislada, comparando tres filas conocidas. Esa prueba demuestra el procedimiento con datos falsos; no restaura el dump productivo ni prueba que este respaldo real sea íntegro.

El dump y el manifiesto contienen o describen información comercial privada. Mantén esa carpeta protegida y no los subas a GitHub. No envíes el dump por correo ni lo coloques en carpetas sincronizadas públicamente.

## Alcance y limitaciones

El dump incluye estructura y datos del esquema `public`, sin propietarios ni ACL/grants (`--no-owner --no-privileges`). No incluye usuarios ni configuración de Supabase Auth, bytes de objetos de Storage, esquemas administrados por Supabase, funciones Edge y despliegues, secretos/Vault ni configuración externa del proyecto. Los metadatos de Storage que estén en `public` pueden aparecer, pero no sustituyen una copia de los archivos. El archivo tampoco es un respaldo PITR. Antes de confiar en él, restaura en un proyecto/instancia aislados y verifica datos, extensiones y permisos.

Para una restauración aislada manual, el destino debe ser una base vacía PostgreSQL compatible; nunca apuntes `pg_restore` al proyecto productivo. Usa la conexión de ese entorno aislado y:

```powershell
& 'D:\Programar\pgsql\bin\pg_restore.exe' --list 'RUTA_PRIVADA\cresce-public-<fecha>.dump'
& 'D:\Programar\pgsql\bin\pg_restore.exe' --exit-on-error --no-owner --no-privileges --dbname 'postgresql://USUARIO@HOST:PUERTO/BASE' 'RUTA_PRIVADA\cresce-public-<fecha>.dump'
```

No pongas contraseñas en la URL ni en la línea de comandos; configura un `PGPASSFILE` temporal con ACL privada como hace el script. Verifica conteos y objetos tras restaurar. La prueba automatizada usa valores sintéticos y no requiere secretos.

Si el ZIP o los binarios portátiles no funcionan, no instales Docker ni un servidor. Alternativa limitada: con un cliente PostgreSQL Node ya disponible y autorizado, exportar en solo lectura las tablas críticas (o usar los exports SQL/CSV de Supabase Dashboard) a JSON/CSV privado, verificando conteos y SHA-256. Esa alternativa no equivale a `pg_dump`: no preserva íntegramente DDL, constraints, funciones, triggers, policies ni permisos. Para respaldo integral de Auth/Storage/plataforma, usa los mecanismos administrados de backup/PITR y copia de objetos del proyecto; el script no los reemplaza.

## Después del respaldo

No aplicar migraciones desde este script. Antes de cualquier activación, conserva el dump y manifiesto, confirma estabilidad y valida una restauración aislada. Las migraciones pendientes conocidas deben revisarse nuevamente si cambió el código; no despliegues sincronizador ni cron como parte del respaldo.

Para la futura activación, el orden preparado es: comprobar respaldo/restauración aislada; ejecutar `npx.cmd supabase db push --dry-run --remote` y confirmar únicamente las tres migraciones de Compra Ágil esperadas; aplicar con `npx.cmd supabase db push --remote`; desplegar solo las Edge Functions modificadas usando `npx.cmd supabase functions deploy <nombre> --project-ref <PROJECT_REF> --use-api`; mantener Cron apagado; y ejecutar la acción manual de una página con la sesión autorizada. No ejecutar esos comandos hasta autorizar explícitamente el cambio productivo y confirmar el UUID en el secreto. Las pruebas del repo y este respaldo no sustituyen esa autorización ni el preflight remoto final.
