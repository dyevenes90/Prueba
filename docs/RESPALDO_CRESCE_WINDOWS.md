# Respaldo lógico de CRESCE en Windows

Este procedimiento crea un archivo PostgreSQL custom del esquema `public`. Es una protección previa útil para datos/tablas públicas; **no es un respaldo integral del proyecto Supabase ni garantiza restauración punto-en-tiempo**.

## Preparación (sin instalar servidor ni usar Docker)

1. Desde la página oficial de [binarios PostgreSQL de EDB](https://www.enterprisedb.com/download-postgresql-binaries), descarga el archivo binario para Windows x64 correspondiente a PostgreSQL 17 y extráelo, por ejemplo, en `%LOCALAPPDATA%\CRESCE\pgsql17`. No ejecutes instaladores. El script busca `bin\pg_dump.exe`, `pg_restore.exe` y `psql.exe` en esa carpeta. También acepta `-PgBinDirectory`.
2. En Supabase Dashboard abre **Connect** y usa los campos individuales de **Session Pooler** si la red no soporta IPv6 (host, puerto, base y usuario). No pegues una URL completa.
3. Abre PowerShell integrado de VS Code en la raíz del repositorio y ejecuta:

   ```powershell
   .\tools\backup-cresce.ps1
   ```

   Si las herramientas quedaron en otra carpeta:

   ```powershell
   .\tools\backup-cresce.ps1 -PgBinDirectory "$env:LOCALAPPDATA\CRESCE\pgsql17\bin"
   ```

4. Escribe los datos de conexión solicitados. La contraseña se solicita como entrada oculta. La carpeta predeterminada es `%LOCALAPPDATA%\CRESCE\backups`, fuera del repositorio. El script restringe ACL de la carpeta de respaldo y de un archivo libpq temporal a la cuenta Windows actual, requiere TLS (`PGSSLMODE=require`), borra el archivo temporal al salir y no pasa la contraseña como argumento. No guarda host, usuario ni contraseña en el manifiesto.

## Validación

El script exige versión mayor 17 para las tres herramientas, ejecuta `pg_dump` de solo lectura para `public`, comprueba `pg_restore --list`, tamaño y SHA-256. Lee el conteo de `compra_agil_oportunidades` y cuenta/fingerprint de checkpoints históricos y prioritarios (si la tabla prioritaria existe) antes y después del dump. Informa si esos datos cambiaron durante la operación; un resultado inestable no se presenta como captura estable. El manifiesto JSON contiene rutas relativas/nombre de archivo, versiones, huella y conteos, nunca datos de conexión.

El dump y el manifiesto contienen o describen información comercial privada. Mantén esa carpeta protegida y no los subas a GitHub. No envíes el dump por correo ni lo coloques en carpetas sincronizadas públicamente.

## Alcance y limitaciones

El dump incluye estructura y datos del esquema `public`, sin propietarios ni ACL/grants (`--no-owner --no-privileges`). No incluye usuarios ni configuración de Supabase Auth, bytes de objetos de Storage, esquemas administrados por Supabase, funciones Edge y despliegues, secretos/Vault ni configuración externa del proyecto. Los metadatos de Storage que estén en `public` pueden aparecer, pero no sustituyen una copia de los archivos. El archivo tampoco es un respaldo PITR. Antes de confiar en él, restaura en un proyecto/instancia aislados y verifica datos, extensiones y permisos.

Si el ZIP o los binarios portátiles no funcionan, no instales Docker ni un servidor. Alternativa limitada: con un cliente PostgreSQL Node ya disponible y autorizado, exportar en solo lectura las tablas críticas (o usar los exports SQL/CSV de Supabase Dashboard) a JSON/CSV privado, verificando conteos y SHA-256. Esa alternativa no equivale a `pg_dump`: no preserva íntegramente DDL, constraints, funciones, triggers, policies ni permisos. Para respaldo integral de Auth/Storage/plataforma, usa los mecanismos administrados de backup/PITR y copia de objetos del proyecto; el script no los reemplaza.

## Después del respaldo

No aplicar migraciones desde este script. Antes de cualquier activación, conserva el dump y manifiesto, confirma estabilidad y valida una restauración aislada. Las migraciones pendientes conocidas deben revisarse nuevamente si cambió el código; no despliegues sincronizador ni cron como parte del respaldo.
