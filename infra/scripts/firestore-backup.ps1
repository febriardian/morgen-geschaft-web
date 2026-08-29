[CmdletBinding()]
param(
    [string]$ProjectId = $env:GCLOUD_PROJECT_ID,
    [string]$Bucket = $env:FIRESTORE_BACKUP_BUCKET,
    [string[]]$Collections,
    [int]$RetentionDays = 30,
    [switch]$SkipCleanup
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($ProjectId)) { $ProjectId = "morgen-geschaft" }
if ([string]::IsNullOrWhiteSpace($Bucket)) {
    throw "FIRESTORE_BACKUP_BUCKET belum diisi. Contoh: gs://morgen-geschaft-backups"
}
if (-not $Bucket.StartsWith("gs://")) { $Bucket = "gs://$Bucket" }

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    throw "gcloud CLI belum terinstal atau belum masuk PATH."
}

if (-not $Collections -or $Collections.Count -eq 0) {
    $Collections = @(
        "products", "orders", "coupons", "blogs", "reviews",
        "notifications", "push_subscriptions"
    )
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$destination = "$($Bucket.TrimEnd('/'))/firestore/$timestamp"
$collectionList = $Collections -join ","

Write-Host "Firestore backup" -ForegroundColor Cyan
Write-Host "Project     : $ProjectId"
Write-Host "Destination : $destination"
Write-Host "Collections : $collectionList"

# Tanpa --async: Task Scheduler menunggu perintah selesai dan exit code dapat diuji.
& gcloud firestore export $destination `
    "--project=$ProjectId" `
    "--collection-ids=$collectionList" `
    --quiet

if ($LASTEXITCODE -ne 0) {
    throw "gcloud firestore export gagal dengan exit code $LASTEXITCODE."
}

Write-Host "Backup selesai: $destination" -ForegroundColor Green

if ($SkipCleanup -or $RetentionDays -le 0) { exit 0 }

$cutoff = (Get-Date).AddDays(-$RetentionDays)
$prefix = "$($Bucket.TrimEnd('/'))/firestore/"
$items = & gcloud storage ls $prefix 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Backup berhasil, tetapi daftar backup lama tidak dapat dibaca."
    exit 0
}

foreach ($item in $items) {
    $name = ($item.TrimEnd('/') -split '/')[-1]
    if ($name -match '^(?<date>\d{8})-(?<time>\d{6})$') {
        $created = [datetime]::ParseExact(
            "$($Matches.date)$($Matches.time)",
            "yyyyMMddHHmmss",
            [Globalization.CultureInfo]::InvariantCulture
        )
        if ($created -lt $cutoff) {
            Write-Host "Menghapus backup lama: $item"
            & gcloud storage rm --recursive $item --quiet
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Gagal menghapus: $item"
            }
        }
    }
}
