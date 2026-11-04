#define GzRole "client"
[Setup]
AppId={{62070551-BB3B-4C84-BC6F-86E680D40437}
AppName=GameZoney Cliente
AppVersion=1.0.5
AppPublisher=GameZoney
DefaultDirName={localappdata}\Programs\GameZoneyCliente
DefaultGroupName=GameZoney Cliente
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0.17763
DisableProgramGroupPage=yes
OutputDir=..\outputs
OutputBaseFilename=GameZoney-Cliente-1.0.5-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=gamezoney.ico
UninstallDisplayIcon={app}\GameZoneyCliente.exe
AppMutex=Local\GameZoneyCliente,Local\GameZoney.Supervisor
CloseApplications=no
InfoBeforeFile=INSTALACAO.txt
VersionInfoVersion=1.0.5.0

[Languages]
Name: brazilianportuguese; MessagesFile: compiler:Languages\BrazilianPortuguese.isl

[Files]
Source: "GUIA-GAMEZONEY.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "MonitorGZ.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "firewall.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "firewall-rules.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "protect-install.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "policy-access.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall-cleanup.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "autostart.ps1"; DestDir: "{app}"; Flags: ignoreversion
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
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "GameZoneyCliente"; ValueData: """{app}\MonitorGZ.exe"""; Flags: uninsdeletevalue
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
Filename: "{dotnet4064}\ngen.exe"; Parameters: "install ""{app}\GameZoneyCliente.exe"" /nologo /silent"; Flags: runhidden waituntilterminated skipifdoesntexist; StatusMsg: "Otimizando a inicialização do cliente..."
Filename: "{dotnet4064}\ngen.exe"; Parameters: "install ""{app}\MonitorGZ.exe"" /nologo /silent"; Flags: runhidden waituntilterminated skipifdoesntexist; StatusMsg: "Otimizando a inicialização do cliente..."
Filename: "{app}\MonitorGZ.exe"; Description: "Abrir GameZoney Cliente"; Flags: nowait postinstall skipifsilent runasoriginaluser

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
  if not Result then MsgBox('A desinstalação foi cancelada: o administrador não foi autorizado ou as restrições do Windows não puderam ser retiradas (veja a mensagem anterior).', mbError, MB_OK);
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
