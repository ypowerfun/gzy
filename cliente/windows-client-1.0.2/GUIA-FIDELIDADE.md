# Cliente — aviso de fidelidade

O Cliente recebe do Servidor os avisos do Programa Fidelidade automático. Todos os clientes ativos participam do programa sem ativação individual.

Quando o Servidor libera um prêmio de tempo, o Cliente exibe a mensagem por aproximadamente 5 segundos. Avisos múltiplos entram em fila e não se sobrepõem.

Durante uma indisponibilidade do Servidor, a sessão ativa continua contando localmente. Avisos pendentes são entregues quando a comunicação voltar ou na próxima sessão do cliente.
