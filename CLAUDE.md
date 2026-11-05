# GameZoney — contexto para o Claude (leia antes de mexer)

Software **proprietário e confidencial** da GameZoney. Não divulgar. Responder sempre em **português**.
Este repositório é só do **GameZoney**. A PRIME ARENA tem repositório e chat próprios (`ypowerfun/prime-arena`): não misturar.

## Regras do dono (valem para toda mudança)
- Qualquer modificação no cliente/servidor que mude **outra condição** (comportamento já existente): **relatar**. Se possível, não modificar o que já foi feito se não entrar no que foi pedido — e relatar.
- Manter todas as atualizações feitas até aqui; se alguma mudança puder **perder dados**, avisar antes.
- Instaladores gerados com **dois cliques** (`.cmd`), detectando sozinho o **Inno Setup 7 ou 6**. PCs que geram: `rcti2` (Inno 6) e `POWER` (Inno 7).
- Não usar espelhos para domínios bloqueados (contenção).
- Caddyfile: **não é usado** (era do app de celular, removido). Se um dia mudar, enviar o Caddyfile completo.
- Commits no `main` com mensagem clara; entregar o zip do código-fonte (`git archive`) ao final de cada atualização.

## Estado atual — versão 1.0.5 (Servidor e Cliente)
- `servidor/server/`: Node 24 + Express + SQLite (`node:sqlite`); painel em `public/` (app.js, *-ui.js, theme-gamezoney.css);
  `Launcher.cs` = GameZoney.exe (painel em janela própria **WebView2** — o Microsoft Edge/WebView2 precisa estar ativo no Windows do servidor; o dono usa Chrome como padrão).
- `cliente/windows-client-1.0.5/`: cliente C# WinForms (GameZoneyCliente.exe + MonitorGZ.exe) e `transport.js` (node.exe).
- `unico/` + `GERAR-INSTALADOR-UNICO.cmd`: instalador único (Servidor e/ou Cliente).
- Guia único: `GUIA-GAMEZONEY.md` (igual no servidor e no cliente — manter os dois iguais).
- `site/`: site **gamezoney.com** (Node + Express + SQLite próprio; VPS Oracle Ubuntu 22.04 ARM 137.131.177.64; domínio na HostGator; Caddy no VPS com `site/deploy/Caddyfile` — este Caddyfile é do site, não do app antigo). Contas por e-mail/senha ou Google, compra por PIX (Mercado Pago ou PIX manual confirmado em `/admin`) ou cartão de crédito/débito (Checkout do Mercado Pago, pedido `provider:'mercadopago-card'`); site em pt/en/es (`public/i18n-site.js` + `i18n-site-dict.js`, seletor no rodapé; capturas do painel em `public/img/telas/*-pt|en|es.jpg`); menu Recursos / Preços / Dúvidas / Novas Atualizações / Teste grátis, chaves de licença, ativação, downloads, suporte e feedback. Guia de instalação: `site/LEIA-ME-SITE.md`; testes: `cd site && npm ci && node --test test/*.test.js`.
- Uso **somente na rede local** por enquanto; próximo passo planejado: servidor rodando **também em nuvem**.

