[CmdletBinding()]
param(
    [string]$PgBinDirectory,
    [string]$BackupDirectory = (Join-Path $env:LOCALAPPDATA 'CRESCE\backups')
)

$ErrorActionPreference = 'Stop'

function Set-PrivateDirectoryAcl([string]$Path) {
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = Get-Acl -LiteralPath $Path
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleAll($rule) }
    $rights = [System.Security.AccessControl.FileSystemRights]::FullControl
    $inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
    $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
        $identity, $rights, $inherit, [System.Security.AccessControl.PropagationFlags]::None,
        [System.Security.AccessControl.AccessControlType]::Allow)
    [void]$acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Invoke-PgTool([string]$Executable, [string[]]$Arguments, [switch]$Capture) {
    if ($Capture) { $result = @(& $Executable @Arguments 2>$null) }
    else { $null = & $Executable @Arguments 2>$null }
    if ($LASTEXITCODE -ne 0) { throw "Una herramienta PostgreSQL terminó con error (código $LASTEXITCODE). No se guardó salida que pueda contener datos." }
    if ($Capture) { return ($result -join "`n").Trim() }
}

function Invoke-Psql([string]$Sql, [string]$PsqlPath, [string[]]$BaseArgs) {
    Invoke-PgTool -Executable $PsqlPath -Arguments ($BaseArgs + @('-c', $Sql)) -Capture
}

