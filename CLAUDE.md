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
- Uso **somente na rede local** por enquanto; próximo passo planejado: servidor rodando **também em nuvem**.

## Decisões já tomadas (não desfazer sem pedir)
- 1.0.1 é a base (1.0.2–1.0.4 foram revertidas). Nomes internos `Gz*`/`GZ_*`; o servidor ainda aceita o cabeçalho antigo `X-Prime-Device` (PCs na 1.0.1) e restaura backups antigos (`prime-arena-full-backup`).
- Senha do servidor 4–24 caracteres; senhas em campos mascarados (`data-secret`), nunca `type=password`; WebView2 com salvar senha desligado.
- Confirmações pela caixa própria `ask()` (nunca `confirm()`/`alert()` do navegador — mostrava o IP).
- Menu: Painel de controle, Clientes, Fidelidade, Transferir/Remover, Configuração | Sessão/Log, Faturas, Estatística | Caixa, Produtos/Serviços (Vendas / Gerenciamento de Produtos / Gerenciamento de Serviços).
- Valor da hora + fuso: engrenagem do card "Valor da hora" no Painel de controle (mudar valor pede senha do administrador, `/api/settings` com `authPassword`). Configuração › **Servidor IP** (abaixo do Backup): botão Servidor IP (cabo/Wi-Fi/nuvem, `GET /api/network`) e **Atualizar Automático** (`POST /api/network/auto`: IP atual, portas 3000/3443/3444, firewall via `firewall.ps1`). Endereço/fuso padrão da máquina (`netinfo.js`). Quadros "Hora e funcionamento" e "Dados e segurança" removidos da Configuração.
- **Toda mudança atualiza o `GUIA-GAMEZONEY.md` junto** (servidor e cliente iguais).
- **Queda de internet/rede não encerra sessão**: PC sem conexão fica vermelho, a sessão continua e o tempo segue contando; servidor reiniciado espera 5 min pelos PCs (`pc.js`).

## Testes
- `cd servidor/server && npm ci && node --test test/*.test.js` — 2 testes só passam no Windows (backup completo e PC HTTPS: precisam de BackupTool.exe/cliente compilado).
- C#: compila com o csc do .NET Framework 4 (no Linux: `mcs -langversion:5`).
