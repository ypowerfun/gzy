param(
    [Parameter(Mandatory=$true)][string]$Installer,
    [Parameter(Mandatory=$true)][string]$Sha256,
    [int]$WaitPid = 0,
    [Parameter(Mandatory=$true)][string]$App,
    [string]$Log = ''
)
# GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
# 1.0.6: instala a atualização baixada pelo botão "Verificar atualização" (Configuração).
# Chamado pelo próprio servidor depois de baixar o instalador, conferir a assinatura/SHA-256 e fazer o backup completo.
#  1. Espera o servidor (node) e o GameZoney.exe fecharem (o servidor fecha sozinho com o código 75 de atualização).
#  2. Confere o SHA-256 do instalador DE NOVO (se o arquivo foi trocado, não instala).
#  3. Roda o instalador (o Windows pede a permissão de administrador). Os dados do servidor não são tocados.
#  4. Abre o GameZoney de novo (a versão nova, ou a antiga se a permissão foi negada ou algo falhou).
$ErrorActionPreference = 'Stop'
function Write-Log([string]$Message) { if ($Log) { try { Add-Content -LiteralPath $Log -Value ((Get-Date).ToString('s') + ' ' + $Message) -Encoding UTF8 } catch {} } }
function Open-GameZoney { try { Start-Process -FilePath (Join-Path $App 'GameZoney.exe') -WorkingDirectory $App } catch { Write-Log ('Falha ao abrir o GameZoney: ' + $_.Exception.Message) } }

Write-Log "Atualizacao: aguardando o servidor fechar (pid $WaitPid)."
if ($WaitPid -gt 0) { try { Wait-Process -Id $WaitPid -Timeout 90 -ErrorAction SilentlyContinue } catch {} }
$appFull = [IO.Path]::GetFullPath($App).TrimEnd('\') + '\'
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
    $running = @(Get-Process -Name 'GameZoney' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($appFull, [StringComparison]::OrdinalIgnoreCase) })
    if ($running.Count -eq 0) { break }
    Start-Sleep -Milliseconds 500
}

try { $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Installer).Hash.ToLowerInvariant() } catch { $hash = '' }
if ($hash -ne $Sha256.ToLowerInvariant()) {
    Write-Log 'Instalador diferente do conferido (SHA-256 nao confere): instalacao cancelada.'
    try { Remove-Item -LiteralPath $Installer -Force } catch {}
    Open-GameZoney
    exit 2
}

try {
    Write-Log ('Instalando ' + $Installer)
    $p = Start-Process -FilePath $Installer -ArgumentList '/SILENT', '/SUPPRESSMSGBOXES', '/NORESTART' -Wait -PassThru
    Write-Log ('Instalador terminou com o codigo ' + $p.ExitCode + '.')
} catch {
    Write-Log ('Instalacao nao iniciada (permissao de administrador negada?): ' + $_.Exception.Message)
}
Open-GameZoney
exit 0
