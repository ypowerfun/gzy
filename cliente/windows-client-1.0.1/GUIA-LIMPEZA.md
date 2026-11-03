# Cliente 2.0.18 — encerramento de aplicativos por sessão

A limpeza agora usa o momento do login como linha de base.

- Processos que já estavam abertos antes do login são preservados.
- Jogos, aplicativos e launchers abertos depois do login passam a pertencer à sessão.
- Helpers e processos filhos iniciados durante a sessão também são acompanhados (por exemplo `steamwebhelper` e `GameOverlayUI`).
- Se um processo da sessão reiniciar com outro PID, a nova instância continua sendo reconhecida.
- Ao encerrar a sessão manualmente ou quando o tempo chegar a zero, somente os processos pertencentes àquela sessão são encerrados.
- Steam, Epic, Battle.net, Riot, Ubisoft, EA, GOG, ChatGPT e Discord só são encerrados se tiverem sido iniciados depois do login.
- Se algum deles já estava aberto antes do login, ele permanece aberto.
- Nenhum perfil, cookie, histórico, favorito, senha ou arquivo de navegador é apagado.

Compatibilidade: Cliente 2.0.18 / Servidor 3.0.15.

## Jogos com anticheat ao acabar o tempo — 2.0.59
Problema: ao acabar o tempo com o Fortnite aberto, o PC ficava em "Limpeza pendente. Procure a recepção:
FortniteClient-Win64-Shipping_EAC_EOS: Acesso negado; Programa ainda aberto: …". O EasyAntiCheat (e outros anticheats, ou
programas de serviço/administrador) não deixa outros programas encerrarem os processos dele, e o GameZoney roda com a conta do
PC, sem administrador.

Agora, para cada programa da sessão que o Windows não deixa fechar ("Acesso negado"):
1. o cliente pede para ele fechar normalmente (como clicar no X) e espera até 10 segundos;
2. se ele continuar aberto **sem janela** (processo de fundo, como o `…_EAC_EOS`), a limpeza termina e o PC é liberado. O nome do
   processo fica anotado em `%LOCALAPPDATA%\GameZoneyCliente\session-cleanup.log`;
3. se ele continuar com **janela aberta** (o jogo do cliente anterior na tela), o PC continua bloqueado, como antes, com a mensagem
   "o Windows não deixa o GameZoney fechar <programa> (proteção anticheat/administrador); feche esse programa na tela". Assim que
   a janela fechar, a próxima tentativa (a cada 2 s) libera o PC sozinha.

Programas comuns (sem proteção) continuam sendo fechados como antes, e os que já estavam abertos antes do login continuam
preservados.

