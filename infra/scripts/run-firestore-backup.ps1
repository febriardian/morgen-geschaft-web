$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$backupScript = Join-Path $projectRoot "backend\scripts\firestore-backup-json.js"
$logDirectory = Join-Path $projectRoot "infra\logs"
$logFile = Join-Path $logDirectory "firestore-backup-json.log"

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

$startedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$startedAt] START"

& $nodeExe $backupScript *>> $logFile
$exitCode = $LASTEXITCODE

$finishedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$finishedAt] END exit=$exitCode"
Add-Content -Path $logFile -Value ""

exit $exitCode
