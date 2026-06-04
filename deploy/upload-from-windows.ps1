param(
  [Parameter(Mandatory = $true)]
  [string]$VpsUser,

  [Parameter(Mandatory = $true)]
  [string]$VpsHost
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RemotePath = "/opt/esp32-audio-monitor"
$Archive = Join-Path $env:TEMP "esp32-audio-monitor.zip"

if (Test-Path -LiteralPath $Archive) {
  Remove-Item -LiteralPath $Archive -Force
}

Compress-Archive -Path (Join-Path $ProjectRoot "*") -DestinationPath $Archive -Force

Write-Host "Creating remote folder..."
ssh "$VpsUser@$VpsHost" "sudo mkdir -p $RemotePath && sudo chown `$USER:`$USER $RemotePath"

Write-Host "Uploading project archive..."
scp $Archive "$VpsUser@$VpsHost`:/tmp/esp32-audio-monitor.zip"

Write-Host "Extracting on VPS..."
ssh "$VpsUser@$VpsHost" "sudo apt update && sudo apt install -y unzip && sudo rm -rf $RemotePath/* && sudo unzip -o /tmp/esp32-audio-monitor.zip -d $RemotePath"

Write-Host "Upload complete."
Write-Host "Next SSH into VPS and run:"
Write-Host "cd /opt/esp32-audio-monitor/deploy"
Write-Host "sudo bash install-vps.sh audio.yourdomain.com"

