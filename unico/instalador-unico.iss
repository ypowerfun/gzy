; GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
; INSTALADOR ÚNICO: na mesma tela o técnico escolhe o que instalar neste PC
;   [ ] Instalar Servidor versão X  (PC da recepção)
;   [ ] Instalar Cliente versão Y   (PCs gamers)
; Ele leva dentro os instaladores oficiais do Servidor e do Cliente, SEM mudar nada neles, e abre cada um escolhido
; (com as mesmas telas, pastas, firewall e permissões de sempre). Gere pelo GERAR-INSTALADOR-UNICO.cmd.
#ifndef ServidorVersao
  #error Gere este instalador pelo GERAR-INSTALADOR-UNICO.cmd (ele informa as versões e os instaladores).
#endif

[Setup]
AppId={{2BBB9A95-383E-475C-9499-B982288061F4}
AppName=GameZoney
AppVersion={#ServidorVersao}
AppVerName=GameZoney (Servidor {#ServidorVersao} / Cliente {#ClienteVersao})
AppPublisher=GameZoney
VersionInfoVersion={#ServidorVersao}.0
VersionInfoDescription=GameZoney - Instalador (Servidor {#ServidorVersao} / Cliente {#ClienteVersao})
; O instalador único não fica instalado: quem fica são o Servidor e/ou o Cliente, cada um com o seu desinstalador.
Uninstallable=no
CreateAppDir=no
DisableProgramGroupPage=yes
DisableWelcomePage=yes
; Roda com a conta do Windows aberta: o Servidor é instalado nesta conta e o Cliente pede a autorização de administrador ele mesmo.
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
MinVersion=10.0.17763
OutputBaseFilename=GameZoney-Instalador-Servidor-{#ServidorVersao}-Cliente-{#ClienteVersao}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=gamezoney.ico
; 1.0.5: instalador em inglês por padrão; a primeira tela deixa trocar para Português (Brasil) ou manter English.
; O idioma escolhido é repassado aos instaladores do Servidor e do Cliente (/LANG=), que não perguntam de novo.
ShowLanguageDialog=yes
LanguageDetectionMethod=none

[Languages]
Name: english; MessagesFile: compiler:Default.isl
Name: brazilianportuguese; MessagesFile: compiler:Languages\BrazilianPortuguese.isl

[Messages]
english.WizardSelectComponents=Installation
english.SelectComponentsDesc=Select the desired option(s)
english.SelectComponentsLabel2=Check what to install on this PC: the Server goes on the front-desk PC; the Client goes on the arena's gaming PCs. Then click Next.
brazilianportuguese.WizardSelectComponents=Instalação
brazilianportuguese.SelectComponentsDesc=Selecione a(s) opção(ões) desejada(s)
brazilianportuguese.SelectComponentsLabel2=Marque o que instalar neste PC: o Servidor vai no PC da recepção; o Cliente vai nos PCs gamers da arena. Depois clique em Avançar.

[CustomMessages]
english.GzChoice=Choice
brazilianportuguese.GzChoice=Escolha
english.GzInstallServer=Install Server version %1
brazilianportuguese.GzInstallServer=Instalar Servidor versão %1
english.GzInstallClient=Install Client version %1
brazilianportuguese.GzInstallClient=Instalar Cliente versão %1
english.GzServer=Server
brazilianportuguese.GzServer=Servidor
english.GzClient=Client
brazilianportuguese.GzClient=Cliente
english.GzOpening=Opening the %1 installer... (follow its screens)
brazilianportuguese.GzOpening=Abrindo o instalador do %1... (siga as telas dele)
english.GzOpenFailed=Could not open the %1 installer: %2
brazilianportuguese.GzOpenFailed=Não foi possível abrir o instalador do %1: %2
english.GzNotFinished=The %1 installer ended without finishing (code %2). If it was canceled, run this installer again whenever you want.
brazilianportuguese.GzNotFinished=O instalador do %1 terminou sem concluir (código %2). Se ele foi cancelado, rode este instalador de novo quando quiser.
english.GzPickOne=Check what to install on this PC: Server (front-desk PC) or Client (gaming PCs).
brazilianportuguese.GzPickOne=Marque o que instalar neste PC: Servidor (PC da recepção) ou Cliente (PCs gamers).
english.GzBoth=You checked Server and Client on the same PC. The Client locks the PC for the arena's customers: do this only on a test PC. Continue?
brazilianportuguese.GzBoth=Você marcou Servidor e Cliente no mesmo PC. O Cliente bloqueia o PC para uso dos clientes da arena: faça isso só em PC de teste. Continuar?

[Types]
Name: "escolha"; Description: "{cm:GzChoice}"; Flags: iscustom

[Components]
Name: "servidor"; Description: "{cm:GzInstallServer,{#ServidorVersao}}"
Name: "cliente"; Description: "{cm:GzInstallClient,{#ClienteVersao}}"

[Files]
Source: "{#ServidorSetup}"; DestDir: "{tmp}"; DestName: "servidor-setup.exe"; Components: servidor; Flags: ignoreversion
Source: "{#ClienteSetup}"; DestDir: "{tmp}"; DestName: "cliente-setup.exe"; Components: cliente; Flags: ignoreversion

[Code]
procedure RodarInstalador(const Nome, Arquivo: String);
var
  Codigo: Integer;
begin
  WizardForm.StatusLabel.Caption := FmtMessage(CustomMessage('GzOpening'), [Nome]);
  { 1.0.5: o Servidor/Cliente abre no mesmo idioma escolhido aqui (english ou brazilianportuguese) }
  if not ShellExec('', ExpandConstant('{tmp}\' + Arquivo), '/SP- /LANG=' + ActiveLanguage(), '', SW_SHOWNORMAL, ewWaitUntilTerminated, Codigo) then
    MsgBox(FmtMessage(CustomMessage('GzOpenFailed'), [Nome, SysErrorMessage(Codigo)]), mbError, MB_OK)
  else if Codigo <> 0 then
    MsgBox(FmtMessage(CustomMessage('GzNotFinished'), [Nome, IntToStr(Codigo)]), mbInformation, MB_OK);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    if WizardIsComponentSelected('servidor') then
      RodarInstalador(CustomMessage('GzServer'), 'servidor-setup.exe');
    if WizardIsComponentSelected('cliente') then
      RodarInstalador(CustomMessage('GzClient'), 'cliente-setup.exe');
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = wpSelectComponents then
  begin
    if (not WizardIsComponentSelected('servidor')) and (not WizardIsComponentSelected('cliente')) then
    begin
      MsgBox(CustomMessage('GzPickOne'), mbInformation, MB_OK);
      Result := False;
    end
    else if WizardIsComponentSelected('servidor') and WizardIsComponentSelected('cliente') then
      Result := MsgBox(CustomMessage('GzBoth'), mbConfirmation, MB_YESNO) = IDYES;
  end;
end;
