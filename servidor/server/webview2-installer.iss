{ ===========================================================================
  GameZoney 1.0.2 - WebView2 Runtime da Microsoft (motor da janela do painel).
  Confere a versão no registro do EdgeUpdate (por máquina e por usuário) E se o
  msedgewebview2.exe dessa versão existe de fato (instalação danificada conta
  como ausente). Se faltar, for anterior à 120 ou estiver danificado, roda o
  instalador oficial da Microsoft em silêncio; se não resolver, oferece rodar
  como administrador (reparo da instalação do PC). Sem WebView2 o GameZoney
  funciona igual: o painel abre na janela do Microsoft Edge.
  =========================================================================== }

const
  GzWv2Cliente = 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  GzWv2Minimo = 120;

var
  GzWv2Diagnostico: String;

function GzHex(C: Integer): String;
var
  V: Int64;
begin
  V := C;
  if V < 0 then V := V + 4294967296;
  Result := IntToHex(V, 8) + ' (' + IntToStr(C) + ')';
end;

function GzWv2Principal(Versao: String): Integer;
var
  P: Integer;
begin
  P := Pos('.', Versao);
  if P > 0 then Result := StrToIntDef(Copy(Versao, 1, P - 1), 0) else Result := StrToIntDef(Versao, 0);
end;

{ Uma instalação (registro + pasta) com versão aceita e o executável presente. }
function GzWv2Confere(Raiz: Integer; Pasta, Onde: String): Boolean;
var
  V, Exe: String;
begin
  Result := False;
  if not RegQueryStringValue(Raiz, GzWv2Cliente, 'pv', V) then exit;
  if (V = '') or (V = '0.0.0.0') then begin
    GzWv2Diagnostico := GzWv2Diagnostico + Onde + ': registro sem versão (instalação incompleta). ';
    exit;
  end;
  Exe := AddBackslash(Pasta) + 'Microsoft\EdgeWebView\Application\' + V + '\msedgewebview2.exe';
  if not FileExists(Exe) then begin
    GzWv2Diagnostico := GzWv2Diagnostico + Onde + ': versão ' + V + ' no registro, mas sem os arquivos (danificado). ';
    exit;
  end;
  if GzWv2Principal(V) < GzWv2Minimo then begin
    GzWv2Diagnostico := GzWv2Diagnostico + Onde + ': versão ' + V + ' antiga. ';
    exit;
  end;
  GzWv2Diagnostico := GzWv2Diagnostico + Onde + ': versão ' + V + ' ok. ';
  Result := True;
end;

function GzWebView2Pronto(): Boolean;
begin
  GzWv2Diagnostico := '';
  Result := GzWv2Confere(HKLM32, ExpandConstant('{commonpf32}'), 'PC');
  if not Result and IsWin64 then Result := GzWv2Confere(HKLM64, ExpandConstant('{commonpf32}'), 'PC (64)');
  if not Result then Result := GzWv2Confere(HKCU, ExpandConstant('{localappdata}'), 'usuário');
  if GzWv2Diagnostico = '' then GzWv2Diagnostico := 'não instalado. ';
  Log('WebView2 Runtime: ' + GzWv2Diagnostico);
end;

function GzPrecisaWebView2(): Boolean;
begin
  Result := not GzWebView2Pronto();
end;

{ Chamado logo depois de o instalador oficial ser copiado para a pasta temporária. }
procedure GzInstalarWebView2();
var
  Arquivo: String;
  Codigo, CodigoAdmin: Integer;
begin
  Arquivo := ExpandConstant(CurrentFileName);
  WizardForm.StatusLabel.Caption := 'Instalando/atualizando o WebView2 da Microsoft (janela do painel)...';
  Codigo := -1;
  if not Exec(Arquivo, '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, Codigo) then
    Log('WebView2: o instalador da Microsoft não abriu (erro ' + IntToStr(Codigo) + ').')
  else
    Log('WebView2: instalador da Microsoft terminou com o código ' + GzHex(Codigo) + '.');
  if GzWebView2Pronto() then exit;
  CodigoAdmin := -1;
  if not WizardSilent then
    if MsgBox('O WebView2 da Microsoft (janela do painel do GameZoney) não ficou pronto neste PC.' + #13#10 +
      'Situação: ' + GzWv2Diagnostico + #13#10 + 'Código do instalador da Microsoft: ' + GzHex(Codigo) + #13#10#13#10 +
      'Tentar reparar como administrador? O Windows vai pedir confirmação.', mbConfirmation, MB_YESNO) = IDYES then
    begin
      WizardForm.StatusLabel.Caption := 'Reparando o WebView2 da Microsoft como administrador...';
      if ShellExec('runas', Arquivo, '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, CodigoAdmin) then
        Log('WebView2: instalador da Microsoft rodou como administrador.')
      else
        Log('WebView2: execução como administrador não aconteceu (código ' + IntToStr(CodigoAdmin) + ').');
      if GzWebView2Pronto() then exit;
    end;
  if not WizardSilent then
    MsgBox('O WebView2 da Microsoft continua sem ficar pronto neste PC (' + GzWv2Diagnostico + ').' + #13#10#13#10 +
      'O GameZoney funciona normalmente: o painel abre numa janela do Microsoft Edge.' + #13#10#13#10 +
      'Para reparar o WebView2 (e voltar à janela própria): Configurações do Windows > Aplicativos >' + #13#10 +
      '"Microsoft Edge WebView2 Runtime" > Modificar > Reparar. Depois, no ícone do GameZoney perto do relógio,' + #13#10 +
      'use "Tentar a janela própria (WebView2) de novo".', mbInformation, MB_OK);
end;
