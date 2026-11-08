Write-Host "Iniciando Aplicativo Mobile..."
$mobileDir = Join-Path $PSScriptRoot "mobile"
Set-Location $mobileDir

# Instalar dependências se necessário
if (!(Test-Path (Join-Path $mobileDir "node_modules"))) {
  Write-Host "Instalando dependências..."
  npm install
}

# Detectar IP da LAN automaticamente (filtrando interfaces virtuais como Hyper-V/WSL e priorizando Wi-Fi 192.168.x.x)
$lanIp = $null
try {
  $configs = Get-NetIPConfiguration | Where-Object { 
    $_.IPv4DefaultGateway -ne $null -and 
    $_.InterfaceAlias -notmatch 'vEthernet|WSL|VirtualBox|VMware|Docker|Loopback' 
  }
  $lanIp = ($configs | ForEach-Object { $_.IPv4Address.IPAddress } | Where-Object { $_ -match '^192\.168\.' } | Select-Object -First 1)
  if (-not $lanIp) {
    $lanIp = ($configs | ForEach-Object { $_.IPv4Address.IPAddress } | Where-Object { $_ -notmatch '^169\.254\.' -and $_ -ne '127.0.0.1' -and $_ -notmatch '^172\.' } | Select-Object -First 1)
  }
} catch {}

if (-not $lanIp -or $lanIp.Trim() -eq '') {
  try {
    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
      $_.IPAddress -ne '127.0.0.1' -and 
      $_.IPAddress -notmatch '^169\.254\.' -and 
      $_.InterfaceAlias -notmatch 'vEthernet|WSL|VirtualBox|VMware|Docker|Loopback' -and
      $_.IPAddress -match '^192\.168\.'
    } | Select-Object -ExpandProperty IPAddress -First 1)
  } catch {}
}

if (-not $lanIp -or $lanIp.Trim() -eq '') {
  try {
    $lanIp = ([System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { 
      $_.AddressFamily -eq 'InterNetwork' -and 
      $_.IPAddressToString -ne '127.0.0.1' -and 
      $_.IPAddressToString -match '^192\.168\.' 
    } | Select-Object -ExpandProperty IPAddressToString -First 1)
  } catch {}
}

if ($lanIp -and $lanIp.Trim() -ne '') {
  $lanIpStr = [string]$lanIp
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIpStr
  $env:EXPO_PUBLIC_API_URL = "http://$lanIpStr:4000/api"
  $env:WS_PORT = "4001"
  Write-Host "REACT_NATIVE_PACKAGER_HOSTNAME=$($env:REACT_NATIVE_PACKAGER_HOSTNAME)"
  Write-Host "EXPO_PUBLIC_API_URL=$($env:EXPO_PUBLIC_API_URL)"
} else {
  Write-Host "IP LAN não detectado; Expo irá tentar autodetectar"
}

# Garantir API ativa: health-check e auto start se necessário
$apiHealthOk = $false
try {
  if ($lanIpStr) {
    $resp = Invoke-WebRequest -Uri ("http://$lanIpStr:4000/api/health") -Method GET -TimeoutSec 3 -ErrorAction Stop
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) { $apiHealthOk = $true }
  }
} catch {}
if (-not $apiHealthOk) {
  Write-Host "Iniciando API (auto) ..."
  Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'start-api.ps1') | Out-Null
  Start-Sleep -Seconds 5
}

# Iniciar Expo em modo Web na porta 8082 com cache limpo
npx expo start --web --port 8082 -c
