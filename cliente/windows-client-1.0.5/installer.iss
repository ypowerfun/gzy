#define GzRole "client"
[Setup]
AppId={{62070551-BB3B-4C84-BC6F-86E680D40437}
AppName=GameZoney Cliente
; 1.0.15: sem número de versão nas telas do instalador (a versão continua nos detalhes do arquivo, para a equipe)
AppVerName=GameZoney Cliente
AppVersion=1.0.18
AppPublisher=GameZoney
; 1.1.3: fornecedor GameZoney nos detalhes do instalador e em Programas instalados
AppPublisherURL=https://gamezoney.com
AppSupportURL=https://gamezoney.com/atendimento
AppUpdatesURL=https://gamezoney.com/atualizacoes
VersionInfoCompany=GameZoney
VersionInfoCopyright=© 2026 GameZoney. Todos os direitos reservados.
VersionInfoProductName=GameZoney Cliente
VersionInfoDescription=GameZoney Cliente - instalador
; assinatura digital: só quando o gerador acha um certificado (assinatura\config.ps1) e passa /DGzSign
#ifdef GzSign
SignTool=gz
SignedUninstaller=yes
#endif
DefaultDirName={localappdata}\Programs\GameZoneyCliente
DefaultGroupName=GameZoney Cliente
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0.17763
DisableProgramGroupPage=yes
OutputDir=..\outputs
OutputBaseFilename=GameZoney-Cliente-1.0.18-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=gamezoney.ico
UninstallDisplayIcon={app}\GameZoneyCliente.exe
AppMutex=Local\GameZoneyCliente,Local\GameZoney.Supervisor
CloseApplications=no
InfoBeforeFile=INSTALACAO-en.txt
; 1.0.5: instalador em inglês por padrão; a primeira tela deixa trocar para Português (Brasil) ou manter English.
ShowLanguageDialog=yes
LanguageDetectionMethod=none
VersionInfoVersion=1.0.18.0

[Languages]
Name: english; MessagesFile: compiler:Default.isl; InfoBeforeFile: INSTALACAO-en.txt
Name: brazilianportuguese; MessagesFile: compiler:Languages\BrazilianPortuguese.isl; InfoBeforeFile: INSTALACAO.txt

[CustomMessages]
english.GzOptimizing=Optimizing client startup...
brazilianportuguese.GzOptimizing=Otimizando a inicialização do cliente...
english.GzOpenApp=Open GameZoney Client
brazilianportuguese.GzOpenApp=Abrir GameZoney Cliente
english.GzFirewallStatus=Configuring Windows Firewall for GameZoney...
brazilianportuguese.GzFirewallStatus=Configurando o Firewall do Windows para o GameZoney...
english.GzFirewallFailed=GameZoney Client was installed, but Windows refused to create the firewall rules (group policy or an antivirus with its own firewall). Details in firewall-status.log in the application folder. The "Reparar conexao de rede" (repair network connection) shortcut in the Start menu tries again.
brazilianportuguese.GzFirewallFailed=O GameZoney Cliente foi instalado, mas o Windows recusou a criacao das regras de firewall (politica de grupo ou antivirus com firewall proprio). Detalhes em firewall-status.log na pasta do aplicativo. O atalho "Reparar conexao de rede" no menu Iniciar tenta novamente.
english.GzAutostartStatus=Configuring fast startup with Windows...
brazilianportuguese.GzAutostartStatus=Configurando a inicializacao rapida com o Windows...
english.GzProtectStatus=Protecting the application folder...
brazilianportuguese.GzProtectStatus=Protegendo a pasta do aplicativo...
english.GzProtectFailed=The client was installed, but the folder protection could not be completed. The application will still work. See C:\ProgramData\GameZoney\client-install.log for diagnostics.
brazilianportuguese.GzProtectFailed=O cliente foi instalado, mas a protecao da pasta nao pode ser concluida. O aplicativo continuara utilizavel. Consulte C:\ProgramData\GameZoney\client-install.log para diagnostico.
english.GzPolicyStatus=Checking the permission for the Windows restrictions...
brazilianportuguese.GzPolicyStatus=Conferindo a permissao das restricoes do Windows...
english.GzPolicyFailed=The client was installed, but the permission for the Windows restrictions (Task Manager, Control Panel) could not be granted to the PC account. Details in C:\ProgramData\GameZoney\client-install.log. Sign in with the PC account and use the "Reparar restricoes do Windows" (repair Windows restrictions) shortcut in the Start menu.
brazilianportuguese.GzPolicyFailed=O cliente foi instalado, mas nao foi possivel liberar a permissao das restricoes do Windows (Gerenciador de Tarefas, Painel de Controle) para a conta do PC. Detalhes em C:\ProgramData\GameZoney\client-install.log. Entre com a conta do PC e use o atalho "Reparar restricoes do Windows" no menu Iniciar.
english.GzUninstallCanceled=Uninstall was canceled: the administrator was not authorized or the Windows restrictions could not be removed (see the previous message).
brazilianportuguese.GzUninstallCanceled=A desinstalação foi cancelada: o administrador não foi autorizado ou as restrições do Windows não puderam ser retiradas (veja a mensagem anterior).
english.GzFilesInUse=GameZoney Client was removed, but some of its files were in use and could not be deleted. Restart the PC and delete the GameZoneyCliente folder in AppData\Local of the PC account, if it still exists.
brazilianportuguese.GzFilesInUse=O GameZoney Cliente foi removido, mas alguns arquivos dele estavam em uso e nao puderam ser apagados. Reinicie o PC e apague a pasta GameZoneyCliente em AppData\Local da conta do PC, se ela ainda existir.


[Files]
Source: "GUIA-GAMEZONEY.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "MonitorGZ.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "firewall.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "firewall-rules.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "protect-install.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "policy-access.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall-cleanup.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "autostart.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "wol-setup.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "discover.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "transport.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "runtime\node.exe"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "LICENSE-node.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "GameZoneyCliente.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "wallpaper-padrao.jpg"; DestDir: "{app}"; Flags: ignoreversion
Source: "logo-marca.png"; DestDir: "{app}"; Flags: ignoreversion
Source: "logo-gamezoney.png"; DestDir: "{app}"; Flags: ignoreversion
Source: "fonts\*"; DestDir: "{app}\fonts"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\Reconfigurar conexao com o servidor"; Filename: "{app}\GameZoneyCliente.exe"; Parameters: "/reconfigure"
Name: "{group}\Reparar conexao de rede"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\firewall.ps1"" -Role client -Action Install -Interactive"; WorkingDir: "{app}"; IconFilename: "{app}\GameZoneyCliente.exe"; Flags: runminimized
Name: "{group}\Reparar restricoes do Windows"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\policy-access.ps1"" -Interactive"; WorkingDir: "{app}"; IconFilename: "{app}\GameZoneyCliente.exe"; Flags: runminimized
Name: "{group}\GameZoney Cliente"; Filename: "{app}\MonitorGZ.exe"; IconFilename: "{app}\GameZoneyCliente.exe"
Name: "{group}\Restaurar acessos do Windows (administrador)"; Filename: "{app}\GameZoneyCliente.exe"; Parameters: "/recover"
Name: "{autodesktop}\GameZoney Cliente"; Filename: "{app}\MonitorGZ.exe"; IconFilename: "{app}\GameZoneyCliente.exe"

[Registry]
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "GameZoneyCliente"; ValueData: """{app}\MonitorGZ.exe"" /autostart"; Flags: uninsdeletevalue
; 2.0.29: inicializacao rapida. Reativa a entrada caso tenha sido desativada no Gerenciador de Tarefas
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; ValueType: none; ValueName: "GameZoneyCliente"; Flags: deletevalue
; e remove o atraso que o Windows aplica aos programas de inicializacao (StartupDelayInMSec / WaitForIdleState)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize"; ValueType: dword; ValueName: "StartupDelayInMSec"; ValueData: "0"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize"; ValueType: dword; ValueName: "WaitForIdleState"; ValueData: "0"; Flags: uninsdeletevalue
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize"; ValueType: dword; ValueName: "StartupDelayInMSec"; ValueData: "0"; Flags: uninsdeletevalue

[UninstallRun]
Filename: "{dotnet4064}\ngen.exe"; Parameters: "uninstall ""{app}\GameZoneyCliente.exe"" /nologo /silent"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "NgenClient"
Filename: "{dotnet4064}\ngen.exe"; Parameters: "uninstall ""{app}\MonitorGZ.exe"" /nologo /silent"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "NgenMonitor"

[Dirs]
Name: "{app}"; Attribs: hidden system

[Run]
; 2.0.29: pre-compila o cliente e o monitor (ngen) para abrir mais rapido no boot (sem compilacao JIT a cada inicio)
Filename: "{dotnet4064}\ngen.exe"; Parameters: "install ""{app}\GameZoneyCliente.exe"" /nologo /silent"; Flags: runhidden waituntilterminated skipifdoesntexist; StatusMsg: "{cm:GzOptimizing}"
Filename: "{dotnet4064}\ngen.exe"; Parameters: "install ""{app}\MonitorGZ.exe"" /nologo /silent"; Flags: runhidden waituntilterminated skipifdoesntexist; StatusMsg: "{cm:GzOptimizing}"
; 1.0.7: placa de rede pronta para ligar pela rede (Wake-on-LAN); nunca falha a instalacao
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""{app}\wol-setup.ps1"""; Flags: runhidden waituntilterminated; StatusMsg: "{cm:GzOptimizing}"
Filename: "{app}\MonitorGZ.exe"; Description: "{cm:GzOpenApp}"; Flags: nowait postinstall skipifsilent runasoriginaluser

[Code]
{ 2.0.33: removido o acesso temporario da instalacao. A maquina aguarda a aprovacao no servidor e o
  acesso administrativo usa os administradores cadastrados no servidor (Configuracao > Contas de acesso). }
procedure StopOldClientForUpdate;
var
  ExitCode: Integer;
begin
  { O Monitor pode reabrir o cliente se o executavel for encerrado primeiro. }
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /T /IM MonitorGZ.exe', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Sleep(600);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /T /IM GameZoneyCliente.exe', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Sleep(1200);
  { Segunda tentativa para processos que estavam finalizando ou reiniciando. }
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /T /IM MonitorGZ.exe', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /T /IM GameZoneyCliente.exe', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  Sleep(800);
end;

{ 2.0.29: inicializacao rapida com o Windows (tarefa agendada no logon). }
function RegisterGzAutostart(Action: String): Boolean;
var
  ExitCode: Integer;
begin
  Result := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\autostart.ps1') + '" -Action ' + Action + ' -InstallPath "' + ExpandConstant('{app}') + '"',
    ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode);
  if Result then Result := ExitCode = 0;
  if not Result then Log('Inicializacao automatica GameZoney (' + Action + ') nao confirmada. Codigo: ' + IntToStr(ExitCode));
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  StopOldClientForUpdate;
  Result := '';
