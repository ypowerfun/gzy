# GameZoney Cliente 1.0.2 — gerar o instalador e instalar nos PCs

> Software proprietário e confidencial da GameZoney. Todos os direitos reservados.

Detalhes do funcionamento em `GUIA-CLIENTE.md`, `GUIA-BARRA.md`, `GUIA-LOGIN.md`, `GUIA-LIMPEZA.md`, `GUIA-PROTECAO.md`
e `GUIA-REMOCAO.md`. Funciona com o GameZoney Servidor 1.0.2.

## 1. Gerar o instalador — dois cliques (num PC Windows)
Precisa de: .NET Framework 4 (já vem no Windows), **Node.js** (o mesmo do servidor) e **Inno Setup 7 ou 6**.

1. Extraia a pasta (ex.: `C:\GZ\cliente\windows-client-1.0.2`).
2. **Dois cliques em `GERAR-INSTALADOR-CLIENTE.cmd`**: ele acha o Inno Setup sozinho (7 ou 6, 64 ou 32 bits, "somente
   para mim", outra pasta ou PATH), compila o cliente, roda os autotestes e gera
   **`..\outputs\GameZoney-Cliente-1.0.2-Setup.exe`**.
   Se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações → Executar assim mesmo**.
   Nas linhas do autoteste os acentos podem aparecer trocados: é só a exibição.

## 2. Instalar/atualizar em cada PC da arena
1. No PC, entre com um administrador do servidor (botão Entrar) e feche o cliente ("Fechar aplicativo").
2. Barra de tarefas do Windows **embaixo** e **sem "ocultar automaticamente"** (assim a aba do tempo fica visível).
3. Execute `GameZoney-Cliente-1.0.2-Setup.exe` **com a conta do PC (a dos clientes) conectada no Windows**.
4. Primeira instalação: o cliente procura o servidor e pede autorização — aprove no painel
   (Computadores / TVs → PC aguardando autorização).
5. Confira: a tela de login mostra **Disponível**; inicie uma sessão e veja a barra no topo; **Ctrl+Alt+T** reinicia a barra;
   em jogo de tela cheia a barra some e volta no Alt+Tab.

## 3. Desinstalar (remove tudo)
Entre com um administrador do servidor, feche o cliente e desinstale em Configurações do Windows > Aplicativos >
**GameZoney Cliente**. Para manter o mesmo computador no painel ao reinstalar, veja `GUIA-REMOCAO.md`.
