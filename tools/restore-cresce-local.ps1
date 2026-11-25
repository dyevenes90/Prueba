[CmdletBinding()]
param(
    [string]$PgBinDirectory = 'D:\Programar\pgsql\bin',
    [string]$BackupPath,
    [string]$BackupDirectory = (Join-Path $env:LOCALAPPDATA 'CRESCE\backups'),
    [switch]$AllowOmittingAuthForeignKeys
)

$ErrorActionPreference = 'Stop'

function Assert-PrivatePath([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "No existe la ruta local privada: $Path" }
    $acl = Get-Acl -LiteralPath $Path -ErrorAction Stop
    try { $owner = ([Security.Principal.NTAccount]$acl.Owner).Translate([Security.Principal.SecurityIdentifier]).Value } catch { $owner = $null }
    $current = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $allowed = @($current, $owner, 'S-1-5-18', 'S-1-5-32-544') | Where-Object { $_ } | Select-Object -Unique
    if ($owner -and $owner -notin @($current,'S-1-5-18','S-1-5-32-544')) { throw 'El propietario no es el usuario actual, SYSTEM ni Administradores; se detiene la restauración.' }
    foreach ($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { continue }
        $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
        if ($sid -notin $allowed) { throw 'La ruta permite acceso a otra identidad de Windows; se detiene la restauración.' }
    }
}

function Ensure-PrivateDirectory([string]$Path) {
    New-Item -ItemType Directory -Path $Path -Force -ErrorAction Stop | Out-Null
    Assert-PrivatePath $Path
}

