$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Membersihkan proses dan cache frontend saja..." -ForegroundColor Cyan

# Jangan sentuh port backend 3002 dan jangan hapus proses PM2.
$listeners = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
    $pidToStop = $listener.OwningProcess
    if ($pidToStop -and $pidToStop -ne $PID) {
        $process = Get-Process -Id $pidToStop -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Menghentikan frontend lama: $($process.ProcessName) PID $pidToStop" -ForegroundColor Yellow
            Stop-Process -Id $pidToStop -Force -ErrorAction SilentlyContinue
        }
    }
}

$viteCache = Join-Path $projectRoot "frontend\node_modules\.vite"
if (Test-Path $viteCache) {
    Remove-Item $viteCache -Recurse -Force -ErrorAction SilentlyContinue
}

if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    $pm2Json = pm2 jlist 2>$null
    if ($LASTEXITCODE -eq 0 -and $pm2Json) {
        try {
            $apps = $pm2Json | ConvertFrom-Json
            $backend = $apps | Where-Object { $_.name -eq "morgen-backend" } | Select-Object -First 1
            if (-not $backend) {
                Write-Warning "PM2 belum memiliki proses morgen-backend. Jalankan npm run backend:restart satu kali."
            } elseif ($backend.pm2_env.status -ne "online") {
                Write-Warning "morgen-backend ada di PM2 tetapi statusnya $($backend.pm2_env.status). Jalankan npm run backend:restart."
            } else {
                Write-Host "Backend PM2 tetap aktif (online)." -ForegroundColor Green
            }
        } catch {
            Write-Warning "Status PM2 tidak dapat dibaca, tetapi proses PM2 tidak diubah."
        }
    }
}

Write-Host "Menjalankan Vite frontend..." -ForegroundColor Green
& npm run dev:frontend
