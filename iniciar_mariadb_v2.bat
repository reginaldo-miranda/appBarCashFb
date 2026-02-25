@echo off
echo ==========================================================
echo INICIANDO MARIADB PORTABLE NA PORTA 3307
echo ==========================================================
echo.
echo 1. Copiando my.ini novo para D:\regi\mariadb\data...
copy /Y "D:\regi\appBarCashFb\my_novo.ini" "D:\regi\mariadb\data\my.ini"
if errorlevel 1 (
    echo [ERRO] Falha ao copiar my.ini. Verifique permissoes.
    pause
    exit /b
)
echo [OK] Arquivo my.ini atualizado.
echo.
echo 2. Iniciando servidor...
echo OBS: Se esta janela fechar sozinha, houve um erro.
echo Verifique o arquivo D:\regi\mariadb\data\mariadb.err
echo.
cd /d "D:\regi\mariadb\bin"
mysqld.exe --defaults-file="D:\regi\mariadb\data\my.ini" --console
echo.
echo [AVISO] O servidor parou ou nao iniciou.
pause
