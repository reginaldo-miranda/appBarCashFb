@echo off
echo Iniciando MariaDB na porta 3307...
cd /d "D:\regi\mariadb\bin"
start "MariaDB 3307" mysqld.exe --defaults-file="D:\regi\mariadb\data\my.ini" --console
echo MariaDB iniciado. Pode fechar esta janela, mas nao a janela do MariaDB.
pause
