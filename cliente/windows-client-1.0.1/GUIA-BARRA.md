# GameZoney Cliente — barra superior

Atualize somente o cliente dos PCs. O Servidor 2.5.0 permanece compatível.

1. No PC, abra Manutenção / recepção e informe a senha local.
2. Escolha encerrar o cliente.
3. Execute GameZoney-Cliente-1.5.1-Setup.exe e instale por cima da versão atual, na mesma conta do Windows.
4. Abra o cliente e inicie uma sessão. Confira um navegador maximizado e os ícones da área de trabalho.

A barra reserva uma faixa de 48 pixels no monitor principal através do mecanismo AppBar do Windows. Aplicativos que respeitam a área útil, incluindo janelas maximizadas, passam a ocupar o espaço abaixo dela. A reserva é liberada quando a barra é ocultada, na manutenção ou ao fechar o cliente. A associação e o fundo de login existentes são preservados.

Se uma janela antiga permanecer na posição anterior, restaure e maximize novamente. Ícones posicionados manualmente podem precisar de um ajuste de posição. Jogos e navegadores em tela cheia (F11) não seguem necessariamente a área útil das janelas; esta correção é para o uso normal da área de trabalho e aplicativos maximizados.

Verificação: compilação, simulação das chamadas ao Windows para registro/reserva/liberação/reabertura, testes nativos de login, manutenção e fundo em desktop isolado, e verificação do executável extraído do instalador. O teste com o Explorer real, Chrome e ícones deve ser realizado no PC da arena; não alteramos a área útil do computador de desenvolvimento.

Referência técnica Microsoft: https://learn.microsoft.com/en-us/windows/win32/shell/abm-querypos

## Jogos em tela cheia — 2.0.18
Durante uma sessão, a barra de tempo deixa de reservar espaço e perde a prioridade de janela quando um jogo/aplicativo em tela cheia ou borderless está em primeiro plano. Assim o jogo pode ocupar a tela inteira. Ao voltar para o desktop ou para uma janela normal, a barra retorna automaticamente.

## Barra fixa e área de trabalho — 2.0.21
A área de trabalho do Windows não é mais confundida com um aplicativo em tela cheia. Sem jogo/aplicativo em tela cheia em primeiro plano, a barra permanece fixa no topo, por cima das janelas e com a faixa de 48 px reservada. Ela só vai para trás quando um jogo/aplicativo em tela cheia ou borderless fica em primeiro plano de forma estável (1 segundo), e volta 0,7 segundo depois de sair dele. Desktop, barra de tarefas, Menu Iniciar e Alt+Tab nunca contam como tela cheia.

## Jogos em tela cheia exclusiva — 2.0.23
A barra não ativa mais a si mesma ao sair da frente do jogo (a troca de prioridade é feita sem roubar o foco). Jogos como League of Legends podem ficar em tela cheia sem minimizar para a área de trabalho. A barra sai da frente imediatamente quando o jogo entra em tela cheia e volta 1,5 segundo depois de o jogo sair dela.

## Barra sempre fixa — 2.0.26
- A barra de tempo fica **sempre fixa no topo**. Ela só sai quando um **jogo em tela cheia** ou uma **janela em tela cheia (sem bordas, cobrindo o monitor inteiro)** está em primeiro plano.
- Janelas maximizadas comuns (navegador, Steam, Discord, launchers dos jogos) **não** escondem mais a barra.
- Entrou no jogo em tela cheia: a barra sai na hora, para não ficar por cima do jogo.
- Voltou para a área de trabalho ou para uma janela normal: a barra reaparece fixa **após 1 segundo**.
- Voltou para o jogo: a barra sai de novo imediatamente.

