@echo off
echo Iniciando o servidor (API)...
start /B "API Server" cmd /c "cd api && npm start"

timeout /t 5

echo Iniciando o sistema no navegador...
cd mobile
npx expo start --web
pause