## Decisões já tomadas (não desfazer sem pedir)
- **Licença comercial** (`license.js`, `public/license-ui.js`): teste grátis de **30 dias** (início em `state.license.trialStartedAt` + cópia em `%LOCALAPPDATA%\GameZoney\gz-license.json`); licença **vitalícia R$ 89,90** (Black Friday) comprada em gamezoney.com; chave `GZ-XXXX-XXXX-XXXX-XXXX` ativada em Configuração › Licença → o site devolve certificado **Ed25519** preso ao `installId` (chave pública embutida em `license.js`; a privada `license-private.pem` fica só no VPS e com o dono — **nunca no Git**). Teste vencido: só bloqueia (402) `/api/credit`, `/start`, `/guest-start*`, `/shop/sale`, `/events`, `/events/pay`, `/events/start`, `/cash/open`, `/members`, `/members/import`, `/loyalty/redeem`; dados mantidos.
- Corujão/Viradão **sem campo Tipo**: o nome já diz (eventos novos `kind:'evento'`, sem prefixo; antigos mantêm "Corujão"/"Viradão").
- 1.0.1 é a base (1.0.2–1.0.4 foram revertidas). Nomes internos `Gz*`/`GZ_*`; o servidor ainda aceita o cabeçalho antigo `X-Prime-Device` (PCs na 1.0.1) e restaura backups antigos (`prime-arena-full-backup`).
- Senha do servidor 4–24 caracteres; senhas em campos mascarados (`data-secret`), nunca `type=password`; WebView2 com salvar senha desligado.
- Confirmações pela caixa própria `ask()` (nunca `confirm()`/`alert()` do navegador — mostrava o IP).
- Menu: Painel de controle, Clientes, Fidelidade, Corujão/Viradão, Transferir/Remover | Sessão, Log, Faturas, Estatística | Caixa (Caixa atual / Vendas / Caixas fechados), Produtos/Serviços (Estoque / Gerenciamento de Produtos / Gerenciamento de Serviços) | Ranking | Configuração. Vendas (PDV) continua na tela `shop` e Estoque na tela `cash`; as abas cruzadas ficam em `gzTabs()`/`gzNavView()` (cash-ui.js).
- "Pontos" virou **"Medalhas"** só nos textos (dados internos continuam `pointsMilli`, `loyaltyLedger`; importação aceita coluna antiga "Pontos fidelidade").
- **Corujão/Viradão** (`events.js`, `events-ui.js`): criar > adicionar participantes > confirmar pagamento (vira venda do PDV com item `kind:'event'`, entra no caixa; cancelar a venda desfaz o pagamento) > Iniciar (medalhas `settings.eventMedalsMilli`, definidas em Fidelidade > Medalhas Corujão/Viradão) > Encerrar. **Ranking** (`/api/ranking`): Top 10 Medalhas (conquistadas, sem descontar resgates), Top 10 Participação, Top 10 Recargas Mês.
- **Data e hora = as do computador do servidor** (relógio do Windows; `netinfo.timeZone()` usa o fuso da máquina, inclusive UTC, a cada início e no Atualizar Automático; nenhum "fuso" aparece na tela). Instalação nova vem com **Exemplo Console** (TV, id 1) e **Exemplo PC** (id 2); console removível por **Remover console** (`/api/station/remove`). Atualizar Automático informa se está disponível **localmente** ou **em nuvem** (domínio é mantido).
- Valor da hora: engrenagem do card "Valor da hora" no Painel de controle (mudar valor pede senha do administrador, `/api/settings` com `authPassword`). Configuração › **Servidor IP** (abaixo do Backup): botão Servidor IP (cabo/Wi-Fi/nuvem, `GET /api/network`) e **Atualizar Automático** (`POST /api/network/auto`: IP atual, portas 3000/3443/3444, firewall via `firewall.ps1`). Endereço/fuso padrão da máquina (`netinfo.js`). Quadros "Hora e funcionamento" e "Dados e segurança" removidos da Configuração.
- **Pagamento combinado** (`payments.js`): 2 a 3 formas, soma = total; venda fica `paymentMethod:'mixed'` + `payments:[{method,cents}]` (recarga, visitante e PDV; Visitantes em grupo e Corujão continuam com forma única). Caixa soma cada forma.
- **Enviar Mensagem** (Ações dos PCs, `POST /api/pc/message`): aviso entregue no `state` do PC (`messages`, janela de 60 s); cliente mostra em `SystemMessage.cs` (janela em camadas, click-through, sem foco, fonte Montserrat da pasta `fonts` do cliente ou fallback). `*texto*` = dourado.
- Menu lateral cabe em qualquer altura (Senha/Sair sempre visíveis; respeita o zoom automático `--fit-zoom` do `lockdown.js`).
- **Desinstalar o Servidor** (`uninstall-cleanup.iss`): pergunta; Sim apaga `{app}`, `%LOCALAPPDATA%\GameZoney\painel*` e `data` menos `data\backups` (cópia `antes-desinstalar-*.sqlite` antes); mantém Documentos\bkp gamezoney e `data-anterior-*`; silenciosa mantém dados.
- Telas não mostram porta: Servidor IP exibe só o IP/domínio (`gzHost()`), modal sem campo Porta (mantém a atual), Atualizar Automático usa nomes "Conexão das TVs/dos PCs/Busca dos PCs". Comprovante impresso sem cabeçalho/rodapé do navegador (`@page{margin:0}` no print).
- **Perfil** (botão no lugar de "Senha"; `#password-button` continua oculto): Alterar senha, **Idioma** (`public/i18n.js`: pt-BR/en/es/fr/ru, dicionário gerado em `public/i18n-dict.js` (`exact` + `patterns` com {0}…, aplicado por MutationObserver em textos e placeholder/title/aria-label, inclusive de textarea); cobre todas as telas, Estatística, Configuração e as mensagens do Log; ao criar texto novo no painel, incluir a tradução nos 4 idiomas; idioma por usuário em `operator.lang`, `POST /api/profile/lang`), **Ajuda** (https://gamezoney.com/) e **Feedback** (`feedback.js`, `POST /api/feedback`: guarda em `state.feedback` e envia a `GZ_FEEDBACK_URL` ou https://gamezoney.com/api/feedback com {id,name,email,comment,at,serverVersion,installId}; fila reenviada a cada 10 min).
- Produtos/Serviços > **Gerenciamento de Categoria** (`state.categories`, `/api/shop/category[/remove]`; renomear atualiza produtos; remover só sem produtos ativos). Cliente tem **email** opcional.
- Máquinas: só "Bloquear Gerenciador de Tarefas" e "Bloquear Configurações" (= `dateTime`); `controlPanel` e `securityOptions` sempre `false` (migração com nova revisão). Menu do ícone sem "Abrir no navegador"/"Abrir pasta de dados". Botões Exportar ficam ao lado dos filtros (Fidelidade, Sessão, Log).
- **Instaladores em inglês por padrão** (Servidor, Cliente e único): `ShowLanguageDialog=yes`, `LanguageDetectionMethod=none`, idiomas `english` (Default.isl, `INSTALACAO-en.txt`) e `brazilianportuguese` (`INSTALACAO.txt`); textos próprios em `[CustomMessages]` (`CustomMessage('Gz…')`/`{cm:Gz…}`); o único repassa `/LANG=` ao Servidor/Cliente. Nomes dos atalhos do menu Iniciar continuam em português.
- **Toda mudança atualiza o `GUIA-GAMEZONEY.md` junto** (servidor e cliente iguais).
- **Queda de internet/rede não encerra sessão**: PC sem conexão fica vermelho, a sessão continua e o tempo segue contando; servidor reiniciado espera 5 min pelos PCs (`pc.js`).

## Testes
- `cd servidor/server && npm ci && node --test test/*.test.js` — 2 testes só passam no Windows (backup completo e PC HTTPS: precisam de BackupTool.exe/cliente compilado).
- C#: compila com o csc do .NET Framework 4 (no Linux: `mcs -langversion:5`).
