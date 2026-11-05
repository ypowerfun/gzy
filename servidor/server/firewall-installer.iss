#include "firewall-core.iss"

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    WizardForm.StatusLabel.Caption := CustomMessage('GzFirewallStatus');
    if not ConfigureGzFirewall('Install') then
      SuppressibleMsgBox(CustomMessage('GzFirewallFailed'), mbInformation, MB_OK, IDOK);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  { 1.0.5: desinstalacao completa (menos backups) - uninstall-cleanup.iss }
  if CurUninstallStep = usUninstall then GzUninstallAsk();
  if CurUninstallStep = usUninstall then begin
    if not ConfigureGzFirewall('Remove') then
      Log('Firewall GameZoney: remocao das regras nao confirmada.');
  end;
  if CurUninstallStep = usPostUninstall then GzUninstallCleanup();
end;
