# GameZoney Cliente 2.0.59 — gerar o instalador e atualizar os PCs

> Software proprietário e confidencial da GameZoney. Não divulgar.

**Novidades** (detalhes em `GUIA-LIMPEZA.md`, `GUIA-REMOCAO.md`, `GUIA-PROTECAO.md`, `GUIA-LOGIN.md`, `GUIA-CLIENTE.md` e `GUIA-BARRA.md`):
- **2.0.59 — fim do tempo com jogo de anticheat aberto:** o PC não fica mais preso em "Limpeza pendente" por causa de um processo
  protegido de fundo (ex.: `FortniteClient-Win64-Shipping_EAC_EOS`, "Acesso negado"); o cliente pede para o programa fechar, espera
  até 10 s e libera o PC. Se a janela do jogo continuar aberta, o PC segue bloqueado com o motivo claro;
- **2.0.58 — desinstalação completa:** ao desinstalar, o cliente não deixa nada no PC: pasta do programa, dados de todas as contas
  do Windows (associação com o servidor, sessão local, logs, fundo do login), log de instalação, inicialização automática,
  regras de firewall e valores de Registro que ele criou. Ao instalar de novo, o PC **pede uma nova autorização** ao servidor;
- **2.0.57 — restrições do Windows com acesso negado (a causa do "Sem conexão com o servidor"):** quando o Windows nega ao
  cliente a gravação das restrições (Gerenciador de Tarefas, Painel de Controle, opções de segurança), a tela agora diz isso e
  onde está o reparo, em vez de "Sem conexão com o servidor". O instalador devolve à conta do PC a permissão nessas duas chaves
  do Registro, e há um atalho novo **"Reparar restrições do Windows"** no menu Iniciar. O administrador do servidor consegue
  entrar mesmo se as restrições não puderem ser retiradas (para rodar o reparo). Gerar o instalador: **dois cliques**, sem digitar
  nada;
- **2.0.56 — tela de login sem piscar:** ao clicar nos campos, passar do nick para a senha com **Tab** e voltar para a tela de
  login, a tela não pisca mais (a tela é desenhada em memória antes de aparecer). Só a tela de login mudou;
- **2.0.55 — conexão com o servidor:** a tela mostra o **motivo real** quando falta conexão; se o servidor **mudar de IP**, o
  cliente o reencontra sozinho na rede (só aceita o mesmo certificado já associado); o componente de conexão tem tempo-limite e
  não trava mais o cliente; o `connection.log` registra cada motivo;
- **2.0.54:** barra volta na hora (Alt+Tab/fechar o jogo); Ctrl+Alt+T fora de tela cheia reinicia a barra; instalador com dois cliques;
- **2.0.53:** barra some no F11 e no vídeo em tela cheia do navegador; **2.0.52:** sem piscar no login, barra por cima das janelas.

Funciona com o Servidor 3.0.64 ou mais novo (recomendado: 3.0.67; o servidor não muda nesta versão). Pode instalar direto por cima de qualquer versão a partir da 2.0.49.

## 1. Gerar o instalador — dois cliques, nada para digitar (uma vez, num PC Windows)
Precisa de: .NET Framework 4 (já vem no Windows), **Node.js** (o mesmo usado no servidor) e **Inno Setup 7 ou 6**.

1. Descompacte esta pasta (ex.: `C:\GameZoneyBuild\windows-client-2.0.59`).
2. Instale o **Inno Setup** se ainda não tiver (7 ou 6): https://jrsoftware.org/isdl.php.
3. **Dois cliques em `GERAR-INSTALADOR-CLIENTE.cmd`**. Pronto: ele acha o Inno Setup sozinho — **7 ou 6**, de 64 ou 32 bits,
   em Arquivos de Programas, na instalação "somente para mim" (como no PC `rcti2`), em outra pasta (pelo registro do Windows)
   ou no PATH, compila o cliente, roda os autotestes e gera
   **`..\outputs\GameZoney-Cliente-2.0.59-Setup.exe`**. No fim a janela espera você apertar uma tecla.
   - Se preferir digitar: no CMD `GERAR-INSTALADOR-CLIENTE.cmd`; no PowerShell `.\GERAR-INSTALADOR-CLIENTE.cmd`.
   - O comando antigo da 2.0.48 (com `-InnoCompiler "..."`) continua funcionando igual.
   Se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações → Executar assim mesmo**.
