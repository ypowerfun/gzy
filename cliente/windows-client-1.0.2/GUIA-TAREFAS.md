# GameZoney — Lista de tarefas por computador

Atualização: Servidor e Cliente. Atualize os dois para habilitar a função. Feche o cliente pelo modo administrador antes de instalar por cima. O MonitorGZ permanece separado da árvore do cliente.

No servidor, clique no monitor do PC. A lista de programas da sessão mostra Nome (com .exe), PID e Status: Em execução ou Não respondendo. O status é consultado no Windows e atualizado nas consultas periódicas; a detecção de travamento não é instantânea. Se não for possível consultar o estado, será exibido Status indisponível.

A lista continua limitada a processos com janela visível iniciados após o cliente reconhecer a sessão. Não é a lista completa dos processos do Windows. Processos anteriores ao login, cliente GameZoney e MonitorGZ não são oferecidos para finalização. Se um navegador já estava aberto, uma nova aba pode compartilhar o processo anterior e não aparecer.

Finalizar tarefa encerra à força o processo selecionado, inclusive travado. Não pede confirmação: mostra um aviso verde de solicitação enviada. Dados não salvos serão perdidos. A ação não finaliza toda a árvore de subprocessos e não pede para o programa salvar. O cliente confirma a sessão, PID e horário de criação antes de agir. Falhas de permissão ou encerramento são mostradas no painel e registradas no log. A lista é atualizada após a próxima consulta.

Clientes anteriores continuam conectando, mas o botão fica desabilitado e solicita atualização. A conta administradora do servidor é necessária. O modo de manutenção do PC continua impedindo ações remotas.

Validação: 21 testes do servidor e teste de interface aprovados. Teste nativo em área de trabalho isolada identificou um aplicativo de teste em execução e outro travado e finalizou ambos à força; um programa anterior à sessão foi preservado. Nenhum programa real do usuário foi finalizado.

Referência do estado de janela: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-ishungappwindow
