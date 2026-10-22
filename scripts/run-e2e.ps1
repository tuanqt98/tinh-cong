$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $projectRoot 'apps\web'
$vite = Join-Path $webRoot 'node_modules\vite\bin\vite.js'
$server = Start-Process `
  -FilePath 'node' `
  -ArgumentList @($vite, '--host', '127.0.0.1', '--port', '4173') `
  -WorkingDirectory $webRoot `
  -WindowStyle Hidden `
  -PassThru

try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri 'http://127.0.0.1:4173' -UseBasicParsing -TimeoutSec 1
      if ($response.StatusCode -eq 200) {
        $ready = $true
        break
      }
    }
    catch {
      Start-Sleep -Milliseconds 250
    }
  }

  if (-not $ready) {
    throw 'Vite did not become ready on http://127.0.0.1:4173.'
  }

  $env:E2E_EXTERNAL_SERVER = 'true'
  & pnpm.cmd exec playwright test --reporter=line --workers=1
  $testExitCode = $LASTEXITCODE
  if ($testExitCode -ne 0) {
    exit $testExitCode
  }
}
finally {
  Remove-Item Env:E2E_EXTERNAL_SERVER -ErrorAction SilentlyContinue
  if (-not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
}
