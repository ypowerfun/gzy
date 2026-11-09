# Only declares functions. Used by the repair shortcut, by the installer fallback and by isolated tests.
# O instalador usa netsh (firewall-core.iss) com os MESMOS nomes de regra gerados aqui.

function Get-GzFirewallKey {
    param([string]$ProgramPath, [switch]$Legacy)
    $encoding = if ($Legacy) { [Text.Encoding]::UTF8 } else { [Text.Encoding]::Unicode }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($encoding.GetBytes($ProgramPath.ToLowerInvariant())))).Replace('-','').Substring(0,16) } finally { $sha.Dispose() }
}

# 1.2.5: rede da arena = sub-rede local + faixas PRIVADAS (10.x, 172.16-31.x, 192.168.x, 169.254.x).
# Antes era so 'LocalSubnet': PCs/TVs atras de outro roteador, switch gerenciado ou ponto de Wi-Fi com outra faixa
# (ex.: servidor 192.168.0.x e PC 192.168.1.x) eram bloqueados pelo firewall. Faixas privadas nao existem na internet.
$GzPrivateNetworks = @('LocalSubnet','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16','169.254.0.0/16')

function Get-GzFirewallPlan {
    param([ValidateSet('server','client')][string]$Role, [string]$InstallDirectory)
    $programPath = [IO.Path]::GetFullPath((Join-Path $InstallDirectory 'runtime\node.exe'))
    $key = Get-GzFirewallKey $programPath
    $legacyKey = Get-GzFirewallKey $programPath -Legacy
    $prefix = "GameZoney-$Role-$key"
    $common = @{ Program=$programPath; Profile='Any'; RemoteAddress=$GzPrivateNetworks; Action='Allow'; Enabled='True'; PolicyStore='PersistentStore' }
    if ($Role -eq 'server') {
        $definitions = @(
            @{ Key='https-in'; Direction='Inbound'; Protocol='TCP'; LocalPort='3443'; RemotePort='Any' },
            @{ Key='discovery-in'; Direction='Inbound'; Protocol='UDP'; LocalPort='3444'; RemotePort='Any' },
            @{ Key='discovery-out'; Direction='Outbound'; Protocol='UDP'; LocalPort='3444'; RemotePort='Any' }
        )
    } else {
        $definitions = @(
            @{ Key='https-out'; Direction='Outbound'; Protocol='TCP'; LocalPort='Any'; RemotePort='3443' },
            @{ Key='discovery-out'; Direction='Outbound'; Protocol='UDP'; LocalPort='Any'; RemotePort='3444'; RemoteAddress=@($GzPrivateNetworks + '255.255.255.255') },
            @{ Key='discovery-in'; Direction='Inbound'; Protocol='UDP'; LocalPort='Any'; RemotePort='3444' }
        )
    }
    foreach ($definition in $definitions) {
        $rule = $common.Clone()
        foreach ($property in $definition.Keys) { if ($property -ne 'Key') { $rule[$property] = $definition[$property] } }
        # EdgeTraversal so existe para regras de ENTRADA. Informar em regra de saida faz o Windows recusar a regra.
        if ($rule.Direction -eq 'Inbound') { $rule.EdgeTraversalPolicy = 'Block' }
        $rule.Name = "$prefix-$($definition.Key)"
        $rule.DisplayName = "GameZoney $Role - $($definition.Key) [$key]"
        $rule.Description = 'Comunicacao local do GameZoney. Perfis Publico, Privado e Dominio; rede local e programa desta instalacao.'
        # Nome usado pelas versoes anteriores; removido para nao deixar regras duplicadas.
        $rule.LegacyName = "GameZoney-$Role-$legacyKey-$($definition.Key)"
        $rule
    }
}

function Sync-GzFirewallRules {
    param([object[]]$Plan, [ValidateSet('Install','Remove')][string]$Action)
    $warnings = New-Object System.Collections.Generic.List[string]
    foreach ($entry in $Plan) {
        $rule = $entry.Clone()
        $legacyName = $rule.LegacyName
        $rule.Remove('LegacyName')
        foreach ($name in @($rule.Name, $legacyName) | Select-Object -Unique) {
            if (Get-NetFirewallRule -PolicyStore PersistentStore -Name $name -ErrorAction SilentlyContinue) {
                Remove-NetFirewallRule -PolicyStore PersistentStore -Name $name -ErrorAction Stop
            }
        }
        if ($Action -eq 'Remove') { continue }
        # Program/porta/endereco sao filtros separados no Firewall do Windows. Recriamos a regra
        # com o mesmo nome, tornando reinstalacoes idempotentes.
        New-NetFirewallRule @rule -ErrorAction Stop | Out-Null
        if (!(Get-NetFirewallRule -PolicyStore PersistentStore -Name $rule.Name -ErrorAction SilentlyContinue)) {
            throw "A regra $($rule.Name) nao foi gravada pelo Windows."
        }
        # Com politica de grupo que ignora regras locais a regra existe, mas nao fica efetiva.
        # Isso nao e falha da instalacao: apenas registramos o aviso.
        $effective = Get-NetFirewallRule -PolicyStore ActiveStore -Name $rule.Name -ErrorAction SilentlyContinue
        if (!$effective) { $warnings.Add("Aviso: a regra $($rule.Name) foi gravada, mas uma politica do Windows pode estar ignorando regras locais.") }
    }
    foreach ($warning in $warnings) { $warning }
}

# Remove regras GameZoney desta funcao que apontam para o mesmo programa (inclui nomes antigos).
function Remove-GzFirewallRulesForProgram {
    param([ValidateSet('server','client')][string]$Role, [string]$ProgramPath)
    $target = [IO.Path]::GetFullPath($ProgramPath)
    foreach ($rule in @(Get-NetFirewallRule -PolicyStore PersistentStore -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "GameZoney-$Role-*" })) {
        try {
            $filter = $rule | Get-NetFirewallApplicationFilter -ErrorAction Stop
            if ($filter.Program -and [string]::Equals([IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($filter.Program)), $target, [StringComparison]::OrdinalIgnoreCase)) {
                Remove-NetFirewallRule -PolicyStore PersistentStore -Name $rule.Name -ErrorAction SilentlyContinue
            }
        } catch { }
    }
}
