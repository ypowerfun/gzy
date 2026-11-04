param([Parameter(Mandatory=$true)][string]$InnoCompiler)
$ErrorActionPreference = 'Stop'
$buildRoot = $PSScriptRoot
$nodeRuntime = (Get-Command node.exe -ErrorAction Stop).Source
$csharpCompiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
Push-Location $buildRoot
try {
    # 3.0.32: dependencias atualizadas para versoes sem vulnerabilidades conhecidas
    # (express 4.22+ e qs 6.14.1+). O npm resolve as versoes corrigidas e atualiza o package-lock.json,
    # depois o npm audit fix aplica as correcoes compativeis e o npm audit confere o resultado.
    & npm.cmd install --omit=dev --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar as dependências.' }
    & npm.cmd audit fix --omit=dev --no-fund
    if ($LASTEXITCODE -ne 0) { Write-Host 'Aviso: npm audit fix não conseguiu aplicar todas as correções automaticamente.' -ForegroundColor Yellow }
    & npm.cmd audit --omit=dev
    if ($LASTEXITCODE -ne 0) { throw 'Ainda existem vulnerabilidades nas dependências do servidor (veja o relatório do npm audit acima).' }
    Write-Host 'Dependências do servidor sem vulnerabilidades conhecidas.' -ForegroundColor Green
    & $csharpCompiler /nologo /target:exe "/out:$buildRoot\CertTool.exe" (Join-Path $buildRoot 'CertTool.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar gerador de identidade.' }

    # Os testes de backup executam BackupTool.exe diretamente. Por isso a ferramenta
    # precisa existir ANTES da suite de testes (no gerador anterior ela era compilada
    # somente depois, causando ENOENT em test/backups.test.js).
    & $csharpCompiler /nologo /target:exe "/out:$buildRoot\BackupTool.exe" /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:System.Web.Extensions.dll (Join-Path $buildRoot 'BackupTool.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar ferramenta de backup.' }
    if (-not (Test-Path -LiteralPath (Join-Path $buildRoot 'BackupTool.exe'))) { throw 'BackupTool.exe nao foi gerado antes dos testes.' }
    # 3.0.34: ClearAll.exe (limpa todos os registros, mantendo estacoes/pareamentos e configuracoes)
    & $csharpCompiler /nologo /target:winexe "/out:$buildRoot\ClearAll.exe" "/win32icon:$buildRoot\gamezoney.ico" /reference:System.Windows.Forms.dll (Join-Path $buildRoot 'ClearAll.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar ClearAll.exe.' }

    & $nodeRuntime --test test/*.test.js
    if ($LASTEXITCODE -ne 0) { throw 'Os testes falharam.' }
    New-Item -ItemType Directory -Path runtime -Force | Out-Null
    Copy-Item -LiteralPath $nodeRuntime -Destination (Join-Path $buildRoot 'runtime\node.exe')
    # 3.0.68: painel em janela própria (WebView2) e ícone do app embutido (bandeja e janela).
    & $csharpCompiler /nologo /target:winexe "/out:$buildRoot\GameZoney.exe" "/win32icon:$buildRoot\gamezoney.ico" "/resource:$buildRoot\gamezoney.ico,gamezoney.ico" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/reference:$buildRoot\Microsoft.Web.WebView2.Core.dll" "/reference:$buildRoot\Microsoft.Web.WebView2.WinForms.dll" (Join-Path $buildRoot 'Launcher.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o iniciador.' }

    # O Inno Setup 6 ainda pode falhar ao ler arquivos muito profundos de node_modules
    # quando o pacote foi aberto por uma visualizacao de ZIP/pasta temporaria. Para evitar
    # o limite de caminho do Windows, o empacotamento e feito a partir de uma pasta curta.
    $packageStage = Join-Path $env:TEMP ("GZ-SRV-PKG-" + $PID)
    $outputDir = Join-Path (Split-Path -Parent $buildRoot) 'outputs'
    try {
        if (Test-Path -LiteralPath $packageStage) {
            Remove-Item -LiteralPath $packageStage -Recurse -Force
        }
        New-Item -ItemType Directory -Force -Path $packageStage | Out-Null
        New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

        # Copia somente o que pode ser usado pelo instalador. Os testes e dados locais nao
        # precisam entrar na area de empacotamento. Os arquivos de topo incluem installer.iss,
        # firewall-installer.iss, icones, executaveis, scripts e documentacao.
        Get-ChildItem -LiteralPath $buildRoot -File | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination $packageStage -Force
        }
        foreach ($folderName in @('runtime', 'runtimes', 'public', 'certs', 'node_modules')) {
            $sourceFolder = Join-Path $buildRoot $folderName
            if (Test-Path -LiteralPath $sourceFolder) {
                Copy-Item -LiteralPath $sourceFolder -Destination $packageStage -Recurse -Force
            }
        }

        $stagedInstaller = Join-Path $packageStage 'installer.iss'
        if (-not (Test-Path -LiteralPath $stagedInstaller)) {
            throw 'installer.iss nao foi copiado para a area curta de empacotamento.'
        }

        Write-Host "Empacotando servidor a partir de caminho curto: $packageStage" -ForegroundColor Cyan
        & $InnoCompiler "/O$outputDir" $stagedInstaller
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o instalador.' }
    } finally {
        if (Test-Path -LiteralPath $packageStage) {
            Remove-Item -LiteralPath $packageStage -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
} finally { Pop-Location }
