Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' 1. Limpar processos antigos nas portas 4000 e 8082
WshShell.Run "cmd /c for /f ""tokens=5"" %P in ('netstat -ano ^| findstr "":4000"" ^| findstr ""LISTENING""') do taskkill /PID %P /F", 0, True
WshShell.Run "cmd /c for /f ""tokens=5"" %P in ('netstat -ano ^| findstr "":8082"" ^| findstr ""LISTENING""') do taskkill /PID %P /F", 0, True

' 2. Detectar IP da LAN (192.168.x.x) para que dispositivos na rede Wi-Fi funcionem perfeitamente
Set execIp = WshShell.Exec("cmd /c node -e ""const os=require('os');const ifaces=os.networkInterfaces();let ip='';for(const k in ifaces){if(/vmware|virtualbox|vbox|wsl|docker|vethernet/i.test(k))continue;for(const i of ifaces[k]){if(i.family==='IPv4'&&!i.internal){if(i.address.startsWith('192.168.')){ip=i.address;break;}if(!ip&&!i.address.startsWith('172.')&&!i.address.startsWith('169.254.')){ip=i.address;}}}}console.log(ip||'localhost');""")
lanIp = Trim(execIp.StdOut.ReadAll())
If lanIp = "" Then lanIp = "localhost"

' 3. Iniciar a API na porta 4000 (em segundo plano, totalmente invisivel)
WshShell.CurrentDirectory = currentDir & "\api"
WshShell.Run "cmd /c set HOST=0.0.0.0&& set PORT=4000&& node server.js", 0, False

' 4. Iniciar o Expo Web na porta 8082 (em segundo plano, totalmente invisivel)
WshShell.CurrentDirectory = currentDir & "\mobile"
WshShell.Run "cmd /c set REACT_NATIVE_PACKAGER_HOSTNAME=" & lanIp & "&& set EXPO_PUBLIC_API_URL=http://" & lanIp & ":4000/api&& npx expo start --web --port 8082 -c", 0, False

' 5. Aguardar 4 segundos para a API e o banco de dados inicializarem
WScript.Sleep 4000

' 6. Abrir o navegador no sistema (porta 4000)
WshShell.Run "http://localhost:4000", 1, False