end;

{ 2.0.57: o cliente roda com a conta do PC e grava as restricoes do Windows em HKCU\...\Policies\System e \Explorer.
  Se essas chaves ficam sem permissao de escrita para essa conta, o PC ficava bloqueado ("Sem conexao com o servidor").
  O instalador (como administrador) devolve a conta conectada ao Windows a permissao nessas duas chaves. }
function RepairGzPolicyAccess(): Boolean;
var
  ExitCode: Integer;
begin
  Result := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\policy-access.ps1') + '"',
    ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode);
  if Result then Result := ExitCode = 0;
  if not Result then Log('Permissao das restricoes do Windows nao confirmada. Codigo: ' + IntToStr(ExitCode));
end;

{ 2.0.58: desinstalacao completa. Apaga de todas as contas do Windows a pasta de dados do cliente (associacao com o
  servidor, sessao local, logs, fundo do login), copias antigas da pasta do programa, a marca de inicializacao desativada e o
  log de instalacao. Assim, ao instalar de novo, o PC pede uma nova autorizacao ao servidor. }
function RunGzUninstallCleanup(): Boolean;
var
  ExitCode: Integer;
begin
  Result := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\uninstall-cleanup.ps1') + '" -InstallPath "' + ExpandConstant('{app}') + '"',
    ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode);
  if Result then Result := ExitCode = 0;
  if not Result then Log('Limpeza completa do GameZoney Cliente nao confirmada. Codigo: ' + IntToStr(ExitCode));
