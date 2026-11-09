@echo off
chcp 65001 >nul 2>&1
TITLE appBarCash - Encerrando Sistema
color 0C

cd /d "%~dp0"
echo.
echo  ============================================
echo     appBarCash - Encerrando o Sistema
echo  ============================================
echo.

echo  [1/2] Parando servicos na porta 4000 (API)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%P /F >nul 2>&1
)
echo         OK.

echo  [2/2] Parando servicos na porta 8082 (Web/Mobile)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8082" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%P /F >nul 2>&1
)
echo         OK.

echo.
echo  ============================================
echo     Sistema desligado com sucesso!
echo  ============================================
ping 127.0.0.1 -n 3 >nul
