$ErrorActionPreference = "Stop"

$project = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$source  = Join-Path $project "backend\public"
$zip     = Join-Path $project "public-update.zip"

Write-Host "Menyiapkan ZIP update frontend..." -ForegroundColor Cyan

if (-not (Test-Path $source)) {
    throw "Folder tidak ditemukan: $source"
}

$indexFile = Join-Path $source "index.html"
if (-not (Test-Path $indexFile)) {
    throw "index.html tidak ditemukan. Jalankan npm run build:hosting terlebih dahulu."
}

Remove-Item $zip -Force -ErrorAction SilentlyContinue

Compress-Archive `
    -Path "$source\*" `
    -DestinationPath $zip `
    -CompressionLevel Optimal `
    -Force

if (-not (Test-Path $zip)) {
    throw "Gagal membuat ZIP."
}

$zipSize = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host ""
Write-Host "ZIP berhasil dibuat." -ForegroundColor Green
Write-Host "Lokasi : $zip"
Write-Host "Ukuran : $zipSize MB"
Write-Host "Upload ke /home/morq2932/morgen-app/public lalu Extract." -ForegroundColor Yellow
