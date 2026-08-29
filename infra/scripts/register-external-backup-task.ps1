[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Destination,

    [string]$TaskName = "Morgen External Backup Sync",
    [string]$DailyAt = "03:30",
    [int]$RetentionDays = 90
)

$ErrorActionPreference = "Stop"
$time = [datetime]::ParseExact($DailyAt, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
$scriptPath = (Resolve-Path (Join-Path $PSScriptRoot "sync-backup-to-external.ps1")).Path
$powershell = (Get-Command powershell.exe).Source
$arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`" -Destination `"$Destination`" -RetentionDays $RetentionDays"

$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Description "Menyalin backup JSON Firestore Morgen Geschäft ke penyimpanan eksternal/sinkronisasi cloud." `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Force | Out-Null

Write-Host "Task '$TaskName' dibuat pada $DailyAt." -ForegroundColor Green
Write-Host "Tujuan: $Destination"
