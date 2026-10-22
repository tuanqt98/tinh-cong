param([Parameter(Mandatory = $true)][string]$OutputDirectory)

$workspacePath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if (-not (Test-Path -LiteralPath $OutputDirectory)) {
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}
$resolvedOutput = (Resolve-Path -LiteralPath $OutputDirectory).Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$databaseFile = Join-Path $resolvedOutput "tinhcong-$stamp.sql"
docker compose -f (Join-Path $workspacePath 'docker-compose.yml') exec -T db pg_dump -U $env:POSTGRES_USER -d $env:POSTGRES_DB --clean --if-exists --no-owner | Set-Content -Encoding UTF8 -LiteralPath $databaseFile
if ($LASTEXITCODE -ne 0) { throw 'Database backup failed.' }
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $databaseFile).Hash
[pscustomobject]@{ Path = $databaseFile; Sha256 = $hash; CreatedAt = (Get-Date).ToString('o') } | ConvertTo-Json
