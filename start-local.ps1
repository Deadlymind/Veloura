$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$pythonExe = Join-Path $projectRoot '.venv/Scripts/python.exe'
$nextScript = Join-Path $projectRoot 'frontend/node_modules/next/dist/bin/next'
$statePath = Join-Path $projectRoot '.local-servers.json'
if (!(Test-Path -LiteralPath $pythonExe) -or !(Test-Path -LiteralPath $nextScript)) { throw 'Install dependencies first. See README.md.' }
if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'backend/.env'))) { throw 'Create backend/.env as described in README.md.' }
if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'frontend/.next/BUILD_ID'))) { throw 'Run npm run build from frontend first, or use npm run dev in a separate terminal.' }
foreach ($port in @(8000, 3000)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is already in use. Stop the existing server before using this launcher." }
}
$backendProcess = Start-Process -FilePath $pythonExe -ArgumentList @('manage.py', 'runserver', '127.0.0.1:8000', '--noreload') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'backend/server.log') -RedirectStandardError (Join-Path $projectRoot 'backend/server-error.log')
try {
    $nodeExe = (Get-Command node.exe).Source
    $frontendProcess = Start-Process -FilePath $nodeExe -ArgumentList @(('"' + $nextScript + '"'), 'start', '--hostname', '127.0.0.1') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'frontend/server.log') -RedirectStandardError (Join-Path $projectRoot 'frontend/server-error.log')
    @($backendProcess, $frontendProcess) | ForEach-Object { @{ processId = $_.Id; started = $_.StartTime.ToUniversalTime().ToString('o') } } | ConvertTo-Json | Set-Content -LiteralPath $statePath
    Write-Host 'Veloura is starting at http://127.0.0.1:3000'
    Write-Host 'Django Admin: http://127.0.0.1:8000/admin/'
    Write-Host 'Use ./stop-local.ps1 to stop these servers. Server logs are in backend/ and frontend/.'
} catch {
    Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue
    throw
}
