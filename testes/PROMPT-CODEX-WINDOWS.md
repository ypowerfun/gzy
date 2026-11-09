# Prompt para o Codex (testes no Windows)

Copie tudo entre as linhas `=====` e envie ao Codex. Ele precisa rodar **num PC com Windows 10/11** (Codex CLI ou app no próprio PC, não na nuvem Linux), com a pasta do código-fonte do GameZoney já extraída.

=====
Você vai TESTAR (não desenvolver) o projeto GameZoney neste PC Windows. O código é proprietário e confidencial: não publique, não envie para fora e não faça commit/push. NÃO altere nenhum arquivo do projeto; se algo falhar, só investigue e relate. Responda em português.

Pasta do projeto: a pasta onde está o `GERAR-INSTALADOR-UNICO.cmd` (raiz). Dentro dela: `servidor\server` (Node), `cliente\windows-client-1.0.5` (C#) e `site` (Node).

Pré-requisitos (confira e informe a versão de cada um; NÃO instale nada sem me perguntar):
- `node -v` (precisa ser Node 22 ou 24) e `npm -v`
- `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe` existe
- PowerShell 5.1 (`$PSVersionTable.PSVersion`)

Passos (rode um por vez, no PowerShell, e guarde a saída de cada um):

1. Dependências do site (para os testes que usam o site não serem pulados):
   `cd <raiz>\site; npm ci --no-audit --no-fund`
2. Testes do site:
   `cd <raiz>\site; node --test --test-reporter=tap test\*.test.js` (anote as linhas `# pass` e `# fail` e cada `not ok`)
3. Dependências do servidor:
   `cd <raiz>\servidor\server; npm ci --ignore-scripts --no-audit --no-fund`
4. Ferramentas que só compilam no Windows (usadas pelos testes):
   `cd <raiz>\servidor\server`
   `& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:exe /out:CertTool.exe CertTool.cs`
   `& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:exe /out:BackupTool.exe /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:System.Web.Extensions.dll BackupTool.cs`
   `& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /out:ClearAll.exe /win32icon:gamezoney.ico /reference:System.Windows.Forms.dll ClearAll.cs`
   `& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /out:GameZoney.exe /win32icon:gamezoney.ico /resource:gamezoney.ico,gamezoney.ico /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:Microsoft.Web.WebView2.Core.dll /reference:Microsoft.Web.WebView2.WinForms.dll Launcher.cs GzIntegrity.dev.cs`
5. Testes COMPLETOS do servidor, do jeito que o gerador roda (compila o Cliente C# e limpa variáveis NODE_*):
   `cd <raiz>\servidor; node scripts\testServer.cjs`
   Anote o resumo final (`tests`, `pass`, `fail`, `skipped`) e, para CADA teste com ✖/fail/skip, o nome do teste, o arquivo e a mensagem de erro completa.
6. Testes do Cliente (autotestes do executável):
   `cd <raiz>\cliente\windows-client-1.0.5`
   Compile: `& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /out:GameZoneyCliente.exe /win32icon:gamezoney.ico /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Security.dll /reference:System.Web.Extensions.dll Client.cs ClientTheme.cs RemoteControl.cs PasswordRegistration.cs SessionCleanup.cs SessionSecurity.cs SystemMessage.cs PrintControl.cs SelfService.cs`
   e `& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /out:MonitorGZ.exe ClientGuard.cs`
   Rode: `Start-Process .\GameZoneyCliente.exe -ArgumentList '/selftest',"$env:TEMP\gz-self.txt" -Wait; Get-Content "$env:TEMP\gz-self.txt"`
   e `Start-Process .\GameZoneyCliente.exe -ArgumentList '/policy-test',"$env:TEMP\gz-policy.txt" -Wait; Get-Content "$env:TEMP\gz-policy.txt"`
   (o resultado começa com PASS: ou mostra o erro).
7. NÃO rode o Cliente normalmente (ele trava a tela do PC). NÃO rode instaladores.
8. No fim, apague os .exe que você compilou dentro de `servidor\server` e `cliente\windows-client-1.0.5` (CertTool.exe, BackupTool.exe, ClearAll.exe, GameZoney.exe, GameZoneyCliente.exe, MonitorGZ.exe) e a pasta `cliente\windows-client-1.0.5\runtime` se ela foi criada pelo teste.

Responda EXATAMENTE neste formato (um bloco só, sem resumir os erros):

```
RELATORIO-GAMEZONEY-WINDOWS
commit/versao: <conteúdo da 1ª linha de servidor\server\INSTALACAO.txt e de cliente\windows-client-1.0.5\INSTALACAO.txt>
windows: <versão do Windows>  node: <versão>  npm: <versão>  powershell: <versão>  csc: <ok/ausente>
SITE: tests=<n> pass=<n> fail=<n> skipped=<n>
SERVIDOR: tests=<n> pass=<n> fail=<n> skipped=<n>
CLIENTE selftest: <linha do resultado>
CLIENTE policy-test: <linha do resultado>
FALHAS:
- [SITE|SERVIDOR|CLIENTE] <nome do teste> | <arquivo> | <mensagem de erro completa + as 15 primeiras linhas da pilha>
PULADOS:
- <nome do teste> | <motivo do skip>
OBSERVACOES: <qualquer erro de compilação, aviso estranho ou passo que não deu para fazer, com a saída>
```
=====

Depois cole a resposta do Codex no chat do Claude.
