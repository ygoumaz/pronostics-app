# deploy-fix-davidraj.ps1
#
# Uploads fix-davidraj-pronostic.cjs to /app on the Fly.io machine (so that
# Node.js resolves @prisma/client from /app/node_modules), runs it, then
# removes it.
#
# Usage (from repo root):
#   .\scripts\deploy-fix-davidraj.ps1

$ErrorActionPreference = 'Stop'

$appName     = 'pronostics-app'
$localScript = Join-Path $PSScriptRoot 'fix-davidraj-pronostic.cjs'
$remotePath  = '/app/fix-davidraj-pronostic.cjs'

Write-Host "==> Uploading fix script to $remotePath ..." -ForegroundColor Cyan
flyctl sftp put $localScript $remotePath --app $appName

Write-Host "==> Running fix script on Fly.io machine ..." -ForegroundColor Cyan
flyctl ssh console --app $appName --command "node $remotePath"

Write-Host "==> Cleaning up remote script ..." -ForegroundColor Cyan
flyctl ssh console --app $appName --command "rm -f $remotePath"

Write-Host "==> All done!" -ForegroundColor Green
