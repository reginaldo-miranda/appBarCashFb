; Script do Inno Setup para o appBarCash
; Gera o instalador executável final (.exe) do sistema para Windows.
;
; CORREÇÕES v2:
;   - Detecção expandida: verifica MySQL E MariaDB antes de instalar
;   - Porta dinâmica: se 3306 está ocupada, usa 3307
;   - Nome do banco padronizado: sempre 'appbarcash' (minúsculo)
;   - Novo passo: detectar-porta.bat roda ANTES do configurar-banco.bat

[Setup]
AppId={{D1F4F9B3-75B0-4A3C-9C5A-2ED9EF74DCF5}
AppName=appBarCash
AppVersion=1.0.0
AppPublisher=appBarCash
DefaultDirName=C:\appBarCash
DefaultGroupName=appBarCash
DisableProgramGroupPage=yes
OutputBaseFilename=appBarCash_Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
; Privilegios administrativos sao necessarios para instalar servicos de Windows e bancos de dados
PrivilegesRequired=admin
UninstallDisplayIcon={app}\api\public\favicon.ico

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
; Copiar arquivos da API e do sistema (excluindo os instaladores MSI pesados)
Source: "build\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs; Excludes: "prerequisites\*"

; Copiar instaladores MSI apenas para a pasta temporária de instalação (serão excluídos após a instalação)
Source: "build\prerequisites\node.msi"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "build\prerequisites\mariadb.msi"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
; Atalho na Area de Trabalho que abre a aplicacao no navegador padrao
Name: "{commondesktop}\appBarCash"; Filename: "http://localhost:4000"; IconFilename: "{app}\api\public\favicon.ico"; Comment: "Iniciar appBarCash"
Name: "{group}\appBarCash"; Filename: "http://localhost:4000"; IconFilename: "{app}\api\public\favicon.ico"
Name: "{group}\Desinstalar appBarCash"; Filename: "{uninstallexe}"

[Run]
; 1. Instalar Node.js silenciosamente se necessário
Filename: "msiexec.exe"; Parameters: "/i ""{tmp}\node.msi"" /qn /norestart"; StatusMsg: "Verificando e instalando Node.js (Ambiente de Execução)..."; Flags: runhidden; Check: NodeNecessario

; 2. Instalar MariaDB silenciosamente se necessário
;    A porta é determinada pela função GetMariaDbPortParam() que verifica se 3306 está em uso
Filename: "msiexec.exe"; Parameters: "/i ""{tmp}\mariadb.msi"" /qn /norestart PASSWORD=root PORT={code:GetMariaDbPortParam} SERVICENAME=MariaDB ADD_TO_PATH=1"; StatusMsg: "Verificando e instalando Banco de Dados MariaDB..."; Flags: runhidden; Check: MariaDbNecessario

; 3. Detectar porta do banco e atualizar configurações (.env, service.xml)
;    DEVE rodar ANTES do configurar-banco.bat
Filename: "{cmd}"; Parameters: "/c ""{app}\detectar-porta.bat"""; StatusMsg: "Detectando configuração do banco de dados..."; Flags: runhidden waituntilterminated

; 4. Configurar banco de dados (criar banco vazio 'appbarcash')
;    As tabelas são criadas automaticamente pela API no primeiro startup (dbBootstrap.js)
Filename: "{cmd}"; Parameters: "/c ""{app}\configurar-banco.bat"""; StatusMsg: "Configurando banco de dados..."; Flags: runhidden waituntilterminated

; 5. Registrar a API Node.js como Serviço do Windows usando WinSW
Filename: "{app}\appbarcash-service.exe"; Parameters: "install"; StatusMsg: "Registrando Serviço de Sistema appBarCash..."; Flags: runhidden

; 6. Iniciar o Serviço do Windows recém-registrado
Filename: "{app}\appbarcash-service.exe"; Parameters: "start"; StatusMsg: "Iniciando Serviço do Sistema..."; Flags: runhidden

; 7. Abrir a aplicação no navegador no final da instalação
Filename: "cmd.exe"; Parameters: "/c start http://localhost:4000"; Description: "Iniciar o appBarCash agora"; Flags: postinstall nowait

[UninstallRun]
; Parar o serviço da API antes de desinstalar os arquivos
Filename: "{app}\appbarcash-service.exe"; Parameters: "stop"; Flags: runhidden; RunOnceId: "StopService"
; Remover o serviço do Windows
Filename: "{app}\appbarcash-service.exe"; Parameters: "uninstall"; Flags: runhidden; RunOnceId: "UninstallService"

[Code]
// Função para checar se o Node.js já está instalado na máquina do cliente
function NodeNecessario(): Boolean;
begin
  // Retorna True se o executável do Node não for encontrado nas pastas padrões
  Result := not FileExists('C:\Program Files\nodejs\node.exe') and 
            not FileExists('C:\Program Files (x86)\nodejs\node.exe');
end;

// Determina a porta para instalar o MariaDB
// Se a porta 3306 está em uso (por um MySQL existente que não foi reconhecido acima), usa 3307
function GetMariaDbPortParam(Param: String): String;
var
  ResultCode: Integer;
begin
  // Executa netstat para verificar se a porta 3306 está em uso
  // Se netstat encontrar LISTENING na 3306, usa porta alternativa
  if Exec('cmd.exe', '/c netstat -ano | findstr "LISTENING" | findstr ":3306 "', '',
          SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    if ResultCode = 0 then
    begin
      // Porta 3306 está em uso — instalar na 3307
      Result := '3307';
    end
    else
    begin
      // Porta 3306 está livre — usar padrão
      Result := '3306';
    end;
  end
  else
  begin
    // Falha ao executar netstat — usar padrão por segurança
    Result := '3306';
  end;
end;

// Função para checar se QUALQUER banco de dados compatível (MariaDB OU MySQL) já está instalado e ativo como serviço
function MariaDbNecessario(): Boolean;
var
  PortaParam: String;
begin
  PortaParam := GetMariaDbPortParam('');
  
  // Se a porta 3306 está em uso, precisamos instalar o MariaDB na porta 3307.
  // Mas se o serviço MariaDB já estiver registrado (de uma instalação anterior na 3307), não reinstalamos.
  if PortaParam = '3307' then
  begin
    if RegKeyExists(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Services\MariaDB') then
      Result := False
    else
      Result := True;
    Exit;
  end;

  // Se a porta 3306 está livre, verificamos se existe algum serviço de banco de dados registrado.
  // Se houver algum serviço de MySQL ou MariaDB ativo, assumimos que já está instalado e não precisa de nova instalação.
  if RegKeyExists(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Services\MariaDB') or
     RegKeyExists(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Services\MySQL') or
     RegKeyExists(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Services\MySQL80') or
     RegKeyExists(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Services\wampmysqld64') then
  begin
    Result := False;
  end
  else
  begin
    Result := True;
  end;
end;

procedure CurUninstallStepChanged(JustAfterAnsiNextStep: TUninstallStep);
begin
  if JustAfterAnsiNextStep = usPostUninstall then
  begin
    // Mensagem informativa ao usuário
    MsgBox('O serviço do appBarCash foi removido com sucesso.' + #13#10 +
           'Por motivos de segurança, o banco de dados MariaDB e os seus dados de vendas foram mantidos no computador.' + #13#10 +
           'Se desejar removê-los permanentemente, desinstale o MariaDB através do Painel de Controle.', mbInformation, MB_OK);
  end;
end;
