# Desconexão e recuperação de energia — Servidor 3.0.15

## Queda somente do Servidor
Se o Servidor for fechado/reiniciado enquanto os PCs continuam ligados, o Cliente mantém a sessão local e o relógio continua contando. Ao reconectar, o tempo local é reconciliado automaticamente.

## Queda somente do PC/Cliente — regra 3.0.19
Com o Servidor ativo, uma estação que não responde por 10 segundos fica **vermelha** (sem conexão). Somente a partir desse momento o Servidor abre uma janela de **1 minuto** aguardando a reconexão do cliente; o painel mostra quantos segundos faltam.
- Se o cliente voltar dentro de 1 minuto, a estação volta a ficar **verde** e a sessão continua normalmente (o tempo é reconciliado com o relógio do PC).
- Se não voltar, a sessão é encerrada e o tempo é devolvido a partir do instante em que a estação ficou vermelha.
Estações verdes não entram nessa verificação. Os eventos "PC sem conexão", "Conexão restabelecida" e "Sessão encerrada" ficam no Sistema de log.

## Queda simultânea do Servidor e dos PCs
O Cliente grava checkpoints locais da sessão com o tempo restante e o uptime do Windows. O Servidor também persiste o último checkpoint recebido.

Quando o PC reinicia, o Cliente reconhece a troca de boot pelo uptime e envia ao Servidor o tempo restante salvo antes da queda. O Servidor encerra a sessão anterior e devolve o maior valor seguro entre o checkpoint local e o último checkpoint persistido no servidor.

Se o Servidor reiniciar e o PC não voltar dentro da janela de inicialização, o Servidor usa o último checkpoint persistido como fallback. Isso evita que todo o intervalo em que a arena ficou sem energia seja descontado do usuário.

## Auditoria
Cada recuperação cria um registro de log do tipo `recuperacao-energia`, contendo:
- usuário/nick;
- estação;
- checkpoint informado pelo Cliente, quando disponível;
- último checkpoint conhecido pelo Servidor;
- segundos devolvidos;
- diferença detectada e indicação de que o maior checkpoint foi usado para evitar perda de saldo.

## Auditoria pós-queda — 3.0.15
Quando a execução anterior do Servidor terminou de forma inesperada e havia PCs em uso, o Servidor cria uma auditoria somente para essas sessões. O painel mostra a verificação ao reiniciar. Se o PC também reiniciou, os checkpoints do Cliente, do Servidor e do último instante conhecido antes da queda são comparados e o maior saldo seguro é usado. O Sistema de log mostra os casos. Se ainda restar uma diferença calculável, o administrador recebe o botão **Devolver saldo**; a correção é única e fica registrada. Quando nenhum problema é encontrado, o painel informa que não houve perda de saldo nas máquinas em uso.

## Batimento do Cliente — 3.0.17 / 2.0.21
O Cliente 2.0.21 mantém uma linha de batimento independente da interface. Se a consulta normal de estado atrasar (interface ocupada, diálogo de recepção aberto, limpeza ou download do fundo), o PC envia um batimento leve para `/pc/heartbeat`. O Servidor apenas registra que o PC está vivo; saldo, sessão, reconciliação e modo administrador não são alterados. Um PC realmente desligado ou sem rede continua sendo encerrado após 10 segundos, com devolução do saldo restante.
