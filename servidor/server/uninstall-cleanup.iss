(* ===========================================================================
  GameZoney Servidor 1.0.5 - desinstalacao completa.
  Remove tudo o que foi instalado e o que o servidor criou, EXCETO os backups:
   - pasta do aplicativo inteira (logs, certificados, restos de versoes);
   - %LOCALAPPDATA%\GameZoney\painel e painel-edge (dados da janela do painel);
   - %LOCALAPPDATA%\GameZoney\data (banco, pareamentos, certificado dos PCs, logs),
     MENOS a subpasta "backups". Antes de apagar, uma copia do banco vai para
     data\backups\antes-desinstalar-AAAAMMDD-HHMMSS.sqlite.
  Ficam: Documentos\gamezoney\backup (backups diarios), data\backups e as pastas
  data-anterior-* (copias feitas pela restauracao).
  Desinstalacao com tela: pede confirmacao antes de apagar os dados.
  Desinstalacao silenciosa: os dados sao mantidos (seguranca).
  =========================================================================== *)
var
  GzRemoveData: Boolean;

procedure GzDeleteAllExcept(Dir, Keep: String);
var
  FindRec: TFindRec;
  ItemPath: String;
begin
  if not DirExists(Dir) then exit;
  if FindFirst(AddBackslash(Dir) + '*', FindRec) then
  try
    repeat
      if (FindRec.Name <> '.') and (FindRec.Name <> '..') and (CompareText(FindRec.Name, Keep) <> 0) then begin
        ItemPath := AddBackslash(Dir) + FindRec.Name;
        if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then
          DelTree(ItemPath, True, True, True)
        else
          DeleteFile(ItemPath);
      end;
    until not FindNext(FindRec);
  finally
    FindClose(FindRec);
  end;
end;

procedure GzSafetyCopy(Data: String);
var
  Stamp, Target: String;
  Ok: Boolean;
begin
  if not FileExists(Data + '\gamezoney.sqlite') then exit;
  ForceDirectories(Data + '\backups');
  Stamp := GetDateTimeString('yyyymmdd-hhnnss', #0, #0);
  Target := Data + '\backups\antes-desinstalar-' + Stamp + '.sqlite';
  if not FileCopy(Data + '\gamezoney.sqlite', Target, False) then
    Log('GameZoney: copia de seguranca do banco falhou: ' + Target);
  if FileExists(Data + '\gamezoney.sqlite-wal') then
    Ok := FileCopy(Data + '\gamezoney.sqlite-wal', Target + '-wal', False);
end;

procedure GzUninstallAsk();
begin
  GzRemoveData := False;
  if UninstallSilent then exit;
  { 1.0.5: texto no idioma escolhido na instalacao (english/brazilianportuguese) - [CustomMessages] do installer.iss }
  GzRemoveData := MsgBox(CustomMessage('GzUninstallAsk'), mbConfirmation, MB_YESNO or MB_DEFBUTTON1) = IDYES;
end;

procedure GzUninstallCleanup();
var
  Root, Data: String;
begin
  Root := ExpandConstant('{localappdata}\GameZoney');
  DelTree(Root + '\painel', True, True, True);
  DelTree(Root + '\painel-edge', True, True, True);
  if GzRemoveData then begin
    Data := Root + '\data';
    GzSafetyCopy(Data);
    GzDeleteAllExcept(Data, 'backups');
  end;
  DelTree(ExpandConstant('{app}'), True, True, True);
end;
