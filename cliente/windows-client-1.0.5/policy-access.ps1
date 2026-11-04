param(
    [string]$UserSid = '',
    [switch]$Interactive
)
# 2.0.57: permissao das restricoes do Windows para o usuario do PC.
# O Cliente roda com a conta do PC (sem administrador) e grava as restricoes configuradas no servidor em
#   HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System   (Gerenciador de Tarefas, Bloquear, Alterar senha)
#   HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer (Painel de Controle, Sair)
# Se essas duas chaves ficam sem permissao de escrita para a conta do PC (outro programa ou politica do Windows), o Cliente
# nao consegue aplicar as restricoes e o PC fica bloqueado. Este script (como administrador) devolve a essa conta a
# permissao nessas DUAS chaves e em nada mais. Sem -UserSid: contas conectadas ao Windows (instalador).
# Pelo atalho do menu Iniciar (-Interactive): a conta que abriu o atalho; o Windows pede a autorizacao de administrador.
$ErrorActionPreference = 'Stop'
$logDir = Join-Path $env:ProgramData 'GameZoney'
$logPath = Join-Path $logDir 'client-install.log'
function Write-InstallLog([string]$Message) {
    try {
        New-Item -ItemType Directory -Force -Path $logDir | Out-Null
        Add-Content -LiteralPath $logPath -Value ((Get-Date).ToString('s') + ' RESTRICOES ' + $Message) -Encoding UTF8
    } catch {}
}
function Show-Result([string]$Message) {
    if ($Interactive) { Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.MessageBox]::Show($Message, 'GameZoney - Restricoes do Windows') | Out-Null }
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    # Atalho aberto pela conta do PC: eleva so este script e informa qual conta reparar (a que abriu o atalho).
    try {
        $arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -UserSid ' + $identity.User.Value
        if ($Interactive) { $arguments += ' -Interactive' }
        $process = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -Wait -PassThru
        exit $process.ExitCode
    } catch { exit 2 }
}

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class GzPolicyPrivilege {
 [DllImport("advapi32.dll", SetLastError = true)] static extern bool OpenProcessToken(IntPtr process, int access, out IntPtr token);
 [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool LookupPrivilegeValue(string system, string name, out long luid);
 [StructLayout(LayoutKind.Sequential, Pack = 1)] struct TokenPrivilege { public int Count; public long Luid; public int Attributes; }
 [DllImport("advapi32.dll", SetLastError = true)] static extern bool AdjustTokenPrivileges(IntPtr token, bool disableAll, ref TokenPrivilege state, int length, IntPtr previous, IntPtr returned);
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 public static bool Enable(string name) {
  IntPtr token;
  if (!OpenProcessToken(GetCurrentProcess(), 0x28, out token)) return false;
  try {
   var state = new TokenPrivilege { Count = 1, Attributes = 2 };
   if (!LookupPrivilegeValue(null, name, out state.Luid)) return false;
   return AdjustTokenPrivileges(token, false, ref state, 0, IntPtr.Zero, IntPtr.Zero) && Marshal.GetLastWin32Error() == 0;
  } finally { CloseHandle(token); }
 }
}
'@

$rights = [System.Security.AccessControl.RegistryRights]
$sections = [System.Security.AccessControl.AccessControlSections]
# Contas que, com uma regra de NEGAR, tirariam a escrita da conta do PC: a propria conta, Todos, Usuarios,
# Usuarios autenticados e Interativo.
function Get-DenySids([string]$Sid) { @($Sid, 'S-1-1-0', 'S-1-5-32-545', 'S-1-5-11', 'S-1-5-4') }

function Get-TargetSids {
    if ($UserSid) { return @($UserSid) }
    $found = New-Object System.Collections.Generic.List[string]
    # Contas com a area de trabalho aberta (explorer.exe) e, como reserva, a conta do console.
    try {
        foreach ($p in @(Get-CimInstance Win32_Process -Filter "Name='explorer.exe'" -ErrorAction Stop)) {
            try { $owner = Invoke-CimMethod -InputObject $p -MethodName GetOwnerSid -ErrorAction Stop; if ($owner.Sid -and !$found.Contains($owner.Sid)) { $found.Add($owner.Sid) } } catch {}
        }
    } catch {}
    try {
        $console = (Get-CimInstance Win32_ComputerSystem -ErrorAction Stop).UserName
        if ($console) { $sid = ([Security.Principal.NTAccount]$console).Translate([Security.Principal.SecurityIdentifier]).Value; if (!$found.Contains($sid)) { $found.Add($sid) } }
    } catch {}
    return @($found)
}

function Open-ForPermissions([string]$Path) {
    $want = $rights::ChangePermissions -bor $rights::ReadPermissions -bor $rights::ReadKey
    try { return [Microsoft.Win32.Registry]::Users.OpenSubKey($Path, [Microsoft.Win32.RegistryKeyPermissionCheck]::ReadWriteSubTree, $want) }
    catch [System.UnauthorizedAccessException], [System.Security.SecurityException] {
        # Nem o administrador pode mudar a permissao: assume a posse da chave (Administradores) e tenta de novo.
        [void][GzPolicyPrivilege]::Enable('SeTakeOwnershipPrivilege')
        [void][GzPolicyPrivilege]::Enable('SeRestorePrivilege')
        $key = [Microsoft.Win32.Registry]::Users.OpenSubKey($Path, [Microsoft.Win32.RegistryKeyPermissionCheck]::ReadWriteSubTree, $rights::TakeOwnership)
        try {
            $owner = New-Object System.Security.AccessControl.RegistrySecurity
            $owner.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
            $key.SetAccessControl($owner)
        } finally { $key.Close() }
        Write-InstallLog "Posse de $Path passada para Administradores (o administrador nao podia mudar a permissao)."
        return [Microsoft.Win32.Registry]::Users.OpenSubKey($Path, [Microsoft.Win32.RegistryKeyPermissionCheck]::ReadWriteSubTree, $want)
    }
}

function Repair-PolicyKey([string]$Sid, [string]$Name) {
    $path = "$Sid\Software\Microsoft\Windows\CurrentVersion\Policies\$Name"
    # Cria a chave so se ela nao existir (abrir para escrita uma chave bloqueada falharia aqui, antes do reparo).
    $exists = $true
    try { $probe = [Microsoft.Win32.Registry]::Users.OpenSubKey($path, $false); if ($probe) { $probe.Close() } else { $exists = $false } } catch { $exists = $true }
    if (!$exists) {
        $created = [Microsoft.Win32.Registry]::Users.CreateSubKey($path)
        if ($created) { $created.Close() }
        Write-InstallLog "Chave criada: HKEY_USERS\$path"
    }
    $key = Open-ForPermissions $path
    if (!$key) { throw "Chave nao encontrada: HKEY_USERS\$path" }
    try {
        $account = New-Object Security.Principal.SecurityIdentifier($Sid)
        $acl = $key.GetAccessControl($sections::Access)
        $changes = @()
        $deny = Get-DenySids $Sid
        foreach ($rule in @($acl.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier]))) {
            if ($rule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Deny -and $deny -contains $rule.IdentityReference.Value) {
                [void]$acl.RemoveAccessRuleSpecific($rule)
                $changes += ('regra de negar removida (' + $rule.IdentityReference.Value + ')')
            }
        }
        $allow = New-Object System.Security.AccessControl.RegistryAccessRule($account, $rights::FullControl,
            [System.Security.AccessControl.InheritanceFlags]::ContainerInherit, [System.Security.AccessControl.PropagationFlags]::None,
            [System.Security.AccessControl.AccessControlType]::Allow)
        $acl.AddAccessRule($allow)
        $key.SetAccessControl($acl)
        $check = $key.GetAccessControl($sections::Access)
        $ok = $false
        foreach ($rule in @($check.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier]))) {
            if ($rule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow -and $rule.IdentityReference.Value -eq $Sid -and (($rule.RegistryRights -band $rights::FullControl) -eq $rights::FullControl)) { $ok = $true }
        }
        if (!$ok) { throw "A permissao nao ficou gravada em HKEY_USERS\$path" }
        $detail = 'permissao total para a conta do PC'
        if ($changes.Count -gt 0) { $detail += '; ' + ($changes -join '; ') }
        Write-InstallLog "OK: Policies\$Name da conta $Sid ($detail)."
    } finally { $key.Close() }
}

