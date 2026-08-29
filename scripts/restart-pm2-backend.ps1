$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    throw "Perintah pm2 tidak ditemukan. Pastikan PM2 sudah terpasang dan terminal baru sudah dibuka."
}

$backendDir = Join-Path $projectRoot "backend"
$ecosystem = Join-Path $backendDir "config\ecosystem.config.cjs"
if (-not (Test-Path $ecosystem)) {
    throw "File backend/config/ecosystem.config.cjs tidak ditemukan."
}

$apps = @()
$pm2Json = pm2 jlist 2>$null
if ($LASTEXITCODE -eq 0 -and $pm2Json) {
    try { $apps = $pm2Json | ConvertFrom-Json } catch { $apps = @() }
}

$existing = $apps | Where-Object { $_.name -eq "morgen-backend" } | Select-Object -First 1
if ($existing) {
    Write-Host "Memuat ulang backend yang sudah dikelola PM2..." -ForegroundColor Cyan
    pm2 restart morgen-backend --update-env
} else {
    Write-Host "Proses morgen-backend belum terdaftar. Mendaftarkan ecosystem config..." -ForegroundColor Yellow
    pm2 start $ecosystem --update-env
}

if ($LASTEXITCODE -ne 0) {
    throw "PM2 gagal memuat backend. Jalankan: pm2 logs morgen-backend --lines 100"
}

pm2 save | Out-Null
Start-Sleep -Seconds 3

$checks = @(
    "http://127.0.0.1:3002/api/_version",
    "http://127.0.0.1:3002/api/testimoni",
    "http://127.0.0.1:3002/api/promotions"
)

$failed = $false
foreach ($url in $checks) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        Write-Host "OK $($response.StatusCode)  $url" -ForegroundColor Green
    } catch {
        $failed = $true
        $status = $_.Exception.Response.StatusCode.value__
        if (-not $status) { $status = "tidak tersambung" }
        Write-Host "GAGAL ($status)  $url" -ForegroundColor Red
    }
}

if ($failed) {
    Write-Host "\nBackend aktif tetapi endpoint belum benar. Log terakhir:" -ForegroundColor Yellow
    pm2 logs morgen-backend --lines 60 --nostream
    throw "Verifikasi backend gagal. Periksa log PM2 di atas."
}

Write-Host "\nBackend PM2 sudah menggunakan source terbaru. Setelah ini cukup jalankan npm run dev untuk frontend." -ForegroundColor Green
