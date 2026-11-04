{ ===========================================================================
  GameZoney - configuracao automatica do Firewall do Windows pelo instalador.
  Arquivo compartilhado (identico) entre Servidor e Cliente. Requer #define PrimeRole.

  Metodo principal: netsh advfirewall, executado em um unico lote (.cmd) gerado
  na pasta do aplicativo. Nao depende do PowerShell, da ExecutionPolicy, do
  modulo NetSecurity nem da leitura do ActiveStore - motivos que faziam a
  configuracao falhar em alguns PCs.
  Metodo reserva: firewall.ps1 (o mesmo usado pelo atalho "Reparar conexao de rede").
  =========================================================================== }

const
  PrimeFwRole = '{#PrimeRole}';

function PrimeFwProgram(): String;
begin
  Result := ExpandConstant('{app}\runtime\node.exe');
end;

{ Nome estavel por instalacao. Mesmo algoritmo do firewall-rules.ps1:
  SHA-256 do caminho (minusculo, UTF-16) do node.exe, 16 primeiros hex. }
function PrimeFwKey(): String;
begin
  Result := Uppercase(Copy(GetSHA256OfUnicodeString(AnsiLowercase(PrimeFwProgram())), 1, 16));
end;

{ Chave usada pelas versoes anteriores (UTF-8). Usada apenas para limpar regras antigas. }
function PrimeFwLegacyKey(): String;
var
  Ansi: AnsiString;
begin
  Ansi := AnsiLowercase(PrimeFwProgram());
  Result := Uppercase(Copy(GetSHA256OfString(Ansi), 1, 16));
end;

function PrimeFwName(Key, Suffix: String): String;
begin
  Result := 'GameZoney-' + PrimeFwRole + '-' + Key + '-' + Suffix;
end;

procedure PrimeFwLine(var Script: String; Line: String);
begin
  Script := Script + Line + #13#10;
end;

procedure PrimeFwDelete(var Script: String; Suffix: String);
begin
  PrimeFwLine(Script, '"%NETSH%" advfirewall firewall delete rule name="' + PrimeFwName(PrimeFwKey(), Suffix) + '" >nul 2>&1');
  if PrimeFwLegacyKey() <> PrimeFwKey() then
    PrimeFwLine(Script, '"%NETSH%" advfirewall firewall delete rule name="' + PrimeFwName(PrimeFwLegacyKey(), Suffix) + '" >nul 2>&1');
end;

procedure PrimeFwAdd(var Script: String; Suffix, Spec: String);
var
  Name: String;
begin
  Name := PrimeFwName(PrimeFwKey(), Suffix);
  PrimeFwDelete(Script, Suffix);
  PrimeFwLine(Script, '"%NETSH%" advfirewall firewall add rule name="' + Name + '" ' + Spec +
    ' action=allow enable=yes profile=any program="%PROG%" description="Comunicacao local do GameZoney ' + PrimeFwRole + '" >>"%LOG%" 2>&1');
  PrimeFwLine(Script, '"%NETSH%" advfirewall firewall show rule name="' + Name + '" >nul 2>&1');
  PrimeFwLine(Script, 'if errorlevel 1 (set /a FAIL+=1 & echo [ERRO] Regra nao criada: ' + Name + ' >>"%LOG%") else (echo [OK] ' + Name + ' >>"%LOG%")');
end;

{ Definicao das regras. Perfis Publico/Privado/Dominio, somente rede local e somente o node.exe desta instalacao. }
procedure PrimeFwRules(var Script: String; Install: Boolean);
begin
#if PrimeRole == "server"
  if Install then begin
    PrimeFwAdd(Script, 'https-in', 'dir=in protocol=TCP localport=3443 remoteip=localsubnet edge=no');
    PrimeFwAdd(Script, 'discovery-in', 'dir=in protocol=UDP localport=3444 remoteip=localsubnet edge=no');
    PrimeFwAdd(Script, 'discovery-out', 'dir=out protocol=UDP localport=3444 remoteip=localsubnet');
  end else begin
    PrimeFwDelete(Script, 'https-in');
    PrimeFwDelete(Script, 'discovery-in');
    PrimeFwDelete(Script, 'discovery-out');
  end;
#else
  if Install then begin
    PrimeFwAdd(Script, 'https-out', 'dir=out protocol=TCP remoteport=3443 remoteip=localsubnet');
    PrimeFwAdd(Script, 'discovery-out', 'dir=out protocol=UDP remoteport=3444 remoteip=localsubnet,255.255.255.255');
    PrimeFwAdd(Script, 'discovery-in', 'dir=in protocol=UDP remoteport=3444 remoteip=localsubnet edge=no');
  end else begin
    PrimeFwDelete(Script, 'https-out');
    PrimeFwDelete(Script, 'discovery-out');
    PrimeFwDelete(Script, 'discovery-in');
  end;
#endif
end;

function PrimeFwBuildScript(Install: Boolean): String;
var
  Script: String;
