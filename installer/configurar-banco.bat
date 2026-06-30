@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

:: ============================================================
:: configurar-banco.bat (v2)
:: Cria o banco de dados 'appbarcash' vazio.
:: As tabelas são criadas automaticamente pela API (dbBootstrap.js).
::
:: Lê a porta e senha detectadas pelo detectar-porta.bat
:: ============================================================

call :main > registro_banco.log 2>&1
exit /b %errorlevel%

:main
echo ======================================================
echo    appBarCash - Configuração Inicial do Banco
echo    Data/Hora: %DATE% %TIME%
echo ======================================================
echo.

:: ─────────────────────────────────────────────────────────
:: PASSO 1: Ler porta e senha detectadas
:: ─────────────────────────────────────────────────────────
set "DB_PORT=3306"
set "DB_PASS=root"

if exist "%~dp0porta_detectada.txt" (
    set /p DB_PORT=<"%~dp0porta_detectada.txt"
    echo [INFO] Porta lida do detectar-porta: %DB_PORT%
) else (
    echo [INFO] Usando porta padrao: %DB_PORT%
)

if exist "%~dp0senha_detectada.txt" (
    set /p DB_PASS=<"%~dp0senha_detectada.txt"
    echo [INFO] Senha lida do detectar-porta.
) else (
    echo [INFO] Usando senha padrao: root
)

:: ─────────────────────────────────────────────────────────
:: PASSO 2: Localizar binário mysql.exe
:: ─────────────────────────────────────────────────────────
set "MYSQL_BIN=mysql.exe"

where mysql >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] mysql.exe nao esta no PATH. Procurando em diretorios padrao...

    :: MariaDB
    for %%V in (11.4 11.3 11.2 11.1 11.0 10.11 10.5) do (
        if exist "C:\Program Files\MariaDB %%V\bin\mysql.exe" (
            set "MYSQL_BIN=C:\Program Files\MariaDB %%V\bin\mysql.exe"
            goto :achou_mysql
        )
    )

    :: MySQL
    for %%V in (9.0 8.4 8.3 8.2 8.1 8.0 5.7) do (
        if exist "C:\Program Files\MySQL\MySQL Server %%V\bin\mysql.exe" (
            set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server %%V\bin\mysql.exe"
            goto :achou_mysql
        )
    )

    echo [ERRO] mysql.exe nao foi encontrado no PATH nem nos caminhos padrao!
    echo Verifique se o MariaDB ou MySQL foi instalado corretamente.
    exit /b 1
)

:achou_mysql
echo [OK] Usando binario do banco: "%MYSQL_BIN%"
echo [OK] Porta do banco: %DB_PORT%
echo.

:: ─────────────────────────────────────────────────────────
:: PASSO 3: Aguardar banco ficar disponível (até 30 tentativas)
:: ─────────────────────────────────────────────────────────
echo Aguardando inicializacao do banco na porta %DB_PORT%...
set "CONNECTED=0"

for /L %%i in (1,1,30) do (
    if "%DB_PASS%"=="" (
        "%MYSQL_BIN%" -u root -P %DB_PORT% -h 127.0.0.1 -e "SELECT 1;" >nul 2>&1
    ) else (
        "%MYSQL_BIN%" -u root -p%DB_PASS% -P %DB_PORT% -h 127.0.0.1 -e "SELECT 1;" >nul 2>&1
    )
    if not errorlevel 1 (
        set "CONNECTED=1"
        goto :connected
    )
    echo Tentativa %%i/30: banco ainda nao respondeu na porta %DB_PORT%. Aguardando 2 segundos...
    timeout /t 2 /nobreak >nul
)

:connected
if "%CONNECTED%"=="0" (
    echo [ERRO] O banco de dados nao respondeu apos 60 segundos na porta %DB_PORT%.
    echo.
    echo Possíveis causas:
    echo   - O servico MariaDB/MySQL nao esta em execucao
    echo   - A senha de root nao e '%DB_PASS%'
    echo   - A porta %DB_PORT% esta bloqueada pelo firewall
    echo.
    echo Verifique o Gerenciador de Servicos do Windows.
    exit /b 1
)
echo [OK] Banco de dados conectado com sucesso na porta %DB_PORT%!
echo.

:: ─────────────────────────────────────────────────────────
:: PASSO 4: Criar banco de dados 'appbarcash' (se não existir)
:: ─────────────────────────────────────────────────────────
echo Criando banco de dados 'appbarcash' (caso nao exista)...
if "%DB_PASS%"=="" (
    "%MYSQL_BIN%" -u root -P %DB_PORT% -h 127.0.0.1 -e "CREATE DATABASE IF NOT EXISTS appbarcash CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
) else (
    "%MYSQL_BIN%" -u root -p%DB_PASS% -P %DB_PORT% -h 127.0.0.1 -e "CREATE DATABASE IF NOT EXISTS appbarcash CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
)
if %errorlevel% neq 0 (
    echo [ERRO] Nao foi possivel criar o banco de dados 'appbarcash'.
    echo Verifique se a senha do usuario 'root' e '%DB_PASS%'.
    exit /b %errorlevel%
)
echo [SUCESSO] Banco de dados 'appbarcash' verificado/criado!
echo.
echo [INFO] As tabelas serao criadas automaticamente pelo sistema
echo [INFO] na primeira vez que o appBarCash for iniciado (dbBootstrap.js).
echo.

:: ─────────────────────────────────────────────────────────
:: PASSO 5: Limpar arquivos temporários
:: ─────────────────────────────────────────────────────────
if exist "%~dp0porta_detectada.txt" del "%~dp0porta_detectada.txt"
if exist "%~dp0senha_detectada.txt" del "%~dp0senha_detectada.txt"

echo ======================================================
echo    Configuracao inicial do banco concluida!
echo    Porta: %DB_PORT% | Banco: appbarcash
echo ======================================================
exit /b 0
