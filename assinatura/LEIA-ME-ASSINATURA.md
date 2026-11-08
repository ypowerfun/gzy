# Assinatura digital do GameZoney ("Fornecedor: GameZoney" no Windows)

Quando alguém baixa e abre um instalador, o Windows (Microsoft Defender SmartScreen) mostra **"O Windows protegeu o computador … Fornecedor desconhecido"**.
Isso acontece com **todo** programa sem **assinatura digital de código** (Authenticode). Não é vírus e não é algo que se resolva no código do GameZoney: o nome do fornecedor só aparece quando o arquivo é assinado com um **certificado de assinatura de código** emitido por uma autoridade certificadora no nome da empresa (ou da pessoa).

## O que já está pronto no código
- Os programas (GameZoney.exe, GameZoneyCliente.exe, MonitorGZ.exe e as ferramentas) e os 3 instaladores levam **Empresa / Fornecedor: GameZoney**, produto, descrição, direitos autorais e o site gamezoney.com (aparece em Propriedades › Detalhes e em Programas instalados).
- Os geradores (`GERAR-INSTALADOR-UNICO.cmd`, do Servidor e do Cliente) **assinam sozinhos** os programas, os instaladores e os desinstaladores **assim que existir um certificado configurado**. Sem certificado, tudo funciona como antes (só aparece um aviso amarelo).

## Passo a passo
1. **Comprar o certificado de assinatura de código** (tipo "Code Signing", padrão OV) no nome da GameZoney (com CNPJ) ou no seu nome (pessoa física, alguns fornecedores aceitam). Exemplos de autoridades: Certum (tem opção barata com assinatura na nuvem "SimplySign"), Sectigo, DigiCert, GlobalSign. Desde 2023 a chave fica obrigatoriamente em **token USB** ou **na nuvem** do fornecedor (não vem mais como arquivo .pfx solto).
2. A autoridade confere os documentos (CNPJ/identidade, telefone, às vezes vídeo). Leva alguns dias.
3. No PC que gera os instaladores (POWER ou rcti2): instale o token/app do fornecedor e o **Windows SDK** (no instalador do SDK, marque só **Windows SDK Signing Tools for Desktop Apps**).
4. Abra `certmgr.msc` › Pessoal › Certificados, abra o certificado › Detalhes › **Impressão digital** e copie o código.
5. Crie o arquivo `assinatura\config.ps1` (ele **não vai para o Git**) com:
   ```powershell
   $env:GZ_SIGN_THUMBPRINT = 'COLE-AQUI-A-IMPRESSAO-DIGITAL'
   ```
   (Se o fornecedor entregar um .pfx: `$env:GZ_SIGN_PFX = 'C:\caminho\cert.pfx'` e `$env:GZ_SIGN_PASSWORD = 'senha'`.)
6. Rode o `GERAR-INSTALADOR-UNICO.cmd` normalmente. Aparece "Assinado: …" em verde para cada arquivo.

## Importante
- Com o certificado, o Windows passa a mostrar **Fornecedor: GameZoney** (inclusive na tela de permissão de administrador). O SmartScreen ainda pode mostrar o aviso azul nos primeiros downloads até o certificado ganhar **reputação** (vai sumindo conforme mais pessoas baixam e instalam; não há como pular essa etapa).
- Nunca envie o certificado, a senha ou o `config.ps1` por chat ou para o Git.
- Até lá: no aviso azul, **Executar assim mesmo** (em algumas versões do Windows, antes clique em **Mais informações**) instala normalmente.
