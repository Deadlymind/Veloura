$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot '.local-tunnel.json'
if (Test-Path -LiteralPath $statePath) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $tunnel = Get-Process -Id $state.processId -ErrorAction SilentlyContinue
    if ($tunnel -and $tunnel.StartTime.ToUniversalTime().Ticks -eq ([datetime]$state.started).ToUniversalTime().Ticks) {
        Stop-Process -Id $tunnel.Id
    }
    Remove-Item -LiteralPath $statePath
}
$originPath = Join-Path $PSScriptRoot 'backend/.tunnel-origin'
if (Test-Path -LiteralPath $originPath) { Remove-Item -LiteralPath $originPath }
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.local-servers.json')) {
    & (Join-Path $PSScriptRoot 'stop-local.ps1')
    & (Join-Path $PSScriptRoot 'start-local.ps1')
}
Write-Host 'Public tunnel closed. Local Veloura servers remain available.'