4. O `build.ps1` é o da 2.0.48; a única mudança é achar o Inno Setup sozinho quando o caminho não é digitado.
   Nas linhas do autoteste os acentos podem aparecer trocados (ex.: `preservaÃ§Ã£o`): é só a exibição, não afeta o instalador.

## 2. Atualizar cada PC da arena
1. No PC, entre com um administrador do servidor (botão Entrar) e feche o cliente (botão "Fechar aplicativo").
2. Confira a barra de tarefas do Windows: **embaixo** e **sem "ocultar automaticamente"** (botão direito na barra de tarefas >
   Configurações da barra de tarefas). Assim a aba do tempo fica sempre visível.
3. Execute `GameZoney-Cliente-2.0.59-Setup.exe` **por cima** da versão atual, **com a conta do PC (a dos clientes) conectada
   no Windows**. No fim, o instalador mostra "Conferindo a permissão das restrições do Windows..." e devolve a essa conta a
   permissão nas chaves das restrições (registro em `%ProgramData%\GameZoney\client-install.log`, linhas `RESTRICOES`).
4. Abra o cliente e confira:
   - clique nos campos de usuário e senha, digite o nick e passe para a senha com **Tab** (e volte com Shift+Tab): **a tela não
     pisca**;
   - a tela de login mostra **Disponível** (conectado). Se aparecer "Sem conexão com o servidor", a linha **Motivo:** diz a causa
     (tabela no `GUIA-CLIENTE.md`) e fica registrada em `%LOCALAPPDATA%\GameZoneyCliente\connection.log` do usuário do PC;
   - se aparecer "**Este PC não conseguiu aplicar as restrições do Windows**": entre como administrador (botão Entrar) e use
     menu Iniciar > GameZoney Cliente > **Reparar restrições do Windows** (o Windows pede a senha de administrador do PC);
     em até 2 segundos o cliente aplica as restrições e volta a **Disponível**;
   - inicie uma sessão, abra um jogo com anticheat (ex.: Fortnite) e deixe o tempo acabar com ele aberto: o jogo fecha e o PC
     volta à tela de login **Disponível** (sem "Limpeza pendente");
   - inicie uma sessão: a barra ocupa o **topo inteiro**; abra o Explorer e o navegador em janela: **a barra continua por cima**;
   - a seta **︿** esconde a barra e a aba com o tempo aparece **na barra de tarefas**;
   - num jogo em tela cheia, dê **Alt+Tab**: a barra volta **na hora**; feche o jogo: volta na hora;
   - na área de trabalho, aperte **Ctrl+Alt+T**: a barra é reiniciada (se tiver sumido, aparece de novo);
   - abra o navegador e aperte **F11** (ou um vídeo do YouTube em tela cheia): a barra **some** junto com a barra de tarefas;
   - abra um jogo em tela cheia: a barra (ou a aba) **some**; aperte **Ctrl+Alt+T**: a barra pequena aparece por 5 s
     (apertar de novo esconde); dê Alt+Tab: a barra volta como estava.

Associação do PC, fundo de login e regras de firewall são preservados. Para voltar atrás, instale o 2.0.49 por cima.

## 3. Desinstalar (2.0.58: remove tudo)
1. No PC, entre com um administrador do servidor (botão Entrar) e feche o cliente (botão "Fechar aplicativo").
2. Configurações do Windows > Aplicativos > **GameZoney Cliente** > Desinstalar. Informe um administrador do servidor quando o
   cliente pedir (ele retira as restrições do Windows antes de sair).
3. Para instalar de novo: instale o `GameZoney-Cliente-2.0.59-Setup.exe`. O cliente procura o servidor e pede autorização;
   aprove no painel (Computadores > PC aguardando autorização). Para manter o **mesmo** computador do painel (ex.: MAQUINA-7),
   veja `GUIA-REMOCAO.md`.

