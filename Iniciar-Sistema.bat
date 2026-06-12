@echo off
chcp 65001 >nul 2>&1
TITLE appBarCash - Sistema Completo
color 0A

echo.
echo  ============================================
echo     appBarCash - Iniciando Sistema Completo
echo  ============================================
echo.

:: Forcar diretorio do script
cd /d "%~dp0"
echo  Diretorio: "%CD%"
echo.

:: -----------------------------------------------
:: 1. Detectar IP da LAN
:: -----------------------------------------------
set "LAN_IP="
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1" ^| findstr /v "169.254"') do (
    if not defined LAN_IP (
        for /f "tokens=* delims= " %%B in ("%%A") do set "LAN_IP=%%B"
    )
)
if not defined LAN_IP set "LAN_IP=localhost"

echo  IP da Rede Local: %LAN_IP%
echo.

:: -----------------------------------------------
:: 2. Matar processos antigos na porta 4000
:: -----------------------------------------------
echo  [1/5] Limpando processos antigos na porta 4000...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%P /F >nul 2>&1
)
echo         OK
echo.

:: -----------------------------------------------
:: 3. Verificar se Node.js esta instalado
:: -----------------------------------------------
echo  [2/5] Verificando Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERRO] Node.js nao encontrado!
    echo  Instale em: https://nodejs.org
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%V in ('node -v') do echo         Node.js %%V encontrado
echo.

:: -----------------------------------------------
:: 4. Verificar e instalar dependencias da API
:: -----------------------------------------------
echo  [3/5] Verificando dependencias da API...
if not exist "api\node_modules" (
    echo         Instalando dependencias da API...
    cd api
    call npm install --omit=dev
    cd ..
    echo         Dependencias da API instaladas!
) else (
    echo         OK - node_modules encontrado
)
echo.

:: -----------------------------------------------
:: 5. Verificar e instalar dependencias do Mobile
:: -----------------------------------------------
echo  [4/5] Verificando dependencias do Mobile...
if not exist "mobile\node_modules" (
    echo         Instalando dependencias do Mobile...
    cd mobile
    call npm install
    cd ..
    echo         Dependencias do Mobile instaladas!
) else (
    echo         OK - node_modules encontrado
)
echo.

:: -----------------------------------------------
:: 6. Iniciar API em nova janela
:: -----------------------------------------------
echo  [5/5] Iniciando servicos...
echo.
echo         Iniciando API na porta 4000...

:: Configurar variaveis de ambiente para a API
set "API_CMD=cd /d \"%~dp0api\" && set HOST=0.0.0.0 && set PORT=4000 && node server.js"
start "appBarCash - API (porta 4000)" cmd /k "%API_CMD%"

:: Aguardar a API iniciar
echo         Aguardando API conectar ao banco (8 segundos)...
timeout /t 8 /nobreak >nul

:: -----------------------------------------------
:: 7. Iniciar Expo Web em nova janela
:: -----------------------------------------------
echo         Iniciando Expo Web...

set "EXPO_CMD=cd /d \"%~dp0mobile\" && set REACT_NATIVE_PACKAGER_HOSTNAME=%LAN_IP% && set EXPO_PUBLIC_API_URL=http://%LAN_IP%:4000/api && npx expo start --host lan --port 8082 -c"
start "appBarCash - Expo Web (porta 8082)" cmd /k "%EXPO_CMD%"

:: -----------------------------------------------
:: 8. Exibir resumo
:: -----------------------------------------------
echo.
echo  ============================================
echo     SISTEMA INICIADO COM SUCESSO!
echo  ============================================
echo.
echo   API:       http://%LAN_IP%:4000/api
echo   Expo Web:  http://%LAN_IP%:8082
echo   Local:     http://localhost:4000/api
echo.
echo   Duas janelas foram abertas:
echo     - appBarCash - API (porta 4000)
echo     - appBarCash - Expo Web (porta 8082)
echo.
echo   Para parar: feche as duas janelas do CMD
echo   ou pressione Ctrl+C em cada uma delas.
echo.
echo  ============================================
echo.
pause
