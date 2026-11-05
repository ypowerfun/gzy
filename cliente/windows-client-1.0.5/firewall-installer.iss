#include "firewall-core.iss"

function ProtectGzClientFiles(): Boolean;
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
    WizardForm.StatusLabel.Caption := CustomMessage('GzFirewallStatus');
    if not ConfigureGzFirewall('Install') then
      SuppressibleMsgBox(CustomMessage('GzFirewallFailed'), mbInformation, MB_OK, IDOK);
    WizardForm.StatusLabel.Caption := CustomMessage('GzAutostartStatus');
    if not RegisterGzAutostart('Install') then
      Log('A tarefa de inicializacao nao foi criada; a entrada Run do Windows continua ativa.');
    WizardForm.StatusLabel.Caption := CustomMessage('GzProtectStatus');
    if not ProtectGzClientFiles() then
      SuppressibleMsgBox(CustomMessage('GzProtectFailed'), mbInformation, MB_OK, IDOK);
    WizardForm.StatusLabel.Caption := CustomMessage('GzPolicyStatus');
    if not RepairGzPolicyAccess() then
      SuppressibleMsgBox(CustomMessage('GzPolicyFailed'), mbInformation, MB_OK, IDOK);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then begin
    RegisterGzAutostart('Remove');
    if not ConfigureGzFirewall('Remove') then
      Log('Firewall GameZoney: remocao das regras nao confirmada.');
    { 2.0.58: desinstalacao completa (dados, logs e sobras de todas as contas do Windows) }
    if not RunGzUninstallCleanup() then
      if not UninstallSilent() then
        MsgBox(CustomMessage('GzFilesInUse'), mbInformation, MB_OK);
  end;
end;
