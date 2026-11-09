$ErrorActionPreference='Stop'
. (Join-Path (Split-Path $PSScriptRoot) 'firewall-rules.ps1')
function Assert($Condition,$Message) { if (!$Condition) { throw $Message } }
$server=@(Get-GzFirewallPlan server 'C:\Arena Test\Servidor')
$client=@(Get-GzFirewallPlan client 'C:\Arena Test\Cliente')
foreach($rule in @($server)+@($client)) {
    Assert ($rule.Profile -eq 'Any') 'Todos os perfis devem ser incluidos'
    Assert ($rule.RemoteAddress -contains 'LocalSubnet') 'Alcance local obrigatorio'
    foreach($net in @('10.0.0.0/8','172.16.0.0/12','192.168.0.0/16')) { Assert ($rule.RemoteAddress -contains $net) "Sub-redes da arena (outros roteadores/Wi-Fi): $net" }
    Assert (!($rule.RemoteAddress -contains 'Any')) 'Nunca liberar para a internet'
    Assert ($rule.Program.EndsWith('\runtime\node.exe')) 'Programa deve ser limitado ao runtime'
    if ($rule.Direction -eq 'Inbound') { Assert ($rule.EdgeTraversalPolicy -eq 'Block') 'Entrada sem edge traversal' }
    else { Assert (!$rule.ContainsKey('EdgeTraversalPolicy')) 'Regra de saida nao pode informar edge traversal' }
    Assert ($rule.Name -match '^GameZoney-(server|client)-[0-9A-F]{16}-') 'Nome no formato usado pelo instalador (netsh)'
    foreach($key in $rule.Keys) { if($key -ne 'LegacyName'){ Assert ((Get-Command New-NetFirewallRule).Parameters.ContainsKey($key)) "Parametro New desconhecido: $key" } }
}
Assert (@($server|Where-Object {$_.Direction -eq 'Inbound' -and $_.LocalPort -eq '3443' -and $_.Protocol -eq 'TCP'}).Count -eq 1) 'HTTPS de entrada do servidor'
Assert (@($server|Where-Object {$_.Direction -eq 'Inbound' -and $_.LocalPort -eq '3000' -and $_.Protocol -eq 'TCP'}).Count -eq 1) 'Apps moveis pela rede local'
Assert (@($client|Where-Object {$_.Direction -eq 'Inbound' -and $_.Protocol -eq 'TCP'}).Count -eq 0) 'Cliente nao deve abrir servidor TCP'
Assert (@($client|Where-Object {$_.RemoteAddress -contains '255.255.255.255' -and $_.RemotePort -eq '3444' -and $_.Direction -eq 'Outbound'}).Count -eq 1) 'Broadcast somente para descoberta'
Assert ($server[0].Name -eq @(Get-GzFirewallPlan server 'c:\arena test\servidor')[0].Name) 'Nomes estaveis em atualizacao'
Assert ($server[0].Name -ne @(Get-GzFirewallPlan server 'C:\Outro servidor')[0].Name) 'Nao tocar outra instalacao'

# In-memory mocks. No Windows rule is read, added, updated or deleted below.
$legacy=$client[0].LegacyName
$script:rules=@{Unrelated=@{Enabled='True';Action='Allow'};$legacy=@{Enabled='True';Action='Allow'}};$script:created=0;$script:deny=$false;$script:inactive=$false
function Get-NetFirewallRule { [CmdletBinding()]param($PolicyStore,$Name);if($PolicyStore -eq 'ActiveStore' -and $script:inactive){return};if($script:rules.ContainsKey($Name)){[pscustomobject]$script:rules[$Name]} }
function Remove-NetFirewallRule { [CmdletBinding()]param($PolicyStore,$Name);$script:rules.Remove($Name) }
$params='[CmdletBinding()]param($Name,$DisplayName,$Description,$Program,$Profile,$RemoteAddress,$Action,$Enabled,$EdgeTraversalPolicy,$PolicyStore,$Direction,$Protocol,$LocalPort,$RemotePort);'
Set-Item Function:New-NetFirewallRule ([scriptblock]::Create($params+'if($script:deny){throw "Acesso negado simulado"};$script:created++;$script:rules[$Name]=@{Enabled=$Enabled;Action=$Action}'))
foreach($command in @('Get-NetFirewallRule','New-NetFirewallRule','Remove-NetFirewallRule')) { Assert ((Get-Command $command).CommandType -eq 'Function') 'Teste exige mocks, nao cmdlets reais' }
$w=@(Sync-GzFirewallRules $server Install)
Assert ($script:created -eq 4 -and $w.Count -eq 0) 'Criar quatro regras de servidor'
$w=@(Sync-GzFirewallRules $server Install)
Assert ($script:created -eq 8 -and $script:rules.Count -eq 6) 'Recriar sem duplicar'
$w=@(Sync-GzFirewallRules $client Install)
Assert (!$script:rules.ContainsKey($legacy)) 'Regra com nome antigo removida'
Assert ($script:rules.Count -eq 8) 'Servidor e cliente coexistem com regras externas'
$w=@(Sync-GzFirewallRules $server Remove)
Assert ($script:rules.Count -eq 4 -and $script:rules.ContainsKey('Unrelated')) 'Remover somente regras da instalacao'
$w=@(Sync-GzFirewallRules $server Remove)
Assert ($script:rules.Count -eq 4) 'Desinstalacao repetida sem efeitos extras'
$script:deny=$true;$caught=$false
try{Sync-GzFirewallRules $client Install | Out-Null}catch{$caught=$true}
Assert $caught 'Negacao deve informar falha';$script:deny=$false;$script:inactive=$true
$w=@(Sync-GzFirewallRules $client Install)
Assert ($w.Count -eq 3) 'Regra gravada mas ignorada por politica gera aviso, nao falha'
Write-Output 'PASS: escopo, perfis, edge traversal so na entrada, nomes do instalador, recriacao sem duplicar, limpeza de nome antigo, remocao restrita, recusa e aviso de politica. Nenhuma alteracao no firewall real.'
