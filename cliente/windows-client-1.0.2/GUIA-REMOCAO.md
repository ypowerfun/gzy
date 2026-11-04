# Atualização GameZoney — Servidor 2.4.1 / Cliente 1.4.1

Encerre o programa antes de instalar a atualização por cima da versão existente, na mesma conta do Windows. Não desinstale nem apague os dados.

## Remover um computador
Entre como administrador no servidor. O botão **Remover computador** aparece no cartão de um PC desconectado (após cerca de 15 segundos sem contato) ou inativo, sem sessão de cliente ou administrador aberta. Confirme a remoção na caixa exibida.

O computador sai da lista e sua associação antiga é revogada. O histórico, os registros e os saldos são preservados. TVs não apresentam essa opção. Desinstalar o cliente, por si só, não exclui automaticamente o cadastro no servidor.

A versão 2.4.1 do servidor já permite remover PCs com os clientes atuais. A atualização 1.4.1 do cliente acrescenta o atalho para facilitar uma futura reconfiguração.

## Cadastrar novamente uma máquina removida
1. Instale/atualize o Cliente 1.4.1 no PC. Se já estiver aberto, entre em **Manutenção / recepção**, usando a senha local de manutenção, e encerre o cliente.
2. No menu Iniciar do Windows, na pasta GameZoney Cliente, abra **Reconfigurar conexao com o servidor**.
3. Informe a senha local de manutenção e confirme. A associação anterior é guardada como cópia local; as restrições aplicadas pelo cliente são restauradas antes de configurar novamente.
4. Siga a descoberta do servidor. Na recepção, confira o código e autorize como **Novo computador**. Confirme a identidade do servidor no cliente e crie sua senha de manutenção.

Reinstalar mantém os dados locais: uma associação revogada não será reutilizada. O cliente não se cadastra novamente sozinho ao perder a conexão. Cancelar a nova configuração não autoriza o PC; basta abrir novamente o cliente para configurar.

Validação: testes de remoção, revogação HTTPS, descoberta com nova autorização, persistência, histórico e permissões; painel testado com DOM; programas compilados. Instalação e conexão final devem ser conferidas nas máquinas da arena.

## Desinstalação completa
Ao desinstalar o GameZoney Cliente (Configurações do Windows > Aplicativos), **nada dele fica no PC**:
- pasta do programa (`%LOCALAPPDATA%\Programs\GameZoneyCliente`) e cópias antigas dela em outras contas do Windows;
- pasta de dados de **todas** as contas do Windows (`%LOCALAPPDATA%\GameZoneyCliente`): associação com o servidor (`client.dat`),
  sessão local, `connection.log`, `fullscreen.log`, `monitor.log` e fundo do login;
- log de instalação (`%ProgramData%\GameZoney\client-install.log`, e a pasta se ficar vazia);
- inicialização automática (entrada Run, tarefa agendada e a marca "desativado" que o Windows cria), regras de firewall,
  atalhos e os valores de inicialização rápida (`Explorer\Serialize`) que o instalador criou;
- as restrições do Windows são retiradas antes (o cliente pede um administrador do servidor, como antes). Se o Windows negar o
  acesso às chaves das restrições, o desinstalador devolve a permissão e tenta de novo.

Fica no Windows apenas a permissão da conta do PC nas duas chaves das restrições (`...\Policies\System` e `\Explorer`), que é a
permissão normal da conta.

**Instalar de novo:** o PC não tem mais a associação. O cliente procura o servidor e pede autorização; aprove no painel
(Computadores > PC aguardando autorização) e confirme a identidade do servidor no PC.

**Manter o mesmo computador no painel (ex.: MAQUINA-7):** o servidor não deixa aprovar o pedido num computador que ainda está
associado (para não tomar o lugar de outro PC). Escolha uma destas formas:
1. No painel, **Remover computador** na MAQUINA-7 antiga (o histórico, os registros e os saldos são preservados) e aprove o pedido
   como **Novo computador** com o nome MAQUINA-7; ou
2. No cartão da MAQUINA-7, **Associação por arquivo (alternativa)**: gere o arquivo e, na tela de configuração do cliente, use
   **Importar** — o PC volta a ser a MAQUINA-7, sem aprovar pedido.

