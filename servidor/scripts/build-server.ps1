param(
    [string]$InnoCompiler = "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    [switch]$SkipTests,
    [switch]$SkipDependencies
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$serverRoot = Join-Path $projectRoot 'server'
$outputRoot = Join-Path $projectRoot 'outputs'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
# 1.1.3: assinatura digital (só com certificado configurado em assinatura\config.ps1; sem ele nada muda)
$gzSignScript = Join-Path $projectRoot '..\assinatura\assinar.ps1'
if (Test-Path -LiteralPath $gzSignScript) { . $gzSignScript } else { function Invoke-GzSign([string[]]$Files) {}; function Get-GzInnoSignArgs { @() } }
if (!(Test-Path -LiteralPath $InnoCompiler)) { throw 'Informe o caminho do ISCC.exe do Inno Setup (7 ou 6) com -InnoCompiler.' }
Push-Location $serverRoot
try {
    & $node (Join-Path $PSScriptRoot 'prepare-server.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar versão.' }
    if (!$SkipDependencies) {
        & npm.cmd ci --ignore-scripts --no-audit --no-fund --cache (Join-Path $projectRoot 'tools\npm-cache')
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependências fixadas.' }
    }
    & $csc /nologo /target:exe /out:CertTool.exe CertTool.cs
    if ($LASTEXITCODE -ne 0) { throw 'Falha no CertTool.' }
    & $csc /nologo /target:exe /out:BackupTool.exe /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:System.Web.Extensions.dll BackupTool.cs
    if ($LASTEXITCODE -ne 0) { throw 'Falha no BackupTool.' }
    # 1.4.3: ClearAd (redefinir a senha do administrador principal) no lugar do ClearAll
    & $csc /nologo /target:winexe /out:ClearAd.exe /win32icon:gamezoney.ico /reference:System.Windows.Forms.dll /reference:System.Drawing.dll ClearAd.cs
    if ($LASTEXITCODE -ne 0) { throw 'Falha no ClearAd.' }
    # 3.0.68: painel em janela própria (WebView2) e ícone do app embutido (bandeja e janela).
    & $csc /nologo /target:winexe /out:GameZoney.exe /win32icon:gamezoney.ico /resource:gamezoney.ico,gamezoney.ico /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:Microsoft.Web.WebView2.Core.dll /reference:Microsoft.Web.WebView2.WinForms.dll Launcher.cs GzIntegrity.dev.cs
    if ($LASTEXITCODE -ne 0) { throw 'Falha no iniciador.' }
    if (!$SkipTests) {
        & $node (Join-Path $PSScriptRoot 'testServer.cjs')
        if ($LASTEXITCODE -ne 0) { throw 'Os testes falharam.' }
    }
    # 1.2.6: instalador oficial do WebView2 (Microsoft) vai junto: Windows sem Edge/WebView2 (ex.: Windows Server em VPS)
    # recebe o componente na instalação e o painel abre na janela própria, nunca no navegador. Baixado do link oficial da
    # Microsoft e aceito só com assinatura digital válida da Microsoft; a cópia fica guardada para as próximas gerações.
    $wv2 = Join-Path $serverRoot 'MicrosoftEdgeWebview2Setup.exe'
    $wv2Ok = { param($f) (Test-Path -LiteralPath $f) -and ((Get-AuthenticodeSignature -LiteralPath $f).Status -eq 'Valid') -and ((Get-AuthenticodeSignature -LiteralPath $f).SignerCertificate.Subject -match 'O=Microsoft Corporation') }
    if (!(& $wv2Ok $wv2) -or ((Get-Item -LiteralPath $wv2).LastWriteTime -lt (Get-Date).AddDays(-60))) {
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -UseBasicParsing -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile ($wv2 + '.download')
            if (& $wv2Ok ($wv2 + '.download')) { Move-Item -LiteralPath ($wv2 + '.download') -Destination $wv2 -Force; Write-Host 'OK  WebView2 (Microsoft) baixado e conferido.' -ForegroundColor Green }
            else { Remove-Item -LiteralPath ($wv2 + '.download') -Force -ErrorAction SilentlyContinue; throw 'assinatura da Microsoft não confere' }
        } catch {
            if (& $wv2Ok $wv2) { Write-Host ('AVISO WebView2: não foi possível atualizar (' + $_.Exception.Message + '); usando a cópia guardada.') -ForegroundColor Yellow }
            else { Remove-Item -LiteralPath $wv2 -Force -ErrorAction SilentlyContinue; Write-Host ('AVISO WebView2: não foi possível baixar (' + $_.Exception.Message + '). O instalador sai SEM ele; em Windows sem Edge o painel pede para instalar o WebView2.') -ForegroundColor Yellow }
        }
    } else { Write-Host 'OK  WebView2 (Microsoft) já guardado e conferido.' -ForegroundColor Green }
    New-Item -ItemType Directory -Force -Path (Join-Path $serverRoot 'runtime'),$outputRoot | Out-Null
    Copy-Item -LiteralPath $node -Destination (Join-Path $serverRoot 'runtime\node.exe') -Force
    # A short temporary path avoids the compiler's legacy path limits.
    $stageParent = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
    $stage = [IO.Path]::GetFullPath((Join-Path $stageParent ('GZ-BUILD-' + [Guid]::NewGuid().ToString('N').Substring(0,8))))
    if (!$stage.StartsWith($stageParent + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Área temporária inválida.' }
    New-Item -ItemType Directory -Path $stage | Out-Null
    try {
        Get-ChildItem -LiteralPath $serverRoot -File | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $stage }
        foreach ($folder in @('runtime','runtimes','public','certs','node_modules')) {
            Copy-Item -LiteralPath (Join-Path $serverRoot $folder) -Destination $stage -Recurse
        }
        # 1.0.7: proteção — embaralha o código na pasta temporária (o repositório não muda), gera a lista de SHA-256 e
        # compila de novo o GameZoney.exe com a lista embutida (arquivo alterado = o GameZoney não abre).
        $protect = Join-Path $projectRoot 'tools\protect'
        Push-Location $protect
        try {
            & npm.cmd ci --ignore-scripts --no-audit --no-fund --cache (Join-Path $projectRoot 'tools\npm-cache')
            if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar a ferramenta de proteção (tools\protect).' }
        } finally { Pop-Location }
        & $node (Join-Path $protect 'protect.cjs') $stage
        if ($LASTEXITCODE -ne 0) { throw 'Falha na proteção do código.' }
        Push-Location $stage
        try {
            & $csc /nologo /target:winexe /out:GameZoney.exe /win32icon:gamezoney.ico /resource:gamezoney.ico,gamezoney.ico /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:Microsoft.Web.WebView2.Core.dll /reference:Microsoft.Web.WebView2.WinForms.dll Launcher.cs GzIntegrity.cs
            if ($LASTEXITCODE -ne 0) { throw 'Falha no iniciador protegido.' }
        } finally { Pop-Location }
        Invoke-GzSign @('GameZoney.exe','BackupTool.exe','CertTool.exe','ClearAd.exe' | ForEach-Object { Join-Path $stage $_ })
        & $InnoCompiler @(Get-GzInnoSignArgs) "/O$outputRoot" (Join-Path $stage 'installer.iss')
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar instalador do servidor.' }
    } finally {
        $resolvedStage = [IO.Path]::GetFullPath($stage)
        if ($resolvedStage.StartsWith($stageParent + '\GZ-BUILD-',[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedStage)) {
            Remove-Item -LiteralPath $resolvedStage -Recurse -Force
        }
    }
} finally { Pop-Location }
