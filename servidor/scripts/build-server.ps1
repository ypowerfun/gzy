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
    & $csc /nologo /target:winexe /out:ClearAll.exe /win32icon:gamezoney.ico /reference:System.Windows.Forms.dll ClearAll.cs
    if ($LASTEXITCODE -ne 0) { throw 'Falha no ClearAll.' }
    # 3.0.68: painel em janela própria (WebView2) e ícone do app embutido (bandeja e janela).
    & $csc /nologo /target:winexe /out:GameZoney.exe /win32icon:gamezoney.ico /resource:gamezoney.ico,gamezoney.ico /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:Microsoft.Web.WebView2.Core.dll /reference:Microsoft.Web.WebView2.WinForms.dll Launcher.cs
    if ($LASTEXITCODE -ne 0) { throw 'Falha no iniciador.' }
    if (!$SkipTests) {
        & $node (Join-Path $PSScriptRoot 'testServer.cjs')
        if ($LASTEXITCODE -ne 0) { throw 'Os testes falharam.' }
    }
    New-Item -ItemType Directory -Force -Path (Join-Path $serverRoot 'runtime'),$outputRoot | Out-Null
    # 1.0.2: instalador oficial do WebView2 Runtime (Evergreen, redistribuível) vai junto: o instalador do servidor
    # instala/atualiza o WebView2 no PC quando faltar. Baixado uma vez da Microsoft; a assinatura digital é conferida.
    $wv2Dir = Join-Path $serverRoot 'webview2'
    $wv2 = Join-Path $wv2Dir 'MicrosoftEdgeWebview2Setup.exe'
    New-Item -ItemType Directory -Force -Path $wv2Dir | Out-Null
    function Test-Wv2([string]$file) {
        if (!(Test-Path -LiteralPath $file)) { return $false }
        $sig = Get-AuthenticodeSignature -LiteralPath $file
        return ($sig.Status -eq 'Valid' -and $sig.SignerCertificate.Subject -match 'O=Microsoft Corporation')
    }
    if (!(Test-Wv2 $wv2)) {
        Write-Host 'Baixando o instalador oficial do WebView2 da Microsoft...'
        if (Test-Path -LiteralPath $wv2) { Remove-Item -LiteralPath $wv2 -Force }
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -UseBasicParsing -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $wv2
        if (!(Test-Wv2 $wv2)) {
            Remove-Item -LiteralPath $wv2 -Force -ErrorAction SilentlyContinue
            throw 'O instalador do WebView2 baixado não tem a assinatura válida da Microsoft. Confira a internet e gere de novo.'
        }
    }
    Write-Host 'OK  WebView2 (instalador oficial da Microsoft, assinatura conferida)'
    Copy-Item -LiteralPath $node -Destination (Join-Path $serverRoot 'runtime\node.exe') -Force
    # A short temporary path avoids the compiler's legacy path limits.
    $stageParent = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
    $stage = [IO.Path]::GetFullPath((Join-Path $stageParent ('GZ-BUILD-' + [Guid]::NewGuid().ToString('N').Substring(0,8))))
    if (!$stage.StartsWith($stageParent + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Área temporária inválida.' }
    New-Item -ItemType Directory -Path $stage | Out-Null
    try {
        Get-ChildItem -LiteralPath $serverRoot -File | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $stage }
        foreach ($folder in @('runtime','runtimes','public','certs','node_modules','webview2')) {
            Copy-Item -LiteralPath (Join-Path $serverRoot $folder) -Destination $stage -Recurse
        }
        & $InnoCompiler "/O$outputRoot" (Join-Path $stage 'installer.iss')
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar instalador do servidor.' }
    } finally {
        $resolvedStage = [IO.Path]::GetFullPath($stage)
        if ($resolvedStage.StartsWith($stageParent + '\GZ-BUILD-',[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedStage)) {
            Remove-Item -LiteralPath $resolvedStage -Recurse -Force
        }
    }
} finally { Pop-Location }
