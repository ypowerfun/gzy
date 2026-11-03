# GameZoney — Programa fidelidade automático

Compatibilidade: **Servidor 3.0.15** e **Cliente 2.0.18**.

Todos os clientes cadastrados e ativos participam automaticamente do Programa Fidelidade. Não existe mais ativação individual nem necessidade de marcar um prêmio automático por usuário.

Na tela **Fidelidade > Configurar programa**, configure:

- a regra de geração de pontos (valor gasto x pontos recebidos, inclusive por dia da semana);
- a quantidade de pontos necessária para liberar o prêmio;
- quantos minutos serão liberados quando o limite for atingido.

Exemplo: **10 pontos = 60 minutos**. Ao atingir 10 pontos, o sistema consome automaticamente os 10 pontos e libera 60 minutos. Se houver sessão ativa, o tempo é somado imediatamente; caso contrário, vai para o saldo do cliente.

Se houver pontos para vários ciclos, todos são processados. Exemplo: 20 pontos numa regra de 10 pontos = 60 minutos liberam 120 minutos.

O Cliente mostra por aproximadamente 5 segundos:

    = Programa fidelidade =
    Prêmio de 1 hora liberado !

Se o cliente estiver offline no momento da liberação, o aviso aparece na próxima sessão.
