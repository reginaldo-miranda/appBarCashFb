@echo off
echo ==========================================================
echo INICIANDO MARIADB PORTABLE (MODO SIMPLES)
echo ==========================================================
echo.
echo Navegando para D:\regi\mariadb\bin...
cd /d "D:\regi\mariadb\bin"
if errorlevel 1 (
    echo [ERRO] A pasta D:\regi\mariadb\bin nao existe.
    echo Verifique se o caminho esta correto.
    pause
    exit /b
)
echo.
echo Iniciando mysqld.exe na porta 3307...
echo Se der erro de "bind-address", significa que ja tem algo rodando.
echo.
mysqld.exe --port=3307 --datadir="D:\regi\mariadb\data_portable" --console
echo.
echo [AVISO] O servidor parou.
pause
