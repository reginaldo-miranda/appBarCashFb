# Script PowerShell para preparar os arquivos de build do Instalador do appBarCash
# Executado no ambiente de desenvolvimento do programador.

$ErrorActionPreference = "Stop"

# 1. Configurar diretorios
$InstallerDir = $PSScriptRoot
$ProjectRoot = (Get-Item -Path $InstallerDir).Parent.FullName
$BuildDir = Join-Path -Path $InstallerDir -ChildPath "build"
$CacheDir = Join-Path -Path $InstallerDir -ChildPath "cache"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "     Preparador do Instalador - appBarCash" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Raiz do projeto: $ProjectRoot"
Write-Host "Pasta do instalador: $InstallerDir"
Write-Host "Pasta de build final: $BuildDir"
Write-Host "------------------------------------------------------"

# 2. Criar pastas basicas
if (!(Test-Path -Path $CacheDir)) {
    New-Item -ItemType Directory -Path $CacheDir | Out-Null
}
if (Test-Path -Path $BuildDir) {
    Write-Host "Limpando pasta de build anterior..." -ForegroundColor Yellow
    Remove-Item -Path $BuildDir -Recurse -Force
}
New-Item -ItemType Directory -Path $BuildDir | Out-Null
$PrereqDir = New-Item -ItemType Directory -Path (Join-Path -Path $BuildDir -ChildPath "prerequisites")

# 3. Baixar pre-requisitos (se nao estiverem no cache)
$NodeMsiUrl = "https://nodejs.org/dist/v18.18.2/node-v18.18.2-x64.msi"
$MariaDbMsiUrl = "https://archive.mariadb.org/mariadb-10.11.5/winx64-packages/mariadb-10.11.5-winx64.msi"
$WinSwUrl = "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe"

$NodeMsiCache = Join-Path -Path $CacheDir -ChildPath "node.msi"
$MariaDbMsiCache = Join-Path -Path $CacheDir -ChildPath "mariadb.msi"
$WinSwCache = Join-Path -Path $CacheDir -ChildPath "winsw.exe"

# Baixar Node.js MSI
if (!(Test-Path -Path $NodeMsiCache)) {
    Write-Host "Baixando Node.js MSI para o cache..." -ForegroundColor Green
    Invoke-WebRequest -Uri $NodeMsiUrl -OutFile $NodeMsiCache -UseBasicParsing
} else {
    Write-Host "Node.js MSI ja esta no cache." -ForegroundColor Gray
}

# Baixar MariaDB MSI
if (!(Test-Path -Path $MariaDbMsiCache)) {
    Write-Host "Baixando MariaDB MSI para o cache..." -ForegroundColor Green
    Invoke-WebRequest -Uri $MariaDbMsiUrl -OutFile $MariaDbMsiCache -UseBasicParsing
} else {
    Write-Host "MariaDB MSI ja esta no cache." -ForegroundColor Gray
}

# Baixar WinSW
if (!(Test-Path -Path $WinSwCache)) {
    Write-Host "Baixando WinSW para o cache..." -ForegroundColor Green
    Invoke-WebRequest -Uri $WinSwUrl -OutFile $WinSwCache -UseBasicParsing
} else {
    Write-Host "WinSW ja esta no cache." -ForegroundColor Gray
}

# Copiar pre-requisitos para a pasta de build
Copy-Item -Path $NodeMsiCache -Destination (Join-Path -Path $PrereqDir.FullName -ChildPath "node.msi")
Copy-Item -Path $MariaDbMsiCache -Destination (Join-Path -Path $PrereqDir.FullName -ChildPath "mariadb.msi")
Copy-Item -Path $WinSwCache -Destination (Join-Path -Path $BuildDir -ChildPath "appbarcash-service.exe")

# 4. Copiar arquivos de configuracao do servico e banco
Copy-Item -Path (Join-Path -Path $InstallerDir -ChildPath "appbarcash-service.xml") -Destination (Join-Path -Path $BuildDir -ChildPath "appbarcash-service.xml")
Copy-Item -Path (Join-Path -Path $InstallerDir -ChildPath "configurar-banco.bat") -Destination (Join-Path -Path $BuildDir -ChildPath "configurar-banco.bat")
Copy-Item -Path (Join-Path -Path $InstallerDir -ChildPath "detectar-porta.bat") -Destination (Join-Path -Path $BuildDir -ChildPath "detectar-porta.bat")

# 5. (dump_mysql.sql nao e mais necessario no instalador)
#    As tabelas sao criadas automaticamente pelo sistema na primeira execucao.
#    Apenas o banco vazio 'appbarcash' e criado pelo configurar-banco.bat.

# 6. Gerar Build Web do Frontend Mobile
Write-Host "Gerando Build de Produção Web do Frontend (Expo)..." -ForegroundColor Green
$MobilePath = Join-Path -Path $ProjectRoot -ChildPath "mobile"
Push-Location $MobilePath
try {
    npx expo export -p web
} finally {
    Pop-Location
}

# 7. Copiar Backend da API
Write-Host "Copiando arquivos da API backend..." -ForegroundColor Green
$ApiSrc = Join-Path -Path $ProjectRoot -ChildPath "api"
$ApiDest = Join-Path -Path $BuildDir -ChildPath "api"
New-Item -ItemType Directory -Path $ApiDest | Out-Null

$ExcludeList = @("node_modules", ".env", "error_log.txt", "error_output.txt", "debug_log.txt", "backup_source.sql", "restore_final.sql", "business_data.sql", "business_data_v2.sql", "business_data_v3.sql", "public")
Get-ChildItem -Path $ApiSrc | Where-Object { $_.Name -notin $ExcludeList } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $ApiDest -Recurse -Force
}

# Criar pasta public e copiar o build do frontend para dentro da API
$PublicDest = Join-Path -Path $ApiDest -ChildPath "public"
New-Item -ItemType Directory -Path $PublicDest | Out-Null
Copy-Item -Path (Join-Path -Path $MobilePath -ChildPath "dist\*") -Destination $PublicDest -Recurse -Force

# Criar arquivo .env de producao com a senha de root configurada
$EnvContent = @"
PORT=4000
# Variavel principal usada pelo Prisma schema
DATABASE_URL_LOCAL="mysql://root:root@127.0.0.1:3306/appbarcash"
# DATABASE_URL="mysql://root:root@127.0.0.1:3306/appbarcash"
JWT_SECRET="thunder"
NODE_ENV="production"
"@
$EnvContent | Out-File -FilePath (Join-Path -Path $ApiDest -ChildPath ".env") -Encoding utf8

# 8. Instalar dependencias da API no build de producao
Write-Host "Instalando dependencias de producao na API..." -ForegroundColor Green
Push-Location $ApiDest
try {
    npm install --omit=dev
    # Usar npx para executar o prisma generate de forma portátil
    npx prisma generate
} finally {
    Pop-Location
}

# Criar pasta de logs para o WinSW
New-Item -ItemType Directory -Path (Join-Path -Path $BuildDir -ChildPath "logs") | Out-Null

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "     ARQUIVOS DE BUILD PREPARADOS COM SUCESSO!" -ForegroundColor Green
Write-Host "     Pasta: $BuildDir" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
