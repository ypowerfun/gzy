# GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
# 1.1.3: ASSINATURA DIGITAL (Authenticode) dos programas e instaladores do GameZoney.
# É ela que faz o Windows (SmartScreen e a tela de permissão de administrador) mostrar "Fornecedor: GameZoney" em vez de
# "Fornecedor desconhecido". Só funciona com um CERTIFICADO DE ASSINATURA DE CÓDIGO comprado de uma autoridade certificadora
# (Certum, Sectigo, DigiCert, GlobalSign…) no nome da empresa/pessoa. Veja assinatura\LEIA-ME-ASSINATURA.md.
#
# Sem certificado configurado, nada muda: os instaladores saem sem assinatura (como antes) e o gerador avisa.
# Configuração (NUNCA no Git): crie assinatura\config.ps1 (já está no .gitignore) com UMA das opções:
#   $env:GZ_SIGN_THUMBPRINT = 'impressão digital SHA-1 do certificado'   # certificado no Windows, token USB ou nuvem (SimplySign etc.)
#   $env:GZ_SIGN_PFX = 'C:\caminho\certificado.pfx'; $env:GZ_SIGN_PASSWORD = 'senha'   # arquivo .pfx (menos seguro)
# Opcionais: $env:GZ_SIGNTOOL = 'C:\...\signtool.exe'   $env:GZ_SIGN_TIMESTAMP = 'http://timestamp.digicert.com'
$gzConfig = Join-Path $PSScriptRoot 'config.ps1'
if (Test-Path -LiteralPath $gzConfig) { . $gzConfig }

function Get-GzSignTool {
    if ($env:GZ_SIGNTOOL -and (Test-Path -LiteralPath $env:GZ_SIGNTOOL)) { return $env:GZ_SIGNTOOL }
    $kits = @("${env:ProgramFiles(x86)}\Windows Kits\10\bin", "$env:ProgramFiles\Windows Kits\10\bin")
    foreach ($k in $kits) {
        if (!(Test-Path -LiteralPath $k)) { continue }
        $found = Get-ChildItem -LiteralPath $k -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match '\\x64\\' } | Sort-Object FullName -Descending | Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    $p = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($p) { return $p.Source }
    return $null
}

# devolve $null (sem assinatura) ou @{Tool; Args} — Args sem o arquivo
function Get-GzSigner {
    if (!$env:GZ_SIGN_THUMBPRINT -and !$env:GZ_SIGN_PFX) { return $null }
    $tool = Get-GzSignTool
    if (!$tool) { throw 'Assinatura digital configurada, mas o signtool.exe não foi encontrado. Instale o "Windows SDK" (só o item Signing Tools) ou informe $env:GZ_SIGNTOOL em assinatura\config.ps1.' }
    $ts = if ($env:GZ_SIGN_TIMESTAMP) { $env:GZ_SIGN_TIMESTAMP } else { 'http://timestamp.digicert.com' }
    $a = @('sign', '/fd', 'sha256', '/tr', $ts, '/td', 'sha256', '/d', 'GameZoney', '/du', 'https://gamezoney.com')
    if ($env:GZ_SIGN_THUMBPRINT) { $a += @('/sha1', ($env:GZ_SIGN_THUMBPRINT -replace '[^0-9A-Fa-f]', '')) }
    else {
        if (!(Test-Path -LiteralPath $env:GZ_SIGN_PFX)) { throw ('Certificado não encontrado: ' + $env:GZ_SIGN_PFX) }
        $a += @('/f', $env:GZ_SIGN_PFX); if ($env:GZ_SIGN_PASSWORD) { $a += @('/p', $env:GZ_SIGN_PASSWORD) }
    }
    return @{ Tool = $tool; Args = $a }
}

# assina os arquivos (.exe/.dll) e confere a assinatura; sem certificado só avisa
function Invoke-GzSign([string[]]$Files) {
    $s = Get-GzSigner
    if (!$s) { Write-Host 'Assinatura digital: sem certificado configurado (assinatura\config.ps1). O Windows vai mostrar "Fornecedor desconhecido".' -ForegroundColor Yellow; return }
    foreach ($f in $Files) {
        if (!(Test-Path -LiteralPath $f)) { continue }
        & $s.Tool @($s.Args + @($f)) | Out-Host
        if ($LASTEXITCODE -ne 0) { throw ('Falha ao assinar ' + $f) }
        & $s.Tool verify /pa /q $f | Out-Host
        if ($LASTEXITCODE -ne 0) { throw ('Assinatura de ' + $f + ' não confere.') }
        Write-Host ('Assinado: ' + [IO.Path]::GetFileName($f)) -ForegroundColor Green
    }
}

# parâmetros extras do ISCC: o Inno assina o instalador E o desinstalador (SignTool=gz no .iss, só com /DGzSign)
function Get-GzInnoSignArgs {
    $s = Get-GzSigner
    if (!$s) { return @() }
    $q = { param($x) if ($x -match '\s') { '$q' + $x + '$q' } else { $x } }
    $cmd = (& $q $s.Tool) + ' ' + (($s.Args | ForEach-Object { & $q $_ }) -join ' ') + ' $f'
    return @('/DGzSign', ('/Sgz=' + $cmd))
}