function ConvertTo-ProcessArgument([string]$Value) {
    if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') { return $Value }
    $builder=New-Object Text.StringBuilder; [void]$builder.Append('"'); $slashes=0
    foreach($character in $Value.ToCharArray()) {
        if([int]$character -eq 92) { $slashes++; continue }
        if([int]$character -eq 34) { [void]$builder.Append(('\' * (($slashes*2)+1))); [void]$builder.Append('"'); $slashes=0; continue }
        if($slashes) { [void]$builder.Append(('\' * $slashes)); $slashes=0 }; [void]$builder.Append($character)
    }
    if($slashes) { [void]$builder.Append(('\' * ($slashes*2))) }; [void]$builder.Append('"'); return $builder.ToString()
}

function Invoke-LocalTool([string]$Executable,[string[]]$Arguments,[string]$LogPath,[switch]$NoCapture) {
    $process=$null
    try {
        $info=New-Object Diagnostics.ProcessStartInfo; $info.FileName=$Executable
        $info.Arguments=(($Arguments | ForEach-Object { ConvertTo-ProcessArgument ([string]$_) }) -join ' ')
        $info.UseShellExecute=$false; $info.CreateNoWindow=$true
        if(-not $NoCapture) { $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true }
        $process=New-Object Diagnostics.Process; $process.StartInfo=$info
        if(-not $process.Start()) { throw 'No se pudo iniciar la herramienta PostgreSQL.' }
        if($NoCapture) { $process.WaitForExit(); $out=''; $err='' }
        else { $outTask=$process.StandardOutput.ReadToEndAsync(); $errTask=$process.StandardError.ReadToEndAsync(); $process.WaitForExit(); $out=$outTask.Result; $err=$errTask.Result }
        if($LogPath) { [IO.File]::WriteAllText($LogPath,($out + [Environment]::NewLine + $err),[Text.UTF8Encoding]::new($true)) }
        return [pscustomobject]@{ ExitCode=$process.ExitCode; Stdout=$out; Stderr=$err }
    } catch { throw 'No se pudo iniciar o completar una herramienta local PostgreSQL. Revisa el archivo de log privado si fue creado.' }
    finally { if($process) { $process.Dispose() } }
}

function Invoke-LocalPsql([string]$Sql,[string]$Database) {
    $args=@('-h','127.0.0.1','-p',[string]$script:port,'-U','cresce_restore','-d',$Database,'--no-password','-X','--set=ON_ERROR_STOP=1','-q','-t','-A','-c',$Sql)
    $result=Invoke-LocalTool -Executable $script:psql -Arguments $args -LogPath $null
    if($result.ExitCode -ne 0) { throw "psql local falló durante la validación/restauración: $($result.Stderr.Trim())" }
    return $result.Stdout.Trim()
}

function Get-LatestValidatedBackup([string]$Directory) {
    if(-not (Test-Path -LiteralPath $Directory -PathType Container)) { throw 'No se encontró la carpeta local de respaldos.' }
    $items=@()
    foreach($file in Get-ChildItem -LiteralPath $Directory -Filter '*.manifest.json' -File) {
        try { $m=Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json } catch { continue }
        if($m.status -eq 'validated_stable' -and $m.backup.file) { $items += [pscustomobject]@{Manifest=$m;ManifestPath=$file.FullName;Created=$file.LastWriteTimeUtc} }
    }
    $selected=$items | Sort-Object Created -Descending | Select-Object -First 1
    if(-not $selected) { throw 'No hay un manifiesto validated_stable para restaurar.' }
    $dump=Join-Path $Directory ([string]$selected.Manifest.backup.file)
    return [pscustomobject]@{ Path=$dump; Manifest=$selected.Manifest; ManifestPath=$selected.ManifestPath }
}

$root=Join-Path $env:LOCALAPPDATA 'CRESCE\restore-tests'
$restoreDir=$null; $dataDir=$null; $serverStarted=$false; $passDir=$null; $managedReferences=@()
$oldPass=$env:PGPASSFILE; $oldSsl=$env:PGSSLMODE; $oldTimeout=$env:PGCONNECT_TIMEOUT
$script:port=$null; $script:psql=Join-Path $PgBinDirectory 'psql.exe'
try {
    if(-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA no está disponible.' }
    foreach($name in 'initdb.exe','pg_ctl.exe','postgres.exe','pg_restore.exe','psql.exe') {
        if(-not (Test-Path -LiteralPath (Join-Path $PgBinDirectory $name) -PathType Leaf)) { throw "Falta la herramienta portátil $name en $PgBinDirectory." }
    }
    foreach($name in 'initdb.exe','pg_ctl.exe','postgres.exe','pg_restore.exe','psql.exe') {
        $version=Invoke-LocalTool (Join-Path $PgBinDirectory $name) @('--version') $null
        if($version.ExitCode -ne 0 -or $version.Stdout -notmatch 'PostgreSQL\) 17\.') { throw "Se requiere PostgreSQL 17 para $name." }
    }
    if(-not $BackupPath) { $backup=Get-LatestValidatedBackup $BackupDirectory; $BackupPath=$backup.Path }
    else {
        $manifestPath=[IO.Path]::ChangeExtension($BackupPath,$null) + '.manifest.json'
        if(-not (Test-Path -LiteralPath $manifestPath)) { throw 'El respaldo explícito no tiene su manifiesto correspondiente.' }
        $m=Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if($m.status -ne 'validated_stable') { throw 'El manifiesto no acredita validated_stable.' }
        $backup=[pscustomobject]@{Path=$BackupPath;Manifest=$m;ManifestPath=$manifestPath}
    }
    Assert-PrivatePath (Split-Path -Parent $BackupPath)
    if(-not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) { throw 'No existe el archivo indicado en el manifiesto.' }
    Assert-PrivatePath $BackupPath
    Assert-PrivatePath $backup.ManifestPath
    $hash=(Get-FileHash -LiteralPath $BackupPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if($hash -ne [string]$backup.Manifest.backup.sha256) { throw 'El SHA-256 del respaldo no coincide con el manifiesto; no se modificará el archivo.' }
    $list=Invoke-LocalTool (Join-Path $PgBinDirectory 'pg_restore.exe') @('--list',$BackupPath) $null
    if($list.ExitCode -ne 0 -or -not $list.Stdout) { throw "pg_restore --list falló: $($list.Stderr.Trim())" }
    $extensionEntries=@($list.Stdout -split '\r?\n' | Where-Object { $_ -match '\bEXTENSION\b' })
    $archiveLines=@($list.Stdout -split '\r?\n')
    $archiveForeignKeys=@($archiveLines | Where-Object { $_ -match '^\s*\d+;\s+\d+\s+\d+\s+FK CONSTRAINT\b' })
    $archiveKeyConstraints=@($archiveLines | Where-Object { $_ -match '^\s*\d+;\s+\d+\s+\d+\s+CONSTRAINT public\b' })
    $authForeignKeyPattern='^\s*\d+;\s+\d+\s+\d+\s+FK CONSTRAINT public trovo_importaciones_proveedor trovo_importaciones_proveedor_(cargado_por|revisado_por)_fkey\b'
    $authForeignKeys=@($archiveLines | Where-Object { $_ -match $authForeignKeyPattern })
    if($AllowOmittingAuthForeignKeys -and $authForeignKeys.Count -ne 2) { throw "Se esperaba encontrar exactamente las dos FK Auth conocidas; encontradas: $($authForeignKeys.Count). No se alteró la lista de restauración." }
    $schemaOnly=Invoke-LocalTool (Join-Path $PgBinDirectory 'pg_restore.exe') @('--schema-only','--file=-',$BackupPath) $null
    if($schemaOnly.ExitCode -ne 0) { throw 'No se pudo inspeccionar el DDL del respaldo.' }
    $managedReferences=@([regex]::Matches($schemaOnly.Stdout,'(?i)\bREFERENCES\s+([a-z_][\w]*)\.([a-z_][\w]*)') | ForEach-Object { '{0}.{1}' -f $_.Groups[1].Value.ToLowerInvariant(),$_.Groups[2].Value.ToLowerInvariant() } | Where-Object { ($_ -split '\.')[0] -ne 'public' } | Sort-Object -Unique)
    $timestamp=(Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
    Ensure-PrivateDirectory $root
    Write-Verbose 'El respaldo y su hash fueron validados; preparando clúster temporal.'
    $restoreDir=Join-Path $root "restore-$timestamp"; Ensure-PrivateDirectory $restoreDir
    $dataDir=Join-Path $restoreDir 'data'; Ensure-PrivateDirectory $dataDir
    $pwDir=Join-Path $env:LOCALAPPDATA 'CRESCE\temp'; Ensure-PrivateDirectory $pwDir
    $passDir=Join-Path $pwDir ([guid]::NewGuid().ToString('N')); Ensure-PrivateDirectory $passDir
    $secretBytes=New-Object byte[] 32; $rng=[Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($secretBytes)
    $localPassword=([BitConverter]::ToString($secretBytes)).Replace('-','').ToLowerInvariant(); $rng.Dispose(); [Array]::Clear($secretBytes,0,$secretBytes.Length)
    $pwFile=Join-Path $passDir 'initdb-password.txt'; [IO.File]::WriteAllText($pwFile,$localPassword,[Text.UTF8Encoding]::new($false)); Assert-PrivatePath $pwFile
    $init=Invoke-LocalTool (Join-Path $PgBinDirectory 'initdb.exe') @('-D',$dataDir,'-U','cresce_restore','--auth-local=scram-sha-256','--auth-host=scram-sha-256','--pwfile',$pwFile,'--encoding=UTF8') (Join-Path $restoreDir 'initdb.log')
    Remove-Item -LiteralPath $pwFile -Force; Remove-Item -LiteralPath $passDir -Force; $passDir=$null
    if($init.ExitCode -ne 0) { throw "initdb falló. Revisa el log privado: $(Join-Path $restoreDir 'initdb.log')" }
    Assert-PrivatePath $dataDir
    $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0); $listener.Start(); $script:port=([Net.IPEndPoint]$listener.LocalEndpoint).Port; $listener.Stop()
    $serverLog=Join-Path $restoreDir 'postgres.log'
    Write-Verbose "Inicialización completa; iniciando PostgreSQL aislado en loopback puerto $script:port."
    $start=Invoke-LocalTool (Join-Path $PgBinDirectory 'pg_ctl.exe') @('-D',$dataDir,'-l',$serverLog,'-o',"-h 127.0.0.1 -p $script:port -c listen_addresses=127.0.0.1",'-w','start') (Join-Path $restoreDir 'pg_ctl-start.log') -NoCapture
    if($start.ExitCode -ne 0) { throw "pg_ctl no pudo iniciar el clúster local. Revisa el log privado: $serverLog" }; $serverStarted=$true
    Assert-PrivatePath $serverLog
    Write-Verbose 'Private log ACL verified.'
    $passFile=Join-Path $pwDir ([guid]::NewGuid().ToString('N') + '.pgpass')
    $passLine='127.0.0.1:{0}:*:{1}:{2}' -f $script:port,'cresce_restore',$localPassword
    [IO.File]::WriteAllText($passFile,$passLine,[Text.UTF8Encoding]::new($false)); Assert-PrivatePath $passFile; $localPassword=$null
    Write-Verbose 'Temporary password file created and ACL verified.'
    $env:PGPASSFILE=$passFile; $env:PGSSLMODE='disable'; $env:PGCONNECT_TIMEOUT='5'
    Write-Verbose 'Clúster iniciado; comprobando conexión local autenticada.'
    Invoke-LocalPsql 'SELECT 1' 'postgres' | Out-Null
    Invoke-LocalPsql 'CREATE DATABASE cresce_restore_validation' 'postgres' | Out-Null
    Invoke-LocalPsql 'DROP SCHEMA public CASCADE' 'cresce_restore_validation' | Out-Null
    Write-Verbose 'Conexión verificada; iniciando pg_restore transaccional.'
    $restoreLog=Join-Path $restoreDir 'pg-restore.log'
    $restoreArgs=@('--exit-on-error','--single-transaction','--no-owner','--no-privileges','--host=127.0.0.1',"--port=$script:port",'--username=cresce_restore','--dbname=cresce_restore_validation')
    $omittedConstraints=@()
    if($AllowOmittingAuthForeignKeys) {
        $omittedConstraints=@('trovo_importaciones_proveedor_cargado_por_fkey','trovo_importaciones_proveedor_revisado_por_fkey')
        $filteredList=foreach($line in $archiveLines) { if($line -match $authForeignKeyPattern) { '; intentionally omitted for isolated public-data validation: ' + $line } else { $line } }
        $tocPath=Join-Path $restoreDir 'restore-selection.list'
        [IO.File]::WriteAllLines($tocPath,[string[]]$filteredList,[Text.UTF8Encoding]::new($true)); Assert-PrivatePath $tocPath
        $restoreArgs += @('--use-list',$tocPath)
    }
    $restoreArgs += $BackupPath
    $restore=Invoke-LocalTool (Join-Path $PgBinDirectory 'pg_restore.exe') $restoreArgs $restoreLog
    if($restore.ExitCode -ne 0) {
        $errors=@($restore.Stderr -split '\r?\n' | Where-Object { $_ -match '(?i)error|fatal|does not exist|extension|permission denied' })
        if(-not $errors) { $errors=@('pg_restore devolvió un código de error sin diagnóstico legible; log completo privado.') }
        $dependencyNote=if($managedReferences.Count -gt 0) { "`nDependencias externas declaradas por el dump: $($managedReferences -join ', '). El respaldo solo contiene public; por tanto esta copia no puede restaurarse íntegramente sin esos esquemas/filas gestionados." } else { '' }
        throw ("pg_restore falló sin ocultar errores. Log privado: $restoreLog`n" + ($errors -join "`n") + $dependencyNote)
    }
    Write-Verbose 'pg_restore completó; verificando tablas y checkpoints.'
    $tables=[int](Invoke-LocalPsql "SELECT count(*) FROM pg_tables WHERE schemaname='public'" 'cresce_restore_validation')
    $opportunities=[int](Invoke-LocalPsql 'SELECT count(*) FROM public.compra_agil_oportunidades' 'cresce_restore_validation')
    $historical=[int](Invoke-LocalPsql 'SELECT count(*) FROM public.compra_agil_sync_state' 'cresce_restore_validation')
    $historicalFingerprintSql="SET TIME ZONE 'UTC'; SELECT count(*)::text || '|' || coalesce(md5(string_agg(concat_ws('|', s.region_id::text, coalesce(s.cursor_success::text,''), coalesce(s.window_from::text,''), coalesce(s.window_to::text,''), s.next_page::text, coalesce(s.total_pages::text,''), coalesce(to_jsonb(s)->>'date_mode','')), E'\n' order by s.region_id)), md5('')) from public.compra_agil_sync_state s"
    $historicalFingerprint=(Invoke-LocalPsql $historicalFingerprintSql 'cresce_restore_validation').Split('|')[-1]
    $restoredForeignKeys=[int](Invoke-LocalPsql "SELECT count(*) FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace" 'cresce_restore_validation')
    $restoredConstraints=[int](Invoke-LocalPsql "SELECT count(*) FROM pg_constraint WHERE contype IN ('p','u','f','c') AND connamespace='public'::regnamespace" 'cresce_restore_validation')
    $opportunityIntegrity=(Invoke-LocalPsql "SELECT CASE WHEN count(*)=count(DISTINCT codigo) AND count(codigo)=count(*) THEN 'ok' ELSE 'mismatch' END FROM public.compra_agil_oportunidades" 'cresce_restore_validation')
    $importRowStats=(Invoke-LocalPsql "SELECT count(*)::text || '|' || count(cargado_por)::text || '|' || count(revisado_por)::text FROM public.trovo_importaciones_proveedor" 'cresce_restore_validation')
    $priorityExists=(Invoke-LocalPsql "SELECT CASE WHEN to_regclass('public.compra_agil_sync_priority_state') IS NULL THEN 'absent' ELSE 'present' END" 'cresce_restore_validation') -eq 'present'
    $priority=if($priorityExists){[int](Invoke-LocalPsql 'SELECT count(*) FROM public.compra_agil_sync_priority_state' 'cresce_restore_validation')}else{$null}
    $expectedOpp=[int]$backup.Manifest.before.opportunities; $expectedHistorical=[int]$backup.Manifest.before.historical.count
    $expectedPriority=if($backup.Manifest.before.priority){[int]$backup.Manifest.before.priority.count}else{$null}
    $expectedFingerprint=[string]$backup.Manifest.before.historical.fingerprint
    $expectedForeignKeys=$archiveForeignKeys.Count-$omittedConstraints.Count
    $restoredKeyConstraints=[int](Invoke-LocalPsql "SELECT count(*) FROM pg_constraint WHERE contype IN ('p','u') AND connamespace='public'::regnamespace" 'cresce_restore_validation')
    $expectedKeyConstraints=$archiveKeyConstraints.Count
    if($opportunities -ne $expectedOpp -or $historical -ne $expectedHistorical -or $historicalFingerprint -ne $expectedFingerprint -or ($null -ne $expectedPriority -and $priority -ne $expectedPriority) -or $restoredForeignKeys -ne $expectedForeignKeys -or $restoredKeyConstraints -ne $expectedKeyConstraints -or $opportunityIntegrity -ne 'ok') {
        $observed=@("opportunities=$opportunities/$expectedOpp","historical=$historical/$expectedHistorical","fingerprint_match=$($historicalFingerprint -eq $expectedFingerprint)","key_constraints=$restoredKeyConstraints/$expectedKeyConstraints","foreign_keys=$restoredForeignKeys/$expectedForeignKeys","opportunity_code_integrity=$opportunityIntegrity","priority=$priority") -join '; '
        throw "La restauración terminó, pero la validación no coincide: $observed"
    }
    $restoreStatus=if($omittedConstraints.Count -gt 0){'public_data_restored_with_auth_foreign_keys_omitted'}else{'public_schema_restored_and_verified'}
    $restoreManifest=[ordered]@{status=$restoreStatus;source_dump=[IO.Path]::GetFileName($BackupPath);source_sha256=$hash;restored_at_utc=(Get-Date).ToUniversalTime().ToString('o');database='cresce_restore_validation';tables_public=$tables;opportunities=$opportunities;opportunity_code_integrity=$opportunityIntegrity;historical_checkpoints=$historical;historical_checkpoint_fingerprint=$historicalFingerprint;restored_constraints=$restoredConstraints;restored_key_constraints=$restoredKeyConstraints;archive_key_constraints=$archiveKeyConstraints.Count;restored_foreign_keys=$restoredForeignKeys;archive_foreign_keys=$archiveForeignKeys.Count;omitted_constraints=@($omittedConstraints);importation_rows=$importRowStats;priority_table_present=$priorityExists;priority_checkpoints=$priority;extension_entries=@($extensionEntries);external_schema_references=@($managedReferences);scope_notice='public schema only; not a full Supabase recovery';network_bind='127.0.0.1 only';server_stopped_after_test=$true;logs=@('initdb.log','pg_ctl-start.log','postgres.log','pg-restore.log')}
    $manifestOut=Join-Path $restoreDir 'restore-verification.json'; $restoreManifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestOut -Encoding UTF8; Assert-PrivatePath $manifestOut
    Write-Output "RESTORE_STATUS=$restoreStatus"
    Write-Output "RESTORE_DIRECTORY=$restoreDir"
    Write-Output "PUBLIC_TABLES=$tables; OPPORTUNITIES=$opportunities; OPPORTUNITY_CODE_INTEGRITY=$opportunityIntegrity; HISTORICAL_CHECKPOINTS=$historical; CHECKPOINT_FINGERPRINT_MATCH=True; KEY_CONSTRAINTS=$restoredKeyConstraints/$($archiveKeyConstraints.Count); FOREIGN_KEYS=$restoredForeignKeys/$($archiveForeignKeys.Count); OMITTED_CONSTRAINTS=$($omittedConstraints.Count); IMPORTATION_ROWS=$importRowStats; PRIORITY_TABLE_PRESENT=$priorityExists; PRIORITY_CHECKPOINTS=$priority"
    if($omittedConstraints.Count -gt 0) { Write-Output ('OMITTED_CONSTRAINT_NAMES=' + ($omittedConstraints -join ', ')); Write-Output 'NOTICE=This is a partial public-data recovery check, not a complete Supabase or constraint-complete restore.' }
    Write-Output "SOURCE_SHA256=$hash; EXTENSION_ENTRIES=$($extensionEntries.Count)"
    if($extensionEntries.Count -gt 0) { Write-Output ('EXTENSIONS=' + (($extensionEntries | ForEach-Object { ($_ -split '\s+')[5] }) -join ', ')) }
    Write-Output "VERIFICATION_MANIFEST=$manifestOut"
} catch {
    Write-Error $_.Exception.Message -ErrorAction Continue
    throw
} finally {
    $env:PGPASSFILE=$oldPass; $env:PGSSLMODE=$oldSsl; $env:PGCONNECT_TIMEOUT=$oldTimeout
    if($passDir -and (Test-Path $passDir)) { Remove-Item -LiteralPath $passDir -Recurse -Force -ErrorAction SilentlyContinue }
    if($passFile -and (Test-Path $passFile)) { Remove-Item -LiteralPath $passFile -Force -ErrorAction SilentlyContinue }
    if($serverStarted) {
        Write-Verbose 'Deteniendo el clúster local temporal.'
        $stop=Invoke-LocalTool (Join-Path $PgBinDirectory 'pg_ctl.exe') @('-D',$dataDir,'-m','fast','-w','stop') (Join-Path $restoreDir 'pg_ctl-stop.log')
        if($stop.ExitCode -ne 0) { Write-Warning "El clúster local no se detuvo correctamente; ejecuta pg_ctl.exe -D `"$dataDir`" -m fast -w stop." }
    }
}
