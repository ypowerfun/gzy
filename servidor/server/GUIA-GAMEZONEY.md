# GameZoney — Guia completo (Servidor e Cliente)

> Software proprietário da GameZoney. Todos os direitos reservados.

O GameZoney tem duas partes:

- **GameZoney Servidor** — instalado no PC da recepção. Guarda clientes, saldos, caixa e histórico, controla as TVs e mostra o painel.
- **GameZoney Cliente** — instalado em cada PC gamer. Bloqueia o PC até a recepção liberar (ou o cliente entrar com nick e senha), mostra a barra de tempo e limpa a sessão no fim.

Índice: 1. Instalação · 2. Primeiro acesso · 3. Painel de controle · 4. TVs (VIDAA e Android) · 5. Clientes e recargas ·
6. Visitante · 7. Caixa (Caixa atual, Vendas, Caixas fechados) · 8. Produtos/Serviços (Estoque e gerenciamento) · 9. Faturas ·
10. Fidelidade, medalhas e promoções · 11. Corujão/Viradão · 12. Transferir/Remover saldo · 13. Sessão, Log e Estatística ·
14. Ranking · 15. Configuração · 16. Backup · 17. Cliente nos PCs · 18. Quedas de energia, de rede e de internet ·
19. Remover, reinstalar e desinstalar · 20. Problemas comuns

---

## Menu do painel

Ordem: **Painel de controle, Clientes, Fidelidade, Corujão/Viradão, Transferir/Remover** — **Sessão, Log, Faturas, Estatística** — **Caixa, Produtos/Serviços** — **Ranking** — **Configuração** (os grupos são separados por um traço dourado). Transferir/Remover e Configuração aparecem só para administradores. Confirmações (remover, desativar, pagar etc.) aparecem numa caixa do próprio painel, com **Confirmar** e **Cancelar**. O painel nunca pede para salvar senhas. O painel se ajusta a qualquer resolução: **Senha** e **Sair** ficam sempre visíveis no fim do menu, sem rolar a página (em telas muito baixas o menu fica mais compacto).


