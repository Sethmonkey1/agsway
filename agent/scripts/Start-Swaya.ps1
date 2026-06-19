$ErrorActionPreference = "Stop"

$agentRoot = Split-Path -Parent $PSScriptRoot
$port = 4317
$baseUrl = "http://127.0.0.1:$port"
$healthUrl = "$baseUrl/api/integrations"
$nodePath = "C:\Program Files\nodejs\node.exe"
$nextBin = Join-Path $agentRoot "node_modules\next\dist\bin\next"
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

function Show-LaunchError([string]$message) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    $message,
    "Swaya Agent",
    [System.Windows.MessageBoxButton]::OK,
    [System.Windows.MessageBoxImage]::Error
  ) | Out-Null
}

function Test-SwayaServer {
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -match '"localOnly"'
  } catch {
    return $false
  }
}

function Start-HiddenProcess([string]$fileName, [string]$arguments, [string]$workingDirectory) {
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $fileName
  $startInfo.Arguments = $arguments
  $startInfo.WorkingDirectory = $workingDirectory
  $startInfo.UseShellExecute = $true
  $startInfo.CreateNoWindow = $true
  $startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  return [System.Diagnostics.Process]::Start($startInfo)
}

try {
  if (-not (Test-Path -LiteralPath $nodePath)) {
    throw "Node.js was not found. Reinstall Node.js, then try the shortcut again."
  }

  if (-not (Test-Path -LiteralPath $nextBin)) {
    throw "Swaya's dependencies are missing. Open the project and run npm install once."
  }

  if (-not (Test-Path -LiteralPath (Join-Path $agentRoot ".next\BUILD_ID"))) {
    $build = Start-HiddenProcess $nodePath "`"$nextBin`" build" $agentRoot
    $build.WaitForExit()
    if ($build.ExitCode -ne 0) {
      throw "Swaya could not prepare its local app files."
    }
  }

  if (-not (Test-SwayaServer)) {
    $occupied = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($occupied) {
      throw "Port $port is already being used by another application."
    }

    Start-HiddenProcess $nodePath "`"$nextBin`" start -p $port -H 127.0.0.1" $agentRoot | Out-Null

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
      Start-Sleep -Milliseconds 500
      if (Test-SwayaServer) {
        $ready = $true
        break
      }
    }

    if (-not $ready) {
      throw "Swaya did not start within 15 seconds."
    }
  }

  if (Test-Path -LiteralPath $edgePath) {
    Start-Process -FilePath $edgePath -ArgumentList "--app=$baseUrl", "--start-maximized"
  } elseif (Test-Path -LiteralPath $chromePath) {
    Start-Process -FilePath $chromePath -ArgumentList "--app=$baseUrl", "--start-maximized"
  } else {
    Start-Process $baseUrl
  }
} catch {
  Show-LaunchError $_.Exception.Message
  exit 1
}
