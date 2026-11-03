# GameZoney — Servidor 2.4.0 e Cliente 1.4.0

## Atualização
Encerre os programas anteriores e instale o Servidor 2.4.0 na recepção e o Cliente 1.4.0 nos PCs, nas mesmas pastas e contas do Windows. As associações, os clientes e as senhas de manutenção ficam preservados. As TVs não precisam ser alteradas.

## Administrador nos PCs
1. No servidor, entre com um administrador e abra Configuração das máquinas.
2. Clique em Cadastrar administrador e informe usuário e senha (mínimo de 8 caracteres). Esta conta também terá privilégios administrativos no painel do servidor.
3. No PC, marque Acesso administrativo (recepção), informe a conta criada e entre. Também pode ser usada uma conta do servidor que já tenha perfil Administrador.
4. A barra mostrará ADMIN. As restrições aplicadas pelo GameZoney serão suspensas para permitir manutenção de programas e painéis. Esse acesso não consome saldo nem abre sessão de cliente.
5. Clique em Sair do administrador para reaplicar os bloqueios globais e voltar à tela de login. Feche as janelas de configuração abertas durante a manutenção antes de sair.

Clientes e operadores de atendimento não recebem esse acesso. É necessário encerrar a sessão do cliente antes de entrar como administrador. Enquanto houver administrador conectado ao PC, o servidor recusa iniciar uma sessão de cliente nessa máquina.

Ao perder contato com o servidor por 15 segundos, o cliente volta à tela de controle e tenta reaplicar as restrições. Reiniciar cliente ou servidor exige nova autenticação administrativa. A senha administrativa não fica salva no PC. O log do servidor registra as entradas e saídas.

A conta é do GameZoney: não cria uma conta do Windows, não concede elevação do UAC e não remove bloqueios externos que já existiam antes do cliente. Permissões e políticas do próprio Windows continuam valendo.

## Caixa de manutenção
Corrigida a disputa de foco entre a tela de bloqueio e a caixa de senha. A caixa agora pertence à janela principal; as atualizações que reposicionavam a tela aguardam seu fechamento. Durante a digitação, as restrições continuam ativas. O tempo no servidor não é pausado. Cancelar ou errar a senha não libera o PC. A manutenção local continua disponível sem o servidor usando a senha de manutenção cadastrada no PC.

Se a versão antiga impedir a saída por causa do foco: deixe os bloqueios desmarcados temporariamente no servidor, aguarde o cliente receber a alteração e faça a atualização com o cliente encerrado. Se necessário, coloque o PC em uma sessão pelo servidor para sair da tela de login e acessar o Gerenciador de Tarefas. Encerrar o processo à força exige usar Recuperar acesso de manutenção para restaurar políticas antes de concluir a atualização. Confira/encerre a sessão de teste no servidor e volte a marcar as opções desejadas depois.

## Resumo ao terminar
Nome, início, término e tempos utilizados/restantes aparecem por no máximo 30 segundos a partir do término registrado pelo servidor. Depois, o resumo é ocultado e o texto fica apenas Disponível, sem Estação. Os campos de login continuam disponíveis e o histórico completo permanece no servidor. Consultas repetidas não reiniciam os 30 segundos; sessões antigas não reaparecem ao abrir o cliente.

## Restrições globais e limites
As opções continuam na Configuração das máquinas e valem para PCs, exceto durante um acesso administrativo autorizado. As TVs não são afetadas. Desmarcar uma opção restaura o valor anterior da política; o modo de manutenção e a recuperação fazem a mesma restauração.

A opção de Ctrl+Alt+Del restringe Bloquear, Sair e Alterar senha; não bloqueia a combinação protegida do Windows. Outras opções do sistema podem continuar disponíveis. Jogos em tela cheia exclusiva podem ocultar a barra: use janela sem bordas quando necessário.

Os instaladores preservam a configuração automática do firewall para Público, Privado e Domínio, limitada ao programa e à rede local. Autorize a solicitação administrativa do Windows. O atalho Reparar conexao de rede permite repetir a etapa.

## Testes
Teste nativo em desktop separado e não exibido: foco da caixa de senha durante 12 atualizações, digitação completa, prazo sem pausa, entrada/saída administrativa, perda de contato e ocultação do resumo sem reabrir na consulta seguinte. Políticas foram simuladas, sem modificar o Registro real.

Testes do servidor cobrem credenciais, papéis, rejeição de cliente/operador, saldo preservado, concorrência com sessão de cliente, saída, desconexão, reinício do cliente, revogação e comunicação HTTPS. Confirme o comportamento final no PC piloto da arena.
