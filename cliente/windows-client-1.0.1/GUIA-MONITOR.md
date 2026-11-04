# Cliente 2.0.1 — MonitorGZ independente

O MonitorGZ.exe abre e supervisiona o GameZoneyCliente.exe. O monitor é o processo pai, não um subprocesso do cliente; encerrar o cliente e seus descendentes não encerra o monitor.

No modo usuário, o primeiro reinício ocorre aproximadamente 2 segundos após a saída forçada. Falhas repetidas aumentam a espera para 4, 8, 16, 32 e até 60 segundos. O cliente volta sem acesso administrativo e consulta a sessão vigente no servidor: o relógio não é zerado e nenhum crédito é duplicado. Se o servidor já encerrou a sessão, será exibida a tela de login.

No modo administrador, após fechamento autorizado ou ao cancelar a configuração inicial, o monitor também encerra e não reabre o cliente. O MonitorGZ continua visível no Gerenciador de Tarefas; ele não oculta processos nem impede um administrador do Windows de finalizá-lo. Não é um serviço do Windows. Não abra cópias de versões diferentes ao mesmo tempo.

Atualização: entre em manutenção no cliente atual, clique em Fechar aplicativo e instale a versão 2.0.1 por cima, na mesma pasta. Use o atalho GameZoney Cliente. Os atalhos de inicialização agora apontam ao MonitorGZ, mantendo o ícone GameZoney. Abrir o executável do cliente diretamente também encaminha a inicialização ao monitor. O arquivo antigo GameZoneyMonitor.exe é removido pelo instalador; configurações, pareamento e saldo não são apagados.

Não é necessário atualizar novamente o Servidor 3.0.

Validação: testes com aplicativos fictícios conferem o vínculo pai/filho pelo Windows, encerram o cliente e seu subprocesso, verificam que o monitor sobrevive e recupera o cliente, evitam monitores duplicados e confirmam que administração, saída autorizada e cancelamento da configuração não causam reinício. O comando taskkill /T foi bloqueado no ambiente de testes; o teste equivalente terminou explicitamente os dois processos de teste após conferir sua árvore. Nenhum aplicativo real foi encerrado.
