[CmdletBinding()]
param(
    [string]$PgBinDirectory,
    [string]$BackupDirectory = (Join-Path $env:LOCALAPPDATA 'CRESCE\backups'),
    [switch]$Console,
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'

function Test-PrivateAclRules($Rules, [string]$OwnerSid) {
    $identitySid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $safeSids = @($identitySid, 'S-1-5-18', 'S-1-5-32-544') | Where-Object { $_ } | Select-Object -Unique
    if ($OwnerSid -and $OwnerSid -notin $safeSids) {
        throw 'El propietario de la carpeta o archivo no es la cuenta actual, SYSTEM ni Administradores. Se detiene el respaldo por seguridad.'
    }
    foreach ($rule in $Rules) {
        if ($rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) { continue }
        try { $sid = $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value }
        catch { throw 'No se puede verificar una identidad permitida en la ACL. Se detiene el respaldo por seguridad.' }
        if ($sid -notin $safeSids) {
            throw 'La carpeta o archivo permite acceso a otra identidad de Windows. Se detiene el respaldo; revisa los permisos con el administrador del equipo.'
        }
    }
    return $true
}

function Assert-PrivatePath([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "No existe la ruta privada que se debe validar: $Path" }
    try { $acl = Get-Acl -LiteralPath $Path -ErrorAction Stop }
    catch { throw 'Windows no permitió verificar los permisos del almacenamiento privado. No se creó ni utilizó el archivo de credenciales.' }
    try { $ownerSid = ([System.Security.Principal.NTAccount]$acl.Owner).Translate([System.Security.Principal.SecurityIdentifier]).Value }
    catch { $ownerSid = $null }
    Test-PrivateAclRules -Rules @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) -OwnerSid $ownerSid | Out-Null
    return $true
}

function Ensure-PrivateDirectory([string]$Path) {
    try { New-Item -ItemType Directory -Path $Path -Force -ErrorAction Stop | Out-Null }
    catch { throw 'No se pudo crear la carpeta privada. Comprueba que LOCALAPPDATA tenga permisos de escritura.' }
    # No se reemplaza ni se protege la ACL: las carpetas nuevas heredan la seguridad de Windows.
    Assert-PrivatePath $Path | Out-Null
}

function Remove-TemporaryCredentialDirectory([string]$Path) {
    if ($Path -and (Test-Path -LiteralPath $Path)) {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
    }
}

function Invoke-PgTool([string]$Executable, [string[]]$Arguments, [switch]$Capture) {
    if ([IO.Path]::GetFileName($Executable) -match '^psql') {
        $sensitive = @($env:PGPASSFILE)
        for ($i=0; $i -lt $Arguments.Count - 1; $i++) {
            if ([string]$Arguments[$i] -in @('--host','--username','--dbname','-h','-U','-d')) { $sensitive += [string]$Arguments[$i+1] }
        }
        $diagnostic = Invoke-PsqlDiagnostic -Executable $Executable -Arguments $Arguments -SensitiveValues $sensitive
        if (-not $diagnostic.Success) { throw (Format-PsqlDiagnostic $diagnostic) }
        if ($Capture) { return $diagnostic.Detail }
        return
    }
    try {
        if ($Capture) { $result = @(& $Executable @Arguments 2>$null) }
        else { $null = & $Executable @Arguments 2>$null }
    } catch {
        $tool = [IO.Path]::GetFileName($Executable)
        if ($tool -match '^psql') { throw 'No se pudo leer Supabase. Revisa host, usuario, acceso de red y TLS.' }
        if ($tool -match '^pg_dump') { throw 'pg_dump no pudo crear el respaldo. Revisa permisos de lectura y espacio disponible.' }
        if ($tool -match '^pg_restore') { throw 'pg_restore no pudo validar el archivo. El respaldo puede estar truncado.' }
        throw 'La herramienta PostgreSQL fallo; su salida se oculto por seguridad.'
    }
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        $tool = [IO.Path]::GetFileName($Executable)
        if ($tool -match '^psql') { throw "No se pudo leer Supabase (codigo $exitCode). Revisa host, usuario, acceso de red y TLS." }
        if ($tool -match '^pg_dump') { throw "pg_dump no pudo crear el respaldo (codigo $exitCode). Revisa permisos de lectura y espacio disponible." }
        if ($tool -match '^pg_restore') { throw "pg_restore no pudo validar el archivo (codigo $exitCode). El respaldo puede estar truncado." }
        throw "La herramienta PostgreSQL fallo (codigo $exitCode); su salida se oculto por seguridad."
    }
    if ($Capture) { return ($result -join "`n").Trim() }
}

function Invoke-Psql([string]$Sql, [string]$PsqlPath, [string[]]$BaseArgs) {
    Invoke-PgTool -Executable $PsqlPath -Arguments ($BaseArgs + @('-c', $Sql)) -Capture
}