function Escape-PgPassField([string]$Value) {
    return $Value.Replace('\', '\\').Replace(':', '\:')
}

function Get-CountAndFingerprint([string]$Table, [string]$PsqlPath, [string[]]$BaseArgs) {
    $sql = "select count(*)::text || '|' || coalesce(md5(string_agg(concat_ws('|', region_id::text, coalesce(cursor_success::text,''), coalesce(window_from::text,''), coalesce(window_to::text,''), next_page::text, coalesce(total_pages::text,'')), E'\n' order by region_id)), md5('')) from public.$Table"
    $value = Invoke-Psql -Sql $sql -PsqlPath $PsqlPath -BaseArgs $BaseArgs
    if ($value -notmatch '^(\d+)\|([0-9a-f]{32})$') { throw "No se pudo validar la lectura de public.$Table." }
    return [pscustomobject]@{ count = [int]$Matches[1]; fingerprint = $Matches[2] }
}

function Get-OpportunityCount([string]$PsqlPath, [string[]]$BaseArgs) {
    $value = Invoke-Psql -Sql 'select count(*) from public.compra_agil_oportunidades' -PsqlPath $PsqlPath -BaseArgs $BaseArgs
    if ($value -notmatch '^\d+$') { throw 'No se pudo leer el conteo de oportunidades.' }
    return [int]$value
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
$tempRoot = Join-Path $env:LOCALAPPDATA 'CRESCE\temp'
$runDirectory = $null
$oldPassfile = $env:PGPASSFILE
$oldSslmode = $env:PGSSLMODE
$oldConnectTimeout = $env:PGCONNECT_TIMEOUT
$manifest = $null
$backupPath = $null
$dumpCompleted = $false

try {
    if (-not $env:LOCALAPPDATA) { throw 'No está disponible LOCALAPPDATA; no se puede crear almacenamiento privado.' }
    $candidateBins = @()
    if ($PgBinDirectory) { $candidateBins += $PgBinDirectory }
    $candidateBins += @(
        (Join-Path $env:LOCALAPPDATA 'CRESCE\pgsql17\bin'),
        (Join-Path $env:LOCALAPPDATA 'CRESCE\pgsql17\pgsql\bin'),
        (Join-Path $env:USERPROFILE 'tools\pgsql17\bin')
    )
    $bin = $candidateBins | Where-Object { (Test-Path (Join-Path $_ 'pg_dump.exe')) -and (Test-Path (Join-Path $_ 'pg_restore.exe')) -and (Test-Path (Join-Path $_ 'psql.exe')) } | Select-Object -First 1
    if (-not $bin) { throw 'No encuentro pg_dump.exe, pg_restore.exe y psql.exe. Extrae el ZIP oficial de EDB y vuelve a ejecutar, o indica -PgBinDirectory con su carpeta bin.' }
    $pgDump = Join-Path $bin 'pg_dump.exe'; $pgRestore = Join-Path $bin 'pg_restore.exe'; $psql = Join-Path $bin 'psql.exe'
    $dumpVersion = Invoke-PgTool -Executable $pgDump -Arguments @('--version') -Capture
    $restoreVersion = Invoke-PgTool -Executable $pgRestore -Arguments @('--version') -Capture
    $psqlVersion = Invoke-PgTool -Executable $psql -Arguments @('--version') -Capture
    foreach ($version in @($dumpVersion, $restoreVersion, $psqlVersion)) {
        if ($version -notmatch 'PostgreSQL\) 17\.') { throw 'Se requieren pg_dump, pg_restore y psql de PostgreSQL 17.' }
    }

    Write-Host 'Conexión desde Supabase Dashboard > Connect; usa Session Pooler si tu red no tiene IPv6.'
    $hostName = Read-Host 'Host (sin protocolo ni URL)'
    $port = Read-Host 'Puerto'
    $database = Read-Host 'Base de datos'
    $userName = Read-Host 'Usuario de conexión'
    if ($hostName -notmatch '^[A-Za-z0-9.-]+$' -or $port -notmatch '^\d{1,5}$' -or [int]$port -lt 1 -or [int]$port -gt 65535 -or $database -notmatch '^[A-Za-z0-9_.-]+$' -or $userName -match '[:\r\n]' -or -not $userName) {
        throw 'Host, puerto, base o usuario tienen un formato no admitido. No pegues una URL de conexión completa.'
    }
    $securePassword = Read-Host 'Contraseña de base de datos (entrada oculta)' -AsSecureString
    if ($securePassword.Length -eq 0) { throw 'La contraseña no puede estar vacía.' }
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    if ($password -match '[\r\n]') { throw 'La contraseña contiene saltos de línea no compatibles con el archivo temporal libpq.' }

    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
    Set-PrivateDirectoryAcl -Path $tempRoot
    $runDirectory = Join-Path $tempRoot ([guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $runDirectory | Out-Null
    Set-PrivateDirectoryAcl -Path $runDirectory
    $passFile = Join-Path $runDirectory 'pgpass.conf'
    $escapedPassword = Escape-PgPassField $password
    $passLine = '{0}:{1}:{2}:{3}:{4}' -f (Escape-PgPassField $hostName), (Escape-PgPassField $port), (Escape-PgPassField $database), (Escape-PgPassField $userName), $escapedPassword
    [IO.File]::WriteAllText($passFile, $passLine, [Text.UTF8Encoding]::new($false))
    $password = $null; $escapedPassword = $null; $passLine = $null; $securePassword.Dispose()
    $env:PGPASSFILE = $passFile
    $env:PGSSLMODE = 'require'
    $env:PGCONNECT_TIMEOUT = '15'
    $baseArgs = @('--host', $hostName, '--port', $port, '--username', $userName, '--dbname', $database, '--no-password', '--no-psqlrc', '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1')

    $fullBackupPath = [IO.Path]::GetFullPath($BackupDirectory).TrimEnd('\')
    if ($fullBackupPath.Equals($repoRoot, [StringComparison]::OrdinalIgnoreCase) -or $fullBackupPath.StartsWith($repoRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'La carpeta de respaldo debe estar fuera del repositorio.'
    }
    New-Item -ItemType Directory -Path $fullBackupPath -Force | Out-Null
    $BackupDirectory = (Resolve-Path $fullBackupPath).Path
    Set-PrivateDirectoryAcl -Path $BackupDirectory
    $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
    $backupPath = Join-Path $BackupDirectory "cresce-public-$stamp.dump"
    $manifestPath = Join-Path $BackupDirectory "cresce-public-$stamp.manifest.json"

    $priorityExists = (Invoke-Psql -Sql "select case when to_regclass('public.compra_agil_sync_priority_state') is null then 'absent' else 'present' end" -PsqlPath $psql -BaseArgs $baseArgs) -eq 'present'
    $before = [ordered]@{
        opportunities = Get-OpportunityCount -PsqlPath $psql -BaseArgs $baseArgs
        historical = Get-CountAndFingerprint -Table 'compra_agil_sync_state' -PsqlPath $psql -BaseArgs $baseArgs
        priority = if ($priorityExists) { Get-CountAndFingerprint -Table 'compra_agil_sync_priority_state' -PsqlPath $psql -BaseArgs $baseArgs } else { $null }
    }
    $dumpArgs = @('--host', $hostName, '--port', $port, '--username', $userName, '--dbname', $database, '--no-password', '--format=custom', '--schema=public', '--no-owner', '--no-privileges', '--file', $backupPath)
    Invoke-PgTool -Executable $pgDump -Arguments $dumpArgs
    $dumpCompleted = $true
    $archiveEntries = Invoke-PgTool -Executable $pgRestore -Arguments @('--list', $backupPath) -Capture
    if (-not $archiveEntries) { throw 'pg_restore --list no encontró entradas en el archivo.' }
    $item = Get-Item -LiteralPath $backupPath
    if ($item.Length -lt 512) { throw 'El archivo de respaldo es inesperadamente pequeño.' }
    $sha = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash.ToLowerInvariant()

    $after = [ordered]@{
        opportunities = Get-OpportunityCount -PsqlPath $psql -BaseArgs $baseArgs
        historical = Get-CountAndFingerprint -Table 'compra_agil_sync_state' -PsqlPath $psql -BaseArgs $baseArgs
        priority = if ($priorityExists) { Get-CountAndFingerprint -Table 'compra_agil_sync_priority_state' -PsqlPath $psql -BaseArgs $baseArgs } else { $null }
    }
    $stable = ($before.opportunities -eq $after.opportunities) -and ($before.historical.count -eq $after.historical.count) -and ($before.historical.fingerprint -eq $after.historical.fingerprint)
    if ($priorityExists) { $stable = $stable -and ($before.priority.count -eq $after.priority.count) -and ($before.priority.fingerprint -eq $after.priority.fingerprint) }
    $manifest = [ordered]@{
        status = if ($stable) { 'validated_stable' } else { 'validated_but_database_changed_during_dump' }
        created_at_utc = (Get-Date).ToUniversalTime().ToString('o')
        scope = 'PostgreSQL custom-format logical dump of schema public'
        ssl_mode = 'require'
        connection_type = 'Supabase Session Pooler (recommended; host omitted)'
        tools = [ordered]@{ pg_dump = $dumpVersion; pg_restore = $restoreVersion; psql = $psqlVersion }
        backup = [ordered]@{ file = [IO.Path]::GetFileName($backupPath); bytes = $item.Length; sha256 = $sha; pg_restore_list_valid = $true; archive_entries = (@($archiveEntries -split "`r?`n" | Where-Object { $_.Trim() }).Count) }
        before = $before
        after = $after
        stable_during_dump = $stable
        excluded = @('Supabase Auth users and configuration', 'Storage object bytes (database metadata alone is not a file backup)', 'Supabase-managed schemas and platform configuration', 'Edge Function source/deployments', 'Secrets and Vault values', 'external project settings')
        restore_note = 'This is not a complete Supabase project backup or a guarantee of point-in-time consistency; test restore in an isolated project before relying on it.'
    }
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    Set-PrivateDirectoryAcl -Path $BackupDirectory
    Write-Host "Respaldo validado: $backupPath"
    Write-Host "Manifiesto sin credenciales: $manifestPath"
    Write-Host "SHA-256: $sha | Oportunidades antes/después: $($before.opportunities)/$($after.opportunities)"
    Write-Host "Checkpoints históricos: $($before.historical.count) antes, $($after.historical.count) después; estables: $($stable)"
    if (-not $stable) { throw 'La base cambió durante el respaldo; el archivo se conserva, pero no debe tratarse como una captura estable.' }
}
catch {
    if ($backupPath -and (Test-Path -LiteralPath $backupPath) -and -not $dumpCompleted) { Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue }
    Write-Error $_.Exception.Message
    throw $_
}
finally {
    $env:PGPASSFILE = $oldPassfile
    $env:PGSSLMODE = $oldSslmode
    $env:PGCONNECT_TIMEOUT = $oldConnectTimeout
    if ($runDirectory -and (Test-Path -LiteralPath $runDirectory)) { Remove-Item -LiteralPath $runDirectory -Recurse -Force -ErrorAction SilentlyContinue }
    $password = $null; $escapedPassword = $null; $passLine = $null
}
