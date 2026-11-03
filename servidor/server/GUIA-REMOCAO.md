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