## Tela cheia em janela (CS2 e similares) — 2.0.38
A barra também some quando o jogo está em **tela cheia em janela / sem bordas** (ex.: CS2 "Tela cheia em janela").
O cliente considera tela cheia quando qualquer um destes acontece com a janela em primeiro plano:
- jogo DirectX em tela cheia exclusiva (informado pelo Windows);
- janela cobrindo o monitor inteiro (ou empurrada só pela faixa da barra);
- **área útil** da janela cobrindo o monitor inteiro (jogos que mantêm estilo de janela ou ficam maiores que o monitor);
- o Windows informando "aplicativo em tela cheia" com a janela cobrindo o monitor.
Janela maximizada comum (Steam, Discord, navegador) continua com a barra visível.

Diagnóstico: durante a sessão o cliente grava em `%LOCALAPPDATA%\GameZoneyCliente\fullscreen.log` uma linha a cada
mudança de janela em primeiro plano (processo, posição, área útil e a decisão "barra some/fica").

## Resoluções aceitas em tela cheia em janela — 2.0.39
Jogo **sem bordas** (sem barra de título, não maximizado, dentro do monitor) com uma destas resoluções, com o monitor
entre **60 Hz e 240 Hz**, também esconde a barra, mesmo que seja menor que o monitor:
1920x1080 · 1600x900 · 1536x864 · 1360x768 · 1366x768 · 800x600 · 1024x768 · 1280x800 · 1440x900 · 1680x1050 ·
1920x1200 · 2560x1600 · 1280x1024 · 640x800 (tolerância de 2 pixels).
Jogo em janela comum (com barra de título) nessas resoluções não esconde a barra.

## Jogos x gerenciadores x navegadores — 2.0.40 (todas as regras anteriores continuam valendo)
Barra SOME (jogo em tela cheia ou tela cheia em janela, sem bordas): LoL, VALORANT, CS2, Dota 2, Battlefield, jogos da
Steam, Epic, EA, Ubisoft etc. Regras novas somadas às anteriores:
- janela de 1x1 pixel no canto do monitor (League of Legends em tela cheia exclusiva);
- área útil com o tamanho exato do monitor, deslocada poucos pixels (CS2/Dota 2 em -8,-8).
Barra FICA sempre: navegadores (Chrome, Edge, Firefox, Brave, Opera, Opera GX, Vivaldi...) e gerenciadores/lançadores
(Steam, Epic Games Launcher, Riot Client, cliente do LoL, EA app, Ubisoft Connect, Battle.net, GOG Galaxy, Rockstar,
Xbox app, Discord, Overwolf, Playnite, GeForce NOW, FACEIT, Gamers Club), mesmo em tela cheia; e jogos em janela comum.

## Tolerância automática de 128 pixels e ajuste do jogo — 2.0.41 (todas as regras anteriores continuam valendo)
- Jogo **sem bordas** (sem barra de título visível), não maximizado, cuja área fica a **até 128 px** de cada borda do
  monitor conta como tela cheia: a barra some. Vale para qualquer jogo (LoL, CS2, Dota 2, VALORANT, Battlefield...).
- **Ajuste automático:** com a barra escondida, se o jogo sem bordas ficou deslocado ou menor (até 128 px), o cliente
  alinha a janela do jogo ao monitor (posição 0,0 e tamanho da tela). No máximo 3 ajustes por janela; não mexe em
  tela cheia exclusiva nem em jogos em janela comum. Cada ajuste é anotado no fullscreen.log.
- Navegadores e gerenciadores (Steam, Epic, Riot, cliente do LoL...) continuam sempre com a barra.

## Modelo NexCafé — 2.0.42
- **Barra flutuante no topo, sempre por cima:** não reserva mais a faixa do topo; a cada 250 ms reafirma "sempre no topo"
  sem roubar o foco.
- **Jogo sem borda / tela cheia em janela:** a barra continua visível por cima do jogo e o **clique atravessa a barra**
  (o jogo recebe o clique; sem "bug de foco"). Todas as regras de reconhecimento de jogo das versões 2.0.26 a 2.0.41
  continuam sendo usadas para saber que é um jogo.