begin
  Script := '';
  PrimeFwLine(Script, '@echo off');
  PrimeFwLine(Script, 'setlocal EnableExtensions');
  { %~dp0 e expandido pelo proprio Windows: funciona com acentos/espacos no caminho. }
  PrimeFwLine(Script, 'set "PROG=%~dp0runtime\node.exe"');
  PrimeFwLine(Script, 'set "LOG=%~dp0firewall-status.log"');
  PrimeFwLine(Script, 'set "NETSH=%SystemRoot%\System32\netsh.exe"');
  PrimeFwLine(Script, 'set FAIL=0');
  if Install then begin
    PrimeFwLine(Script, 'echo %DATE% %TIME% - GameZoney ' + PrimeFwRole + ' - configuracao automatica do firewall pelo instalador >"%LOG%"');
    { O servico do Firewall precisa estar ativo para gravar as regras. }
    PrimeFwLine(Script, '"%SystemRoot%\System32\sc.exe" query MpsSvc | "%SystemRoot%\System32\find.exe" /I "RUNNING" >nul 2>&1');
    PrimeFwLine(Script, 'if errorlevel 1 "%SystemRoot%\System32\net.exe" start MpsSvc >>"%LOG%" 2>&1');
  end else
    PrimeFwLine(Script, 'echo %DATE% %TIME% - GameZoney ' + PrimeFwRole + ' - remocao das regras >"%LOG%"');
  PrimeFwRules(Script, Install);
  if Install then begin
    PrimeFwLine(Script, 'if %FAIL%==0 (echo OK: regras do GameZoney ' + PrimeFwRole + ' configuradas automaticamente para os perfis Publico, Privado e Dominio, com alcance local. >>"%LOG%") else (echo FALHA: %FAIL% regra^(s^) nao configurada^(s^). >>"%LOG%")');
    PrimeFwLine(Script, 'exit /b %FAIL%');
  end else
    PrimeFwLine(Script, 'exit /b 0');
  Result := Script;
end;

{ Executa um processo; quando o instalador nao estiver elevado (Servidor), pede UAC uma unica vez. }
function PrimeFwRun(FileName, Params: String; var ExitCode: Integer): Boolean;
begin
  ExitCode := -1;
  if IsAdminInstallMode() then
    Result := Exec(FileName, Params, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode)
  else
    Result := ShellExec('runas', FileName, Params, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode);
end;

{ 0 = regras configuradas; 1 = netsh executou com falha; 2 = nao foi possivel executar (UAC recusado etc.). }
function PrimeFwNetsh(Install: Boolean): Integer;
var
  ExitCode: Integer;
  Batch: String;
begin
  Result := 2;
  if Install then Batch := ExpandConstant('{app}\firewall-setup.cmd')
  else Batch := ExpandConstant('{app}\firewall-remove.cmd');
  if not SaveStringToFile(Batch, PrimeFwBuildScript(Install), False) then begin
    Log('Firewall GameZoney: nao foi possivel gravar ' + Batch);
    exit;
  end;
  if PrimeFwRun(ExpandConstant('{sys}\cmd.exe'), '/c ""' + Batch + '""', ExitCode) then begin
    if ExitCode = 0 then Result := 0 else Result := 1;
  end;
  Log('Firewall GameZoney (netsh): resultado ' + IntToStr(Result) + ', codigo ' + IntToStr(ExitCode));
  DeleteFile(Batch);
end;

{ Metodo reserva: script PowerShell (mesmo do atalho de reparo). }
function PrimeFwPowerShell(Action: String): Boolean;
var
  ExitCode: Integer;
begin
  Result := PrimeFwRun(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\firewall.ps1') + '" -Role ' + PrimeFwRole + ' -Action ' + Action,
    ExitCode);
  if Result then Result := ExitCode = 0;
  Log('Firewall GameZoney (PowerShell ' + Action + '): codigo ' + IntToStr(ExitCode));
end;

function ConfigurePrimeFirewall(Action: String): Boolean;
var
  Attempt, Status, MaxAttempts: Integer;
begin
  Result := False;
  if Action = 'Remove' then begin
    Status := PrimeFwNetsh(False);
    Result := Status = 0;
    { Limpeza complementar por prefixo/programa (regras criadas pelo atalho de reparo). Somente com elevacao ja disponivel. }
    if IsAdminInstallMode() then PrimeFwPowerShell('Remove');
    exit;
  end;
  { Instalador elevado (Cliente): ate 3 tentativas sem novo UAC. Servidor: 1 tentativa (1 UAC). }
  if IsAdminInstallMode() then MaxAttempts := 3 else MaxAttempts := 1;
  Status := 2;
  for Attempt := 1 to MaxAttempts do begin
    Status := PrimeFwNetsh(True);
    if Status = 0 then begin
      Result := True;
      exit;
    end;
    if Status = 2 then break;
    if Attempt < MaxAttempts then Sleep(1500);
  end;
  { Reserva PowerShell somente quando o netsh executou e falhou (nao repete UAC recusado). }
  if Status = 1 then Result := PrimeFwPowerShell('Install');
  if not Result then Log('Firewall GameZoney: configuracao automatica nao concluida.');
end;
