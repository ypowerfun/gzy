{ ===========================================================================
  GameZoney - configuracao automatica do Firewall do Windows pelo instalador.
  Arquivo compartilhado (identico) entre Servidor e Cliente. Requer #define GzRole.

  Metodo principal: netsh advfirewall, executado em um unico lote (.cmd) gerado
  na pasta do aplicativo. Nao depende do PowerShell, da ExecutionPolicy, do
  modulo NetSecurity nem da leitura do ActiveStore - motivos que faziam a
  configuracao falhar em alguns PCs.
  Metodo reserva: firewall.ps1 (o mesmo usado pelo atalho "Reparar conexao de rede").
  =========================================================================== }

const
  GzFwRole = '{#GzRole}';

function GzFwProgram(): String;
begin
  Result := ExpandConstant('{app}\runtime\node.exe');
end;

{ Nome estavel por instalacao. Mesmo algoritmo do firewall-rules.ps1:
  SHA-256 do caminho (minusculo, UTF-16) do node.exe, 16 primeiros hex. }
function GzFwKey(): String;
begin
  Result := Uppercase(Copy(GetSHA256OfUnicodeString(AnsiLowercase(GzFwProgram())), 1, 16));
end;

{ Chave usada pelas versoes anteriores (UTF-8). Usada apenas para limpar regras antigas. }
function GzFwLegacyKey(): String;
var
  Ansi: AnsiString;
begin
  Ansi := AnsiLowercase(GzFwProgram());
  Result := Uppercase(Copy(GetSHA256OfString(Ansi), 1, 16));
end;

function GzFwName(Key, Suffix: String): String;
begin
  Result := 'GameZoney-' + GzFwRole + '-' + Key + '-' + Suffix;
end;

procedure GzFwLine(var Script: String; Line: String);
begin
  Script := Script + Line + #13#10;
end;

procedure GzFwDelete(var Script: String; Suffix: String);
begin
  GzFwLine(Script, '"%NETSH%" advfirewall firewall delete rule name="' + GzFwName(GzFwKey(), Suffix) + '" >nul 2>&1');
  if GzFwLegacyKey() <> GzFwKey() then
    GzFwLine(Script, '"%NETSH%" advfirewall firewall delete rule name="' + GzFwName(GzFwLegacyKey(), Suffix) + '" >nul 2>&1');
end;

procedure GzFwAdd(var Script: String; Suffix, Spec: String);
var
  Name: String;
begin
  Name := GzFwName(GzFwKey(), Suffix);
  GzFwDelete(Script, Suffix);
  GzFwLine(Script, '"%NETSH%" advfirewall firewall add rule name="' + Name + '" ' + Spec +
    ' action=allow enable=yes profile=any program="%PROG%" description="Comunicacao local do GameZoney ' + GzFwRole + '" >>"%LOG%" 2>&1');
  GzFwLine(Script, '"%NETSH%" advfirewall firewall show rule name="' + Name + '" >nul 2>&1');
  GzFwLine(Script, 'if errorlevel 1 (set /a FAIL+=1 & echo [ERRO] Regra nao criada: ' + Name + ' >>"%LOG%") else (echo [OK] ' + Name + ' >>"%LOG%")');
end;

{ Definicao das regras. Perfis Publico/Privado/Dominio, somente rede local e somente o node.exe desta instalacao. }
procedure GzFwRules(var Script: String; Install: Boolean);
begin
#if GzRole == "server"
  if Install then begin
    GzFwAdd(Script, 'https-in', 'dir=in protocol=TCP localport=3443 remoteip=localsubnet,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16 edge=no');
    { porta 3000: tela das TVs (cliente.html). O nome 'mobile-in' continua o mesmo para nao deixar regra antiga para tras. }
    GzFwAdd(Script, 'mobile-in', 'dir=in protocol=TCP localport=3000 remoteip=localsubnet,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16 edge=no');
    GzFwAdd(Script, 'discovery-in', 'dir=in protocol=UDP localport=3444 remoteip=localsubnet,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16 edge=no');
    GzFwAdd(Script, 'discovery-out', 'dir=out protocol=UDP localport=3444 remoteip=localsubnet,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16');
  end else begin
    GzFwDelete(Script, 'https-in');
    GzFwDelete(Script, 'mobile-in');
    GzFwDelete(Script, 'discovery-in');
    GzFwDelete(Script, 'discovery-out');
  end;
#else
  if Install then begin
    GzFwAdd(Script, 'https-out', 'dir=out protocol=TCP remoteport=3443 remoteip=localsubnet,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16');
    GzFwAdd(Script, 'discovery-out', 'dir=out protocol=UDP remoteport=3444 remoteip=localsubnet,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16,255.255.255.255');
    GzFwAdd(Script, 'discovery-in', 'dir=in protocol=UDP remoteport=3444 remoteip=localsubnet,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16 edge=no');
  end else begin
    GzFwDelete(Script, 'https-out');
    GzFwDelete(Script, 'discovery-out');
    GzFwDelete(Script, 'discovery-in');
  end;
#endif
end;

