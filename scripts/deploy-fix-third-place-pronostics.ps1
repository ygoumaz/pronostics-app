# deploy-fix-third-place-pronostics.ps1
#
# Uploads fix-third-place-pronostics.cjs to /app on the Fly.io machine and
# runs it. Backfills all participants' pronostics for the third-place match
# (M103, France vs England) from the manually-collected Pronos.xlsx sheet.
#
# Usage (from repo root):
#   .\scripts\deploy-fix-third-place-pronostics.ps1

$ErrorActionPreference = 'Stop'

# Ensure flyctl is available
$flyDir = 'C:\Users\Yannick\AppData\Local\Microsoft\WinGet\Packages\Fly-io.flyctl_Microsoft.Winget.Source_8wekyb3d8bbwe'
if (Test-Path "$flyDir\flyctl.exe") {
  $env:PATH += ";$flyDir"
}

$appName     = 'pronostics-app'
$localScript = Join-Path $PSScriptRoot 'fix-third-place-pronostics.cjs'
$remotePath  = '/app/fix-third-place-pronostics.cjs'

Write-Host "==> Uploading fix script to $remotePath ..." -ForegroundColor Cyan
flyctl sftp put $localScript $remotePath --app $appName

Write-Host "==> Running fix script on Fly.io machine ..." -ForegroundColor Cyan
flyctl ssh console --app $appName --command "node $remotePath"

Write-Host "==> Cleaning up remote script ..." -ForegroundColor Cyan
flyctl ssh console --app $appName --command "rm -f $remotePath"

Write-Host "==> All done!" -ForegroundColor Green
