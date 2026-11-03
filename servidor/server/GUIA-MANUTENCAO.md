# GameZoney — Servidor 2.6.1 / Cliente 1.6.2

Atualize primeiro o servidor e depois os clientes, instalando por cima na mesma conta do Windows e com os programas encerrados.

No modo administrador, a barra do cliente apresenta **Fechar aplicativo**. Esse botão avisa o servidor, encerra automaticamente a sessão administrativa e fecha o cliente. Nenhum cliente fica em atendimento nessa máquina. O histórico e os saldos são preservados.

No servidor, cada computador tem um indicador ao lado do nome:
- Verde: aplicativo cliente conectado ao servidor, inclusive na tela de login sem usuário.
- Vermelho: cliente fechado ou sem comunicação.

O fechamento normal é refletido na próxima atualização do painel (cerca de 3 segundos). Se o computador desligar, travar ou perder a rede sem enviar o aviso, a indicação muda após aproximadamente 15 segundos sem contato, mais o intervalo de atualização do painel. Nesse caso o acesso administrativo também expira automaticamente. A cor indica conexão do aplicativo, não se alguém está jogando.

Ao reabrir, o cliente volta ao login, sem retomar o modo administrador. Quando reconecta, a indicação fica verde. As TVs não recebem este indicador de cliente PC.

Validação: 13 testes de servidor, fechamento/reconexão por HTTPS, fim do vínculo administrativo e manutenção do saldo; teste nativo com botão disponível em modo administrador e envio do aviso antes do fechamento; indicadores verde/vermelho no painel. Ambiente nativo isolado e políticas simuladas, sem alterar o computador de desenvolvimento. Confira nas máquinas da arena após atualizar ambos.
