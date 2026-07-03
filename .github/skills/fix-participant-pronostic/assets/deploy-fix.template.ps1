# deploy-fix-<participant>-match<N>.ps1
#
# Uploads fix-<participant>-match<N>.cjs to /app on the Fly.io machine and runs it.
#
# Usage (from repo root):
#   .\scripts\deploy-fix-<participant>-match<N>.ps1

$ErrorActionPreference = 'Stop'

# Ensure flyctl is available (WinGet install path)
$flyDir = 'C:\Users\Yannick\AppData\Local\Microsoft\WinGet\Packages\Fly-io.flyctl_Microsoft.Winget.Source_8wekyb3d8bbwe'
if (Test-Path "$flyDir\flyctl.exe") {
  $env:PATH += ";$flyDir"
}

$appName     = 'pronostics-app'
$localScript = Join-Path $PSScriptRoot 'fix-<participant>-match<N>.cjs' # TODO: rename
$remotePath  = '/app/fix-<participant>-match<N>.cjs'                    # TODO: rename

Write-Host "==> Uploading fix script to $remotePath ..." -ForegroundColor Cyan
flyctl sftp put $localScript $remotePath --app $appName

Write-Host "==> Running fix script on Fly.io machine ..." -ForegroundColor Cyan
flyctl ssh console --app $appName --command "node $remotePath"

Write-Host "==> Cleaning up remote script ..." -ForegroundColor Cyan
flyctl ssh console --app $appName --command "rm -f $remotePath"

Write-Host "==> All done!" -ForegroundColor Green
