param(
    [Parameter(Mandatory=$true)][string]$InstallPath
)
$ErrorActionPreference = 'Stop'

$logDir = Join-Path $env:ProgramData 'GameZoney'
$logPath = Join-Path $logDir 'client-install.log'
function Write-InstallLog([string]$Message) {
    try {
        New-Item -ItemType Directory -Force -Path $logDir | Out-Null
        Add-Content -LiteralPath $logPath -Value ((Get-Date).ToString('s') + ' ' + $Message) -Encoding UTF8
    } catch {}
}

try {
    $root = [IO.Path]::GetFullPath($InstallPath).TrimEnd('\\')
    if (!(Test-Path -LiteralPath $root -PathType Container)) { throw 'Pasta de instalacao nao encontrada.' }

    # O programa fica oculto/protegido, mas todo usuario local precisa de leitura e execucao.
    # Aplicamos a ACL somente na raiz e depois fazemos os filhos herdarem dela. Isto evita
    # ACEs de negacao ou permissao incompleta que podem causar CreateProcess codigo 5.
    & "$env:SystemRoot\System32\icacls.exe" $root '/setowner' '*S-1-5-32-544' '/C' '/Q' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Falha ao definir proprietario da pasta (icacls=$LASTEXITCODE)." }

    & "$env:SystemRoot\System32\icacls.exe" $root '/inheritance:r' '/grant:r' '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' '/C' '/Q' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar permissoes da pasta (icacls=$LASTEXITCODE)." }

    $children = Join-Path $root '*'
    & "$env:SystemRoot\System32\icacls.exe" $children '/reset' '/T' '/C' '/Q' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Falha ao propagar permissoes aos arquivos (icacls=$LASTEXITCODE)." }

    & "$env:SystemRoot\System32\attrib.exe" '+H' '+S' $root | Out-Null

    # Validacao final: o executavel do monitor precisa continuar legivel/executavel.
    $monitor = Join-Path $root 'MonitorGZ.exe'
    $client = Join-Path $root 'GameZoneyCliente.exe'
    if (!(Test-Path -LiteralPath $monitor -PathType Leaf) -or !(Test-Path -LiteralPath $client -PathType Leaf)) {
        throw 'Executaveis do cliente nao encontrados apos a instalacao.'
    }
    Write-InstallLog "OK: pasta protegida com leitura/execucao para Usuarios. Path=$root"
    exit 0
} catch {
    Write-InstallLog ('ERRO: ' + $_.Exception.Message)
    exit 1
}
