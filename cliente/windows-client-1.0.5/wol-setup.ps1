# GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
# 1.0.7: deixa a placa de rede (cabo) pronta para o GameZoney Servidor ligar este PC pela rede (Wake-on-LAN).
#  - liga "Wake on Magic Packet" (e o WoL depois de desligar, quando a placa tem a opção) no Windows;
#  - desliga a "Inicialização rápida" do Windows, que em muitas placas impede ligar pela rede depois de Desligar.
# Também é preciso ativar o Wake-on-LAN na BIOS do PC (opção "Wake on LAN", "Power On By PCI-E" ou parecida).
# Nunca falha a instalação: o que a placa não aceitar fica como está.
$ErrorActionPreference = 'SilentlyContinue'
$log = Join-Path $env:ProgramData 'GameZoney\wol-setup.log'
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
"$(Get-Date -Format s) inicio" | Out-File -FilePath $log -Encoding utf8
foreach ($a in (Get-NetAdapter -Physical | Where-Object { $_.PhysicalMediaType -match '802\.3' -or $_.MediaType -eq '802.3' })) {
  Set-NetAdapterPowerManagement -Name $a.Name -WakeOnMagicPacket Enabled -NoRestart
  foreach ($k in '*WakeOnMagicPacket', 'S5WakeOnLan', 'WakeOnLink') {
    $p = Get-NetAdapterAdvancedProperty -Name $a.Name -RegistryKeyword $k
    if ($p -and $k -ne 'WakeOnLink') { Set-NetAdapterAdvancedProperty -Name $a.Name -RegistryKeyword $k -RegistryValue 1 -NoRestart }
  }
  # deixa a placa acordar o PC (Gerenciador de Dispositivos > Gerenciamento de energia)
  $pnp = Get-CimInstance -Namespace root/wmi -ClassName MSPower_DeviceWakeEnable | Where-Object { $_.InstanceName -like "*$($a.PnPDeviceID)*" }
  foreach ($w in $pnp) { Set-CimInstance -InputObject $w -Property @{Enable = $true} }
  "$(Get-Date -Format s) placa $($a.Name) $($a.MacAddress): WoL ligado" | Out-File -FilePath $log -Append -Encoding utf8
}
# Inicialização rápida desligada (o PC passa a desligar por completo; o resto do Windows não muda)
New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' -Name HiberbootEnabled -PropertyType DWord -Value 0 -Force | Out-Null
"$(Get-Date -Format s) inicializacao rapida desligada" | Out-File -FilePath $log -Append -Encoding utf8
exit 0
