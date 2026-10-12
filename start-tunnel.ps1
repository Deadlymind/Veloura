$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$statePath = Join-Path $root '.local-tunnel.json'
$exe = Join-Path $root '.tools/cloudflared.exe'
if (Test-Path -LiteralPath $statePath) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $existing = Get-Process -Id $state.processId -ErrorAction SilentlyContinue
    if ($existing -and $existing.StartTime.ToUniversalTime().Ticks -eq ([datetime]$state.started).ToUniversalTime().Ticks) {
        Write-Host "Veloura tunnel is already running: $($state.url)"
        return
    }
}
if (!(Test-Path -LiteralPath $exe)) {
    $release = Invoke-RestMethod 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest'
    $asset = $release.assets | Where-Object name -eq 'cloudflared-windows-amd64.exe'
    if (!$asset -or !$asset.digest) { throw 'Official Windows download or checksum unavailable.' }
    New-Item -ItemType Directory -Force -Path (Join-Path $root '.tools') | Out-Null
    Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $exe
    $digest = 'sha256:' + (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLower()
    if ($digest -ne $asset.digest) {
        Remove-Item -LiteralPath $exe
        throw 'Cloudflared download checksum mismatch.'
    }
}
if (!(Test-Path -LiteralPath (Join-Path $root '.local-servers.json'))) {
    & (Join-Path $root 'start-local.ps1')
}
$log = Join-Path $root 'tunnel-error.log'
$tunnel = Start-Process -FilePath $exe -ArgumentList @('tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:3000') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $root 'tunnel.log') -RedirectStandardError $log
try {
    $url = $null
    for ($attempt = 0; $attempt -lt 45; $attempt++) {
        Start-Sleep -Seconds 1
        $tunnel.Refresh()
        if ($tunnel.HasExited) { throw 'Cloudflared exited. See tunnel-error.log.' }
        $match = [regex]::Match((Get-Content -LiteralPath $log -Raw), 'https://[a-z0-9-]+\.trycloudflare\.com')
        if ($match.Success) { $url = $match.Value; break }
    }
    if (!$url) { throw 'No tunnel URL received. See tunnel-error.log.' }
    Set-Content -LiteralPath (Join-Path $root 'backend/.tunnel-origin') -Value $url -Encoding utf8
    @{ processId = $tunnel.Id; started = $tunnel.StartTime.ToUniversalTime().ToString('o'); url = $url } | ConvertTo-Json | Set-Content -LiteralPath $statePath
    # Reload the backend with this exact trusted origin; preserve local access.
    & (Join-Path $root 'stop-local.ps1')
    & (Join-Path $root 'start-local.ps1')
    Write-Host "Public storefront: $url"
    Write-Host "Admin dashboard: $url/admin/login"
    Write-Host 'Keep this computer awake. Use ./stop-tunnel.ps1 to close public access.'
} catch {
    Stop-Process -Id $tunnel.Id -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $statePath) { Remove-Item -LiteralPath $statePath }
    $originPath = Join-Path $root 'backend/.tunnel-origin'
    if (Test-Path -LiteralPath $originPath) { Remove-Item -LiteralPath $originPath }
    throw
}