function GzFwBuildScript(Install: Boolean): String;
var
  Script: String;
begin
  Script := '';
  GzFwLine(Script, '@echo off');
  GzFwLine(Script, 'setlocal EnableExtensions');
  { %~dp0 e expandido pelo proprio Windows: funciona com acentos/espacos no caminho. }
  GzFwLine(Script, 'set "PROG=%~dp0runtime\node.exe"');
  GzFwLine(Script, 'set "LOG=%~dp0firewall-status.log"');
  GzFwLine(Script, 'set "NETSH=%SystemRoot%\System32\netsh.exe"');
  GzFwLine(Script, 'set FAIL=0');
  if Install then begin
    GzFwLine(Script, 'echo %DATE% %TIME% - GameZoney ' + GzFwRole + ' - configuracao automatica do firewall pelo instalador >"%LOG%"');
    { O servico do Firewall precisa estar ativo para gravar as regras. }
    GzFwLine(Script, '"%SystemRoot%\System32\sc.exe" query MpsSvc | "%SystemRoot%\System32\find.exe" /I "RUNNING" >nul 2>&1');
    GzFwLine(Script, 'if errorlevel 1 "%SystemRoot%\System32\net.exe" start MpsSvc >>"%LOG%" 2>&1');
  end else
    GzFwLine(Script, 'echo %DATE% %TIME% - GameZoney ' + GzFwRole + ' - remocao das regras >"%LOG%"');
  GzFwRules(Script, Install);
  if Install then begin
    GzFwLine(Script, 'if %FAIL%==0 (echo OK: regras do GameZoney ' + GzFwRole + ' configuradas automaticamente para os perfis Publico, Privado e Dominio, com alcance local. >>"%LOG%") else (echo FALHA: %FAIL% regra^(s^) nao configurada^(s^). >>"%LOG%")');
    GzFwLine(Script, 'exit /b %FAIL%');
  end else
    GzFwLine(Script, 'exit /b 0');
  Result := Script;
end;

{ Executa um processo; quando o instalador nao estiver elevado (Servidor), pede UAC uma unica vez. }
function GzFwRun(FileName, Params: String; var ExitCode: Integer): Boolean;
begin
  ExitCode := -1;
  if IsAdminInstallMode() then
    Result := Exec(FileName, Params, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode)
  else
    Result := ShellExec('runas', FileName, Params, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode);
end;

{ 0 = regras configuradas; 1 = netsh executou com falha; 2 = nao foi possivel executar (UAC recusado etc.). }
function GzFwNetsh(Install: Boolean): Integer;
var
  ExitCode: Integer;
  Batch: String;
begin
  Result := 2;
  if Install then Batch := ExpandConstant('{app}\firewall-setup.cmd')
  else Batch := ExpandConstant('{app}\firewall-remove.cmd');
  if not SaveStringToFile(Batch, GzFwBuildScript(Install), False) then begin
    Log('Firewall GameZoney: nao foi possivel gravar ' + Batch);
    exit;
  end;
  if GzFwRun(ExpandConstant('{sys}\cmd.exe'), '/c ""' + Batch + '""', ExitCode) then begin
    if ExitCode = 0 then Result := 0 else Result := 1;
  end;
  Log('Firewall GameZoney (netsh): resultado ' + IntToStr(Result) + ', codigo ' + IntToStr(ExitCode));
  DeleteFile(Batch);
end;

{ Metodo reserva: script PowerShell (mesmo do atalho de reparo). }
function GzFwPowerShell(Action: String): Boolean;
var
  ExitCode: Integer;
begin
  Result := GzFwRun(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\firewall.ps1') + '" -Role ' + GzFwRole + ' -Action ' + Action,
    ExitCode);
  if Result then Result := ExitCode = 0;
  Log('Firewall GameZoney (PowerShell ' + Action + '): codigo ' + IntToStr(ExitCode));
end;

function ConfigureGzFirewall(Action: String): Boolean;
var
  Attempt, Status, MaxAttempts: Integer;
begin
  Result := False;
  if Action = 'Remove' then begin
    Status := GzFwNetsh(False);
    Result := Status = 0;
    { Limpeza complementar por prefixo/programa (regras criadas pelo atalho de reparo). Somente com elevacao ja disponivel. }
    if IsAdminInstallMode() then GzFwPowerShell('Remove');
    exit;
  end;
  { Instalador elevado (Cliente): ate 3 tentativas sem novo UAC. Servidor: 1 tentativa (1 UAC). }
  if IsAdminInstallMode() then MaxAttempts := 3 else MaxAttempts := 1;
  Status := 2;
  for Attempt := 1 to MaxAttempts do begin
    Status := GzFwNetsh(True);
    if Status = 0 then begin
      Result := True;
      exit;
    end;
    if Status = 2 then break;
    if Attempt < MaxAttempts then Sleep(1500);
  end;
  { Reserva PowerShell somente quando o netsh executou e falhou (nao repete UAC recusado). }
  if Status = 1 then Result := GzFwPowerShell('Install');
  if not Result then Log('Firewall GameZoney: configuracao automatica nao concluida.');
end;