function ConvertTo-ProcessArgument([string]$Value) {
    if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') { return $Value }
    $builder = New-Object Text.StringBuilder
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ([int]$character -eq 92) { $slashes++; continue }
        if ([int]$character -eq 34) {
            [void]$builder.Append(('\' * (($slashes * 2) + 1)))
            [void]$builder.Append('"')
            $slashes = 0
            continue
        }
        if ($slashes) { [void]$builder.Append(('\' * $slashes)); $slashes = 0 }
        [void]$builder.Append($character)
    }
    if ($slashes) { [void]$builder.Append(('\' * ($slashes * 2))) }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Get-PsqlFailureCategory([string]$Text) {
    if ($Text -match '(?i)password authentication failed|authentication failed|no password supplied|SASL|SCRAM|role .+ does not exist') { return 'Autenticación PostgreSQL' }
    if ($Text -match '(?i)SSL|TLS|certificate|sslmode|no encryption|wrong version number') { return 'TLS' }
    if ($Text -match '(?i)permission denied|SQLSTATE|ERROR:|relation .+ does not exist|syntax error') { return 'Consulta SQL o permisos' }
    if ($Text -match '(?i)could not translate host|could not connect|connection refused|timeout expired|network is unreachable') { return 'Conectividad PostgreSQL' }
    return 'Error de psql/script'
}

function Protect-PsqlDiagnostic([string]$Text, [string[]]$SensitiveValues) {
    $safe = $Text
    foreach ($value in $SensitiveValues) {
        if (-not [string]::IsNullOrEmpty($value)) { $safe = [regex]::Replace($safe, [regex]::Escape($value), '[oculto]', [Text.RegularExpressions.RegexOptions]::IgnoreCase) }
    }
    $safe = [regex]::Replace($safe, '(?i)\b(password|passwd|pwd)\b\s*[:=]\s*[^\s,;]+', '$1=[oculto]')
    $safe = [regex]::Replace($safe, '(?i)(?:for user|user)\s+["'']?[^\s"'']+["'']?', 'user [oculto]')
    $safe = [regex]::Replace($safe, '(?i)host\s+["''][^"'']+["'']', 'host [oculto]')
    return $safe.Trim()
}

function Invoke-PsqlDiagnostic([string]$Executable, [string[]]$Arguments, [string[]]$SensitiveValues) {
    $process = $null
    try {
        $info = New-Object Diagnostics.ProcessStartInfo
        $info.FileName = $Executable
        $info.Arguments = (($Arguments | ForEach-Object { ConvertTo-ProcessArgument ([string]$_) }) -join ' ')
        $info.UseShellExecute = $false; $info.CreateNoWindow = $true
        $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
        $process = New-Object Diagnostics.Process; $process.StartInfo = $info
        if (-not $process.Start()) { throw 'Process.Start returned false' }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        $stdout = $stdoutTask.Result; $stderr = $stderrTask.Result
        if ($process.ExitCode -eq 0) { return [pscustomobject]@{ Success=$true; Category=''; Detail=$stdout.Trim() } }
        $detail = Protect-PsqlDiagnostic $stderr $SensitiveValues
        return [pscustomobject]@{ Success=$false; Category=(Get-PsqlFailureCategory $detail); Detail=$detail }
    } catch {
        return [pscustomobject]@{ Success=$false; Category='Error del script'; Detail='No se pudo iniciar o leer psql. Comprueba la ruta del ejecutable y los permisos locales.' }
    } finally { if ($process) { $process.Dispose() } }
}

function New-PrivatePgPassFile([string]$HostName, [string]$Port, [string]$Database, [string]$UserName, [Security.SecureString]$SecurePassword) {
    $root = Join-Path $env:LOCALAPPDATA 'CRESCE\temp'
    Ensure-PrivateDirectory $root
    $directory = Join-Path $root ([guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $directory -ErrorAction Stop | Out-Null
    $file = Join-Path $directory 'pgpass.conf'
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    try {
        $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        if ($password -match '[\r\n]') { throw 'La contraseña contiene saltos de línea no compatibles con el archivo temporal libpq.' }
        Assert-PrivatePath $directory | Out-Null
        $line = '{0}:{1}:{2}:{3}:{4}' -f (Escape-PgPassField $HostName), (Escape-PgPassField $Port), (Escape-PgPassField $Database), (Escape-PgPassField $UserName), (Escape-PgPassField $password)
        [IO.File]::WriteAllText($file, $line, [Text.UTF8Encoding]::new($false))
        Assert-PrivatePath $file | Out-Null
        return [pscustomobject]@{ Directory=$directory; File=$file }
    } catch {
        Remove-TemporaryCredentialDirectory $directory
        throw
    } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr); $password=$null; $line=$null }
}

function Test-PostgresBackupConnection([string]$PsqlPath, [string]$HostName, [string]$Port, [string]$Database, [string]$UserName, [Security.SecureString]$SecurePassword) {
    $pass = $null; $oldPassfile=$env:PGPASSFILE; $oldSslmode=$env:PGSSLMODE; $oldTimeout=$env:PGCONNECT_TIMEOUT
    try {
        $pass = New-PrivatePgPassFile $HostName $Port $Database $UserName $SecurePassword
        $env:PGPASSFILE=$pass.File; $env:PGSSLMODE='require'; $env:PGCONNECT_TIMEOUT='15'
        $base = (New-ConnectionArgs $HostName $Port $Database $UserName) + @('-X','--no-psqlrc','--no-password','--tuples-only','--no-align','--quiet','--set','ON_ERROR_STOP=1')
        $sensitive = @($HostName,$UserName,$Database,$pass.File)
        $first = Invoke-PsqlDiagnostic -Executable $PsqlPath -Arguments ($base + @('-c','BEGIN READ ONLY; SELECT 1; SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid(); COMMIT;')) -SensitiveValues $sensitive
        if (-not $first.Success) { return [pscustomobject]@{ Success=$false; Message=(Format-PsqlDiagnostic $first) } }
        if (-not (Test-ReadOnlyTlsResult $first.Detail)) { return [pscustomobject]@{ Success=$false; Message='TLS: SELECT 1 pasó, pero PostgreSQL no confirmó una sesión SSL/TLS activa.' } }
        $permissionSql = @"
BEGIN READ ONLY;
WITH public_tables AS (
  SELECT c.oid, c.relname, has_table_privilege(current_user, c.oid, 'SELECT') AS can_select
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p','m')
), public_sequences AS (
  SELECT c.oid, c.relname, has_sequence_privilege(current_user, c.oid, 'SELECT') AS can_select
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S'
), required_tables AS (
  SELECT name, to_regclass('public.' || name) AS object_id FROM unnest(ARRAY['compra_agil_oportunidades','compra_agil_sync_state']) AS name
)
SELECT CASE WHEN has_schema_privilege(current_user,'public','USAGE') THEN '1' ELSE '0' END || '|' ||
       (SELECT count(*) FROM required_tables WHERE object_id IS NULL)::text || '|' ||
       (SELECT count(*) FROM required_tables WHERE object_id IS NOT NULL AND NOT has_table_privilege(current_user,object_id,'SELECT'))::text || '|' ||
       (SELECT count(*) FROM public_tables WHERE NOT can_select)::text || '|' ||
       (SELECT count(*) FROM public_sequences WHERE NOT can_select)::text || '|' ||
       coalesce((SELECT string_agg(relname,',') FROM public_tables WHERE NOT can_select),'') || '|' ||
       coalesce((SELECT string_agg(relname,',') FROM public_sequences WHERE NOT can_select),'');
COMMIT;
"@
        $second = Invoke-PsqlDiagnostic -Executable $PsqlPath -Arguments ($base + @('-c',$permissionSql)) -SensitiveValues $sensitive
        if (-not $second.Success) { return [pscustomobject]@{ Success=$false; Message=(Format-PsqlDiagnostic $second) } }
        $parts = $second.Detail.Trim() -split '\|',7
        if ($parts.Count -ne 7) { return [pscustomobject]@{ Success=$false; Message='Error del script: respuesta inesperada al revisar permisos PostgreSQL.' } }
        if ($parts[0] -ne '1') { return [pscustomobject]@{ Success=$false; Message='Permisos SQL: falta USAGE sobre el esquema public.' } }
        if ([int]$parts[1] -gt 0 -or [int]$parts[2] -gt 0) { return [pscustomobject]@{ Success=$false; Message='Permisos SQL: faltan tablas de oportunidades/checkpoints o permiso SELECT.' } }
        if ([int]$parts[3] -gt 0 -or [int]$parts[4] -gt 0) {
            $names = @($parts[5],$parts[6] | Where-Object { $_ }) -join ', '
            return [pscustomobject]@{ Success=$false; Message="Permisos SQL: SELECT insuficiente para el respaldo completo del esquema public ($($parts[3]) tablas/vistas materializadas y $($parts[4]) secuencias). Objetos: $names" }
        }
        return [pscustomobject]@{ Success=$true; Message='Conexión TLS y autenticación correctas. SELECT 1 pasó en transacción de solo lectura; los permisos de lectura para el respaldo de public también están completos.' }
    } catch {
        return [pscustomobject]@{ Success=$false; Message=('Error del script: ' + $_.Exception.Message) }
    } finally {
        $env:PGPASSFILE=$oldPassfile; $env:PGSSLMODE=$oldSslmode; $env:PGCONNECT_TIMEOUT=$oldTimeout
        if ($pass -and (Test-Path -LiteralPath $pass.Directory)) { Remove-TemporaryCredentialDirectory $pass.Directory }
    }
}

function Format-PsqlDiagnostic($Result) {
    $message = if ($Result.Detail) { $Result.Detail } else { 'psql no proporcionó detalle adicional.' }
    return ($Result.Category + ': ' + $message)
}

function Test-ReadOnlyTlsResult([string]$Output) {
    $lines = @($Output -split '\r?\n' | Where-Object { $_.Trim() })
    return ($lines.Count -eq 2 -and $lines[0].Trim() -eq '1' -and $lines[1].Trim() -match '^(t|true)$')
}

function Escape-PgPassField([string]$Value) {
    return $Value.Replace('\', '\\').Replace(':', '\:')
}

function Assert-ConnectionInput([string]$HostName, [string]$Port, [string]$Database, [string]$UserName) {
    if ($HostName -notmatch '^[A-Za-z0-9.-]+$') { throw 'Host invalido: introduce solo el host, sin protocolo ni URL.' }
    if ($Port -notmatch '^\d{1,5}$' -or [int]$Port -lt 1 -or [int]$Port -gt 65535) { throw 'Puerto invalido: usa un numero entre 1 y 65535.' }
    if ($Database -notmatch '^[A-Za-z0-9_.-]+$') { throw 'Base invalida: usa el nombre indicado en Supabase Connect.' }
    if (-not $UserName -or $UserName -match '[:\\\r\n]') { throw 'Usuario invalido: comprueba el usuario de Supabase Connect.' }
    return $true
}

function New-ConnectionArgs([string]$HostName, [string]$Port, [string]$Database, [string]$UserName) {
    Assert-ConnectionInput $HostName $Port $Database $UserName | Out-Null
    return @('--host', $HostName, '--port', $Port, '--username', $UserName, '--dbname', $Database, '--no-password')
}

function New-DumpArgs([string]$HostName, [string]$Port, [string]$Database, [string]$UserName, [string]$OutputPath) {
    return (New-ConnectionArgs $HostName $Port $Database $UserName) + @('--format=custom', '--schema=public', '--no-owner', '--no-privileges', '--file', $OutputPath)
}

function Get-BackupFileMetadata([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'No se encontro el archivo de respaldo.' }
    $file = Get-Item -LiteralPath $Path
    if ($file.Length -lt 512) { throw 'El archivo de respaldo es demasiado pequeno para ser valido.' }
    return [pscustomobject]@{ bytes = $file.Length; sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
}

function Get-ConnectionConfig([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    try {
        $data = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($data.PSObject.Properties.Name -match '(?i)password|secret|token') { throw 'Sensitive config key' }
        Assert-ConnectionInput ([string]$data.host) ([string]$data.port) ([string]$data.database) ([string]$data.user) | Out-Null
        return @{ host=[string]$data.host; port=[string]$data.port; database=[string]$data.database; user=[string]$data.user; pgBinDirectory=[string]$data.pgBinDirectory }
    } catch { throw 'No se pudo leer la configuración local. Revisa el JSON de backup-settings; nunca debe contener una contraseña.' }
}

function Save-ConnectionConfig([string]$Path, [hashtable]$Connection) {
    $parent = Split-Path -Parent $Path
    Ensure-PrivateDirectory $parent
    if (Test-Path -LiteralPath $Path -PathType Leaf) { Assert-PrivatePath $Path | Out-Null }
    $saved = [ordered]@{ host=$Connection.host; port=$Connection.port; database=$Connection.database; user=$Connection.user; pgBinDirectory=$Connection.pgBinDirectory }
    $json = $saved | ConvertTo-Json
    if ($json -match '(?i)password|secret|token') { throw 'Se bloqueó el guardado de un campo sensible.' }
    [IO.File]::WriteAllText($Path, $json, [Text.UTF8Encoding]::new($true))
    Assert-PrivatePath $Path | Out-Null
}

function ConvertTo-SecureInput([string]$Value) {
    $secure = New-Object Security.SecureString
    foreach ($character in $Value.ToCharArray()) { $secure.AppendChar($character) }
    $secure.MakeReadOnly()
    return $secure
}

function Read-ConsoleConnection($Saved) {
    Write-Host 'Supabase Dashboard > Connect: usa campos de Session Pooler si tu red no tiene IPv6. No pegues una URL completa.'
    $hostName = Read-Host ("Host (sin protocolo)" + $(if ($Saved) { " [$($Saved.host)]" } else { '' }))
    if (-not $hostName -and $Saved) { $hostName = $Saved.host }
    $port = Read-Host ("Puerto" + $(if ($Saved) { " [$($Saved.port)]" } else { ' [5432]' }))
    if (-not $port) { $port = if ($Saved) { $Saved.port } else { '5432' } }
    $database = Read-Host ("Base de datos" + $(if ($Saved) { " [$($Saved.database)]" } else { ' [postgres]' }))
    if (-not $database) { $database = if ($Saved) { $Saved.database } else { 'postgres' } }
    $userName = Read-Host ("Usuario" + $(if ($Saved) { " [$($Saved.user)]" } else { '' }))
    if (-not $userName -and $Saved) { $userName = $Saved.user }
    Assert-ConnectionInput $hostName $port $database $userName | Out-Null
    $secure = Read-Host 'Contraseña de base de datos (entrada oculta)' -AsSecureString
    if ($secure.Length -eq 0) { $secure.Dispose(); throw 'La contraseña no puede estar vacía.' }
    return @{ host=$hostName; port=$port; database=$database; user=$userName; securePassword=$secure }
}

function Show-ConnectionDialog([string]$ConfigPath, [string]$DefaultBin, [string]$PsqlPath) {
    if ([Threading.Thread]::CurrentThread.ApartmentState -ne [Threading.ApartmentState]::STA) {
        throw 'El formulario requiere PowerShell en modo STA. Usa powershell.exe -STA -NoProfile -File .\tools\backup-cresce.ps1 -PgBinDirectory D:\Programar\pgsql\bin; como alternativa, agrega -Console.'
    }
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    [Windows.Forms.Application]::EnableVisualStyles()
    $saved = Get-ConnectionConfig $ConfigPath
    $form = New-Object Windows.Forms.Form
    $form.Text = 'Respaldo privado de CRESCE'; $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'; $form.MaximizeBox = $false; $form.MinimizeBox = $false
    $form.ClientSize = New-Object Drawing.Size(500, 370)
    $labels = @('Host', 'Puerto', 'Base de datos', 'Usuario', 'Contraseña')
    $values = @($(if ($saved) {$saved.host} else {''}), $(if ($saved) {$saved.port} else {'5432'}), $(if ($saved) {$saved.database} else {'postgres'}), $(if ($saved) {$saved.user} else {''}), '')
    $boxes = @{}
    for ($i=0; $i -lt 5; $i++) {
        $label = New-Object Windows.Forms.Label; $label.Text=$labels[$i]; $label.Location=New-Object Drawing.Point(20,(20+48*$i)); $label.Size=New-Object Drawing.Size(120,25)
        $box = New-Object Windows.Forms.TextBox; $box.Location=New-Object Drawing.Point(145,(18+48*$i)); $box.Size=New-Object Drawing.Size(325,25); $box.Text=$values[$i]
        if ($i -eq 4) { $box.UseSystemPasswordChar=$true }
        $form.Controls.Add($label); $form.Controls.Add($box); $boxes[$labels[$i]]=$box
    }
    $remember = New-Object Windows.Forms.CheckBox; $remember.Text='Recordar solo host, puerto, base y usuario'; $remember.Location=New-Object Drawing.Point(145,258); $remember.AutoSize=$true; $remember.Checked=[bool]$saved
    $note = New-Object Windows.Forms.Label; $note.Text='La contraseña no se guarda. Se exige TLS y el respaldo queda fuera del repositorio.'; $note.Location=New-Object Drawing.Point(20,286); $note.Size=New-Object Drawing.Size(455,22)
    $test = New-Object Windows.Forms.Button; $test.Text='Probar conexión'; $test.Location=New-Object Drawing.Point(20,320); $test.Size=New-Object Drawing.Size(135,28)
    $run = New-Object Windows.Forms.Button; $run.Text='Crear respaldo'; $run.Location=New-Object Drawing.Point(225,320); $run.Size=New-Object Drawing.Size(125,28)
    $cancel = New-Object Windows.Forms.Button; $cancel.Text='Cancelar'; $cancel.Location=New-Object Drawing.Point(370,320); $cancel.Size=New-Object Drawing.Size(100,28); $cancel.DialogResult=[Windows.Forms.DialogResult]::Cancel
    $form.Controls.Add($remember); $form.Controls.Add($note); $form.Controls.Add($test); $form.Controls.Add($run); $form.Controls.Add($cancel); $form.AcceptButton=$run; $form.CancelButton=$cancel
    $state = @{ data=$null }
    $test.Add_Click({
        $test.Enabled=$false; $run.Enabled=$false; $cancel.Enabled=$false; $form.UseWaitCursor=$true
        $secure=$null
        try {
            Assert-ConnectionInput $boxes['Host'].Text $boxes['Puerto'].Text $boxes['Base de datos'].Text $boxes['Usuario'].Text | Out-Null
            if ([string]::IsNullOrEmpty($boxes['Contraseña'].Text)) { throw 'Escribe la contraseña de la base.' }
            $secure = ConvertTo-SecureInput $boxes['Contraseña'].Text
            $result = Test-PostgresBackupConnection -PsqlPath $PsqlPath -HostName $boxes['Host'].Text -Port $boxes['Puerto'].Text -Database $boxes['Base de datos'].Text -UserName $boxes['Usuario'].Text -SecurePassword $secure
            $icon = if ($result.Success) { 'Information' } else { 'Warning' }
            [Windows.Forms.MessageBox]::Show($result.Message, 'Prueba de conexión', 'OK', $icon) | Out-Null
        } catch {
            [Windows.Forms.MessageBox]::Show(('Error del script: ' + $_.Exception.Message), 'Prueba de conexión', 'OK', 'Error') | Out-Null
        } finally {
            if ($secure) { $secure.Dispose() }
            $form.UseWaitCursor=$false; $test.Enabled=$true; $run.Enabled=$true; $cancel.Enabled=$true
        }
    })
    $run.Add_Click({
        try {
            Assert-ConnectionInput $boxes['Host'].Text $boxes['Puerto'].Text $boxes['Base de datos'].Text $boxes['Usuario'].Text | Out-Null
            if ([string]::IsNullOrEmpty($boxes['Contraseña'].Text)) { throw 'Escribe la contraseña de la base.' }
            $plain = $boxes['Contraseña'].Text
            $secure = ConvertTo-SecureInput $plain
            $boxes['Contraseña'].Clear(); $plain = $null
            $state.data = @{ host=$boxes['Host'].Text; port=$boxes['Puerto'].Text; database=$boxes['Base de datos'].Text; user=$boxes['Usuario'].Text; securePassword=$secure; remember=$remember.Checked }
            if ($remember.Checked) { Save-ConnectionConfig $ConfigPath @{host=$state.data.host;port=$state.data.port;database=$state.data.database;user=$state.data.user;pgBinDirectory=$DefaultBin} }
            elseif (Test-Path -LiteralPath $ConfigPath -PathType Leaf) { Remove-Item -LiteralPath $ConfigPath -Force }
            $form.DialogResult=[Windows.Forms.DialogResult]::OK; $form.Close()
        } catch { [Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Revisa los datos', 'OK', 'Warning') | Out-Null }
    })
    $dialogResult=$form.ShowDialog(); $form.Dispose()
    if ($dialogResult -ne [Windows.Forms.DialogResult]::OK) { return $null }
    return $state.data
}

function Assert-BackupSelfTests {
    Assert-ConnectionInput 'db.example.supabase.co' '5432' 'postgres' 'postgres.user' | Out-Null
    foreach ($case in @(
        @{h='https://host';p='5432';d='postgres';u='user'},
        @{h='host';p='0';d='postgres';u='user'},
        @{h='host';p='65536';d='postgres';u='user'},
        @{h='host';p='5432';d='postgres';u='bad:user'}
    )) { $failed=$false; try { Assert-ConnectionInput $case.h $case.p $case.d $case.u | Out-Null } catch { $failed=$true }; if (-not $failed) { throw 'No se rechazó una entrada inválida.' } }
    $args = New-DumpArgs 'host.example' '5432' 'postgres' 'user.name' 'C:\private\dump file.dump'
    if (($args -join ' ') -notmatch '--format=custom.*--schema=public' -or ($args -join ' ') -match 'password=|SECRET_MARKER') { throw 'Argumentos de dump incorrectos o con datos sensibles.' }
    if ((Escape-PgPassField 'a:b\c') -ne 'a\:b\\c') { throw 'Escape incorrecto de campos pgpass.' }
    $testRoot=Join-Path $env:LOCALAPPDATA ('CRESCE-backup-tests-'+[guid]::NewGuid().ToString('N')); New-Item -ItemType Directory $testRoot | Out-Null
    try {
        Assert-PrivatePath $testRoot | Out-Null
        $testAcl = Get-Acl -LiteralPath $testRoot
        $testOwner = ([System.Security.Principal.NTAccount]$testAcl.Owner).Translate([System.Security.Principal.SecurityIdentifier]).Value
        Test-PrivateAclRules -Rules @($testAcl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])) -OwnerSid $testOwner | Out-Null
        $unsafeRules = @([System.Security.AccessControl.FileSystemAccessRule]::new(
            ([System.Security.Principal.SecurityIdentifier]'S-1-5-32-545'),
            [System.Security.AccessControl.FileSystemRights]::ReadAndExecute,
            [System.Security.AccessControl.AccessControlType]::Allow))
        $failed=$false; try { Test-PrivateAclRules -Rules $unsafeRules -OwnerSid $testOwner | Out-Null } catch { $failed=$_.Exception.Message -match 'otra identidad' }; if (-not $failed) { throw 'No se rechazaron permisos heredados de usuarios ordinarios.' }
        $missingAcl=$false; try { Assert-PrivatePath (Join-Path $testRoot 'missing') | Out-Null } catch { $missingAcl=$_.Exception.Message -match 'No existe la ruta privada' }; if (-not $missingAcl) { throw 'No se detectó una ruta de permisos inaccesible.' }
        $tempCredentials=Join-Path $testRoot 'credential-temp'; New-Item -ItemType Directory $tempCredentials | Out-Null
        $syntheticPass=Join-Path $tempCredentials 'pgpass.conf'; [IO.File]::WriteAllText($syntheticPass,'synthetic-only')
        Assert-PrivatePath $syntheticPass | Out-Null
        Remove-TemporaryCredentialDirectory $tempCredentials
        if (Test-Path -LiteralPath $syntheticPass) { throw 'No se limpió el archivo temporal de credenciales sintéticas.' }
        $file=Join-Path $testRoot 'synthetic.dump'; [IO.File]::WriteAllBytes($file,(New-Object byte[] 600)); $meta=Get-BackupFileMetadata $file
        if ($meta.bytes -ne 600 -or $meta.sha256 -notmatch '^[0-9a-f]{64}$') { throw 'Verificación sintética de tamaño/SHA-256 falló.' }
        $small=Join-Path $testRoot 'small.dump'; [IO.File]::WriteAllBytes($small,(New-Object byte[] 8)); $failed=$false; try { Get-BackupFileMetadata $small | Out-Null } catch { $failed=$true }; if (-not $failed) { throw 'Se aceptó un archivo truncado.' }
        $config=Join-Path $testRoot 'connection.json'; Save-ConnectionConfig $config @{host='host.example';port='5432';database='postgres';user='reader';pgBinDirectory='D:\Programar\pgsql\bin'}
        $raw=Get-Content $config -Raw -Encoding UTF8
        if ($raw -match '(?i)password|secret|token' -or (Get-ConnectionConfig $config).host -ne 'host.example') { throw 'La configuración no sensible falló.' }
        Assert-PrivatePath $config | Out-Null
        [IO.File]::WriteAllText($config, '{"host":"host.example","port":"5432","database":"postgres","user":"reader","password":"must-not-be-read"}')
        $failed=$false; try { Get-ConnectionConfig $config | Out-Null } catch { $failed=$true }; if (-not $failed) { throw 'Se aceptó una configuración con campo de contraseña.' }
        $failed=$false; try { Get-BackupFileMetadata (Join-Path $testRoot 'missing.dump') | Out-Null } catch { $failed=$true }; if (-not $failed) { throw 'No se detectó un archivo faltante.' }
    } finally { Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue }
    $failed=$false
    try { Invoke-PgTool -Executable (Join-Path $env:WINDIR 'System32\cmd.exe') -Arguments @('/d','/c','echo SECRET_MARKER 1>&2 & exit /b 9') } catch { $failed=$true; if ($_.Exception.Message -match 'SECRET_MARKER') { throw 'Un error expuso salida sensible del proceso.' } }
    if (-not $failed) { throw 'No se detectó el fallo simulado de herramienta.' }
    foreach ($case in @(
        @{text='FATAL: password authentication failed for user someone'; expected='Autenticación PostgreSQL'},
        @{text='SSL error: certificate verify failed'; expected='TLS'},
        @{text='ERROR: permission denied for table sample'; expected='Consulta SQL o permisos'},
        @{text='could not connect to server: timeout expired'; expected='Conectividad PostgreSQL'}
    )) { if ((Get-PsqlFailureCategory $case.text) -ne $case.expected) { throw 'Clasificación sintética de error psql incorrecta.' } }
    if (-not (Test-ReadOnlyTlsResult "1`nt") -or (Test-ReadOnlyTlsResult "1`nf") -or (Test-ReadOnlyTlsResult '1')) { throw 'Validación sintética de SELECT 1/TLS incorrecta.' }
    $protected = Protect-PsqlDiagnostic 'password authentication failed for user account-marker, password=secret-marker' @('account-marker','secret-marker')
    if ($protected -match 'account-marker|secret-marker') { throw 'La sanitización dejó datos sensibles en el diagnóstico.' }
    $cmdPath=Join-Path $env:WINDIR 'System32\cmd.exe'
    $ok = Invoke-PsqlDiagnostic -Executable $cmdPath -Arguments @('/d','/c','echo 1') -SensitiveValues @()
    if (-not $ok.Success -or $ok.Detail.Trim() -ne '1') { throw 'No se capturó correctamente stdout del proceso sintético.' }
    $failure = Invoke-PsqlDiagnostic -Executable $cmdPath -Arguments @('/d','/c','echo FATAL: password authentication failed for account-marker 1>&2 & exit /b 2') -SensitiveValues @('account-marker')
    if ($failure.Success -or $failure.Category -ne 'Autenticación PostgreSQL' -or $failure.Detail -match 'account-marker') { throw 'No se capturó/sanitizó stderr de psql sintético.' }
    $missingProcess = Invoke-PsqlDiagnostic -Executable (Join-Path $env:TEMP 'missing-psql.exe') -Arguments @('-c','SELECT 1') -SensitiveValues @()
    if ($missingProcess.Success -or $missingProcess.Category -ne 'Error del script') { throw 'No se clasificó un error de inicio del proceso.' }
    $tempRoot=Join-Path $env:LOCALAPPDATA 'CRESCE\temp'; Ensure-PrivateDirectory $tempRoot
    $tempCountBefore=@(Get-ChildItem -LiteralPath $tempRoot -Directory -ErrorAction SilentlyContinue).Count
    $savedPassfile=$env:PGPASSFILE; $savedSslmode=$env:PGSSLMODE; $savedTimeout=$env:PGCONNECT_TIMEOUT
    $env:PGPASSFILE='synthetic-old-passfile'; $env:PGSSLMODE='verify-ca'; $env:PGCONNECT_TIMEOUT='23'
    $secureTest=ConvertTo-SecureInput 'synthetic-password-marker'
    try { $result=Test-PostgresBackupConnection -PsqlPath (Join-Path $env:TEMP 'missing-psql.exe') -HostName 'host.example' -Port '5432' -Database 'postgres' -UserName 'synthetic-user' -SecurePassword $secureTest }
    finally { $secureTest.Dispose() }
    $env:PGPASSFILE=$savedPassfile; $env:PGSSLMODE=$savedSslmode; $env:PGCONNECT_TIMEOUT=$savedTimeout
    $tempCountAfter=@(Get-ChildItem -LiteralPath $tempRoot -Directory -ErrorAction SilentlyContinue).Count
    if ($result.Success -or $result.Message -notmatch 'Error del script' -or $tempCountBefore -ne $tempCountAfter -or $env:PGPASSFILE -ne $savedPassfile -or $env:PGSSLMODE -ne $savedSslmode -or $env:PGCONNECT_TIMEOUT -ne $savedTimeout) { throw 'La prueba sintética no limpió credenciales temporales o no restauró el entorno.' }
    Write-Host 'Pruebas locales del respaldo: entradas, argumentos, errores y archivos OK.'
}

if ($SelfTest) { Assert-BackupSelfTests; $global:LASTEXITCODE = 0; return }

function Get-CountAndFingerprint([string]$Table, [string]$PsqlPath, [string[]]$BaseArgs) {
    $sql = "select count(*)::text || '|' || coalesce(md5(string_agg(concat_ws('|', s.region_id::text, coalesce(s.cursor_success::text,''), coalesce(s.window_from::text,''), coalesce(s.window_to::text,''), s.next_page::text, coalesce(s.total_pages::text,''), coalesce(to_jsonb(s)->>'date_mode','')), E'\n' order by s.region_id)), md5('')) from public.$Table s"
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
$configPath = Join-Path $env:LOCALAPPDATA 'CRESCE\backup-settings\connection.json'
$runDirectory = $null
$oldPassfile = $env:PGPASSFILE
$oldSslmode = $env:PGSSLMODE
$oldConnectTimeout = $env:PGCONNECT_TIMEOUT
$manifest = $null
$backupPath = $null
$dumpCompleted = $false

try {
    if (-not $env:LOCALAPPDATA) { throw 'No está disponible LOCALAPPDATA; no se puede crear almacenamiento privado.' }
    $savedConnection = Get-ConnectionConfig $configPath
    $candidateBins = @()
    if ($PgBinDirectory) { $candidateBins += $PgBinDirectory }
    if ($savedConnection -and $savedConnection.pgBinDirectory) { $candidateBins += $savedConnection.pgBinDirectory }
    $candidateBins += @(
        'D:\Programar\pgsql\bin',
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

    if ($Console) { $connection = Read-ConsoleConnection $savedConnection }
    else { $connection = Show-ConnectionDialog $configPath $bin $psql }
    if (-not $connection) { Write-Host 'Respaldo cancelado; no se conecto a Supabase.'; return }
    $hostName = $connection.host; $port = $connection.port; $database = $connection.database; $userName = $connection.user
    $securePassword = $connection.securePassword
    Assert-ConnectionInput $hostName $port $database $userName | Out-Null
    if ($securePassword.Length -eq 0) { throw 'La contraseña no puede estar vacía.' }
    $passInfo = New-PrivatePgPassFile $hostName $port $database $userName $securePassword
    $runDirectory = $passInfo.Directory
    $passFile = $passInfo.File
    $securePassword.Dispose(); $securePassword = $null
    $env:PGPASSFILE = $passFile
    $env:PGSSLMODE = 'require'
    $env:PGCONNECT_TIMEOUT = '15'
    $baseArgs = (New-ConnectionArgs $hostName $port $database $userName) + @('--no-psqlrc', '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1')

    $fullBackupPath = [IO.Path]::GetFullPath($BackupDirectory).TrimEnd('\')
    if ($fullBackupPath.Equals($repoRoot, [StringComparison]::OrdinalIgnoreCase) -or $fullBackupPath.StartsWith($repoRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'La carpeta de respaldo debe estar fuera del repositorio.'
    }
    Ensure-PrivateDirectory -Path $fullBackupPath
    $BackupDirectory = (Resolve-Path $fullBackupPath).Path
    $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
    $backupPath = Join-Path $BackupDirectory "cresce-public-$stamp.dump"
    $manifestPath = Join-Path $BackupDirectory "cresce-public-$stamp.manifest.json"
    if ((Test-Path -LiteralPath $backupPath) -or (Test-Path -LiteralPath $manifestPath)) { throw 'Ya existe el destino del respaldo; no se sobrescribira.' }

    $priorityExists = (Invoke-Psql -Sql "select case when to_regclass('public.compra_agil_sync_priority_state') is null then 'absent' else 'present' end" -PsqlPath $psql -BaseArgs $baseArgs) -eq 'present'
    $before = [ordered]@{
        opportunities = Get-OpportunityCount -PsqlPath $psql -BaseArgs $baseArgs
        historical = Get-CountAndFingerprint -Table 'compra_agil_sync_state' -PsqlPath $psql -BaseArgs $baseArgs
        priority = if ($priorityExists) { Get-CountAndFingerprint -Table 'compra_agil_sync_priority_state' -PsqlPath $psql -BaseArgs $baseArgs } else { $null }
    }
    $dumpArgs = New-DumpArgs $hostName $port $database $userName $backupPath
    Invoke-PgTool -Executable $pgDump -Arguments $dumpArgs
    $dumpCompleted = $true
    $archiveEntries = Invoke-PgTool -Executable $pgRestore -Arguments @('--list', $backupPath) -Capture
    if (-not $archiveEntries) { throw 'pg_restore --list no encontró entradas en el archivo.' }
    $metadata = Get-BackupFileMetadata $backupPath

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
        checkpoint_tables = [ordered]@{ historical = 'present'; priority = if ($priorityExists) { 'present' } else { 'absent' } }
        backup = [ordered]@{ file = [IO.Path]::GetFileName($backupPath); bytes = $metadata.bytes; sha256 = $metadata.sha256; pg_restore_list_valid = $true; archive_entries = (@($archiveEntries -split "`r?`n" | Where-Object { $_.Trim() }).Count) }
        before = $before
        after = $after
        stable_during_dump = $stable
        excluded = @('Supabase Auth users and configuration', 'Storage object bytes (database metadata alone is not a file backup)', 'Supabase-managed schemas and platform configuration', 'Edge Function source/deployments', 'Secrets and Vault values', 'external project settings')
        restore_note = 'This is not a complete Supabase project backup or a guarantee of point-in-time consistency; test restore in an isolated project before relying on it.'
    }
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    Assert-PrivatePath -Path $backupPath | Out-Null
    Assert-PrivatePath -Path $manifestPath | Out-Null
    Write-Host "Respaldo validado: $backupPath"
    Write-Host "Manifiesto sin credenciales: $manifestPath"
    Write-Host "SHA-256: $($metadata.sha256) | Oportunidades antes/después: $($before.opportunities)/$($after.opportunities)"
    Write-Host "Checkpoints históricos: $($before.historical.count) antes, $($after.historical.count) después; estables: $($stable)"
    if (-not $Console) { [Windows.Forms.MessageBox]::Show("Respaldo validado.`nArchivo: $backupPath`nSHA-256: $($metadata.sha256)`nEstable durante la operación: $stable", 'CRESCE', 'OK', 'Information') | Out-Null }
    if (-not $stable) { throw 'La base cambió durante el respaldo; el archivo se conserva, pero no debe tratarse como una captura estable.' }
}
catch {
    if ($backupPath -and (Test-Path -LiteralPath $backupPath) -and -not $dumpCompleted) { Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue }
    if (-not $Console) { try { [Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Respaldo no completado', 'OK', 'Error') | Out-Null } catch {} }
    Write-Error $_.Exception.Message
    throw $_
}
finally {
    $env:PGPASSFILE = $oldPassfile
    $env:PGSSLMODE = $oldSslmode
    $env:PGCONNECT_TIMEOUT = $oldConnectTimeout
    if ($runDirectory -and (Test-Path -LiteralPath $runDirectory)) {
        try { Remove-TemporaryCredentialDirectory $runDirectory }
        catch { Write-Warning "No se pudo limpiar el archivo temporal de credenciales en '$runDirectory'. Elimínalo manualmente de inmediato; no compartas su contenido." }
    }
    if ($securePassword) { $securePassword.Dispose() }
    $password = $null; $escapedPassword = $null; $passLine = $null
}