- **Tela cheia exclusiva:** a barra se oculta (Windows informa jogo DirectX exclusivo, ou janela 1x1 do LoL) e volta
  ao dar Alt+Tab (1 s).
- **Desktop, navegador, gerenciadores (Steam, Epic, Riot...), jogo em janela comum:** barra normal, botões clicáveis.
- fullscreen.log mostra: "TELA CHEIA EXCLUSIVA (barra some)" / "JOGO SEM BORDA (barra por cima, clique atravessa)" /
  "normal (barra fica)".

## Modo administrador — 2.0.43
As regras da barra (exclusiva = some; sem borda = por cima com clique atravessando) agora valem também no
MODO ADMINISTRADOR. Antes, logado como admin, a barra nunca mudava (ficava sempre por cima do jogo).

## 2.0.44 — barra some em tela cheia E em tela cheia sem borda
- Tela cheia exclusiva → barra some. Tela cheia sem borda (tela cheia em janela) → barra some também.
- Volta ao dar Alt+Tab / voltar para a área de trabalho (1 s). Vale na sessão do cliente e no modo administrador.
- Mantido do modelo NexCafé (2.0.42): barra flutuante sempre no topo (sem reservar espaço) no desktop, navegador,
  gerenciadores e jogos em janela comum.

## 2.0.45 — barra encaixada na área de trabalho
- Na área de trabalho (desktop, navegador, apps, jogos em janela) a barra volta a RESERVAR a faixa do topo: ícones do
  desktop e janelas maximizadas ficam abaixo dela, sem nada por baixo da barra.
- Em jogo (tela cheia ou sem borda) a reserva é liberada e a barra some (2.0.44); ao voltar, a faixa é reservada de novo.

## 2.0.46 — reação imediata ao abrir o jogo
- O cliente é avisado pelo Windows na hora em que a janela em primeiro plano muda ou muda de tamanho/posição
  (além da verificação a cada 500 ms): a barra some e libera o topo antes de o jogo se acomodar na faixa reservada.
- Jogo empurrado até 128 px: alinhado ao monitor e mantido à frente da barra. Até 3 tentativas a cada vez que se entra
  no jogo (zeram ao voltar para a área de trabalho), com intervalo mínimo de 300 ms.

## 2.0.47 — barra volta ao sair do jogo
- Ao fechar/minimizar o jogo, a barra volta na hora. Ao dar Alt+Tab, volta em 1 s.
- O aviso de "tela cheia" do Windows pode ficar preso depois que o jogo fecha; agora ele só vale se a janela em
  primeiro plano realmente cobre o monitor (ou é a janela 1x1 do LoL).
- fullscreen.log registra "BARRA: escondida" e "BARRA: voltou".
- Alt+F4 não fecha a barra; o aviso aparece com a barra visível e não trava a atualização. Enquanto escondida, a barra
  é reconferida a cada 250 ms, então Alt+Tab não a deixa presa escondida.

## 2.0.49 — troca de resolução no jogo + Alt+Tab
- O tamanho da tela é lido direto do Windows a cada verificação (antes podia ficar o tamanho antigo em memória depois de o
  jogo trocar a resolução, e janelas comuns pareciam "tela cheia", mantendo a barra escondida).
- Ao mudar a resolução da tela, a barra refaz a reserva do topo com o tamanho novo.
- Vigia a cada 250 ms: barra visível fora da tela, com altura errada ou largura diferente da tela é recolocada no topo.
- Em sessão ou modo admin, se a barra estiver oculta fora do jogo, ela é exibida de novo.

## 2.0.54 — barra volta na hora e Ctrl+Alt+T reinicia a barra
- **Volta na hora:** ao dar **Alt+Tab** ou **fechar** o jogo/aplicativo em tela cheia ou tela cheia em janela (sem borda), a barra
  aparece **na hora** (antes esperava 1 segundo). Entrar em tela cheia continua escondendo na hora.
