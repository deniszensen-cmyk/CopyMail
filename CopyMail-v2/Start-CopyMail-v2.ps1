$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 5180
$url = "http://127.0.0.1:$port"

function Test-CopyMailServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-CopyMailServer)) {
  $npm = (Get-Command npm.cmd).Source
  Start-Process -FilePath $npm -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1') -WorkingDirectory $root -WindowStyle Hidden | Out-Null

  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-CopyMailServer) { break }
  }
}

Start-Process -FilePath '..\node_modules\.bin\electron.cmd' -ArgumentList @('.') -WorkingDirectory $root -WindowStyle Hidden | Out-Null
