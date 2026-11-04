#include "firewall-core.iss"

function ProtectGameZoneyClientFiles(): Boolean;
var
  ExitCode: Integer;
  Arguments: String;
begin
  Arguments := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\protect-install.ps1') + '" -InstallPath "' + ExpandConstant('{app}') + '"';
  Result := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Arguments, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode);
  if Result then Result := ExitCode = 0;
  if not Result then Log('Protecao da pasta GameZoney nao concluida. Codigo: ' + IntToStr(ExitCode));
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    WizardForm.StatusLabel.Caption := 'Configurando o Firewall do Windows para o GameZoney...';
    if not ConfigureGameZoneyFirewall('Install') then
      SuppressibleMsgBox('O GameZoney Cliente foi instalado, mas o Windows recusou a criacao das regras de firewall (politica de grupo ou antivirus com firewall proprio). Detalhes em firewall-status.log na pasta do aplicativo. O atalho "Reparar conexao de rede" no menu Iniciar tenta novamente.', mbInformation, MB_OK, IDOK);
    WizardForm.StatusLabel.Caption := 'Configurando a inicializacao rapida com o Windows...';
    if not RegisterGameZoneyAutostart('Install') then
      Log('A tarefa de inicializacao nao foi criada; a entrada Run do Windows continua ativa.');
    WizardForm.StatusLabel.Caption := 'Protegendo a pasta do aplicativo...';
    if not ProtectGameZoneyClientFiles() then
      SuppressibleMsgBox('O cliente foi instalado, mas a protecao da pasta nao pode ser concluida. O aplicativo continuara utilizavel. Consulte %ProgramData%\GameZoney\client-install.log para diagnostico.', mbInformation, MB_OK, IDOK);
    WizardForm.StatusLabel.Caption := 'Conferindo a permissao das restricoes do Windows...';
    if not RepairGameZoneyPolicyAccess() then
      SuppressibleMsgBox('O cliente foi instalado, mas nao foi possivel liberar a permissao das restricoes do Windows (Gerenciador de Tarefas, Painel de Controle) para a conta do PC. Detalhes em %ProgramData%\GameZoney\client-install.log. Entre com a conta do PC e use o atalho "Reparar restricoes do Windows" no menu Iniciar.', mbInformation, MB_OK, IDOK);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then begin
    RegisterGameZoneyAutostart('Remove');
    if not ConfigureGameZoneyFirewall('Remove') then
      Log('Firewall GameZoney: remocao das regras nao confirmada.');
    { 2.0.58: desinstalacao completa (dados, logs e sobras de todas as contas do Windows) }
    if not RunGameZoneyUninstallCleanup() then
      if not UninstallSilent() then
        MsgBox('O GameZoney Cliente foi removido, mas alguns arquivos dele estavam em uso e nao puderam ser apagados. Reinicie o PC e apague a pasta GameZoneyCliente em %LOCALAPPDATA% da conta do PC, se ela ainda existir.', mbInformation, MB_OK);
  end;
end;
