# GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
# Gera o INSTALADOR ÚNICO (Servidor + Cliente na mesma tela, com caixas de seleção) na pasta saida\.
# Uso: dois cliques em GERAR-INSTALADOR-UNICO.cmd. Ele gera o instalador do Servidor e o do Cliente com os geradores
# originais de cada um (sem mudar nada neles) e junta os dois num só.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
function Pausar { if ($Host.Name -eq 'ConsoleHost') { Read-Host 'Pressione Enter para fechar' | Out-Null } }
function Perguntar([string]$texto) { return ((Read-Host "$texto (S/N)") -match '^\s*(s|sim|y|yes)\s*$') }
function Versao([string]$iss) {
  $m = [regex]::Match((Get-Content -LiteralPath $iss -Raw), '(?m)^AppVersion=(\S+)\s*$')
  if (!$m.Success) { throw "Versão não encontrada em $iss" }
  return $m.Groups[1].Value
}
function Achar-Inno {
  $candidatos = New-Object System.Collections.Generic.List[string]
  $pastas = @($env:ProgramW6432, $env:ProgramFiles, ${env:ProgramFiles(x86)})
  if ($env:LOCALAPPDATA) { $pastas += (Join-Path $env:LOCALAPPDATA 'Programs') }
  foreach ($v in '7', '6') {
    foreach ($pasta in $pastas) { if ($pasta) { $candidatos.Add((Join-Path $pasta "Inno Setup $v\ISCC.exe")) } }
    foreach ($raiz in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall') {
      try { $local = (Get-ItemProperty -LiteralPath (Join-Path $raiz "Inno Setup ${v}_is1") -ErrorAction Stop).InstallLocation; if ($local) { $candidatos.Add((Join-Path $local 'ISCC.exe')) } } catch {}
    }
  }
  $noPath = Get-Command ISCC.exe -ErrorAction SilentlyContinue
  if ($noPath) { $candidatos.Add($noPath.Source) }
  return ($candidatos | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1)
}
try {
  Write-Host 'GameZoney - gerar o instalador único (Servidor + Cliente)' -ForegroundColor Cyan
  $servidorDir = Join-Path $root 'servidor'
  $clienteRaiz = Join-Path $root 'cliente'
  $clienteDir = Get-ChildItem -LiteralPath $clienteRaiz -Directory -Filter 'windows-client-*' | Sort-Object { [version]($_.Name -replace '^windows-client-', '') } -Descending | Select-Object -First 1
  if (!(Test-Path -LiteralPath (Join-Path $servidorDir 'server\installer.iss'))) { throw 'Pasta servidor\ (código do Servidor) não encontrada ao lado desta pasta.' }
  if (!$clienteDir) { throw 'Pasta cliente\windows-client-... (código do Cliente) não encontrada.' }
  $sv = Versao (Join-Path $servidorDir 'server\installer.iss')
  $cv = Versao (Join-Path $clienteDir.FullName 'installer.iss')
  Write-Host "Servidor $sv  +  Cliente $cv"
  # Programas (os mesmos dos geradores do Servidor e do Cliente)
  $inno = Achar-Inno
  if (!$inno) { throw 'Inno Setup não encontrado (procurado o 7 e o 6). Instale em https://jrsoftware.org/isdl.php e rode de novo.' }
  if (!(Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Node.js não encontrado. Instale o Node.js 24 LTS (https://nodejs.org) e rode de novo.' }
  $major = [int]((& node.exe --version).TrimStart('v').Split('.')[0])
  if ($major -lt 24) { throw 'Instale o Node.js 24 LTS ou mais novo (https://nodejs.org) e rode de novo.' }
  if (!(Test-Path -LiteralPath (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'))) { throw '.NET Framework 4.x não encontrado (csc.exe).' }
  Write-Host "OK  Inno Setup: $inno"
  $servidorSetup = Join-Path $servidorDir "outputs\GameZoney-Servidor-$sv-Setup.exe"
  $clienteSetup = Join-Path $clienteRaiz "outputs\GameZoney-Cliente-$cv-Setup.exe"
  $gerar = $true
  if ((Test-Path -LiteralPath $servidorSetup) -and (Test-Path -LiteralPath $clienteSetup)) {
    $gerar = !(Perguntar 'Os instaladores do Servidor e do Cliente já foram gerados antes. Usar esses (S) ou gerar de novo (N)?')
  }
  if ($gerar) {
    Write-Host ''; Write-Host "1/3  Gerando o instalador do Servidor $sv (dependências, testes e instalador; alguns minutos)" -ForegroundColor Cyan
    if (Test-Path -LiteralPath $servidorSetup) { Remove-Item -LiteralPath $servidorSetup -Force }
    & (Join-Path $servidorDir 'scripts\build-server.ps1') -InnoCompiler $inno
    if (!(Test-Path -LiteralPath $servidorSetup)) { throw 'O instalador do Servidor não foi gerado. Veja as mensagens acima.' }
    Write-Host ''; Write-Host "2/3  Gerando o instalador do Cliente $cv (autotestes e instalador)" -ForegroundColor Cyan
    if (Test-Path -LiteralPath $clienteSetup) { Remove-Item -LiteralPath $clienteSetup -Force }
    & (Join-Path $clienteDir.FullName 'build.ps1') -InnoCompiler $inno
    if (!(Test-Path -LiteralPath $clienteSetup)) { throw 'O instalador do Cliente não foi gerado. Veja as mensagens acima.' }
  }
  Write-Host ''; Write-Host '3/3  Juntando os dois no instalador único' -ForegroundColor Cyan
  $saida = Join-Path $root 'saida'
  New-Item -ItemType Directory -Force -Path $saida | Out-Null
  # 1.1.3: assinatura digital (só com certificado configurado em assinatura\config.ps1; sem ele nada muda)
  $gzSignScript = Join-Path $PSScriptRoot '..\assinatura\assinar.ps1'
  if (Test-Path -LiteralPath $gzSignScript) { . $gzSignScript } else { function Invoke-GzSign([string[]]$Files) {}; function Get-GzInnoSignArgs { @() } }
  & $inno @(Get-GzInnoSignArgs) "/DServidorVersao=$sv" "/DClienteVersao=$cv" "/DServidorSetup=$servidorSetup" "/DClienteSetup=$clienteSetup" "/O$saida" (Join-Path $PSScriptRoot 'instalador-unico.iss')
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o instalador único.' }
  $final = Join-Path $saida "GameZoney-Instalador-Servidor-$sv-Cliente-$cv.exe"
  if (!(Test-Path -LiteralPath $final)) { throw 'O instalador único não foi gerado. Veja as mensagens acima.' }
  Write-Host ''
  Write-Host "Instalador único gerado: $final" -ForegroundColor Green
  Write-Host ('SHA-256: ' + (Get-FileHash $final -Algorithm SHA256).Hash.ToLower())
  Start-Process explorer.exe $saida
} catch {
  Write-Host ''
  Write-Host $_.Exception.Message -ForegroundColor Red
}
Pausar
