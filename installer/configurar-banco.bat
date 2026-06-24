@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

:: Redirecionar todas as saídas (stdout e stderr) para o arquivo registro_banco.log para diagnóstico
call :main > registro_banco.log 2>&1
exit /b %errorlevel%

:main
echo ======================================================
echo    appBarCash - Configuração do Banco de Dados
echo    Data/Hora: %DATE% %TIME%
echo ======================================================
echo.

:: Caminho padrão para o mysql.exe
set "MYSQL_BIN=mysql.exe"

:: Verificar se mysql está no PATH
where mysql >nul 2>&1
if %errorlevel% neq 0 (
    echo mysql.exe não está no PATH do sistema. Procurando em diretórios padrão do MariaDB...
    if exist "C:\Program Files\MariaDB 10.11\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MariaDB 10.11\bin\mysql.exe"
    ) else if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
    ) else if exist "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"
    ) else if exist "C:\Program Files\MySQL\MySQL Server 8.1\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.1\bin\mysql.exe"
    ) else if exist "C:\Program Files\MySQL\MySQL Server 8.2\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.2\bin\mysql.exe"
    ) else if exist "C:\Program Files\MySQL\MySQL Server 8.3\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.3\bin\mysql.exe"
    ) else if exist "C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe"
    ) else if exist "C:\Program Files\MariaDB 10.5\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MariaDB 10.5\bin\mysql.exe"
    ) else if exist "C:\Program Files\MariaDB 11.0\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MariaDB 11.0\bin\mysql.exe"
    ) else if exist "C:\Program Files\MariaDB 11.1\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MariaDB 11.1\bin\mysql.exe"
    ) else if exist "C:\Program Files\MariaDB 11.2\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MariaDB 11.2\bin\mysql.exe"
    ) else if exist "C:\Program Files\MariaDB 11.3\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MariaDB 11.3\bin\mysql.exe"
    ) else if exist "C:\Program Files\MariaDB 11.4\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MariaDB 11.4\bin\mysql.exe"
    ) else (
        echo [ERRO] mysql.exe não foi encontrado no PATH e nem nos caminhos padrões do MariaDB/MySQL!
        echo Configuração cancelada.
        exit /b 1
    )
)

echo Usando binário do banco: "%MYSQL_BIN%"
echo.

:: Loop de teste de conexão com o banco de dados (máximo 30 segundos)
echo Aguardando inicialização do banco de dados MariaDB na porta 3306...
set "CONNECTED=0"
for /L %%i in (1,1,30) do (
    "%MYSQL_BIN%" -u root -proot -e "SELECT 1;" >nul 2>&1
    if errorlevel 0 (
        :: Se o comando SELECT 1 der sucesso (errorlevel 0), define como conectado
        set "CONNECTED=1"
        goto :connected
    )
    echo Tentativa %%i/30: banco de dados ainda não respondeu. Aguardando 1 segundo...
    timeout /t 1 /nobreak >nul
)

:connected
if "%CONNECTED%"=="0" (
    echo [ERRO] O banco de dados MariaDB não respondeu após 30 segundos.
    echo Verifique se o serviço 'MariaDB' está em execução no Windows.
    exit /b 1
)
echo Banco de dados conectado com sucesso!
echo.

:: Criar banco de dados se não existir
echo Criando o banco de dados 'appbarcash' (caso não exista)...
"%MYSQL_BIN%" -u root -proot -e "CREATE DATABASE IF NOT EXISTS appbarcash;"
if %errorlevel% neq 0 (
    echo [ERRO] Não foi possível criar o banco de dados 'appbarcash'.
    echo Verifique se a senha do usuário 'root' é realmente 'root'.
    exit /b %errorlevel%
)
echo Banco de dados verificado/criado com sucesso!
echo.

:: Contar o número de tabelas existentes no banco appbarcash
set "TABLE_COUNT=0"
for /F "tokens=1" %%A in ('"%MYSQL_BIN%" -u root -proot -s -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'appbarcash';" 2^>nul') do (
    set "TABLE_COUNT=%%A"
)
echo Número de tabelas encontradas no banco 'appbarcash': %TABLE_COUNT%
echo.

:: Carregar estrutura se o banco estiver vazio ou incompleto (menos de 5 tabelas)
if %TABLE_COUNT% lss 5 (
    echo O banco de dados está vazio ou incompleto (menos de 5 tabelas). Iniciando importação das tabelas...
    if exist "database_setup.sql" (
        "%MYSQL_BIN%" -u root -proot appbarcash < database_setup.sql
        if %errorlevel% neq 0 (
            echo [ERRO] Falha ao importar o arquivo database_setup.sql.
            exit /b %errorlevel%
        )
        echo [SUCESSO] Tabelas importadas com sucesso!
    ) else (
        echo [AVISO] O arquivo database_setup.sql não foi encontrado! A importação foi pulada.
    )
) else (
    echo [INFO] O banco de dados já possui %TABLE_COUNT% tabelas. A importação foi ignorada para preservar seus dados existentes.
)

echo.
echo ======================================================
echo    Configuração finalizada com sucesso!
echo ======================================================
exit /b 0
