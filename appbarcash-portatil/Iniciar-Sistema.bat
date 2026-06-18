@echo off
chcp 65001 >nul 2>&1
TITLE appBarCash - Servidor Local
color 0A

cd /d "%~dp0"
echo.
echo  ======================================================
echo     appBarCash - Iniciando Servidor e Banco Port«≠til
echo  ======================================================
echo.

:: 1. Inicializar Banco de dados port«≠til se for a primeira vez
if not exist "mysql\data" (
    echo  [1/4] Inicializando diret«¸rio de dados do banco...
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

:: 3. Criar Banco de dados e tabelas se for a primeira execu«ı«úo
echo  [3/4] Verificando tabelas do sistema...
mysql\bin\mysql.exe -u root -h 127.0.0.1 -e "CREATE DATABASE IF NOT EXISTS appbarcash;" >nul 2>&1
mysql\bin\mysql.exe -u root -h 127.0.0.1 -e "USE appbarcash; SELECT 1 FROM user LIMIT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo        Carregando estrutura e perfis padr«Êes no banco...
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
echo     Endere«ıo: http://localhost:4000
echo     Pressione qualquer tecla nesta janela para fechar
echo  ======================================================
echo.

start http://localhost:4000
pause >nul

:: Chamar desligamento ao fechar a janela
call Desligar-Sistema.bat
