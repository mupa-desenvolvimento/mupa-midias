$ErrorActionPreference = "Stop"

function Test-IsAdmin {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
  $argsList = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$PSCommandPath`""
  )
  Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $argsList | Out-Null
  exit 0
}

$ServiceName = "APIUnidasulV15"
$Port = 5000
$ScriptDir = Split-Path -Parent $PSCommandPath
$RepoRoot = $ScriptDir
$DeployDir = "C:\Services\APIUnidasulV15"
$ProgramDataDir = Join-Path $env:ProgramData "APIUnidasulV15"
$ProgramDataLogs = Join-Path $ProgramDataDir "logs"
$ExeSource1 = Join-Path $RepoRoot "api-unidasul-master_version_15\dist\APIUnidasulV15.exe"
$ExeSource2 = Join-Path $RepoRoot "APIUnidasulV15.exe"
$ExeDest = Join-Path $DeployDir "APIUnidasulV15.exe"
$NssmDest = Join-Path $DeployDir "nssm.exe"

New-Item -ItemType Directory -Force -Path $DeployDir | Out-Null
New-Item -ItemType Directory -Force -Path $ProgramDataLogs | Out-Null

if (-not (Test-Path -LiteralPath $NssmDest)) {
  $temp = Join-Path $env:TEMP ("apiunidasul_nssm_" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $temp | Out-Null
  $zip = Join-Path $temp "nssm.zip"
  $url = "https://nssm.cc/release/nssm-2.24.zip"
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
  Expand-Archive -Path $zip -DestinationPath $temp -Force
  $candidate = Join-Path $temp "nssm-2.24\win64\nssm.exe"
  if (-not (Test-Path -LiteralPath $candidate)) {
    throw "NSSM não encontrado após download/extração."
  }
  Copy-Item -LiteralPath $candidate -Destination $NssmDest -Force
  Remove-Item -LiteralPath $temp -Recurse -Force
}

$exeSource = $null
if (Test-Path -LiteralPath $ExeSource1) { $exeSource = $ExeSource1 }
elseif (Test-Path -LiteralPath $ExeSource2) { $exeSource = $ExeSource2 }

if (-not $exeSource) {
  throw "APIUnidasulV15.exe não encontrado. Coloque o executável em: `n- $ExeSource2 `nou rode o build para gerar em: `n- $ExeSource1"
}

Copy-Item -LiteralPath $exeSource -Destination $ExeDest -Force

$serviceExists = $false
try {
  $null = sc.exe query $ServiceName 2>$null
  if ($LASTEXITCODE -eq 0) { $serviceExists = $true }
} catch {}

if ($serviceExists) {
  & $NssmDest stop $ServiceName | Out-Null
  Start-Sleep -Seconds 2
  & $NssmDest remove $ServiceName confirm | Out-Null
  Start-Sleep -Seconds 1
}

& $NssmDest install $ServiceName $ExeDest | Out-Null
& $NssmDest set $ServiceName AppDirectory $DeployDir | Out-Null
& $NssmDest set $ServiceName ObjectName LocalSystem | Out-Null
& $NssmDest set $ServiceName Start SERVICE_AUTO_START | Out-Null
& $NssmDest set $ServiceName AppNoConsole 1 | Out-Null
& $NssmDest set $ServiceName AppEnvironmentExtra "RUNNING_AS_SERVICE=1" | Out-Null
& $NssmDest set $ServiceName AppStdout (Join-Path $DeployDir "service_stdout.log") | Out-Null
& $NssmDest set $ServiceName AppStderr (Join-Path $DeployDir "service_stderr.log") | Out-Null
& $NssmDest set $ServiceName AppRotateFiles 1 | Out-Null
& $NssmDest set $ServiceName AppRotateOnline 1 | Out-Null
& $NssmDest set $ServiceName AppRotateSeconds 86400 | Out-Null
& $NssmDest set $ServiceName AppRotateBytes 10485760 | Out-Null
& $NssmDest set $ServiceName AppExit Default Restart | Out-Null
& $NssmDest set $ServiceName AppRestartDelay 10000 | Out-Null

$ruleName = "APIUnidasulV15 TCP $Port"
$rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $rule) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
}

& $NssmDest start $ServiceName | Out-Null
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Serviço instalado e iniciado: $ServiceName"
Write-Host "Status:"
sc.exe query $ServiceName
Write-Host ""
Write-Host "Executável:"
Write-Host " - $ExeDest"
Write-Host "Logs do serviço (stdout/stderr):"
Write-Host " - $DeployDir\service_stdout.log"
Write-Host " - $DeployDir\service_stderr.log"
Write-Host "Log da aplicação:"
Write-Host " - $ProgramDataLogs\apiunidasul.log"
Write-Host "DB:"
Write-Host " - $ProgramDataDir\mupa.db"
Write-Host ""
