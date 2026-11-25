$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'backup-cresce.ps1'
& $scriptPath -SelfTest
if (-not $?) { throw 'Fallaron las pruebas automatizadas del script de respaldo.' }
Write-Host 'Suite de respaldo Windows completada.'