- **Ctrl+Alt+T fora de tela cheia = pequena reinicialização da barra:** se por algum motivo a barra sumir com o cliente na área de
  trabalho (ou num aplicativo em janela), o atalho a traz de volta na hora: desfaz a trava de tela cheia, tira o clique
  atravessando, mostra a barra (se a sessão estiver ativa), refaz o aviso do Windows e recoloca no lugar — aberta no topo ou
  recolhida na barra de tarefas, como estava. Na tela de login o atalho não mostra a barra.
- **Ctrl+Alt+T em tela cheia** (jogo/aplicativo de verdade na frente): continua a barra pequena por 5 s; apertar de novo esconde.
- O log da barra registra "BARRA: Ctrl+Alt+T - barra reiniciada".

## 2.0.53 — barra some no F11 e na tela cheia do navegador (igual à barra de tarefas)
- **Corrigido:** a barra (e a aba da barra de tarefas) continuava aparecendo com o navegador em **F11** ou com vídeo em
  **tela cheia** (YouTube etc.). Desde a 2.0.40 navegadores e lançadores (Steam, Riot, Epic...) mantinham a barra **sempre**.
- Agora vale a **mesma lógica da barra de tarefas do Windows**: com o navegador/lançador **em janela ou maximizado**, a barra
  fica; quando a janela cobre o **monitor inteiro** (F11, vídeo em tela cheia, Steam Big Picture), a barra **some junto** com
  a barra de tarefas e volta ao sair da tela cheia.
- Em tela cheia a barra só aparece pelo **Ctrl+Alt+T** (barra pequena por 5 s) e nos **últimos 5 minutos** (4 s).
- O log da barra mostra "NAVEGADOR/GERENCIADOR EM TELA CHEIA (barra some, igual a barra de tarefas)".

## 2.0.52 — barra no topo inteiro e por cima das janelas; barra pequena em tela cheia
- **Corrigido:** a tela piscava ao clicar nos campos de login/senha, e a barra sumia ao abrir o Explorer (ou outro aplicativo em
  janela). A causa era a regra da 2.0.50/2.0.51 que deixava a barra ATRÁS dos aplicativos e trocava a camada da janela conforme o
  programa em primeiro plano. A 2.0.52 volta à regra da 2.0.49: **barra visível = sempre por cima**.
- **Barra aberta:** ocupa o **topo inteiro** da tela, como antes, e fica **por cima** do Explorer, do navegador e de jogos em janela.
  Continua sem reservar a faixa do topo (o Windows não reajusta a resolução ao dar Alt+Tab ou fechar jogos).
- **Seta ︿:** esconde a barra e o tempo vai para a **aba na barra de tarefas** (ao lado dos ícones da bandeja).
- **Tela cheia ou tela cheia em janela (sem borda):** a barra do topo e a aba da barra de tarefas **somem**, igual à barra de
  tarefas do Windows. Voltam ao sair do jogo/Alt+Tab, do jeito que estavam (aberta ou recolhida).
- **Últimos 5 minutos:**
  - fora de tela cheia: a barra (ou a aba) já está visível e o tempo fica **vermelho**; a barra **não abre mais sozinha**;
  - em tela cheia: a **barra pequena** (só o tempo restante) aparece **por 4 segundos** no lugar da barra de tarefas, por cima do jogo.
- **Ctrl+Alt+T em tela cheia ou tela cheia em janela:** mostra a **barra pequena por 5 segundos** no lugar da barra de tarefas;
  apertar de novo **esconde antes**. Fora de tela cheia a barra já está visível e o atalho não muda nada.
- A barra pequena por cima do jogo deixa o **clique atravessar** (não tira o foco do jogo).
- Sem barra de tarefas utilizável (oculta automaticamente ou na lateral): a aba e a barra pequena ficam no centro do topo.
- Testes: `test/FloatingBarRegression.cs` e `test/TaskbarTabRegression.cs`.

