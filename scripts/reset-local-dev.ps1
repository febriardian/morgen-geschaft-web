$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Menghentikan proses lama pada port 3002 dan 5173..." -ForegroundColor Cyan

$ports = @(3002, 5173)
foreach ($port in $ports) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        $pidToStop = $listener.OwningProcess
        if ($pidToStop -and $pidToStop -ne $PID) {
            $process = Get-Process -Id $pidToStop -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "Menghentikan $($process.ProcessName) PID $pidToStop pada port $port" -ForegroundColor Yellow
                Stop-Process -Id $pidToStop -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

# PM2 can immediately revive an older backend after the PID is killed.
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    $pm2List = pm2 jlist 2>$null
    if ($LASTEXITCODE -eq 0 -and $pm2List) {
        try {
            $apps = $pm2List | ConvertFrom-Json
            $morgenApps = $apps | Where-Object { $_.name -eq "morgen-backend" }
            if ($morgenApps) {
                Write-Host "Menghentikan proses PM2 lama morgen-backend..." -ForegroundColor Yellow
                pm2 delete morgen-backend | Out-Null
            }
        } catch {
            Write-Host "Daftar PM2 tidak dapat dibaca; lanjut tanpa perubahan PM2." -ForegroundColor DarkYellow
        }
    }
}

$viteCache = Join-Path $projectRoot "frontend\node_modules\.vite"
if (Test-Path $viteCache) {
    Remove-Item $viteCache -Recurse -Force -ErrorAction SilentlyContinue
}

$serverFile = Join-Path $projectRoot "backend\src\server.js"
if (-not (Select-String -Path $serverFile -Pattern 'public-content-v3' -Quiet)) {
    throw "backend/src/server.js belum berisi perbaikan public-content-v3. Ekstrak patch dengan Replace terlebih dahulu."
}

Write-Host "Menjalankan frontend dan backend terbaru..." -ForegroundColor Green
Write-Host "Setelah aktif, buka http://localhost:5173/api/_version" -ForegroundColor Cyan
& npm run dev
