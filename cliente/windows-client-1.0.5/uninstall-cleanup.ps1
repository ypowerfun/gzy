param(
    [string]$InstallPath = ''
)
# 2.0.58: DESINSTALACAO COMPLETA do GameZoney Cliente. Chamado pelo desinstalador (como administrador), depois de retirar
# as restricoes do Windows, a inicializacao automatica e as regras de firewall.
# Apaga, de TODAS as contas do Windows deste PC:
#   - a pasta de dados do Cliente (%LOCALAPPDATA%\GameZoneyCliente): associacao com o servidor (client.dat), sessao local,
#     logs (connection.log, fullscreen.log, monitor.log) e fundo do login. Sem ela, ao instalar de novo o PC pede uma nova
#     autorizacao ao servidor;
#   - copias antigas da pasta do programa (%LOCALAPPDATA%\Programs\GameZoneyCliente) de instalacoes feitas com outra conta;
#   - a marca "inicializacao desativada" que o Windows cria para o GameZoney (StartupApproved).
# Por ultimo apaga o log de instalacao (%ProgramData%\GameZoney\client-install.log) e a pasta, se ficar vazia.
# A pasta atual do programa ($InstallPath) e removida pelo proprio desinstalador.
$ErrorActionPreference = 'Stop'
$failures = New-Object System.Collections.Generic.List[string]

# 1) Cliente e monitor fechados (o monitor reabre o cliente; por isso duas passadas).
foreach ($pass in 1, 2) {
    foreach ($name in 'MonitorGZ', 'GameZoneyCliente') {
        Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object { try { $_.Kill(); $_.WaitForExit(3000) | Out-Null } catch {} }
    }
    Start-Sleep -Milliseconds 600
}

function Remove-GzTree([string]$Path) {
    if (!(Test-Path -LiteralPath $Path)) { return }
    # tira oculto/sistema/somente leitura (a pasta do programa fica oculta e protegida)
    Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object { try { $_.Attributes = 'Normal' } catch {} }
    try { (Get-Item -LiteralPath $Path -Force).Attributes = 'Normal' } catch {}
    Remove-Item -LiteralPath $Path -Recurse -Force
}

$current = ''
if ($InstallPath) { try { $current = [IO.Path]::GetFullPath($InstallPath).TrimEnd('\') } catch {} }

# 2) Todas as contas do Windows deste PC (perfis locais e de rede: S-1-5-21-...).
$profiles = @()
foreach ($entry in @(Get-ChildItem -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList' -ErrorAction SilentlyContinue)) {
    if ($entry.PSChildName -notmatch '^S-1-5-21-') { continue }
    try {
        $image = (Get-ItemProperty -LiteralPath $entry.PSPath -Name ProfileImagePath -ErrorAction Stop).ProfileImagePath
        if ($image) { $profiles += [pscustomobject]@{ Sid = $entry.PSChildName; Path = [Environment]::ExpandEnvironmentVariables($image) } }
    } catch {}
}

foreach ($account in $profiles) {
    foreach ($relative in 'AppData\Local\GameZoneyCliente', 'AppData\Local\Programs\GameZoneyCliente') {
        $dir = Join-Path $account.Path $relative
        if (!(Test-Path -LiteralPath $dir)) { continue }
        try { if ($current -and ([IO.Path]::GetFullPath($dir).TrimEnd('\') -ieq $current)) { continue } } catch {}
        try { Remove-GzTree $dir } catch { $failures.Add($dir + ': ' + $_.Exception.Message) }
    }
    # Registro da conta (so se ela estiver conectada ao Windows; contas desconectadas nao tem o registro carregado)
    $hive = $null
    try { $hive = [Microsoft.Win32.Registry]::Users.OpenSubKey($account.Sid) } catch {}
    if ($hive) {
        $hive.Close()
        foreach ($sub in 'Run', 'Run32') {
            $path = 'Registry::HKEY_USERS\' + $account.Sid + '\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\' + $sub
            try { Remove-ItemProperty -LiteralPath $path -Name 'GameZoneyCliente' -ErrorAction Stop } catch {}
        }
    }
}

# 3) Registro do computador: marca "inicializacao desativada" do GameZoney (a entrada Run o desinstalador remove).
foreach ($sub in 'Run', 'Run32') {
    try { Remove-ItemProperty -LiteralPath ('HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\' + $sub) -Name 'GameZoneyCliente' -ErrorAction Stop } catch {}
}

# 4) Log de instalacao e a pasta do ProgramData (so se ficar vazia).
$programData = Join-Path $env:ProgramData 'GameZoney'
try { Remove-Item -LiteralPath (Join-Path $programData 'client-install.log') -Force -ErrorAction Stop } catch {}
try { if ((Test-Path -LiteralPath $programData) -and !(Get-ChildItem -LiteralPath $programData -Force)) { Remove-Item -LiteralPath $programData -Force } } catch {}

if ($failures.Count -gt 0) {
    # Sem log no disco (a desinstalacao nao deixa nada): o desinstalador avisa pelo codigo de saida (ex.: arquivo em uso).
    exit 1
}
exit 0
