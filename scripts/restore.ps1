param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [switch]$ConfirmRestore
)

if (-not $ConfirmRestore) {
  throw 'Restore is destructive. Re-run with -ConfirmRestore after verifying the target environment.'
}
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$workspacePath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Get-Content -Raw -LiteralPath $resolvedBackup | docker compose -f (Join-Path $workspacePath 'docker-compose.yml') exec -T db psql -v ON_ERROR_STOP=1 -U $env:POSTGRES_USER -d $env:POSTGRES_DB
if ($LASTEXITCODE -ne 0) { throw 'Database restore failed.' }
Write-Output "Restore completed from $resolvedBackup. Run integrity checks before use."
