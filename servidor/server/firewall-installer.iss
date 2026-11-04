#include "firewall-core.iss"

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    WizardForm.StatusLabel.Caption := 'Configurando o Firewall do Windows para o GameZoney...';
    if not ConfigureGzFirewall('Install') then
      SuppressibleMsgBox('O GameZoney Servidor foi instalado, mas o firewall nao foi configurado (permissao de administrador cancelada, politica de grupo ou antivirus com firewall proprio). Detalhes em firewall-status.log na pasta do aplicativo. Use o atalho "Reparar conexao de rede" no menu Iniciar e autorize a alteracao.', mbInformation, MB_OK, IDOK);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then begin
    if not ConfigureGzFirewall('Remove') then
      Log('Firewall GameZoney: remocao das regras nao confirmada.');
  end;
end;
