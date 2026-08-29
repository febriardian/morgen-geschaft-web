[CmdletBinding()]
param(
    [string]$Url = "http://127.0.0.1:3002/api/health",
    [int]$TimeoutSec = 15,
    [string]$LogPath = ""
)
if ([string]::IsNullOrWhiteSpace($LogPath)) {
    $infraRoot = Split-Path -Parent $PSScriptRoot
    $LogPath = Join-Path $infraRoot "logs\health-monitor.log"
}

$logDirectory = Split-Path -Parent $LogPath
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

$ErrorActionPreference = "Stop"
$logDirectory = Split-Path -Parent $LogPath
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
    $health = Invoke-RestMethod -Uri $Url -TimeoutSec $TimeoutSec
    $redisStatus = $health.redis.status
    $line = "[$timestamp] status=$($health.status) redis=$redisStatus uptime=$($health.uptime) memoryMB=$($health.memoryMB)"
    Add-Content -Path $LogPath -Value $line

    if ($health.status -ne "ok") {
        Write-Error $line
        exit 1
    }

    Write-Output $line
    exit 0
}
catch {
    $line = "[$timestamp] status=down error=$($_.Exception.Message)"
    Add-Content -Path $LogPath -Value $line
    Write-Error $line
    exit 1
}
