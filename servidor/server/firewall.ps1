param(
    [ValidateSet('server','client')][string]$Role,
    [ValidateSet('Install','Remove')][string]$Action = 'Install',
    [switch]$Preview,
    [switch]$Interactive
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'firewall-rules.ps1')
$plan = @(Get-GzFirewallPlan -Role $Role -InstallDirectory $PSScriptRoot)
if ($Preview) { $plan | ConvertTo-Json -Depth 5; exit 0 }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    # Repair shortcut: elevate only this helper; the applications keep their original account.
    try {
        $arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -Role ' + $Role + ' -Action ' + $Action
        if ($Interactive) { $arguments += ' -Interactive' }
        $process = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -Wait -PassThru
        exit $process.ExitCode
    } catch { exit 2 }
}
$logPath = Join-Path $PSScriptRoot 'firewall-status.log'
try {
    if ($Action -eq 'Install' -and !(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'runtime\node.exe'))) { throw 'Componente de comunicacao nao encontrado.' }
    Import-Module NetSecurity -ErrorAction Stop
    if ($Action -eq 'Install') {
        # O servico do Firewall precisa estar ativo para gravar regras.
        try { $svc = Get-Service -Name MpsSvc -ErrorAction Stop; if ($svc.Status -ne 'Running') { Start-Service -Name MpsSvc -ErrorAction Stop } } catch { }
    }
    $warnings = @(Sync-GzFirewallRules -Plan $plan -Action $Action)
    if ($Action -eq 'Remove') { Remove-GzFirewallRulesForProgram -Role $Role -ProgramPath (Join-Path $PSScriptRoot 'runtime\node.exe') }
    $message = "OK: $Action. Regras do GameZoney $Role configuradas para os perfis Publico, Privado e Dominio, com alcance local."
    if ($Action -eq 'Remove') { $message = "OK: regras do GameZoney $Role removidas." }
    foreach ($warning in $warnings) { if ($warning) { $message += "`r`n" + $warning } }
    [IO.File]::WriteAllText($logPath, ((Get-Date).ToString('s') + "`r`n" + $message))
    if ($Interactive) { Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.MessageBox]::Show($message,'GameZoney - Rede') | Out-Null }
    exit 0
} catch {
    $message = 'Falha ao configurar o firewall: ' + $_.Exception.Message
    try { [IO.File]::WriteAllText($logPath, ((Get-Date).ToString('s') + "`r`n" + $message)) } catch {}
    if ($Interactive) { Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.MessageBox]::Show($message,'GameZoney - Rede') | Out-Null }
    exit 1
}
