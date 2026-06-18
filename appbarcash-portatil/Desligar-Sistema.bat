@echo off
chcp 65001 >nul 2>&1
TITLE appBarCash - Finalizando Servidor
color 0C

cd /d "%~dp0"
echo.
echo  ======================================================
echo     appBarCash - Finalizando Servidor e Banco PortÇ­til
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
echo     ServiÇõos desligados com sucesso!
echo  ======================================================
timeout /t 2 /nobreak >nul
