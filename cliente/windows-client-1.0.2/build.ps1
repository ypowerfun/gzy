param([string]$InnoCompiler='')
$ErrorActionPreference='Stop'
$rootPath=$PSScriptRoot
# 2.0.57: gerar direto, sem digitar o caminho do Inno Setup. Sem -InnoCompiler, procura o ISCC.exe sozinho.
# 2.0.58: aceita o Inno Setup 7 (64 ou 32 bits) e o 6, instalado para todos (Arquivos de Programas) ou "somente para mim",
# ou em outra pasta (pelo registro de desinstalacao do Inno Setup) ou no PATH. Com -InnoCompiler, usa o caminho informado,
# como na 2.0.48. O restante deste build e o original da 2.0.48/2.0.49/2.0.50.
if (-not $InnoCompiler) {
    $candidatos = New-Object System.Collections.Generic.List[string]
    $pastas = @($env:ProgramW6432, $env:ProgramFiles, ${env:ProgramFiles(x86)})
    if ($env:LOCALAPPDATA) { $pastas += (Join-Path $env:LOCALAPPDATA 'Programs') }
    foreach ($versao in '7', '6') {
        foreach ($pasta in $pastas) { if ($pasta) { $candidatos.Add((Join-Path $pasta "Inno Setup $versao\ISCC.exe")) } }
        foreach ($raiz in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall') {
            try { $local = (Get-ItemProperty -LiteralPath (Join-Path $raiz "Inno Setup ${versao}_is1") -ErrorAction Stop).InstallLocation; if ($local) { $candidatos.Add((Join-Path $local 'ISCC.exe')) } } catch {}
        }
    }
    $noPath = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($noPath) { $candidatos.Add($noPath.Source) }
    foreach ($c in $candidatos) { if (Test-Path -LiteralPath $c -PathType Leaf) { $InnoCompiler = $c; break } }
    if (-not $InnoCompiler) { throw 'Inno Setup nao encontrado (procurado o Inno Setup 7 e o 6). Instale o Inno Setup (https://jrsoftware.org/isdl.php) e rode de novo, ou informe o caminho: .\build.ps1 -InnoCompiler "C:\...\ISCC.exe"' }
    Write-Host ('Inno Setup: ' + $InnoCompiler)
}

# Regressao 2.0.9-2.0.12: o evento Stop era criado sinalizado. O Monitor encerrava
# imediatamente e o Cliente falhava em OpenExisting com "Nao existe manipulador do nome fornecido".
$guardSource = Get-Content -LiteralPath (Join-Path $rootPath 'ClientGuard.cs') -Raw
# As validacoes abaixo devem considerar somente codigo executavel. Comentarios podem citar
# regressões antigas sem que isso signifique que o watchdog ainda dependa delas.
$guardCode = [regex]::Replace($guardSource, '(?s)/\*.*?\*/', '')
$guardCode = [regex]::Replace($guardCode, '(?m)//.*$', '')
if ($guardCode -match 'new EventWaitHandle\(true,EventResetMode\.ManualReset,"Local\\\\GameZoney\.Stop\.') {
    throw 'Falha de seguranca do build: o evento Stop do Monitor nao pode iniciar sinalizado.'
}
if ($guardCode -notmatch 'GameZoney\.Pulse\.') { throw 'Falha de seguranca do build: watchdog sem pulso da interface.' }
if ($guardCode -match '\.Responding') { throw 'Falha de seguranca do build: watchdog nao deve depender da propriedade Responding.' }
$csharp=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csharp /nologo /target:winexe "/out:$rootPath\GameZoneyCliente.exe" "/win32icon:$rootPath\gamezoney.ico" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Security.dll /reference:System.Web.Extensions.dll (Join-Path $rootPath 'Client.cs') (Join-Path $rootPath 'ClientTheme.cs') (Join-Path $rootPath 'RemoteControl.cs') (Join-Path $rootPath 'PasswordRegistration.cs') (Join-Path $rootPath 'SessionCleanup.cs') (Join-Path $rootPath 'SessionSecurity.cs')
if($LASTEXITCODE -ne 0){throw 'Falha ao compilar o cliente.'}
function Invoke-GzClientTest([string]$Mode,[string]$ResultPath,[string]$Description) {
    Remove-Item -LiteralPath $ResultPath -Force -ErrorAction SilentlyContinue
    $exe = Join-Path $rootPath 'GameZoneyCliente.exe'
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $exe
    $psi.Arguments = $Mode + ' "' + $ResultPath + '"'
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    if (-not $process.Start()) { throw ($Description + ' nao conseguiu iniciar o executavel de teste.') }
    if (-not $process.WaitForExit(30000)) {
        try { $process.Kill() } catch {}
        throw ($Description + ' excedeu 30 segundos e foi interrompido.')
    }
    $exitCode = $process.ExitCode
    $process.Dispose()
    if (-not (Test-Path -LiteralPath $ResultPath)) {
        throw ($Description + ' terminou com codigo ' + $exitCode + ', mas nao criou o arquivo de resultado.')
    }
    $result = (Get-Content -LiteralPath $ResultPath -Raw).Trim()
    if ($exitCode -ne 0 -or -not $result.StartsWith('PASS:', [System.StringComparison]::OrdinalIgnoreCase)) {
        throw ($Description + ' falhou. Codigo=' + $exitCode + '. Resultado: ' + $result)
    }
    Write-Host ($Description + ': ' + $result)
    Remove-Item -LiteralPath $ResultPath -Force -ErrorAction SilentlyContinue
}
$policyResult=Join-Path $env:TEMP ('gz-client-policy-'+[guid]::NewGuid().ToString('N')+'.txt')
Invoke-GzClientTest '/policy-test' $policyResult 'Autoteste de protecao do cliente'
$selfResult=Join-Path $env:TEMP ('gz-client-self-'+[guid]::NewGuid().ToString('N')+'.txt')
Invoke-GzClientTest '/selftest' $selfResult 'Autoteste do cliente'
& $csharp /nologo /target:winexe "/out:$rootPath\MonitorGZ.exe" (Join-Path $rootPath 'ClientGuard.cs')
if($LASTEXITCODE -ne 0){throw 'Falha ao compilar o monitor do cliente.'}
New-Item -ItemType Directory -Force (Join-Path $rootPath 'runtime') | Out-Null
Copy-Item -LiteralPath (Get-Command node.exe).Source -Destination (Join-Path $rootPath 'runtime\node.exe')
& $InnoCompiler (Join-Path $rootPath 'installer.iss')
if($LASTEXITCODE -ne 0){throw 'Falha ao gerar o instalador do cliente.'}
