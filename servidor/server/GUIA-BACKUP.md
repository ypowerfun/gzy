# Backup completo — Servidor 3.0.4

Em **Hora e configurações → Backup completo do servidor**, deixe o backup diário marcado, escolha o horário e salve. O padrão é **03:00**, no fuso configurado, com destino **Documentos\bkp gamezoney** do usuário que abre o servidor. A primeira cópia acontece na primeira abertura; as seguintes são diárias. Se o servidor estiver fechado no horário, a cópia pendente será feita ao voltar a abrir. A execução exige o servidor aberto. O botão **Criar backup completo agora** permite uma cópia adicional.

Cada ZIP inclui banco de dados consistente, usuários, senhas protegidas, saldos, histórico, faturas, despesas, fidelidade, configurações, imagens, pareamentos das TVs e identidade de conexão dos PCs. Também inclui uma cópia dos arquivos do programa servidor. O painel informa andamento, último arquivo, horário e erros. Não apaga cópias antigas automaticamente; acompanhe o espaço livre.

Uma cópia no mesmo HD não protege contra falha desse HD. Copie os ZIPs para outro disco ou escolha uma pasta de outro dispositivo no destino. Os arquivos contêm dados pessoais e credenciais; mantenha acesso restrito.

## Recuperação

1. Instale o GameZoney Servidor 3.0.4 ou posterior no computador de destino.
2. Encerre o servidor pelo ícone próximo ao relógio do Windows.
3. No menu Iniciar, abra **GameZoney → Restaurar backup GameZoney**.
4. Selecione o ZIP e confirme a substituição. Os arquivos são verificados antes da troca; os dados atuais ficam numa pasta `data-anterior-...` ao lado da pasta de dados.
5. Abra o servidor e entre com a conta administrativa existente no backup. Confira saldos e sessões, que refletem a data da cópia.
6. Se o IP do servidor mudou, atualize o endereço usado pelas TVs. Confira a descoberta dos PCs e ajuste o destino dos backups caso tenha mudado o usuário do Windows.

As configurações gerais do Windows, programas dos clientes e arquivos externos ao GameZoney não fazem parte desta cópia.

## Janela

O painel abre maximizado usando a área útil do monitor. A navegação tem rolagem em telas baixas para manter Alterar senha e Sair acessíveis, inclusive com barras do Windows no topo ou embaixo.

Esta versão também inclui as correções do Servidor 3.0.3: buscas por nick e remoção dos pontos por hora. Atualize os PCs para o Cliente 2.0.9 para corrigir o bloqueio do Gerenciador de Tarefas.
