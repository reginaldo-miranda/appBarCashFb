; Script do Inno Setup para o appBarCash
; Gera o instalador executável final (.exe) do sistema para Windows.

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

; 2. Instalar MariaDB silenciosamente se necessário (Senha de root: root, porta: 3306)
Filename: "msiexec.exe"; Parameters: "/i ""{tmp}\mariadb.msi"" /qn /norestart PASSWORD=root PORT=3306 SERVICENAME=MariaDB ADD_TO_PATH=1"; StatusMsg: "Verificando e instalando Banco de Dados MariaDB..."; Flags: runhidden; Check: MariaDbNecessario

; 3. Executar script de criação do banco e tabelas (configurar-banco.bat)
Filename: "{app}\configurar-banco.bat"; StatusMsg: "Configurando banco de dados e tabelas do sistema..."; Flags: runhidden

; 4. Registrar a API Node.js como Serviço do Windows usando WinSW
Filename: "{app}\appbarcash-service.exe"; Parameters: "install"; StatusMsg: "Registrando Serviço de Sistema appBarCash..."; Flags: runhidden

; 5. Iniciar o Serviço do Windows recém-registrado
Filename: "{app}\appbarcash-service.exe"; Parameters: "start"; StatusMsg: "Iniciando Serviço do Sistema..."; Flags: runhidden

; 6. Abrir a aplicação no navegador no final da instalação
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

// Função para checar se o MariaDB já está instalado
function MariaDbNecessario(): Boolean;
begin
  // Retorna True se nenhuma pasta padrão de instalação do MariaDB for encontrada
  Result := not FileExists('C:\Program Files\MariaDB 10.11\bin\mysqld.exe') and 
            not FileExists('C:\Program Files\MariaDB 10.5\bin\mysqld.exe') and
            not FileExists('C:\Program Files\MariaDB 11.0\bin\mysqld.exe') and
            not FileExists('C:\Program Files\MariaDB 11.1\bin\mysqld.exe') and
            not FileExists('C:\Program Files\MariaDB 11.2\bin\mysqld.exe') and
            not FileExists('C:\Program Files\MariaDB 11.3\bin\mysqld.exe') and
            not FileExists('C:\Program Files\MariaDB 11.4\bin\mysqld.exe');
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
