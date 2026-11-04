# GameZoney Servidor 3.0.70 — gerar o instalador

> Software proprietário e confidencial da GameZoney. Não divulgar.

Esta pasta é o código completo do Servidor **3.0.70** (painel em janela própria, ícone igual ao do app do celular,
proteção da rede da arena e servidor do app abrindo junto com o servidor), pronto para gerar `GameZoney-Servidor-3.0.70-Setup.exe`.

## O que instalar no PC (uma vez só)
1. **Node.js 24 LTS** — https://nodejs.org (marque o npm na instalação).
   Ele também vai dentro do instalador, como o "motor" do servidor.
2. **Inno Setup 7 ou 6** — https://jrsoftware.org/isdl.php (o gerador acha sozinho o 7 ou o 6, instalado para todos ou "somente para mim").
3. **.NET Framework 4.x** — já vem no Windows 10/11.

## Gerar
1. Extraia esta pasta num caminho curto, por exemplo `C:\PA\`.
2. **Dois cliques em `GERAR-INSTALADOR-SERVIDOR.cmd`** — não precisa digitar nenhum comando.
   (Também funciona digitando, dentro desta pasta: no CMD `GERAR-INSTALADOR-SERVIDOR.cmd`; no PowerShell `.\GERAR-INSTALADOR-SERVIDOR.cmd`.)
   Se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações → Executar assim mesmo**
   (acontece com arquivos baixados; para evitar, antes de extrair: botão direito no .zip → Propriedades → **Desbloquear**).
3. Ele confere os programas, confere se tudo está na versão 3.0.70, baixa as dependências fixadas (npm),
   compila as ferramentas (.exe), compila o cliente Windows para o teste nativo, roda todos os testes e
   gera o instalador em **`outputs\GameZoney-Servidor-3.0.70-Setup.exe`**.
   Leva de 3 a 10 minutos. Se algum teste falhar, o instalador NÃO é gerado — envie a mensagem para análise.

## Instalar na arena
1. Painel → Backup → fazer backup. Feche o servidor (ícone perto do relógio → Sair).
2. Execute o `GameZoney-Servidor-3.0.70-Setup.exe` **na mesma conta do Windows** e **na mesma pasta**
   da instalação atual (`C:\GameZoneyServidor`). Os dados (`%LOCALAPPDATA%\GameZoney\data`) são preservados.
3. O painel deve abrir na janela própria do GameZoney e mostrar **SERVER // 3.0.70** (na primeira abertura, faça o login do painel de novo).

> Quem já aplicou a atualização rápida 3.0.70 (script) não precisa reinstalar: o instalador serve para
> instalações novas e para manter o padrão de distribuição.

## O que mudou no código (3.0.50 → 3.0.70)
- 3.0.70 app SV retirado: `server/mobile.js` (todo `/mobile/admin*` responde 410 com aviso), `network-guard.js` (HTTPS público só `/mobile`), `public/mobile/admin-bridge.js` e `admin.css` apagados, `mobile-settings-ui.js` (textos), testes `test/mobile.test.js`, `test/network-guard.test.js`, `test/web-client.test.js`.
- 3.0.69 app do cliente só nativo: `server/mobile.js` (opção `webClient`, desligada por padrão: a página `/mobile/client` e seus scripts respondem 410 com aviso; `/mobile/api` e o app SV continuam), `public/mobile-settings-ui.js` (caixa "Permitir o app do cliente pelo navegador"), testes `test/web-client.test.js` e `test/network-guard.test.js`.
- 3.0.68 painel em janela própria: `server/Launcher.cs` (classes `PanelHost`/`PanelWindow` com o WebView2; fechar esconde a janela; atalho aberto de novo mostra a mesma janela; reserva no Edge/navegador; menu "Abrir no navegador"; Edge procurado também em Arquivos de Programas e no registro; nitidez em telas com escala), arquivos do WebView2 SDK 1.0.4314.35 da Microsoft (`Microsoft.Web.WebView2.Core.dll`, `Microsoft.Web.WebView2.WinForms.dll`, `runtimes\win-x64|win-x86\native\WebView2Loader.dll`, licença em `LICENSE-webview2.txt`), `prime.ico` novo (o ícone do app do celular, 16 a 256 px, embutido no GameZoney.exe), `installer.iss`, `scripts/build-server.ps1` e `server/build.ps1` (compilação com o WebView2 e pasta `runtimes`), gerador com Inno Setup 7 ou 6, testes `test/installer-files.test.js` e `test/PanelWindowRegression.cs`.
- 3.0.67 produtos e PDV: `server/shop.js` (margem de lucro e preço arredondado para cima no real inteiro), `public/shop-ui.js` (campo de margem com cálculo na hora, coluna Margem, confirmação "Deseja realmente finalizar a venda?"), `public/theme-prime.css`, teste em `test/shop.test.js`.
- 3.0.63 rankings do site de volta: `server/rankings.js` (restaurado da 3.0.60), `mobile.js` (rota `/mobile/api/rankings` e endereço nas configurações), `server.js` (sem `/api/medal-ranking`), `public/mobile-settings-ui.js`, `client.html/js/css` (aba Ranking do site com a logo; sem seleção de texto/imagens), `installer.iss` (troca `medal-ranking.js` por `rankings.js`), teste `test/rankings.test.js`. `medal-ranking.js` removido.
- 3.0.62 app do cliente: `client.html/js/css` (nome sem "Olá", avisos com X, engrenagem com Suporte/WhatsApp e Sair, logo no ranking).
- 3.0.61 ranking de medalhas do servidor (`server/medal-ranking.js`, novo: Top 10 pelos pontos do Programa Fidelidade) e aba Torneios (`server/tournaments.js`, novo: busca e confere `/api/torneios` do site); `mobile.js` (rotas `/mobile/api/ranking` e `/mobile/api/torneios`), `server.js` (`/api/medal-ranking` para a recepção), `public/mobile-settings-ui.js`, `client.html/js/css`, arte `public/mobile/art/trophy-gold.webp`, `installer.iss` (troca `rankings.js` por `medal-ranking.js` e `tournaments.js`), testes `test/medal-ranking.test.js` e `test/tournaments.test.js`. `rankings.js` (site) removido.
- 3.0.60 aba Ranking: `server/rankings.js` (novo: busca e confere o JSON do site), `mobile.js` (rota `/mobile/api/rankings` e endereço nas configurações), `public/mobile-settings-ui.js`, `client.html/js/css` (aba Ranking com pódio), `installer.iss` (inclui `rankings.js`), `GUIA-APPS.md`, testes `test/rankings.test.js`.
- 3.0.59 cartões de vidro meio transparente: `client.css` (token `--card-bg` com transparência, `--glass` com desfoque leve).
- 3.0.58 fundos oficiais enviados pela GameZoney: `server/public/mobile/art/bg-entrada.webp` (carregamento/login) e `bg-app.webp` (dentro do app) em `client.css`; `client.html` sem os feixes desenhados; `network-guard.js` libera os dois arquivos.
- 3.0.57 layout das quatro telas de referência: ilustrações em `server/public/mobile/art/*.webp` (desenhadas por `scripts/gerar-ilustracoes.cjs`; `station-pc.webp` e `station-console.webp` recortadas da imagem enviada pela GameZoney), `client.css`, `client.html` (sino de avisos, Sair dentro do painel), `client.js` (avisos com dados reais, ilustrações por tipo/estado), `network-guard.js` (libera os arquivos de `/mobile/art`).
- 3.0.56 visual refinado pelas imagens de referência: `client.css` (feixes de laser, fonte pesada, neon), `client.html` (frase no carregamento, olho da senha, gabinete na saudação), `client.js` (silhueta nas estações, monitor no histórico).
- 3.0.55 Premium Gaming UI: `server/public/mobile/client.css` (reescrito, sistema de design), `client.html`, `client.js`
  (só o desenho das telas), `fonts/` (Rajdhani, OFL) e `tests/mobile-ui.test.cjs` (teste novo).
- `server/public/mobile/client.css` (tema PRIME no fim do arquivo), `client.html`, `app-shell.js`, `emblem.png`:
  visual premium nas cores da logo, cabeçalho compacto e sem espaço em dobro dentro dos apps.
- `server/Launcher.cs` (GameZoney.exe): abre o Caddy de `C:\GameZoneyHTTPS` escondido junto com o servidor, reabre se
  cair, fecha junto; menu do ícone, abaixo de "Abrir diagnóstico": estado do servidor do app, "Reiniciar servidor do app" e
  "Diagnóstico do servidor do app" (`https.log`).
- `server/network-guard.js` (novo): o que cada aparelho da rede alcança.
- `server/server.js`, `server/mobile.js`: proteção ligada; app SV só por HTTPS público.
- `server/public/mobile/`: manifesto, ícones e aviso de instalação no iPhone; `client.html` com as marcações.
- `server/public/mobile-settings-ui.js`: opção "Permitir o app do cliente pela rede local".
- Versão 3.0.70 em `package.json`, `package-lock.json`, `installer.iss`, `Launcher.cs`, `INSTALACAO.txt`, `index.html`.
- `server/test/network-guard.test.js` (novo) e `server/test/mobile.test.js`.
- `scripts/prepare-server.cjs`: agora confere a versão 3.0.70 (antes forçava 3.0.50) e os arquivos do WebView2.

Ficaram de fora deste pacote, de propósito: `outputs\` (instaladores e APKs antigos), `native\` (Android
antigo) e `tools\signing\` (chave de assinatura antiga — guarde-a offline, nunca em zips).
