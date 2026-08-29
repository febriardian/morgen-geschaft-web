[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Destination,

    [string]$Source = "",
    [int]$RetentionDays = 90,
    [switch]$LatestOnly
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if ([string]::IsNullOrWhiteSpace($Source)) {
    $Source = Join-Path $projectRoot "storage\backups\firestore"
}

if (-not (Test-Path $Source)) {
    throw "Folder backup tidak ditemukan: $Source"
}

$targetRoot = Join-Path $Destination "Morgen-Geschaft\firestore"
$logDirectory = Join-Path $projectRoot "infra\logs"
$logFile = Join-Path $logDirectory "external-backup.log"
New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

$files = Get-ChildItem -Path $Source -Filter "firestore-*.json" -File | Sort-Object LastWriteTime
if ($LatestOnly -and $files.Count -gt 0) {
    $files = @($files[-1])
}

if ($files.Count -eq 0) {
    throw "Belum ada file firestore-*.json di $Source"
}

$copied = 0
$skipped = 0
foreach ($file in $files) {
    $target = Join-Path $targetRoot $file.Name
    $copyNeeded = $true

    if (Test-Path $target) {
        $sourceHash = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash
        $targetHash = (Get-FileHash -Path $target -Algorithm SHA256).Hash
        if ($sourceHash -eq $targetHash) {
            $copyNeeded = $false
            $skipped++
        }
    }

    if ($copyNeeded) {
        $temporary = "$target.partial"
        Copy-Item -Path $file.FullName -Destination $temporary -Force

        $sourceHash = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash
        $temporaryHash = (Get-FileHash -Path $temporary -Algorithm SHA256).Hash
        if ($sourceHash -ne $temporaryHash) {
            Remove-Item $temporary -Force -ErrorAction SilentlyContinue
            throw "Verifikasi checksum gagal untuk $($file.Name)"
        }

        Move-Item -Path $temporary -Destination $target -Force
        $copied++
    }
}

if ($RetentionDays -gt 0) {
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -Path $targetRoot -Filter "firestore-*.json" -File |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        Remove-Item -Force
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$line = "[$timestamp] destination=$targetRoot copied=$copied skipped=$skipped retentionDays=$RetentionDays"
Add-Content -Path $logFile -Value $line

Write-Host "Backup eksternal selesai." -ForegroundColor Green
Write-Host "Tujuan    : $targetRoot"
Write-Host "Disalin   : $copied"
Write-Host "Dilewati  : $skipped"
Write-Host "Log       : $logFile"
