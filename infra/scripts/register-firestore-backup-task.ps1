[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Bucket,

    [string]$ProjectId = "morgen-geschaft",
    [string]$TaskName = "Morgen Firestore Backup",
    [string]$DailyAt = "03:00"
)

$ErrorActionPreference = "Stop"
$time = [datetime]::ParseExact($DailyAt, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
$scriptPath = (Resolve-Path (Join-Path $PSScriptRoot "firestore-backup.ps1")).Path
$powershell = (Get-Command powershell.exe).Source
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ProjectId `"$ProjectId`" -Bucket `"$Bucket`""

$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Description "Backup Firestore Morgen Geschäft ke Google Cloud Storage." `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Force | Out-Null

Write-Host "Task '$TaskName' berhasil dibuat pada $DailyAt." -ForegroundColor Green
Write-Host "Catatan: task lokal berjalan saat Windows dan akun pengguna tersedia."