try {
    $targets = @(Get-TargetSids | Where-Object { $_ -match '^S-1-5-21-' })
    if ($targets.Count -eq 0) { throw 'Nenhuma conta conectada ao Windows foi encontrada. Entre no Windows com a conta do PC e rode de novo.' }
    $done = @()
    foreach ($sid in $targets) {
        $hive = [Microsoft.Win32.Registry]::Users.OpenSubKey($sid)
        if (!$hive) { Write-InstallLog "Conta $sid sem perfil carregado (nao esta conectada); ignorada."; continue }
        $hive.Close()
        Repair-PolicyKey $sid 'System'
        Repair-PolicyKey $sid 'Explorer'
        $done += $sid
    }
    if ($done.Count -eq 0) { throw 'A conta do PC nao esta conectada ao Windows. Entre com ela e rode de novo.' }
    $message = 'OK: a conta do PC pode gravar de novo as restricoes do Windows (Gerenciador de Tarefas, Painel de Controle e opcoes de seguranca). Em ate 2 segundos o GameZoney Cliente aplica as restricoes e volta a ficar disponivel.'
    Write-InstallLog ('OK: ' + ($done -join ', '))
    Show-Result $message
    exit 0
} catch {
    $message = 'Falha ao liberar a permissao das restricoes do Windows: ' + $_.Exception.Message
    Write-InstallLog ('ERRO: ' + $_.Exception.Message)
    Show-Result $message
    exit 1
}