**Perfil** (botão ao lado de **Sair**): **Alterar senha**; **Idioma** do painel — Português (Brasil), English, Español, Français ou Русский (vale para o seu usuário; o painel inteiro muda de idioma — menus, títulos, botões, campos, avisos, textos de ajuda, Estatística, Configuração, Ranking e mensagens do Log; nomes, nicks, produtos e outros dados cadastrados continuam como foram digitados); **Ajuda** (abre o site https://gamezoney.com/); **Feedback** (nome, email e comentário, enviados para a GameZoney; sem internet ou com o site fora do ar, o feedback fica guardado no servidor e é reenviado sozinho a cada 10 minutos).
---

## 1. Instalação

**Idioma do instalador**: os instaladores (Servidor, Cliente e o instalador único) abrem em **inglês** por padrão. A primeira tela pergunta o idioma: mantenha **English** ou troque para **Português (Brasil)**. No instalador único, o idioma escolhido vale também para o instalador do Servidor e do Cliente que ele abre. O desinstalador usa o mesmo idioma da instalação. Os nomes dos atalhos do menu Iniciar continuam em português (ex.: **Reparar conexao de rede**).

**Servidor (PC da recepção)** — Windows 10/11 de 64 bits.
1. Execute o instalador (ou o instalador único e marque **Instalar Servidor**). Ele já leva o motor (Node), o banco e as ferramentas; não baixa nada.
2. O instalador configura o firewall do Windows (somente rede local) para as portas **3000/TCP** (TVs), **3443/TCP** (PCs) e **3444/UDP** (descoberta dos PCs). Se precisar repetir: menu Iniciar > GameZoney > **Reparar conexão de rede**.
3. O servidor abre sozinho quando a conta entra no Windows e fica no ícone perto do relógio. Clique com o botão direito no ícone para abrir o painel, o diagnóstico ou encerrar o servidor. Fechar a janela do painel não encerra o servidor.
4. O painel abre em janela própria do GameZoney (motor WebView2 do Windows). **O WebView2 e o Edge não podem estar bloqueados** no PC do servidor (programas que "desativam o Edge" costumam bloquear também o WebView2 e o painel fica com a tela escura). O navegador padrão pode ser o Chrome ou outro.
5. Deixe o IP do PC do servidor **fixo** (reserva no roteador). Mantenha o PC ligado, sem suspensão, durante o atendimento.

**Cliente (PCs gamers)** — Windows 10/11 de 64 bits, conta do Windows **padrão** (não administradora) para os clientes.
1. Execute o instalador (ou o instalador único e marque **Instalar Cliente**) **com a conta do PC dos clientes conectada no Windows**. O Windows pede a autorização de administrador.
2. Ao abrir, o cliente procura o servidor na rede e mostra um **código**. Na recepção: **Painel de controle > PC aguardando autorização**, confira o código e clique em **Autorizar** (como novo computador ou no lugar de um computador livre). No PC, confirme a identidade do servidor e crie a **senha de manutenção** local.
3. Recomendado: barra de tarefas do Windows **embaixo** e **sem ocultar automaticamente** (a aba do tempo fica nela).

**Atualizar:** feche o servidor pelo ícone (Encerrar servidor) e instale por cima, na mesma conta do Windows. Nos PCs, entre como administrador no cliente, use **Fechar aplicativo** e instale por cima. Dados, associações e saldos são preservados.

**Dados do servidor:** `%LOCALAPPDATA%\GameZoney\data` da conta do Windows que abre o servidor (banco `gamezoney.sqlite`, pareamentos das TVs, identidade dos PCs, fundos de login e `server.log`).

---

## 2. Primeiro acesso

1. Abra o **GameZoney Servidor**. A primeira abertura inicia o **teste grátis de 30 dias** (Configuração › Licença, seção 15); depois, entre com a sua conta gamezoney.com com plano ativo. Na primeira vez aparece **Prepare sua arena**: crie o administrador principal (usuário e senha de **4 a 24 caracteres**). Não existe senha padrão.
2. No **Painel de controle**, confira o **valor da hora** (padrão R$ 7,00) pela **engrenagem** do card **Valor da hora**: digite o novo valor, **Confirmar** e informe a senha do administrador. **Data e hora** são sempre as do computador onde o servidor está instalado (as mesmas do relógio do Windows; para mudar, ajuste o relógio do Windows e reabra o servidor). O **endereço do servidor** usado pelas TVs e PCs já vem com o IP da máquina; confira em **Configuração > Servidor IP** (seção 15).
3. A instalação nova já vem com duas estações de exemplo: **Exemplo Console** e **Exemplo PC**. Remova-as com **Remover console** / **Remover computador** (clique na estação) e cadastre as suas em **Painel de controle > + Nova estação** (seção 3) e as promoções em **Fidelidade > Promoções** (seção 10).
4. Crie as contas da equipe em **Configuração > Contas de acesso**: **Administrador** (tudo) ou **Operador** (atendimento: clientes, recargas, sessões, visitantes, PDV, histórico). Cada um troca a própria senha em **Perfil > Alterar senha** (botão **Perfil**, ao lado de **Sair**). Só o administrador principal (primeira conta) ativa/desativa contas.

---

## 3. Painel de controle

- Cada estação aparece como um monitor: **verde** = em uso, **dourado** = modo administrador, sem cor = livre/desligada. O ponto ao lado dos PCs indica conexão do cliente (verde conectado, vermelho sem contato). Clique no monitor para abrir as ações.
- **Iniciar sessão:** escolha o cliente (busca por nome, nick ou CPF) com saldo disponível. A sessão usa todo o saldo do cliente.
- **+ Adicionar tempo:** soma tempo na sessão em andamento sem reiniciar o relógio.
- **Encerrar:** encerra a sessão e devolve ao cliente os segundos não usados. No fim do tempo a sessão encerra sozinha.
- **Visitante / Visitantes em grupo:** seção 6.
- **Organizar A-Z / Z-A** muda a ordem dos monitores (fica guardado).
- **Ações dos PCs** (administrador): liberar em modo administrador, encerrar sessões, desligar e reiniciar — todas, disponíveis ou uma específica. Afeta só computadores, nunca TVs. Ao interromper uma sessão, o saldo restante volta ao cliente.
- **Ações dos PCs > Enviar Mensagem** (administrador): escolha um PC específico ou **Enviar para todos**, escreva a mensagem (até 200 caracteres; trecho entre `*asteriscos*` sai em dourado; Enter quebra a linha) e o **tempo na tela** em segundos. No PC aparece no canto superior esquerdo, com o título **AVISO DO SISTEMA**, só o texto (sem fundo), e some sozinha depois do tempo escolhido. O aviso **não recebe clique nem teclado e não tira o foco do jogo**. PC sem conexão não recebe (o resultado mostra quem recebeu). Em jogo de tela cheia exclusiva o Windows não deixa nada aparecer por cima; em tela cheia sem borda/janela aparece normalmente.
- **Controle do PC** (no monitor do PC, administrador, com sessão ativa): bloquear/desbloquear a tela, lista de programas da sessão (fechar ou **Finalizar tarefa**), visualizar a tela (o PC mostra "TELA VISÍVEL À RECEPÇÃO"), reiniciar e desligar.
- **Layout do login:** envia uma imagem (JPG/PNG) de fundo para a tela de login daquele PC e a posição dos campos (esquerda, centro ou direita). "Remover imagem" volta ao fundo padrão GameZoney.
- **Remover computador:** aparece em PC desconectado/inativo e sem sessão. A associação é revogada; histórico e saldos ficam.

---

## 4. TVs (VIDAA e Android)

Cadastre a TV em **Painel de controle > + Nova estação**: nome, tipo **Console**, **IP da TV**, **entrada HDMI** (1 a 4) e o **Sistema da TV**:

- **VIDAA (Hisense/Toshiba):** use **Parear TV**; a TV mostra um PIN de 4 números; digite em **Informar PIN**. Pareamento antigo pode ser trazido com **Importar pareamento**.
- **Android TV / Google TV:** na TV, ative as Opções do desenvolvedor (Configurações > Sobre > clicar 7 vezes em Build) e ligue a **Depuração ADB pela rede**. Use **Parear TV** e aceite **Permitir depuração** na TV (marque "Sempre permitir").

**Remover console** (em vermelho, ao clicar na estação; só administrador e sem sessão em andamento): tira o console da lista; o histórico de sessões e faturas fica. Para usar de novo, cadastre em **+ Nova estação**.

Ao iniciar a sessão, a TV troca para a entrada HDMI do console. Ao terminar, a TV abre a página de **sessão finalizada** (nome, início, término, tempo usado e devolvido). A TV precisa alcançar a porta 3000 do servidor (e, no Android, ter um navegador instalado). **Testar HDMI** confere o controle. Se a troca falhar, a recarga com início imediato não é registrada — corrija a TV e tente de novo.

---

## 5. Clientes e recargas

- **Clientes > + Novo cliente:** nome, **Usuário/Nick** (3 a 32 caracteres; letras sem acento, números, espaço, ponto, hífen ou sublinhado; não se repete), senha (4 a 20 caracteres, opcional — se ficar vazia, o cliente cria a senha no primeiro acesso ao PC), CPF (opcional, não se repete), telefone, **email** (opcional) e observações. **Ativar programa fidelidade** desmarcado: o cliente não ganha medalhas.
- **Clique no nome do cliente** para **Adicionar tempo**:
  1. escolha uma **promoção** (só recargas com promoção geram medalhas) ou informe **em minutos** ou **em valor** (R$; os minutos são proporcionais ao valor da hora);
  2. escolha a **forma de pagamento** (Dinheiro, Pix, Cartão Crédito/Débito) — aparece na fatura e no relatório. Para dividir, marque **Pagamento combinado (até 3 formas)** e informe o valor de cada uma (ex.: R$ 10 no Pix + R$ 10 no Cartão + R$ 10 em Dinheiro = R$ 30). A soma precisa ser igual ao total; o painel mostra quanto falta ou passou;
  3. **Iniciar após a recarga:** escolha uma estação livre para começar agora, ou **Guardar no saldo do cliente**.
- **Pacote grátis** (R$ 0,00): em vez da forma de pagamento, exige **OBS** (motivo) e a **chave de autenticação** (senha do usuário logado no servidor).
- **Importar planilha** (administrador principal): Excel (.xlsx) ou CSV com as colunas **Nome, Nick, Tempo, Medalhas de fidelidade** (a coluna antiga "Pontos fidelidade" também é aceita). Tempo aceita `01:30`, `90`, `1h30`, `45min`. Mostra uma prévia antes; clientes já cadastrados não são alterados; todos entram sem senha.
- O registro **não processa pagamentos** e não emite nota fiscal.

---

## 6. Visitante (sem cadastro)

- No monitor livre, **Visitante**: escolha a promoção ou o tempo (em minutos ou em valor) e a forma de pagamento (ou **Pagamento combinado**, até 3 formas). A sessão começa na hora com o nome **Visitante**. Em **Visitantes em grupo** a forma de pagamento é única. Não acumula medalhas e o tempo não usado não fica guardado.
- **Visitantes em grupo:** libera várias estações livres e conectadas de uma vez, com o mesmo tempo; cada estação vira uma venda. O resultado mostra estação por estação.

---

## 7. Caixa

- **Abrir caixa:** informe o troco inicial. Com o caixa **fechado**, operadores e administradores adicionados não registram recargas, visitantes nem vendas do PDV (o administrador principal pode).
- **+ Suprimento / − Sangria:** entrada ou retirada de dinheiro, com motivo.
- **Fechar caixa:** informe o dinheiro contado; o sistema mostra a diferença e gera o **PDF** do fechamento (também há o **Parcial (PDF)**).
- A tela tem três abas: **Caixa atual**, **Vendas** (o PDV, seção 8) e **Caixas fechados**.
- O resumo mostra total vendido, dinheiro esperado na gaveta, Pix/Cartão, cancelamentos, itens vendidos e estoque. Pagamentos de Corujão/Viradão entram no caixa como venda.
- **Caixas anteriores** (administrador principal): registrar caixas de datas passadas que não foram feitos no sistema.
- O valor **Caixa de hoje** na tela inicial pode ser escondido com o olho.

---

## 8. Produtos/Serviços e Vendas (PDV)

- **Produtos/Serviços** tem quatro abas: **Estoque** (primeira opção: estoque atual e **+ Entrada** de mercadoria), **Gerenciamento de Produtos**, **Gerenciamento de Serviços** e **Gerenciamento de Categoria**.
- **Gerenciamento de Categoria** (administrador): **+ Nova Categoria**, editar (renomear — os produtos da categoria acompanham o novo nome) e remover (só quando nenhum produto usa a categoria; mude a categoria deles antes). A coluna **Produtos** mostra quantos produtos usam cada categoria.
- A aba **Vendas** (o PDV) fica em **Caixa** (Caixa atual / Vendas / Caixas fechados).
- **Cadastro (administrador), nas áreas de gerenciamento:** produto (nome, categoria, preço de custo, margem de lucro ou preço de venda, código de barras opcional, estoque) ou serviço (nome e preço). A margem calcula o preço de venda, arredondado para cima no real inteiro.
- **Venda (administrador e operador), em Caixa > Vendas:** busque pelo nome ou leia o código de barras, ajuste a quantidade (limitada ao estoque), escolha a forma de pagamento (ou **Pagamento combinado**, até 3 formas: Dinheiro, Pix e Cartão, com o valor de cada uma) e **Finalizar Venda** (caixa de confirmação: Confirmar/Cancelar). O cupom abre em PDF (comprovante interno, sem valor fiscal).
- Venda cancelada (administrador) sai da receita e devolve os produtos ao estoque.

---

## 9. Faturas (administrador)

- Escolha **Diário, Mensal ou Anual**, a data e, se quiser, um **Usuário/Nick**, e clique em **Atualizar**. Na mesma linha: **Exportar relatório CSV** e **+ Despesa**.
- Mostra receita válida, despesas, resultado (receita − despesas), ticket médio, evolução por dia e a lista de faturas e transações (recargas e vendas do PDV).
- **Ver fatura** → imprimir ou salvar em PDF (comprovante interno, não fiscal). O comprovante sai limpo, sem o endereço/IP do servidor, data de impressão ou título do navegador no topo e no rodapé.
- **Cancelar** exige motivo, mantém o registro no histórico e estorna minutos e medalhas. Não é permitido se o cliente já usou o tempo/medalhas ou se a recarga foi feita durante uma sessão.
- O CSV inclui todas as transações e despesas do período, inclusive as canceladas (identificadas), e abre no Excel.

---

## 10. Fidelidade, medalhas e promoções

- **Promoções** (botão na tela **Fidelidade**, ao lado de **Mensagem do prêmio**): cadastre nome, minutos e preço total; edite, desative ou remova. As promoções ativas aparecem no Adicionar tempo e no Visitante. Alterar uma promoção não muda recargas já registradas.
- **Configurar programa:** todos os clientes ativos participam automaticamente (menos os que estiverem com "Ativar programa fidelidade" desmarcado). As **medalhas** (antes chamadas de pontos) só são geradas em **recargas com promoção**, pela regra de valor x medalhas, que pode variar por dia da semana, e na participação em **Corujão/Viradão**. Defina quantas medalhas liberam o prêmio e quantos minutos ele dá (ex.: 10 medalhas = 60 minutos).
- Ao atingir as medalhas, o prêmio é automático: com sessão ativa, o tempo entra na hora; sem sessão, vai para o saldo. Medalhas para vários prêmios liberam todos.
- **Medalhas Corujão/Viradão** (administrador): quantidade de medalhas que cada participante pago recebe ao **Iniciar** um Corujão/Viradão (0 = nenhuma).
- **Mensagem do prêmio:** texto que aparece na barra do cliente (variáveis `{premio}` e `{nick}`), com "Tempo antes | Tempo após" embaixo. Se o cliente não estiver jogando, a mensagem aparece quando ele iniciar a sessão.
- O extrato de medalhas e o histórico ficam nesta tela, com busca por nick (**Filtrar histórico**) e, ao lado, **Exportar para Excel**.

---

## 11. Corujão/Viradão

Passo a passo (administrador e operador):

1. **+ Criar Corujão/Viradão:** nome (ex.: "Corujão Sexta 22h às 6h" — não há mais campo Tipo; o nome já diz se é Corujão ou Viradão), data e valor por participante (R$ 0,00 = gratuito).
2. **+ Adicionar participantes:** busque por Usuário/Nick e marque os clientes (visitantes não participam).
3. **Confirmar pagamento** de cada participante: escolha Dinheiro, Pix ou Cartão. O valor entra no caixa aberto como venda (aparece em **Caixa > Vendas**, nos itens do caixa e em Faturas). Com o caixa fechado, só o administrador principal registra (fora de caixa). Para desfazer antes de iniciar, cancele a venda; o participante volta a **Pendente**.
4. **Iniciar ›:** cada participante **pago** recebe as medalhas definidas em **Fidelidade > Medalhas Corujão/Viradão** e a participação conta no **Ranking**. Quem não pagou fica de fora. Depois de iniciado não é possível adicionar participantes nem cancelar os pagamentos.
5. **Encerrar** quando terminar. **Excluir** (administrador) só enquanto não há pagamento confirmado.

---

## 12. Transferir/Remover saldo (administrador)

Busque os clientes por Usuário/Nick, escolha **transferir** ou **remover**, informe os minutos (ou **Todo o saldo**) e o motivo. Encerre antes as sessões dos clientes envolvidos. Fica registrado (origem, destino, tempo, motivo, data e administrador). Não altera receitas nem medalhas; remover tempo não é reembolso.

---

## 13. Sessão, Log e Estatística

- **Sessão:** histórico completo de sessões (páginas de 100, busca por nick com **Buscar** e, ao lado, **Exportar para Excel**). **Ver resumo > Mostrar este resumo na TV** reenvia a tela de sessão finalizada.
- **Log:** o Sistema de log com todas as ações (logins, recargas, cadastros, configurações, Corujão/Viradão, falhas de TV, quedas de PC, recuperações). Filtros por nick, data e tipo (**Filtrar**) e, ao lado, **Exportar CSV**.
- **Estatística:** uso por máquina, por horário, por funcionário e por cliente, clientes grátis, duração, vendas e fluxo de caixa.

---

## 14. Ranking

- **Top 10 Medalhas:** clientes com mais medalhas conquistadas (resgates de prêmio não descontam; estornos descontam).
- **Top 10 Participação em Viradão:** quem mais participou de Corujão/Viradão iniciados com pagamento confirmado.
- **Top 10 Recargas Mês:** quem fez mais recargas pagas no mês escolhido (campo **Mês das recargas**; desempate pelo valor). Visitantes e pacotes grátis não entram.

---

## 15. Configuração (administrador)

- **Licença** (primeiro quadro da Configuração): o GameZoney pode ser usado grátis, com todas as funções, por **30 dias** a partir da primeira vez que o Servidor abre. Depois, ele funciona com um **plano da sua conta gamezoney.com** (**Standard** ou **Pro**, mensal ou anual, com renovação automática no cartão). O quadro mostra a situação (**Teste grátis**, **Plano Standard/Pro ativo**, **renovação pendente**, **plano vencido** ou **teste encerrado**), a conta, até quando vale e o **código desta instalação**.
  - **Ver planos** abre gamezoney.com: o dono da arena cria a conta (e-mail/senha ou Google), escolhe o plano e o período e paga com cartão de crédito no próprio site.
  - **Entrar com a conta gamezoney.com**: digite o **mesmo e-mail e senha do site** (precisa de internet nesse momento). O plano passa a valer neste computador. A senha **não** fica guardada no Servidor. Quem entra no site com Google cria uma senha em gamezoney.com › Entrar › Esqueci a senha.
  - O Servidor confere o plano sozinho com gamezoney.com a cada 6 horas (e ao abrir). Renovou no site? Ele recebe a nova validade sozinho; **Atualizar plano** confere na hora. **Sem internet**, o plano continua valendo até a data mostrada.
  - **Renovação pendente:** se a renovação não for paga, aparece um aviso no topo e o plano continua funcionando por **7 dias**. Depois, ou ao fim do teste sem plano, os dados continuam guardados e o painel abre normalmente, mas ficam bloqueados **recargas, iniciar sessão, visitantes, PDV, Corujão/Viradão, abrir caixa e cadastrar cliente** até entrar com uma conta com plano ativo. Sessões em andamento continuam até o fim. Voltar o relógio do Windows não estende o teste nem o plano.
  - **Uma conta = um servidor por vez.** Ao entrar com uma conta que já está em uso em outro computador, o painel pergunta se quer **usar neste computador**; confirmando, o outro deixa de usar o plano na próxima conferência, e o dono recebe um e-mail avisando. **Sair da conta** desconecta este computador (para entrar em outro).
  - **Trocar o PC da recepção:** faça o backup completo, instale o Servidor no computador novo, restaure o backup e entre com a conta. Reinstalar o Servidor no mesmo computador não reinicia o teste.
  - **Licença vitalícia antiga (chave GZ-…):** virou plano **Standard por 12 meses** sem custo. O Servidor que já estava ativado continua funcionando e passa sozinho para o plano da conta quando tiver internet; dá para entrar com a conta a qualquer momento.
- **Proteção do sistema (1.0.7):** ao abrir, o GameZoney confere todos os seus arquivos. Se algum foi alterado, trocado ou apagado (por exemplo, por um antivírus ou por alguém tentando burlar a licença), aparece "Os arquivos do GameZoney Servidor foram alterados ou estão corrompidos": reinstale pelo instalador de gamezoney.com (os dados são mantidos). Se alguém tentar mexer no sistema em funcionamento (depurador), o painel mostra "Proteção do GameZoney ativada" e bloqueia recargas, sessões novas e vendas até fechar e abrir o GameZoney de novo.
- **Teste grátis por computador (1.0.7):** os 30 dias contam a partir da primeira vez que o GameZoney abriu **neste computador**; desinstalar, apagar os dados e reinstalar não reinicia o teste.
- **Atualização do sistema** (logo abaixo da Licença): mostra a versão instalada e o botão **Verificar atualização**.
  - Havendo versão nova, aparecem o número, o tamanho e o que mudou. **Baixar atualização** (com plano Standard/Pro ativo) baixa e confere o arquivo: só é aceito o instalador **assinado pela GameZoney** e com a **impressão digital (SHA-256)** certa; arquivo trocado ou corrompido é apagado e nada é instalado. No teste grátis, use **Baixar em gamezoney.com** (Minha conta › Downloads).
  - **Instalar agora:** faz um **backup completo** antes (se o backup falhar, não instala), fecha o servidor por alguns minutos, o Windows pede a **permissão de administrador** e o GameZoney abre de novo sozinho, já na versão nova. As sessões em andamento continuam nos PCs e os dados são mantidos. Se a permissão for negada, o GameZoney abre de novo na versão anterior. O registro fica em `%LOCALAPPDATA%\GameZoney\updates\update.log`.
- **Configuração das máquinas** (vale para todos os PCs, nunca para TVs): **Bloquear Gerenciador de Tarefas** e **Bloquear Configurações** (fecha o app Configurações do Windows e o ajuste de data e hora durante a sessão). As antigas opções de Painel de Controle e da tela Ctrl+Alt+Del foram retiradas e ficam desligadas nos PCs. A coluna "Recebimento pelos clientes" mostra se cada PC aplicou. O modo administrador no PC suspende as restrições.
- **Contas de acesso:** administradores e operadores (senha de 4 a 24 caracteres). O administrador principal ativa/desativa contas.
- **Backup completo:** seção 16.
- **Servidor IP** (abaixo do backup): mostra o IP (ou o domínio, em nuvem) que as TVs e os PCs usam para chegar ao servidor — só o IP, sem a porta.
  - Botão **Servidor IP**: escolha a rede da máquina (**cabo de rede** ou **Wi-Fi**, com o IP de cada uma); ou **Servidor em nuvem / outro endereço** (domínio, ex.: `https://gamezoney.exemplo.com.br`).
  - Botão **Atualizar Automático ›**: use quando o IP da máquina mudar (troca de roteador, cabo ↔ Wi-Fi). No topo do resultado aparece se o servidor está **disponível localmente (rede local)** ou **em nuvem**.
    - **Rede local:** confere o IP em uso e ajusta o endereço, testa a conexão das TVs, a dos PCs e a busca dos PCs na rede e confere o **firewall do Windows** — se faltar regra, recria (o Windows pede confirmação de administrador). Os PCs reencontram o servidor no novo IP sozinhos.
    - **Nuvem** (endereço com domínio): mantém o endereço, confere se o domínio é encontrado e responde, e se o servidor também responde na rede local.
    - Também mostra a data e a hora do computador do servidor. O resultado aparece em lista (✔/✖) e vai para o Log.
- **Valor da hora:** fica na engrenagem do card **Valor da hora**, no Painel de controle (mudar o valor pede a senha do administrador).
- **Data e hora:** sempre as do computador do servidor (relógio do Windows); não há fuso para configurar.

---

## 16. Backup

- **Configuração > Backup completo do servidor:** backup diário automático (padrão às 03:00) em **Documentos\bkp gamezoney**, mais o botão **Criar backup completo agora**. Cada ZIP leva banco, usuários e senhas protegidas, saldos, histórico, faturas, despesas, fidelidade, configurações, imagens, pareamentos das TVs e a identidade dos PCs.
- Copie os ZIPs para **outro disco ou dispositivo** (um backup no mesmo HD não protege contra falha do HD). Os arquivos têm dados pessoais: guarde com acesso restrito. Cópias antigas não são apagadas sozinhas.
- **Restaurar:** encerre o servidor pelo ícone > menu Iniciar > GameZoney > **Restaurar backup GameZoney** > escolha o ZIP. Os dados atuais ficam guardados numa pasta `data-anterior-...`. Abra o servidor e entre com a conta do backup.

---

## 17. Cliente nos PCs

**Login.** O PC fica bloqueado na tela de login (com o fundo enviado pela recepção ou o padrão GameZoney). O cliente entra com **Usuário/Nick e senha** e precisa ter saldo; ou a recepção inicia a sessão pelo painel. Cliente sem senha cadastrada: ao entrar, aparece **Registrar senha** (Senha e Repetir senha), obrigatório. Depois de 7 tentativas erradas o PC bloqueia por 2 minutos. Durante a sessão, o cliente pode trocar a própria senha.

**Barra de tempo.**
- Fica no topo, por cima das janelas, com o tempo restante. A seta **︿** recolhe a barra numa **aba na barra de tarefas** do Windows; clicar na aba abre de novo.
- Em **tela cheia** (jogo em tela cheia, tela cheia em janela/sem borda, F11 ou vídeo em tela cheia no navegador) a barra e a aba somem, como a barra de tarefas do Windows, e voltam ao dar Alt+Tab ou sair do jogo. Navegadores e lançadores (Steam, Epic, Riot...) em janela mantêm a barra.
- **Últimos 5 minutos:** o tempo fica vermelho; em tela cheia aparece a barra pequena por alguns segundos.
- **Ctrl+Alt+T:** fora de tela cheia, reinicia a barra (se ela tiver sumido); em tela cheia, mostra a barra pequena por 5 segundos (apertar de novo esconde). A barra pequena por cima do jogo deixa o clique atravessar.
- Jogo em tela cheia exclusiva pode esconder tudo: prefira "tela cheia em janela/sem bordas".

**Fim da sessão (limpeza).** Os programas abertos **depois do login** (jogos, lançadores e seus auxiliares) são fechados; os que já estavam abertos antes do login ficam. Nada de perfis, senhas, favoritos ou arquivos é apagado. Jogos com anticheat que o Windows não deixa fechar: o cliente pede para fechar e, se ficar só o processo de fundo, libera o PC; se a janela do jogo continuar aberta, o PC fica bloqueado com o aviso até a janela fechar. O resumo da sessão aparece na tela por até 30 segundos.

**Proteção.** Durante a sessão o cliente aplica as restrições da Configuração das máquinas, fecha o Cheat Engine e o app Configurações/data e hora (se **Bloquear Configurações** estiver marcado). O tempo usa relógio interno, não o relógio do Windows. A pasta do programa fica protegida contra alteração por usuários comuns. O **MonitorGZ** reabre o cliente se ele for fechado à força (sem zerar o tempo nem duplicar crédito).

**Modo administrador (manutenção).**
- No PC, **Acesso administrativo (recepção)** com uma conta Administrador do servidor: a barra mostra ADMIN, as restrições ficam suspensas e não há consumo de saldo. **Sair do administrador** reaplica tudo. **Fechar aplicativo** fecha o cliente (para atualizar).
- Sem servidor, a **senha de manutenção** local do PC dá o mesmo acesso.
- Os PCs também podem ser liberados em modo administrador pelo painel (Ações dos PCs).

**Atalhos no menu Iniciar > GameZoney Cliente:**
- **Reconfigurar conexão com o servidor** — quando o servidor mudou de identidade ou o PC foi removido.
- **Reparar restrições do Windows** — quando o PC avisa que não conseguiu aplicar as restrições (o Windows negou a gravação).
- **Reparar conexão de rede** — refaz as regras do firewall.

---

## 18. Quedas de energia, de rede e de internet

- **Só o servidor caiu:** os PCs continuam a sessão e o relógio conta normalmente; ao voltar, o tempo é reconciliado. Depois de reiniciar, o servidor espera até **5 minutos** os PCs reconectarem (o roteador pode estar voltando junto) antes de usar os pontos de controle.
- **Queda da internet ou da rede (o PC ficou sem falar com o servidor):** depois de 10 segundos a estação fica **vermelha**, mas a **sessão continua ativa e o tempo segue contando** no PC e no servidor, pelo tempo que for preciso. O cliente pode continuar jogando o que não precisa de internet. Quando a conexão volta, a estação fica verde e o tempo é conferido com o do PC. Se o tempo acabar durante a queda, o PC bloqueia sozinho e o servidor encerra a sessão por tempo esgotado. O painel mostra "Sem conexão há X min. A sessão continua ativa".
- **Novos clientes durante a queda da internet:** entram normalmente, porque o login só usa a rede local (PC → servidor). Se a própria rede local cair (roteador desligado), ninguém consegue entrar até ela voltar, mas quem já está jogando continua.
- **PC desligado no meio da sessão:** a sessão não é mais encerrada sozinha depois de 1 minuto. Ao ligar o PC de novo, o cliente devolve o tempo a partir do momento em que ele desligou (recuperação automática). Se o PC não for ligado de novo, encerre a sessão pelo painel.
- **Queda geral (servidor e PCs):** os dois guardam pontos de controle da sessão. Ao voltar, é usado o **maior saldo seguro**, para o cliente não perder o tempo em que tudo ficou desligado. O painel mostra a auditoria; se ainda houver diferença, o administrador tem o botão **Devolver saldo** (único e registrado no log).
- Mensagens de conexão na tela do PC: "o servidor não respondeu… procurando na rede" (servidor fechado ou mudou de IP — o cliente reencontra sozinho), "a conexão 3443/TCP falhou" (firewall da recepção: use Reparar conexão de rede no servidor), "o servidor tem outra identidade" (use Reconfigurar conexão no PC). Registro em `%LOCALAPPDATA%\GameZoneyCliente\connection.log` no PC.

---

## 19. Remover, reinstalar e desinstalar

- **Remover computador** (painel): revoga a associação; histórico e saldos ficam. Para usar o PC de novo: no PC, **Reconfigurar conexão com o servidor** (senha de manutenção), siga a descoberta e autorize na recepção como **Novo computador**.
- **Manter o mesmo nome no painel:** remova o computador antigo e autorize o pedido como novo com o mesmo nome, ou use **Associação por arquivo (alternativa)** no cartão do PC e **Importar** no cliente.
- **Desinstalar o Cliente** (Configurações do Windows > Aplicativos): pede um administrador do servidor, retira as restrições e não deixa nada no PC (programa, dados, logs, inicialização automática, firewall e atalhos). Ao instalar de novo, o PC pede nova autorização.
- **Desinstalar o Servidor:** remove o programa e tudo o que o servidor criou no computador (pasta do programa, dados da janela do painel, banco de dados, pareamentos, certificados e registros), **menos os backups**. Antes de apagar, ele pergunta: **Sim** = remover tudo (menos os backups) · **Não** = manter os dados. Ao escolher Sim, uma cópia do banco é guardada antes em `%LOCALAPPDATA%\GameZoney\data\backups` (`antes-desinstalar-…sqlite`). Ficam: **Documentos\bkp gamezoney**, a pasta `data\backups` e as cópias `data-anterior-*` da restauração. Desinstalação silenciosa mantém os dados.

---

## 20. Problemas comuns

| Situação | O que fazer |
|---|---|
| Painel do servidor com a tela escura | Libere o Edge/WebView2 no programa que os desativou e instale o WebView2 Runtime da Microsoft; reabra o servidor |
| PC "Sem conexão com o servidor" | Confira se o servidor está aberto; leia o motivo na tela (seção 18); na recepção, Reparar conexão de rede |
| PC novo não aparece para autorizar | Mesma rede do servidor (não use Wi-Fi de visitantes); firewall do servidor (Reparar conexão de rede) |
| TV não troca de HDMI | Confira IP, entrada HDMI e pareamento (Parear TV); Testar HDMI |
| TV não mostra o resumo | Configuração > Servidor IP > **Atualizar Automático**; a TV precisa alcançar a porta 3000 |
| IP do servidor mudou | Configuração > Servidor IP > **Atualizar Automático** (ajusta o endereço, confere portas e firewall) |
| Recarga recusada "Abra o caixa" | Caixa > Abrir caixa |
| Barra do PC sumiu | Ctrl+Alt+T |
| PC preso em "Limpeza pendente" | Feche o jogo indicado na tela; ele libera sozinho |
| Esqueceu a senha do administrador | Restaure um backup (seção 16) ou peça suporte |
