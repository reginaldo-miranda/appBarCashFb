# Script de geração do pacote portátil do AppBarCash para Windows
# Este script automatiza o download do Node.js e MariaDB portáteis, faz o build do front-end e monta a pasta distribuível.

$ErrorActionPreference = "Stop"

# 1. Configurar diretórios
$ProjectRoot = (Get-Item -Path $PSScriptRoot).Parent.FullName
$DestFolder = Join-Path -Path $ProjectRoot -ChildPath "appbarcash-portatil"
$TempFolder = Join-Path -Path $ProjectRoot -ChildPath ".temp_downloads"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "     Gerador de Pacote Portátil - AppBarCash" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Raiz do projeto: $ProjectRoot"
Write-Host "Pasta de destino: $DestFolder"
Write-Host "------------------------------------------------------"

# 2. Criar pastas de trabalho
if (!(Test-Path -Path $TempFolder)) {
    New-Item -ItemType Directory -Path $TempFolder | Out-Null
}
if (Test-Path -Path $DestFolder) {
    Write-Host "Limpando pasta de destino anterior..." -ForegroundColor Yellow
    Remove-Item -Path $DestFolder -Recurse -Force
}
New-Item -ItemType Directory -Path $DestFolder | Out-Null
New-Item -ItemType Directory -Path (Join-Path -Path $DestFolder -ChildPath "node") | Out-Null
New-Item -ItemType Directory -Path (Join-Path -Path $DestFolder -ChildPath "mysql") | Out-Null

# 3. Baixar binários portáteis
$NodeUrl = "https://nodejs.org/dist/v18.18.2/node-v18.18.2-win-x64.zip"
$MariaDbUrl = "https://archive.mariadb.org/mariadb-10.11.5/winx64-packages/mariadb-10.11.5-winx64.zip"

$NodeZip = Join-Path -Path $TempFolder -ChildPath "node.zip"
$MariaDbZip = Join-Path -Path $TempFolder -ChildPath "mariadb.zip"

# Download Node.js
if (!(Test-Path -Path $NodeZip)) {
    Write-Host "Baixando Node.js Portátil..." -ForegroundColor Green
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip -UseBasicParsing
} else {
    Write-Host "Node.js portátil já baixado." -ForegroundColor Gray
}

# Download MariaDB
if (!(Test-Path -Path $MariaDbZip)) {
    Write-Host "Baixando MariaDB Portátil..." -ForegroundColor Green
    Invoke-WebRequest -Uri $MariaDbUrl -OutFile $MariaDbZip -UseBasicParsing
} else {
    Write-Host "MariaDB portátil já baixado." -ForegroundColor Gray
}

# 4. Extrair binários
Write-Host "Extraindo Node.js..." -ForegroundColor Green
$NodeExtractPath = Join-Path -Path $TempFolder -ChildPath "node_extracted"
if (Test-Path -Path $NodeExtractPath) { Remove-Item -Path $NodeExtractPath -Recurse -Force }
Expand-Archive -Path $NodeZip -DestinationPath $NodeExtractPath

Write-Host "Extraindo MariaDB..." -ForegroundColor Green
$MariaDbExtractPath = Join-Path -Path $TempFolder -ChildPath "mariadb_extracted"
if (Test-Path -Path $MariaDbExtractPath) { Remove-Item -Path $MariaDbExtractPath -Recurse -Force }
Expand-Archive -Path $MariaDbZip -DestinationPath $MariaDbExtractPath

# 5. Organizar arquivos do Node
Write-Host "Organizando arquivos do Node..." -ForegroundColor Green
$NodeFolder = Get-ChildItem -Path $NodeExtractPath | Select-Object -First 1
Copy-Item -Path (Join-Path -Path $NodeFolder.FullName -ChildPath "node.exe") -Destination (Join-Path -Path $DestFolder -ChildPath "node\node.exe")

# 6. Organizar arquivos do MariaDB
Write-Host "Organizando arquivos do MariaDB..." -ForegroundColor Green
$MariaDbFolder = Get-ChildItem -Path $MariaDbExtractPath | Select-Object -First 1
# Copiar apenas binários e arquivos necessários para economizar espaço
$RequiredDirs = @("bin", "share")
foreach ($dir in $RequiredDirs) {
    Copy-Item -Path (Join-Path -Path $MariaDbFolder.FullName -ChildPath $dir) -Destination (Join-Path -Path $DestFolder -ChildPath "mysql\$dir") -Recurse
}
# Criar diretório my.ini básico
$MyIniContent = @"
[mysqld]
basedir=./mysql
datadir=./mysql/data
port=3306
bind-address=127.0.0.1
sql_mode=NO_ENGINE_SUBSTITUTION
default-storage-engine=INNODB
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
max_allowed_packet=64M
"@
$MyIniContent | Out-File -FilePath (Join-Path -Path $DestFolder -ChildPath "mysql\my.ini") -Encoding utf8

# 7. Gerar Build Web do Frontend Mobile
Write-Host "Gerando Build de Produção Web do Frontend..." -ForegroundColor Green
$MobilePath = Join-Path -Path $ProjectRoot -ChildPath "mobile"
Push-Location $MobilePath
try {
    # Executa build estático do Expo
    npx expo export -p web
} finally {
    Pop-Location
}

# 8. Copiar Backend da API e dependências
Write-Host "Copiando arquivos da API..." -ForegroundColor Green
$ApiSrc = Join-Path -Path $ProjectRoot -ChildPath "api"
$ApiDest = Join-Path -Path $DestFolder -ChildPath "api"
New-Item -ItemType Directory -Path $ApiDest | Out-Null

