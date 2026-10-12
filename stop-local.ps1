$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot '.local-servers.json'
if (!(Test-Path -LiteralPath $statePath)) { Write-Host 'No launcher-owned servers recorded.'; exit 0 }
$records = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
foreach ($record in $records) {
    $serverProcess = Get-Process -Id $record.processId -ErrorAction SilentlyContinue
    if ($serverProcess -and $serverProcess.StartTime.ToUniversalTime().Ticks -eq ([datetime]$record.started).ToUniversalTime().Ticks) {
        Stop-Process -Id $serverProcess.Id
    }
}
Remove-Item -LiteralPath $statePath
Write-Host 'Stopped the Veloura servers started by start-local.ps1.'