end;

function InitializeUninstall(): Boolean;
var ExitCode: Integer;
begin
  { 2.0.58: antes de retirar as restricoes, devolve a permissao das chaves delas (2.0.57); sem isso o Windows podia negar. }
  RepairGzPolicyAccess();
  Result := Exec(ExpandConstant('{app}\GameZoneyCliente.exe'), '/recover', '', SW_SHOWNORMAL, ewWaitUntilTerminated, ExitCode);
  if Result then Result := ExitCode = 0;
  if not Result then MsgBox(CustomMessage('GzUninstallCanceled'), mbError, MB_OK);
end;

#include "firewall-installer.iss"

[UninstallDelete]
Type: files; Name: "{app}\temp-access.dat"
; 2.0.58: nada do GameZoney Cliente fica no PC (a pasta do programa inteira, os dados desta conta e o log de instalacao).
Type: filesandordirs; Name: "{app}"
Type: filesandordirs; Name: "{localappdata}\GameZoneyCliente"
Type: files; Name: "{commonappdata}\GameZoney\client-install.log"
Type: dirifempty; Name: "{commonappdata}\GameZoney"

[InstallDelete]
; 1.0.5: guias unificados em GUIA-GAMEZONEY.md
Type: files; Name: "{app}\GUIA-*.md"
Type: files; Name: "{app}\temp-access.dat"
Type: files; Name: "{app}\GameZoneyMonitor.exe"
; 1.0.5: logo renomeada (nomes internos GameZoney) e logo.jpg sem uso no cliente
Type: files; Name: "{app}\logo-prime.png"
Type: files; Name: "{app}\logo.jpg"