# Copiar arquivos selecionados (ignorando node_modules, backups e temporários)
$ExcludeList = @("node_modules", ".env", "error_log.txt", "error_output.txt", "debug_log.txt", "backup_source.sql", "restore_final.sql", "business_data.sql", "business_data_v2.sql", "business_data_v3.sql", "public")
Get-ChildItem -Path $ApiSrc | Where-Object { $_.Name -notin $ExcludeList } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $ApiDest -Recurse -Force
}

# Criar pasta public limpa e mover o build do frontend para lá
$PublicDest = Join-Path -Path $ApiDest -ChildPath "public"
New-Item -ItemType Directory -Path $PublicDest | Out-Null
Copy-Item -Path (Join-Path -Path $MobilePath -ChildPath "dist\*") -Destination $PublicDest -Recurse -Force

# Criar arquivo .env limpo para produção
$EnvContent = @"
PORT=4000
DATABASE_URL_LOCAL="mysql://root@127.0.0.1:3306/appbarcash"
DATABASE_URL="mysql://root@127.0.0.1:3306/appbarcash"
JWT_SECRET="thunder"
"@
$EnvContent | Out-File -FilePath (Join-Path -Path $ApiDest -ChildPath ".env") -Encoding utf8

# 9. Copiar o script SQL de banco limpo do repositório para o pacote
$SqlDumpSrc = Join-Path -Path $ProjectRoot -ChildPath "dump_mysql.sql"
if (Test-Path -Path $SqlDumpSrc) {
    Copy-Item -Path $SqlDumpSrc -Destination (Join-Path -Path $DestFolder -ChildPath "database_setup.sql")
}

# 10. Instalar dependências da API de produção no pacote portátil
Write-Host "Instalando dependências de produção na API portátil..." -ForegroundColor Green
Push-Location $ApiDest
try {
    npm install --omit=dev
    npx prisma generate
} finally {
    Pop-Location
}

# 11. Criar os arquivos de lote .bat
Write-Host "Criando atalhos Iniciar e Desligar..." -ForegroundColor Green

$IniciarBat = @"
@echo off
chcp 65001 >nul 2>&1
TITLE appBarCash - Servidor Local
color 0A

cd /d "%~dp0"
echo.
echo  ======================================================
echo     appBarCash - Iniciando Servidor e Banco Portátil
echo  ======================================================
echo.

:: 1. Inicializar Banco de dados portátil se for a primeira vez
if not exist "mysql\data" (
    echo  [1/4] Inicializando diretório de dados do banco...
    mysql\bin\mysql_install_db.exe --datadir="%CD%\mysql\data" --default-character-set=utf8mb4 >nul 2>&1
    echo        OK
    echo.
)

:: 2. Iniciar o Banco de dados
echo  [2/4] Iniciando Banco de Dados MariaDB...
start "appBarCash - Banco de Dados" /min "%CD%\mysql\bin\mysqld.exe" --defaults-file="%CD%\mysql\my.ini" --standalone
timeout /t 3 /nobreak >nul
echo        OK
echo.

:: 3. Criar Banco de dados e tabelas se for a primeira execução
echo  [3/4] Verificando tabelas do sistema...
mysql\bin\mysql.exe -u root -h 127.0.0.1 -e "CREATE DATABASE IF NOT EXISTS appbarcash;" >nul 2>&1
mysql\bin\mysql.exe -u root -h 127.0.0.1 -e "USE appbarcash; SELECT 1 FROM user LIMIT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo        Carregando estrutura e perfis padrões no banco...
    if exist "database_setup.sql" (
        mysql\bin\mysql.exe -u root -h 127.0.0.1 appbarcash < database_setup.sql
    )
)
echo        OK
echo.

:: 4. Iniciar Servidor API
echo  [4/4] Iniciando Servidor do Sistema...
start "appBarCash - Servidor API" /min "%CD%\node\node.exe" "%CD%\api\server.js"
timeout /t 3 /nobreak >nul
echo        OK
echo.

echo  ======================================================
echo     Sistema rodando localmente!
echo     Endereço: http://localhost:4000
echo     Pressione qualquer tecla nesta janela para fechar
echo  ======================================================
echo.

start http://localhost:4000
pause >nul

:: Chamar desligamento ao fechar a janela
call Desligar-Sistema.bat
"@

$DesligarBat = @"
@echo off
chcp 65001 >nul 2>&1
TITLE appBarCash - Finalizando Servidor
color 0C

cd /d "%~dp0"
echo.
echo  ======================================================
echo     appBarCash - Finalizando Servidor e Banco Portátil
echo  ======================================================
echo.

echo  Parando servidor do sistema...
taskkill /F /IM node.exe >nul 2>&1
echo  OK.
echo.

echo  Parando banco de dados de forma segura...
mysql\bin\mysqladmin.exe -u root -h 127.0.0.1 shutdown >nul 2>&1
echo  OK.
echo.

echo  ======================================================
echo     Serviços desligados com sucesso!
echo  ======================================================
timeout /t 2 /nobreak >nul
"@

$IniciarBat | Out-File -FilePath (Join-Path -Path $DestFolder -ChildPath "Iniciar-Sistema.bat") -Encoding oem
$DesligarBat | Out-File -FilePath (Join-Path -Path $DestFolder -ChildPath "Desligar-Sistema.bat") -Encoding oem

# 12. Limpeza
Write-Host "Limpando arquivos temporários..." -ForegroundColor Green
if (Test-Path -Path $TempFolder) {
    Remove-Item -Path $TempFolder -Recurse -Force
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "     PACOTE PORTÁTIL GERADO COM SUCESSO!" -ForegroundColor Green
Write-Host "     Pasta: $DestFolder" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
