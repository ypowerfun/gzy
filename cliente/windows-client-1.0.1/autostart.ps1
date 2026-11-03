param(
    [Parameter(Mandatory=$true)][ValidateSet('Install','Remove')][string]$Action,
    [string]$InstallPath = ''
)
# 2.0.29: inicializacao RAPIDA do GameZoney Cliente junto com o Windows.
# A entrada "Run" do Windows (Gerenciador de Tarefas > Inicializar) so e executada depois que a area
# de trabalho termina de carregar e ainda recebe o atraso de inicializacao do Explorer (5 a 10 s).
# A tarefa agendada com gatilho "ao fazer logon" e disparada no proprio logon, sem esse atraso.
# A entrada Run continua como reserva; o MonitorGZ.exe so permite uma copia por sessao.
$ErrorActionPreference = 'Stop'
$taskName = 'GameZoney Cliente'
$logDir = Join-Path $env:ProgramData 'GameZoney'
$logPath = Join-Path $logDir 'client-install.log'
function Write-InstallLog([string]$Message) {
    try {
        New-Item -ItemType Directory -Force -Path $logDir | Out-Null
        Add-Content -LiteralPath $logPath -Value ((Get-Date).ToString('s') + ' AUTOSTART ' + $Message) -Encoding UTF8
    } catch {}
}
function Enable-StartupEntry([string]$Hive) {
    foreach ($sub in @('Run', 'Run32')) {
        $key = "${Hive}:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\$sub"
        try {
            if ((Test-Path -LiteralPath $key) -and ($null -ne (Get-ItemProperty -LiteralPath $key -Name 'GameZoneyCliente' -ErrorAction SilentlyContinue))) {
                Remove-ItemProperty -LiteralPath $key -Name 'GameZoneyCliente' -ErrorAction SilentlyContinue
                Write-InstallLog "Entrada de inicializacao reativada em $key"
            }
        } catch {}
    }
}
try {
    if ($Action -eq 'Remove') {
        try { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop; Write-InstallLog 'Tarefa removida.' } catch {}
        exit 0
    }
    $root = [IO.Path]::GetFullPath($InstallPath).TrimEnd('\')
    $monitor = Join-Path $root 'MonitorGZ.exe'
    if (!(Test-Path -LiteralPath $monitor -PathType Leaf)) { throw "MonitorGZ.exe nao encontrado em $root" }

    Enable-StartupEntry 'HKLM'
    Enable-StartupEntry 'HKCU'

    $users = 'S-1-5-32-545'
    try { $users = ([Security.Principal.SecurityIdentifier]'S-1-5-32-545').Translate([Security.Principal.NTAccount]).Value } catch {}
    $actionObj = New-ScheduledTaskAction -Execute $monitor -WorkingDirectory $root
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $principal = New-ScheduledTaskPrincipal -GroupId $users -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -Priority 4
    Register-ScheduledTask -TaskName $taskName -Action $actionObj -Trigger $trigger -Principal $principal -Settings $settings -Description 'Abre o GameZoney Cliente (MonitorGZ) imediatamente ao entrar no Windows.' -Force | Out-Null
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
    if ($task.State -eq 'Disabled') { Enable-ScheduledTask -TaskName $taskName | Out-Null }
    if (@($task.Triggers).Count -lt 1 -or $task.Actions[0].Execute -ne $monitor) { throw 'Tarefa registrada com dados incorretos.' }
    Write-InstallLog "OK: tarefa '$taskName' registrada para $monitor (grupo $users)"
    exit 0
} catch {
    Write-InstallLog ('ERRO: ' + $_.Exception.Message)
    exit 1
}
