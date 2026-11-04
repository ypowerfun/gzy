{ ===========================================================================
  GameZoney 1.0.2 - WebView2 Runtime da Microsoft (motor da janela do painel).
  O instalador confere a versão instalada no PC (registro do EdgeUpdate, por
  máquina e por usuário). Se faltar, ou se for anterior à 120, roda o
  instalador oficial da Microsoft (MicrosoftEdgeWebview2Setup.exe, que baixa a
  versão mais nova) em modo silencioso. Sem internet, avisa: o painel abre no
  navegador até o WebView2 ser instalado.
  =========================================================================== }

const
  GzWv2Cliente = 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  GzWv2Minimo = 120;

function GzWv2Ler(Raiz: Integer; var Versao: String): Boolean;
begin
  Result := RegQueryStringValue(Raiz, GzWv2Cliente, 'pv', Versao) and (Versao <> '') and (Versao <> '0.0.0.0');
end;

function GzWebView2Versao(): String;
var
  V: String;
begin
  Result := '';
  if GzWv2Ler(HKLM32, V) then begin Result := V; exit; end;
  if IsWin64 and GzWv2Ler(HKLM64, V) then begin Result := V; exit; end;
  if GzWv2Ler(HKCU, V) then Result := V;
end;

function GzWv2Principal(Versao: String): Integer;
var
  P: Integer;
begin
  P := Pos('.', Versao);
  if P > 0 then Result := StrToIntDef(Copy(Versao, 1, P - 1), 0) else Result := StrToIntDef(Versao, 0);
end;

function GzPrecisaWebView2(): Boolean;
var
  V: String;
begin
  V := GzWebView2Versao();
  Result := GzWv2Principal(V) < GzWv2Minimo;
  if V = '' then Log('WebView2 Runtime: não instalado.') else Log('WebView2 Runtime: versão ' + V + '.');
end;

procedure GzConferirWebView2();
var
  V: String;
begin
  V := GzWebView2Versao();
  if GzWv2Principal(V) >= GzWv2Minimo then
    Log('WebView2 Runtime pronto: versão ' + V + '.')
  else begin
    Log('WebView2 Runtime ainda ausente/antigo depois do instalador da Microsoft (versão: "' + V + '").');
    if not WizardSilent then
      MsgBox('O WebView2 da Microsoft (usado na janela do painel do GameZoney) não pôde ser instalado ou atualizado agora.' + #13#10#13#10 +
        'Normalmente é falta de internet. O GameZoney funciona assim mesmo: o painel abre no navegador.' + #13#10 +
        'Para tentar de novo, execute este instalador outra vez com a internet ligada.', mbInformation, MB_OK);
  end;
end;
