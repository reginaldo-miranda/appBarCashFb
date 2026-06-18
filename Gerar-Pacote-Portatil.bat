@echo off
TITLE appBarCash - Gerador de Pacote Portatil
color 0B
echo.
echo  ======================================================
echo     appBarCash - Iniciando Gerador de Pacote Portatil
echo  ======================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\gerar-pacote.ps1"
echo.
pause
