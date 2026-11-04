#define GzRole "server"
[Setup]
AppId={{F2DD5917-D41D-43CE-8B51-A2F783C8DC89}
AppName=GameZoney Servidor
AppVersion=1.0.2
AppPublisher=GameZoney
DefaultDirName={localappdata}\Programs\GameZoneyServidor
DefaultGroupName=GameZoney
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0.17763
DisableProgramGroupPage=yes
OutputDir=..\outputs
OutputBaseFilename=GameZoney-Servidor-1.0.2-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=gamezoney.ico
UninstallDisplayIcon={app}\GameZoney.exe
AppMutex=Local\GameZoneyServer_3000
CloseApplications=no
InfoBeforeFile=INSTALACAO.txt
VersionInfoVersion=1.0.2.0

[Languages]
Name: brazilianportuguese; MessagesFile: compiler:Languages\BrazilianPortuguese.isl

[Tasks]
Name: desktopicon; Description: "Criar atalho na área de trabalho"; Flags: checkedonce

[InstallDelete]
; GameZoney 1.0.2: app web antigo de celular retirado (arquivos e arte de versões anteriores)
Type: filesandordirs; Name: "{app}\public\mobile"
Type: files; Name: "{app}\public\mobile-settings-ui.js"
Type: files; Name: "{app}\mobile.js"
Type: files; Name: "{app}\rankings.js"
Type: files; Name: "{app}\tournaments.js"

[Files]
Source: "network-guard.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "balance.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "import.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "shop.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "cash.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "stats.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-PRODUTOS.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-VISITANTE.md"; DestDir: "{app}"; Flags: ignoreversion

Source: "GUIA-IMPORTACAO.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-SALDO.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-PRIMEIRO-ACESSO.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-HISTORICOS.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "excel.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "history.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "BackupTool.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "ClearAll.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "clear-all.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "BackupTool.exe.config"; DestDir: "{app}"; Flags: ignoreversion
Source: "backups.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-BACKUP.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-FIDELIDADE.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-TAREFAS.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "business.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "remote.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-GESTAO.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-DESCONEXAO.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-MANUTENCAO.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-LAYOUT.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "wallpaper.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-REMOCAO.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "firewall.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "firewall-rules.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "discovery.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-CLIENTE.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "pc.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "CertTool.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "GameZoney.exe"; DestDir: "{app}"; Flags: ignoreversion
; 3.0.68: painel em janela própria (WebView2 da Microsoft; licença em LICENSE-webview2.txt)
Source: "Microsoft.Web.WebView2.Core.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "Microsoft.Web.WebView2.WinForms.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "runtimes\win-x64\native\WebView2Loader.dll"; DestDir: "{app}\runtimes\win-x64\native"; Flags: ignoreversion
Source: "runtimes\win-x86\native\WebView2Loader.dll"; DestDir: "{app}\runtimes\win-x86\native"; Flags: ignoreversion
; 1.0.2: instalador oficial do WebView2 Runtime (baixado pelo gerador, assinatura da Microsoft conferida); usado só se faltar no PC
Source: "webview2\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: GzPrecisaWebView2
Source: "server.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "panel-sessions.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "store.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "vidaa.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "androidtv.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "package-lock.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "LICENSE-*.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "GUIA-GAMEZONEY.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "runtime\*"; DestDir: "{app}\runtime"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "certs\*"; DestDir: "{app}\certs"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Restaurar backup GameZoney"; Filename: "{app}\GameZoney.exe"; Parameters: "/restore"; WorkingDir: "{app}"
Name: "{group}\Reparar conexao de rede"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\firewall.ps1"" -Role server -Action Install -Interactive"; WorkingDir: "{app}"; IconFilename: "{app}\GameZoney.exe"; Flags: runminimized
Name: "{group}\GameZoney Servidor"; Filename: "{app}\GameZoney.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\GameZoney Servidor"; Filename: "{app}\GameZoney.exe"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{userstartup}\GameZoney Servidor"; Filename: "{app}\GameZoney.exe"; Parameters: "/silent"; WorkingDir: "{app}"

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Instalando/atualizando o WebView2 da Microsoft (janela do painel)..."; Flags: waituntilterminated; Check: GzPrecisaWebView2; AfterInstall: GzConferirWebView2
Filename: "{app}\GameZoney.exe"; Description: "Abrir GameZoney Servidor"; Flags: nowait postinstall skipifsilent

[Code]

#include "firewall-installer.iss"
#include "webview2-installer.iss"
