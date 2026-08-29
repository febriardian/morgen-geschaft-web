$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$packageFile = Join-Path $projectRoot "package.json"
$unusedService = Join-Path $projectRoot "backend\src\services\imageCdn.js"

if (-not (Test-Path -LiteralPath $packageFile)) {
  throw "Jalankan script ini dari folder project Morgen Geschäft yang benar."
}

$package = Get-Content -LiteralPath $packageFile -Raw | ConvertFrom-Json
if ($package.name -ne "morgen-geschaft-project") {
  throw "Project tidak dikenali. Tidak ada file yang dihapus."
}

if (Test-Path -LiteralPath $unusedService) {
  Remove-Item -LiteralPath $unusedService -Force
  Write-Host "Cloudinary helper yang tidak digunakan sudah dihapus."
} else {
  Write-Host "Cloudinary helper sudah tidak ada. Tidak perlu tindakan tambahan."
}

Write-Host "Pembersihan Cloudinary selesai."
