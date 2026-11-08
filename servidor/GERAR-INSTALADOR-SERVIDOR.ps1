﻿# GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
# Gera o instalador GameZoney-Servidor-1.1.1-Setup.exe na pasta outputs\.
# Uso: dois cliques em GERAR-INSTALADOR-SERVIDOR.cmd (ou botão direito neste arquivo -> "Executar com o PowerShell").
# Precisa de internet na primeira vez, para o npm.
param([string]$InnoCompiler = '', [switch]$SkipTests)
$ErrorActionPreference = 'Stop'
function Pausar { if ($Host.Name -eq 'ConsoleHost') { Read-Host 'Pressione Enter para fechar' | Out-Null } }
try {
  Write-Host 'GameZoney - gerar instalador do Servidor 1.1.1' -ForegroundColor Cyan
  # 1) Node.js
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (!$node) { throw 'Node.js não encontrado. Instale o Node.js 24 LTS (https://nodejs.org) e rode de novo.' }
  $versao = (& node.exe --version).TrimStart('v'); $major = [int]($versao.Split('.')[0])
  if ($major -lt 24) { throw "Node.js $versao encontrado. Instale o Node.js 24 LTS ou mais novo (https://nodejs.org)." }
  Write-Host "OK  Node.js $versao (vai junto no instalador como runtime do servidor)"
  if (!(Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm não encontrado. Reinstale o Node.js marcando o npm.' }
  # 2) Compilador C# do .NET Framework (já vem no Windows)
  $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
  if (!(Test-Path -LiteralPath $csc)) { throw '.NET Framework 4.x não encontrado (csc.exe). Ative-o em "Recursos do Windows".' }
  Write-Host 'OK  .NET Framework (csc.exe)'
  # 3) Inno Setup 7 ou 6 (3.0.68: aceita o 7, 64 ou 32 bits, como o gerador do Cliente 2.0.58)
  #    Arquivos de Programas, "somente para mim" (AppData\Local\Programs), outra pasta (registro de desinstalação) ou PATH.
  if (!$InnoCompiler) {
    $candidatos = New-Object System.Collections.Generic.List[string]
    $pastas = @($env:ProgramW6432, $env:ProgramFiles, ${env:ProgramFiles(x86)})
    if ($env:LOCALAPPDATA) { $pastas += (Join-Path $env:LOCALAPPDATA 'Programs') }
    foreach ($versaoInno in '7', '6') {
      foreach ($pasta in $pastas) { if ($pasta) { $candidatos.Add((Join-Path $pasta "Inno Setup $versaoInno\ISCC.exe")) } }
      foreach ($raiz in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall') {
        try { $local = (Get-ItemProperty -LiteralPath (Join-Path $raiz "Inno Setup ${versaoInno}_is1") -ErrorAction Stop).InstallLocation; if ($local) { $candidatos.Add((Join-Path $local 'ISCC.exe')) } } catch {}
      }
    }
    $noPath = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($noPath) { $candidatos.Add($noPath.Source) }
    $InnoCompiler = $candidatos | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  }
  if (!$InnoCompiler -or !(Test-Path -LiteralPath $InnoCompiler)) { throw 'Inno Setup não encontrado (procurado o Inno Setup 7 e o 6). Instale em https://jrsoftware.org/isdl.php e rode de novo.' }
  Write-Host "OK  Inno Setup: $InnoCompiler"
  # 4) Gera (versão conferida, dependências, ferramentas, testes e instalador)
  $build = Join-Path $PSScriptRoot 'scripts\build-server.ps1'
  if ($SkipTests) { & $build -InnoCompiler $InnoCompiler -SkipTests } else { & $build -InnoCompiler $InnoCompiler }
  $setup = Join-Path $PSScriptRoot 'outputs\GameZoney-Servidor-1.1.1-Setup.exe'
  if (!(Test-Path -LiteralPath $setup)) { throw 'O instalador não foi gerado. Veja as mensagens acima.' }
  $hash = (Get-FileHash $setup -Algorithm SHA256).Hash.ToLower()
  Write-Host ''
  Write-Host "Instalador gerado: $setup" -ForegroundColor Green
  Write-Host "SHA-256: $hash"
} catch {
  Write-Host ''
  Write-Host $_.Exception.Message -ForegroundColor Red
}
Pausar
