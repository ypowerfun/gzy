@echo off
rem GameZoney - gerar o instalador do Cliente. Dois cliques neste arquivo: nada para digitar.
rem Tambem funciona digitando dentro desta pasta: no CMD  GERAR-INSTALADOR-CLIENTE.cmd  e no PowerShell  .\GERAR-INSTALADOR-CLIENTE.cmd
rem Ele roda o build.ps1 (o da 2.0.48, que agora acha o Inno Setup sozinho). A liberacao do PowerShell (ExecutionPolicy Bypass)
rem vale so para esta execucao; o Windows nao e alterado.
setlocal
cd /d "%~dp0"
set "GZ_ROOT=%~dp0"
echo GameZoney - gerar o instalador do Cliente
echo.
rem arquivos baixados da internet ficam "bloqueados" pelo Windows: desbloqueia so os desta pasta
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath $env:GZ_ROOT -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
set "GZ_ERR=%ERRORLEVEL%"
echo.
if "%GZ_ERR%"=="0" goto pronto
echo O instalador NAO foi gerado. Veja a mensagem em vermelho acima.
goto fim
:pronto
echo Pronto: o instalador do Cliente esta na pasta outputs, ao lado desta pasta.
:fim
echo.
pause
exit /b %GZ_ERR%
