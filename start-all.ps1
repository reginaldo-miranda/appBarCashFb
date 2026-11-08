Write-Host "Iniciando Sistema Completo do Bar..."
$root = $PSScriptRoot
function Get-LanIp {
  $ip = $null
  try {
    $configs = Get-NetIPConfiguration | Where-Object { 
      $_.IPv4DefaultGateway -ne $null -and 
      $_.InterfaceAlias -notmatch 'vEthernet|WSL|VirtualBox|VMware|Docker|Loopback' 
    }
    $ip = ($configs | ForEach-Object { $_.IPv4Address.IPAddress } | Where-Object { $_ -match '^192\.168\.' } | Select-Object -First 1)
    if (-not $ip) {
      $ip = ($configs | ForEach-Object { $_.IPv4Address.IPAddress } | Where-Object { $_ -notmatch '^169\.254\.' -and $_ -ne '127.0.0.1' -and $_ -notmatch '^172\.' } | Select-Object -First 1)
    }
  } catch {}

  if (-not $ip -or $ip.Trim() -eq '') {
    try { 
      $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.IPAddress -ne '127.0.0.1' -and 
        $_.IPAddress -notmatch '^169\.254\.' -and 
        $_.InterfaceAlias -notmatch 'vEthernet|WSL|VirtualBox|VMware|Docker|Loopback' -and
        $_.IPAddress -match '^192\.168\.'
      } | Select-Object -ExpandProperty IPAddress -First 1) 
    } catch {}
  }
  if (-not $ip -or $ip.Trim() -eq '') {
    try { 
      $ip = ([System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { 
        $_.AddressFamily -eq 'InterNetwork' -and 
        $_.IPAddressToString -ne '127.0.0.1' -and 
        $_.IPAddressToString -match '^192\.168\.' 
      } | Select-Object -ExpandProperty IPAddressToString -First 1) 
    } catch {}
  }
  return [string]$ip
}
$lanIp = Get-LanIp
if ($lanIp -and $lanIp.Trim() -ne '') {
  Write-Host "API (LAN): http://$lanIp:4000/api"
  Write-Host "Expo (LAN): http://$lanIp:8082"
} else { Write-Host "IP LAN não detectado" }

Start-Process powershell -ArgumentList '-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $root 'start-api.ps1')
Start-Sleep -Seconds 6
Start-Process powershell -ArgumentList '-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $root 'start-mobile.ps1')
Write-Host "Serviços iniciados. Pressione Ctrl+C para sair deste shell."
