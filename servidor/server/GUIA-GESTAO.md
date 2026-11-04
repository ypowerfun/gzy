# GameZoney — Servidor 3.0 / Cliente 2.0

## Atualização

1. No servidor anterior, use **Hora e configurações → Criar cópia de segurança**. Preserve também as pastas `pairing` e `wallpapers` do diretório de dados.
2. Feche o servidor pelo ícone ao lado do relógio. Instale o Servidor 3.0 na mesma pasta. Os dados permanecem no diretório de dados existente.
3. Em cada PC, entre em manutenção e use **Fechar aplicativo**. Instale o Cliente 2.0 na mesma pasta, sem desinstalar. A associação e o fundo existentes são preservados.
4. Abra o cliente e confirme o ponto verde no servidor. Teste primeiro em um computador sem atendimento.

## Painel de monitores

Computadores e TVs ficam em monitores compactos. Clique no monitor para abrir a sessão, configuração, associação, layout e pareamento. Verde no monitor indica sessão ativa; dourado indica administração. O ponto verde/vermelho dos PCs informa conexão. TVs mantêm o controle VIDAA já existente; o ponto cinza da TV não indica uma sondagem contínua de rede.

## Faturas e relatórios

Disponível para administradores. Cada recarga gera um comprovante interno numerado. Registros antigos continuam disponíveis com seu identificador. **Ver fatura → Imprimir / salvar PDF** usa a impressão do navegador. Não é emissão de nota fiscal e não cobra o cliente por cartão ou Pix: registre apenas valores recebidos pela recepção.

Selecione Diário, Mensal ou Anual e uma data dentro do período. Receita, despesas, resultado (receita menos despesas), ticket médio, quantidade de transações e evolução diária aparecem juntos. A receita é contabilizada na data da recarga, no fuso do servidor. Despesas usam a data informada. Cadastre aluguel, energia, compras e demais custos; custos não cadastrados não entram no resultado. Não há apuração tributária.

**Exportar relatório CSV** inclui todas as transações e despesas do período, inclusive canceladas identificadas, e totais que excluem cancelamentos. O arquivo abre no Excel e em outras planilhas. Não depende do limite de 500 sessões mostrado no histórico.

**Cancelar** requer motivo, não apaga o registro e retira os minutos e pontos correspondentes. Só é permitido se o cliente ainda não iniciou nenhuma sessão após a recarga, tiver saldo suficiente e não tiver utilizado os pontos necessários ao estorno. Recargas feitas durante uma sessão também não podem ser canceladas. Se houver devolução de dinheiro, ela deve ser feita pela recepção; o sistema não movimenta contas bancárias. Despesas podem ser canceladas com motivo.

## Fidelidade

Regra inicial: **1 ponto por real gasto**. Frações acumulam até três casas decimais. Compras anteriores à atualização não recebem pontos retroativos. O administrador pode desativar o acúmulo, mudar a quantidade ou escolher pontos por hora efetivamente usada. Regras novas valem para novas compras/sessões; a sessão mantém a regra da sua abertura.

O programa de fidelidade é automático: configure o valor que gera pontos, o limite de pontos e o tempo liberado. Não existe catálogo de prêmios na interface.

## Controle remoto dos PCs

Requer **Cliente 2.0** conectado. Somente administradores do servidor têm acesso. Não se aplica às TVs e fica indisponível durante manutenção/administração do cliente.

- **Bloquear / desbloquear:** cobre a área de trabalho, mantendo a contagem. Para devolver tempo e liberar a máquina, use Encerrar sessão.
- **Programas:** lista processos com janela visível, na mesma sessão do Windows, que iniciaram depois que o cliente reconheceu o início da sessão do cliente. Não inclui programas já abertos, serviços, próprio cliente ou seu monitor. Uma nova aba de navegador já aberto pode não aparecer. Após reiniciar o aplicativo, programas já existentes são considerados anteriores.
- **Fechar:** solicita fechamento normal à janela. O programa pode pedir para salvar arquivos ou recusar; o resultado aparece no painel. Não é encerramento forçado de processos do Windows.
- **Reiniciar / desligar:** pede confirmação, encerra a sessão e devolve saldo antes de agendar a ação do Windows para 15 segundos depois. Salve os arquivos. O funcionamento depende das permissões e condições do Windows no PC.
- **Visualizar tela:** exibe imagens do monitor principal, atualizadas aproximadamente a cada 3 segundos; não transmite áudio nem permite controlar mouse/teclado. A barra do cliente mostra **TELA VISÍVEL À RECEPÇÃO** antes de iniciar a captura. Só funciona durante sessão de cliente, nunca na tela de login ou no modo administrador. Conteúdo protegido ou alguns jogos em tela cheia podem produzir imagem preta; prefira modo janela sem bordas. A captura cessa ao fechar a janela de controle (ou expirar em até 15 segundos), entrar em manutenção, bloquear o PC ou terminar a sessão. Imagens ficam apenas temporariamente na memória do servidor, sem gravação de vídeo ou arquivo.

As ações ficam no log. Comandos não confirmados expiram; não são reaplicados automaticamente após reiniciar o servidor. O tempo de desconexão de 1 minuto e o monitor de recuperação do cliente continuam ativos.

## Validação

Testes em base separada cobrem saldo, estorno, fidelidade, datas/fuso, exportação, permissões, comandos vinculados à sessão e regressões das TVs/PCs. Testes nativos usam ambiente de tela isolado e simulam ações de energia: nenhuma máquina de produção foi desligada ou reiniciada. A captura e o comportamento de cada jogo precisam ser confirmados no PC real após atualizar.

## Ações dos PCs
Na tela Computadores / TVs, administradores possuem o botão **Ações dos PCs**. As ações em lote afetam somente estações do tipo computador e nunca TVs. É possível liberar PCs em modo administrador, encerrar sessões em uso, desligar e reiniciar por escopo (todas, disponíveis ou uma específica, conforme a ação). Ao interromper uma sessão para liberar ADMIN ou executar energia, o saldo restante é devolvido pelas regras normais de encerramento.
