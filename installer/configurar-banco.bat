@echo off
chcp 65001 >nul 2>&1
echo Configurando Banco de Dados appBarCash...

:: Diretorio de instalacao (onde esta o database_setup.sql)
cd /d "%~dp0"

:: Caminho para o mysql.exe
set "MYSQL_BIN=mysql.exe"

:: Verificar se mysql ja esta no PATH
where mysql >nul 2>&1
if %errorlevel% neq 0 (
    :: Nao esta no PATH, tentar achar nas pastas padrao do MariaDB
    if exist "C:\Program Files\MariaDB 10.11\bin\mysql.exe" (
        set "MYSQL_BIN=C:\Program Files\MariaDB 10.11\bin\mysql.exe"
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
        echo Erro: mysql.exe nao encontrado no PATH ou em caminhos padroes!
        exit /b 1
    )
)

echo Executando comandos no banco de dados usando: "%MYSQL_BIN%"

:: Aguardar um momento para garantir que o servico MariaDB iniciou
timeout /t 5 /nobreak >nul

:: Criar banco de dados se nao existir
"%MYSQL_BIN%" -u root -proot -e "CREATE DATABASE IF NOT EXISTS appbarcash;"
if %errorlevel% neq 0 (
    echo Erro ao criar o banco de dados 'appbarcash'.
    exit /b %errorlevel%
)

:: Carregar estrutura se o banco estiver vazio
echo Verificando se o banco ja possui dados...
"%MYSQL_BIN%" -u root -proot -e "USE appbarcash; SELECT 1 FROM user LIMIT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo Banco vazio. Carregando dump de instalacao database_setup.sql...
    if exist "database_setup.sql" (
        "%MYSQL_BIN%" -u root -proot appbarcash < database_setup.sql
        if %errorlevel% neq 0 (
            echo Erro ao restaurar database_setup.sql.
            exit /b %errorlevel%
        )
        echo Banco de dados restaurado com sucesso!
    ) else (
        echo Alerta: database_setup.sql nao foi encontrado.
    )
) else (
    echo Banco de dados ja contem tabelas. Pulando restauracao para nao sobrescrever dados do cliente.
)

exit /b 0
