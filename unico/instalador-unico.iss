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
SetupIconFile=prime.ico

[Languages]
Name: brazilianportuguese; MessagesFile: compiler:Languages\BrazilianPortuguese.isl

[Messages]
brazilianportuguese.WizardSelectComponents=Instalação
brazilianportuguese.SelectComponentsDesc=Selecione a(s) opção(ões) desejada(s)
brazilianportuguese.SelectComponentsLabel2=Marque o que instalar neste PC: o Servidor vai no PC da recepção; o Cliente vai nos PCs gamers da arena. Depois clique em Avançar.

[Types]
Name: "escolha"; Description: "Escolha"; Flags: iscustom

[Components]
Name: "servidor"; Description: "Instalar Servidor versão {#ServidorVersao}"
Name: "cliente"; Description: "Instalar Cliente versão {#ClienteVersao}"

[Files]
Source: "{#ServidorSetup}"; DestDir: "{tmp}"; DestName: "servidor-setup.exe"; Components: servidor; Flags: ignoreversion
Source: "{#ClienteSetup}"; DestDir: "{tmp}"; DestName: "cliente-setup.exe"; Components: cliente; Flags: ignoreversion

[Code]
procedure RodarInstalador(const Nome, Arquivo: String);
var
  Codigo: Integer;
begin
  WizardForm.StatusLabel.Caption := 'Abrindo o instalador do ' + Nome + '... (siga as telas dele)';
  if not ShellExec('', ExpandConstant('{tmp}\' + Arquivo), '/SP-', '', SW_SHOWNORMAL, ewWaitUntilTerminated, Codigo) then
    MsgBox('Não foi possível abrir o instalador do ' + Nome + ': ' + SysErrorMessage(Codigo), mbError, MB_OK)
  else if Codigo <> 0 then
    MsgBox('O instalador do ' + Nome + ' terminou sem concluir (código ' + IntToStr(Codigo) + '). Se ele foi cancelado, rode este instalador de novo quando quiser.', mbInformation, MB_OK);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    if WizardIsComponentSelected('servidor') then
      RodarInstalador('Servidor', 'servidor-setup.exe');
    if WizardIsComponentSelected('cliente') then
      RodarInstalador('Cliente', 'cliente-setup.exe');
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = wpSelectComponents then
  begin
    if (not WizardIsComponentSelected('servidor')) and (not WizardIsComponentSelected('cliente')) then
    begin
      MsgBox('Marque o que instalar neste PC: Servidor (PC da recepção) ou Cliente (PCs gamers).', mbInformation, MB_OK);
      Result := False;
    end
    else if WizardIsComponentSelected('servidor') and WizardIsComponentSelected('cliente') then
      Result := MsgBox('Você marcou Servidor e Cliente no mesmo PC. O Cliente bloqueia o PC para uso dos clientes da arena: faça isso só em PC de teste. Continuar?', mbConfirmation, MB_YESNO) = IDYES;
  end;
end;
