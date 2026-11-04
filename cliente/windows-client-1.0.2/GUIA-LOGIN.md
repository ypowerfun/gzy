# Cliente 1.6.1

Campos de Usuário/Nick e Senha mais compactos na barra superior. O espaço restante fica escuro, com os botões Entrar e Manutenção à direita. O nome da máquina continua à esquerda. Os campos se ajustam em telas menores sem crescer indefinidamente em telas grandes.

Atualize apenas o cliente, mantendo o Servidor 2.6.0. Encerre pela manutenção e instale por cima na mesma conta do Windows.

Compilação e regressão nativa verificadas; renderização revisada. Confira a aparência na resolução/escala dos PCs da arena.

## Tela de login sem piscar

**Problema:** a tela piscava ao clicar nos campos, ao passar do nick para a senha com **Tab** e ao voltar para a tela de login.

**Causa:** a tela de login ocupa a tela inteira com o fundo de login esticado e era desenhada direto na tela. A cada redesenho
(o Tab troca as marcas de foco do teclado e o Windows manda redesenhar a janela inteira; clique e volta para o login também
redesenham), o Windows apagava a tela com a cor de fundo escura e só depois desenhava a imagem. Esse "escuro → imagem" é a piscada.

**Correção:**
- a janela de login e os controles dela (barra de cima, textos, logo, botão) desenham **primeiro em memória** e só depois vão para
  a tela, de uma vez (buffer duplo). Os dois campos de texto (nick e senha) continuam sendo os campos normais do Windows;
- o **Tab** não troca mais as marcas de foco do teclado da tela de login, então não manda redesenhar a janela inteira;
- o visual é o mesmo: a tela de login da versão anterior e da versão anterior foram fotografadas antes e depois do Tab e ficaram iguais;
- diagnóstico: se outro programa ficar na frente da tela de login, o cliente anota no `fullscreen.log`
  (`%LOCALAPPDATA%\GameZoneyCliente`) a linha `LOGIN: outro programa ficou na frente da tela de login: <programa>`
  (no máximo uma por segundo).

