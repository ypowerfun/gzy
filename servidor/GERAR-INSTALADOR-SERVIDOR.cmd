@echo off
rem GameZoney - gerar o instalador do Servidor.
rem Dois cliques neste arquivo (ou digite o nome dele no CMD ou no PowerShell). Nada para digitar.
rem A liberacao do PowerShell (ExecutionPolicy Bypass) vale so para esta execucao; o Windows nao e alterado.
setlocal
cd /d "%~dp0"
set "GZ_ROOT=%~dp0"
echo GameZoney - gerar o instalador do Servidor
echo.
rem arquivos baixados da internet ficam "bloqueados" pelo Windows: desbloqueia so os desta pasta
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath $env:GZ_ROOT -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0GERAR-INSTALADOR-SERVIDOR.ps1"
set "GZ_ERR=%ERRORLEVEL%"
exit /b %GZ_ERR%
