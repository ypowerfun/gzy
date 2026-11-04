@echo off
rem GameZoney - gerar o INSTALADOR UNICO (Servidor + Cliente na mesma tela).
rem Dois cliques neste arquivo. Nada para digitar.
rem A liberacao do PowerShell (ExecutionPolicy Bypass) vale so para esta execucao; o Windows nao e alterado.
setlocal
cd /d "%~dp0"
set "GZ_ROOT=%~dp0"
echo GameZoney - gerar o instalador unico (Servidor + Cliente)
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath $env:GZ_ROOT -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0unico\gerar-instalador-unico.ps1"
set "GZ_ERR=%ERRORLEVEL%"
exit /b %GZ_ERR%
