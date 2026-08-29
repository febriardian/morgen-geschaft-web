[CmdletBinding()]
param(
    [string]$TaskName = "Morgen Local Health Monitor",
    [string]$HealthUrl = "http://127.0.0.1:3002/api/health",
    [int]$IntervalMinutes = 5
)

$ErrorActionPreference = "Stop"
if ($IntervalMinutes -lt 1) { throw "IntervalMinutes minimal 1." }

$scriptPath = (Resolve-Path (Join-Path $PSScriptRoot "local-health-check.ps1")).Path
$powershell = (Get-Command powershell.exe).Source
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Url `"$HealthUrl`""

$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Description "Memeriksa health endpoint Morgen Geschäft pada komputer lokal." `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Force | Out-Null

Write-Host "Task '$TaskName' berhasil dibuat." -ForegroundColor Green
Write-Host "Log: infra\\logs\\health-monitor.log"