## 2.0.51 — aba recolhida NA BARRA DE TAREFAS e atalho Ctrl+Alt+T
- **Recolher (seta ︿) leva a aba para a barra de tarefas do Windows**, à esquerda dos ícones da bandeja (relógio, Wi-Fi,
  som). A barra de tarefas é do próprio Windows e fica visível sempre que não há jogo em tela cheia; a aba fica por cima dela,
  então **o tempo nunca some** fora de tela cheia — nem com navegador ou aplicativo maximizado na frente.
- Nos **últimos 5 minutos** a aba fica **vermelha** e continua na barra de tarefas (não sai de lá para a barra do topo, que pode
  estar atrás de um aplicativo). O prêmio fidelidade também não tira a aba de lá.
- **Jogo em tela cheia** (exclusiva ou sem borda): a barra de tarefas some e a aba também; ao sair do jogo/Alt+Tab ela volta.
- Se a barra de tarefas estiver em **ocultar automaticamente** ou na **lateral/topo**, a aba fica no topo da tela (como na 2.0.50).
  Recomendado nas máquinas da arena: barra de tarefas **embaixo** e **sem** ocultar automaticamente.
- Clicar na aba **abre** a barra no topo.
- **Ctrl+Alt+T** (em qualquer aplicativo): mostra a **barra inteira na frente por 5 segundos**, sem sair do aplicativo
  (apertar de novo esconde antes). Em jogo **sem borda** ela aparece por cima com o clique atravessando (não tira o foco do jogo).
  Em jogo de **tela cheia exclusiva** o Windows não desenha nada por cima (e o jogo poderia minimizar), então o atalho é ignorado.
  Se outro programa já usa Ctrl+Alt+T, o log da barra registra "atalho indisponível".
- Testes: `test/TaskbarTabRegression.cs` e `test/FloatingBarRegression.cs`.

## 2.0.50 — barra FLUTUANTE com seta para esconder (substitui a barra encaixada da 2.0.45)
- A barra **não reserva mais a faixa do topo**: o Windows não precisa reajustar a área de trabalho/resolução a cada Alt+Tab,
  ao fechar jogos ou aplicativos em tela cheia. Acabou o "barra sumiu/presa" causado por essa reserva.
- **Aplicativos, navegadores e jogos ficam SEMPRE NA FRENTE da barra.** A barra não é mais "sempre no topo": ela
  aparece quando o cliente **volta para a área de trabalho do Windows** (sobe sozinha, sem roubar o foco) e sempre que
  o aplicativo aberto **não está em tela cheia nem em tela cheia em janela** e não está por cima dela. Ao clicar num
  aplicativo, ele fica na frente da barra.
- **Aberta:** flutua centralizada no topo (1280 px em telas Full HD; em telas menores deixa 150 px livres de cada
  lado), sem cobrir os botões minimizar/maximizar/fechar das janelas maximizadas.
- **Seta ︿** no canto direito da barra: **recolhe**. A barra vira uma **aba pequena no centro do topo** com a logo, o
  **tempo restante** e a seta **﹀**. Clicar na aba **abre** a barra de novo.
- O cliente escolhe: o estado (aberta/recolhida) **continua igual** depois de Alt+Tab, de fechar o jogo ou de trocar a
  resolução. Cada **sessão nova começa com a barra aberta**.
- **Últimos 5 minutos:** o tempo fica vermelho (também na aba) e a barra **abre sozinha uma vez** (vê-se na área de
  trabalho ou quando nenhum aplicativo a cobre); o cliente pode recolher de novo. Mensagem de **prêmio fidelidade** também abre a barra.
- **Jogos em tela cheia** (exclusiva ou sem borda): a barra continua saindo da frente e volta ao dar Alt+Tab/fechar o
  jogo (regras 2.0.44–2.0.49), agora na posição flutuante, aberta ou recolhida como estava.
- O registro no Windows (AppBar) fica só para receber o aviso de "aplicativo em tela cheia", sem área reservada.
- Teste: `test/FloatingBarRegression.cs` (substitui `DockRegression.cs`).
