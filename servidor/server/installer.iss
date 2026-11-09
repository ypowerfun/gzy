#define GzRole "server"
[Setup]
AppId={{F2DD5917-D41D-43CE-8B51-A2F783C8DC89}
AppName=GameZoney Servidor
; 1.1.9: sem número de versão nas telas do instalador (a versão continua nos detalhes do arquivo, para a equipe)
AppVerName=GameZoney Servidor
AppVersion=1.2.0
AppPublisher=GameZoney
; 1.1.9: fornecedor GameZoney nos detalhes do instalador e em Programas instalados
AppPublisherURL=https://gamezoney.com
AppSupportURL=https://gamezoney.com/atendimento
AppUpdatesURL=https://gamezoney.com/atualizacoes
VersionInfoCompany=GameZoney
VersionInfoCopyright=© 2026 GameZoney. Todos os direitos reservados.
VersionInfoProductName=GameZoney Servidor
VersionInfoDescription=GameZoney Servidor - instalador
; assinatura digital: só quando o gerador acha um certificado (assinatura\config.ps1) e passa /DGzSign
#ifdef GzSign
SignTool=gz
SignedUninstaller=yes
#endif
DefaultDirName={localappdata}\Programs\GameZoneyServidor
DefaultGroupName=GameZoney
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0.17763
DisableProgramGroupPage=yes
OutputDir=..\outputs
OutputBaseFilename=GameZoney-Servidor-1.2.0-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=gamezoney.ico
UninstallDisplayIcon={app}\GameZoney.exe
AppMutex=Local\GameZoneyServer_3000
CloseApplications=no
InfoBeforeFile=INSTALACAO-en.txt
; 1.0.5: instalador em inglês por padrão; a primeira tela deixa trocar para Português (Brasil) ou manter English.
ShowLanguageDialog=yes
LanguageDetectionMethod=none
VersionInfoVersion=1.2.0.0

[Languages]
Name: english; MessagesFile: compiler:Default.isl; InfoBeforeFile: INSTALACAO-en.txt
Name: brazilianportuguese; MessagesFile: compiler:Languages\BrazilianPortuguese.isl; InfoBeforeFile: INSTALACAO.txt

[CustomMessages]
english.GzDesktopIcon=Create a desktop shortcut
brazilianportuguese.GzDesktopIcon=Criar atalho na área de trabalho
english.GzOpenApp=Open GameZoney Server
brazilianportuguese.GzOpenApp=Abrir GameZoney Servidor
english.GzFirewallStatus=Configuring Windows Firewall for GameZoney...
brazilianportuguese.GzFirewallStatus=Configurando o Firewall do Windows para o GameZoney...
english.GzFirewallFailed=GameZoney Server was installed, but the firewall was not configured (administrator permission canceled, group policy or an antivirus with its own firewall). Details in firewall-status.log in the application folder. Use the "Reparar conexao de rede" (repair network connection) shortcut in the Start menu and allow the change.
brazilianportuguese.GzFirewallFailed=O GameZoney Servidor foi instalado, mas o firewall nao foi configurado (permissao de administrador cancelada, politica de grupo ou antivirus com firewall proprio). Detalhes em firewall-status.log na pasta do aplicativo. Use o atalho "Reparar conexao de rede" no menu Iniciar e autorize a alteracao.
english.GzUninstallAsk=Also delete the GameZoney Server data from this computer?%n%nThis deletes: customers, balances, cash register, invoices, history, TV/PC pairings and settings.%n%nBackups are NOT deleted: Documents\bkp gamezoney and the server backups folder (which also keeps a copy of the database made now, before deleting).%n%nYes = remove everything (except backups)   ·   No = keep the data
brazilianportuguese.GzUninstallAsk=Apagar também os dados do GameZoney Servidor deste computador?%n%nSerão apagados: clientes, saldos, caixa, faturas, histórico, pareamentos das TVs/PCs e configurações.%n%nNÃO serão apagados os backups: Documentos\bkp gamezoney e a pasta de backups do servidor (onde também fica uma cópia do banco feita agora, antes de apagar).%n%nSim = remover tudo (menos os backups)   ·   Não = manter os dados

[Tasks]
Name: desktopicon; Description: "{cm:GzDesktopIcon}"; Flags: checkedonce

; 3.0.70: app GameZoney SV retirado — arquivos dele saem de instalações anteriores
[InstallDelete]
; 1.0.5: guias unificados em GUIA-GAMEZONEY.md e app web antigo de celular retirado (arquivos sem uso)
Type: files; Name: "{app}\GUIA-*.md"
Type: filesandordirs; Name: "{app}\public\mobile"
Type: files; Name: "{app}\public\mobile-settings-ui.js"
Type: files; Name: "{app}\mobile.js"
Type: files; Name: "{app}\rankings.js"
Type: files; Name: "{app}\tournaments.js"
; 1.0.5: nomes internos GameZoney (logo e tema renomeados) e arquivos sem uso do painel
Type: files; Name: "{app}\public\logo-prime.png"
Type: files; Name: "{app}\public\theme-prime.css"
Type: files; Name: "{app}\public\manifest.webmanifest"
Type: files; Name: "{app}\public\icon-192.png"
Type: files; Name: "{app}\public\icon-512.png"

[Files]
Source: "network-guard.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "netinfo.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "events.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "payments.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "feedback.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "license.js"; DestDir: "{app}"; Flags: ignoreversion
; 1.0.6: Verificar atualização (manifesto assinado + instalação com backup antes)
Source: "updater.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "update-helper.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "balance.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "import.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "shop.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "nfe.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "app-manager.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "units.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "pc-devices.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "diskless.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "member-photos.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "products-import.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "self-service.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "pc-notices.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "cash.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "stats.js"; DestDir: "{app}"; Flags: ignoreversion

Source: "excel.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "history.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "BackupTool.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "ClearAll.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "clear-all.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "BackupTool.exe.config"; DestDir: "{app}"; Flags: ignoreversion
Source: "backups.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "business.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "remote.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "wallpaper.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "firewall.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "firewall-rules.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "discovery.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "pc.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "CertTool.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "GameZoney.exe"; DestDir: "{app}"; Flags: ignoreversion
; 3.0.68: painel em janela própria (WebView2 da Microsoft; licença em LICENSE-webview2.txt)
Source: "Microsoft.Web.WebView2.Core.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "Microsoft.Web.WebView2.WinForms.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "runtimes\win-x64\native\WebView2Loader.dll"; DestDir: "{app}\runtimes\win-x64\native"; Flags: ignoreversion
Source: "runtimes\win-x86\native\WebView2Loader.dll"; DestDir: "{app}\runtimes\win-x86\native"; Flags: ignoreversion
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
Filename: "{app}\GameZoney.exe"; Description: "{cm:GzOpenApp}"; Flags: nowait postinstall skipifsilent

[Code]

#include "uninstall-cleanup.iss"
#include "firewall-installer.iss"
