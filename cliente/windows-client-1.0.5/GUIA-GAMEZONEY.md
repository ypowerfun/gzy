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


**Perfil** (botão ao lado de **Sair**): no topo, **Arena/Organização** — o nome da sua arena (o administrador digita e clica em **Salvar**; o operador só vê); depois **Alterar senha**; **Idioma** do painel — Português (Brasil), English, Español, Français ou Русский (vale para o seu usuário; o painel inteiro muda de idioma — menus, títulos, botões, campos, avisos, textos de ajuda, Estatística, Configuração, Ranking e mensagens do Log; nomes, nicks, produtos e outros dados cadastrados continuam como foram digitados); **Ajuda** (abre o site https://gamezoney.com/); **Feedback** (nome, email e comentário, enviados para a GameZoney; sem internet ou com o site fora do ar, o feedback fica guardado no servidor e é reenviado sozinho a cada 10 minutos).
---

## 1. Instalação

**Idioma do instalador**: os instaladores (Servidor, Cliente e o instalador único) abrem em **inglês** por padrão. A primeira tela pergunta o idioma: mantenha **English** ou troque para **Português (Brasil)**. No instalador único, o idioma escolhido vale também para o instalador do Servidor e do Cliente que ele abre. O desinstalador usa o mesmo idioma da instalação. Os nomes dos atalhos do menu Iniciar continuam em português (ex.: **Reparar conexao de rede**).

**Aviso azul "O Windows protegeu o computador" (Fornecedor desconhecido)**: aparece em qualquer programa baixado da internet **sem assinatura digital de código**. O GameZoney é seguro: os programas e instaladores levam **Empresa: GameZoney** (Propriedades › Detalhes) e só são publicados em gamezoney.com. Clique em **Executar assim mesmo** (em algumas versões do Windows, antes em **Mais informações**). Quando a GameZoney tiver o certificado de assinatura de código (veja `assinatura\LEIA-ME-ASSINATURA.md` no código-fonte), os instaladores passam a sair assinados e o Windows mostra **Fornecedor: GameZoney**.

**Servidor (PC da recepção)** — Windows 10/11 de 64 bits.
1. Execute o instalador (ou o instalador único e marque **Instalar Servidor**). Ele já leva o motor (Node), o banco e as ferramentas; não baixa nada.
2. O instalador configura o firewall do Windows (somente rede local) para as portas **3000/TCP** (TVs), **3443/TCP** (PCs) e **3444/UDP** (descoberta dos PCs). Se precisar repetir: menu Iniciar > GameZoney > **Reparar conexão de rede**.
3. O servidor abre sozinho quando a conta entra no Windows e fica no ícone perto do relógio. Clique com o botão direito no ícone para abrir o painel, o diagnóstico ou encerrar o servidor. Fechar a janela do painel não encerra o servidor. Ao escolher **Encerrar servidor**, aparece a janela "Encerrando o servidor…" e ele fecha em poucos segundos, mesmo com TVs desligadas ou sem resposta (as sessões continuam contando e são retomadas ao abrir de novo).
4. O painel abre em janela própria do GameZoney (motor WebView2 do Windows). **O WebView2 e o Edge não podem estar bloqueados** no PC do servidor (programas que "desativam o Edge" costumam bloquear também o WebView2 e o painel fica com a tela escura). O navegador padrão pode ser o Chrome ou outro. Em Windows sem o WebView2 (ex.: **Windows Server em VPS**, que vem só com o Internet Explorer), o **instalador instala o WebView2 da Microsoft sozinho** (precisa de internet). Se ainda faltar, ao abrir o painel o GameZoney pergunta se pode instalar e abre na janela própria em seguida. O painel **nunca abre** no Internet Explorer, Brave ou outro navegador.
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
3. A instalação nova vem sem estações (sem TV ou PC de exemplo). Cadastre as suas em **Painel de controle > + Nova estação** (seção 3) e as promoções em **Fidelidade > Promoções** (seção 10).
4. Crie as contas da equipe em **Configuração > Contas de acesso**: **Administrador** (tudo) ou **Operador** (atendimento: clientes, recargas, sessões, visitantes, PDV, histórico). Cada um troca a própria senha em **Perfil > Alterar senha** (botão **Perfil**, ao lado de **Sair**). Só o administrador principal (primeira conta) ativa/desativa contas.

---

## 3. Painel de controle

- Cada estação aparece como um monitor: **verde** = em uso, **dourado** = modo administrador, sem cor = livre/desligada. O ponto ao lado dos PCs indica conexão do cliente (verde conectado, vermelho sem contato). Clique no monitor para abrir as ações.
- **Iniciar sessão:** escolha o cliente (busca por nome, nick ou CPF) com saldo disponível. A sessão usa todo o saldo do cliente.
- **+ Adicionar tempo:** soma tempo na sessão em andamento sem reiniciar o relógio.
- **Encerrar:** encerra a sessão e devolve ao cliente os segundos não usados. No fim do tempo a sessão encerra sozinha.
- **Visitante / Visitantes em grupo:** seção 6.
- **Organizar A-Z / Z-A** muda a ordem dos monitores (fica guardado).
- **Ações dos PCs** (administrador): liberar em modo administrador, encerrar sessões, desligar e reiniciar — todas, disponíveis ou uma específica. Afeta só computadores, nunca TVs. Ao interromper uma sessão, o saldo restante volta ao cliente. **Desligar** ou **reiniciar** um PC em uso (aqui ou no Controle do PC) encerra a sessão na hora, no próprio servidor: o tempo para de contar e o que sobrou fica guardado no saldo do cliente, mesmo se o PC desligar sem conseguir avisar (visitante: o tempo que sobra não fica guardado, como sempre).
- **Ações dos PCs > Enviar Mensagem** (administrador): escolha um PC específico ou **Enviar para todos**, escreva a mensagem (até 200 caracteres; trecho entre `*asteriscos*` sai em dourado; Enter quebra a linha) e o **tempo na tela** em segundos. No PC aparece no canto superior esquerdo, com o título **AVISO DO SISTEMA**, só o texto (sem fundo), e some sozinha depois do tempo escolhido. O aviso **não recebe clique nem teclado e não tira o foco do jogo**. PC sem conexão não recebe (o resultado mostra quem recebeu). Em jogo de tela cheia exclusiva o Windows não deixa nada aparecer por cima; em tela cheia sem borda/janela aparece normalmente.
- **Avisos automáticos no PC** — Configuração › **Avisos automáticos no PC**: o mesmo tipo de mensagem do Enviar Mensagem aparece **sozinho** (1) quando o tempo da sessão estiver acabando (**Minutos antes de acabar**, padrão 5; mensagem editável, `{minutos}` vira os minutos que faltam) e (2) quando o **prêmio automático do programa fidelidade** é liberado (usa a Mensagem do prêmio da Fidelidade). Também define o **Tempo na tela (segundos)**, padrão 10. Vale só para PCs (não TVs). Se o cliente comprar mais tempo, o aviso de tempo volta a valer na próxima vez. Os avisos de antes continuam (barra vermelha nos últimos 5 minutos e o prêmio ao lado do nome).
- **Controle do PC** (no monitor do PC, administrador, com sessão ativa): bloquear/desbloquear a tela, lista de programas da sessão (fechar ou **Finalizar tarefa**), visualizar a tela (o PC mostra "TELA VISÍVEL À RECEPÇÃO"), reiniciar e desligar.
- **Layout do login:** envia uma imagem (JPG/PNG) de fundo para a tela de login daquele PC e a posição dos campos (esquerda, centro ou direita). "Remover imagem" volta ao fundo padrão GameZoney.
- **Remover computador:** aparece em PC desconectado/inativo e sem sessão. A associação é revogada; histórico e saldos ficam.

---

- **Impressões aguardando aprovação:** com o Controle de impressão ligado (Configuração), cada documento que o cliente manda imprimir aparece no topo do Painel de controle e **só imprime depois da aprovação**. **Aprovar** libera a impressão; **Aprovar e cobrar** lança o serviço (ex.: Impressão × páginas) como venda no caixa; **Recusar** apaga o documento da fila do PC. O cliente vê na tela "Sua impressão foi enviada para a recepção".
- **Ligar computadores:** em **Ações dos PCs › Ligar computadores**, **Ligar todos** liga pela rede (Wake-on-LAN) os PCs desligados, e **Ligar específico** liga o PC escolhido. Para funcionar: o PC precisa ter aberto uma vez com o GameZoney Cliente atualizado (ele informa o endereço da placa de rede), estar no **cabo de rede** e ter o **Wake-on-LAN ligado na BIOS** (opção "Wake on LAN", "Power On By PCI-E" ou parecida). "Desligar todas" continua igual.
- **Aparelhos na TV:** qualquer aparelho ligado na TV pelo **HDMI** (PS5, PS4, Xbox, Switch, retrô, simulador) é controlado do mesmo jeito: no fim do tempo a TV troca de entrada. **VR ligado a um PC** (SteamVR, Quest Link) é controlado pelo GameZoney Cliente. **PS VR2** (imagem vai do PS5 direto para o óculos) e **Meta Quest sozinho** não passam pela TV e não são controlados por ela.

## 4. TVs (VIDAA e Android)

Cadastre a TV em **Painel de controle > + Nova estação**: nome, tipo **Console**, **IP da TV**, **entrada HDMI** (1 a 4) e o **Sistema da TV**. No plano Pro aparece também **Tipo no app do cliente** (**Console/VR** ou **Simulador**; para computador: **PC**, **Console/VR** ou **Simulador**), que define o filtro e a foto da estação no app (console/VR com Xbox no nome mostra a foto do Xbox; com PS3, PS4, PS5 ou PlayStation, ou sem marca no nome, a do PlayStation):

- **VIDAA (Hisense/Toshiba):** use **Parear TV**; a TV mostra um PIN de 4 números; digite em **Informar PIN**. Pareamento antigo pode ser trazido com **Importar pareamento**.
- **Android TV / Google TV:** na TV, ative as Opções do desenvolvedor (Configurações > Sobre > clicar 7 vezes em Build) e ligue a **Depuração ADB pela rede**. Use **Parear TV** e aceite **Permitir depuração** na TV (marque "Sempre permitir").

**Remover console** (em vermelho, ao clicar na estação; só administrador e sem sessão em andamento): tira o console da lista; o histórico de sessões e faturas fica. Para usar de novo, cadastre em **+ Nova estação**.

Ao iniciar a sessão, a TV troca para a entrada HDMI do console. Ao terminar, a TV abre a página de **sessão finalizada** (logo, nome, início, término, tempo usado e devolvido; com o plano Pro e o **Personalizar visual**, aparecem a logo e a cor da sua arena). Depois de **10 segundos** o resumo some e entra um **wallpaper** em tela cheia, que fica até a recepção liberar o console de novo (assim o tempo do cliente não fica exposto na TV). A TV precisa alcançar a porta 3000 do servidor (e, no Android, ter um navegador instalado). **Testar HDMI** confere o controle. Se a troca falhar, a recarga com início imediato não é registrada — corrija a TV e tente de novo.

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

- **Foto do cliente:** em **Novo cliente** ou **Editar**, **Tirar foto** usa a câmera (webcam) da recepção — clique em **Capturar** — ou **Enviar arquivo** usa uma foto JPG/PNG. **Remover foto** apaga. A foto aparece na lista de clientes e entra no backup completo; ela **não** vai para a planilha de exportação.
- **Exportar clientes (administrador):** baixa uma planilha Excel com **Nome, Usuário/Nick, CPF, Telefone, E-mail, Tempo (saldo), Medalhas de fidelidade, Observações, Situação e Cadastro** de todos os clientes.
- **Importar planilha:** aceita as mesmas colunas (CPF, Telefone, E-mail, Observações e Situação são opcionais). Serve para levar os clientes para outro servidor e para **trocar de sistema** (NexCafé, HandyCafé e outros): exporte a lista de clientes do sistema antigo em Excel/CSV e importe aqui — o tempo entra como saldo e as medalhas como saldo inicial de fidelidade. CPF repetido ou inválido e e-mail inválido aparecem como erro na prévia; nicks que já existem não são alterados.

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

- **Código do produto:** cada produto ganha um número (coluna **Cód.** em Gerenciamento de Produtos). No PDV, digitar o código e apertar Enter adiciona o produto, como o código de barras.
- **Gerenciamento NF-e (plano Pro):** item próprio no menu, logo abaixo de **Produtos/Serviços**, para dar entrada no estoque com a nota do fornecedor e para emitir as notas fiscais de venda (só aparece com o plano Pro).
  - **+ Importar XML da nota:** escolha o arquivo XML da NF-e que o fornecedor envia (pode escolher vários). A mesma nota não entra duas vezes.
  - Os itens são **vinculados sozinhos** pelo código de barras (EAN) ou pelo vínculo já usado com aquele fornecedor. Os que ficarem **SEM VÍNCULO** pedem o **código do produto** (ou o código de barras): digite e clique em **Vincular**. Produto que ainda não existe: cadastre em Gerenciamento de Produtos e use o código dele.
  - **Converter em UN:** quando o item vem em caixa, pacote, fardo ou dúzia (CX, PCT, FD, DZ…), aparece **"Converter CX em UN"** com o campo **UN por CX**: informe quantas unidades vêm em cada embalagem (ex.: caixa com 12 latas = 12) e clique em **Vincular**. A entrada só libera depois disso, e o estoque entra em unidades. Itens em UN usam o campo **Un. por embalagem** (normalmente 1). O sistema lembra a conversão para as próximas notas do mesmo fornecedor.
  - **Dar entrada no estoque** só libera com todos os itens vinculados: soma o estoque e atualiza o **preço de custo** (o preço de venda não muda).
  - **Descartar:** nota ainda sem entrada sai da lista sem mexer no estoque.
  - **Cancelar entrada:** pede o **motivo** e a **senha do administrador** que está cancelando. O estoque que entrou é retirado (se parte já foi vendida, fica registrado o que faltou) e o custo volta ao anterior. Tudo fica no **Log** (tipo "nota").
  - O painel mostra as notas aguardando entrada, as entradas do mês (quantidade e valor), os fornecedores e as canceladas, com busca por número, fornecedor, CNPJ ou chave.

- **Notas fiscais de venda — NFC-e e NFS-e (plano Pro, pela Focus NFe):** em **Gerenciamento NF-e**, abas **Notas emitidas (NFC-e / NFS-e)** e **Configuração fiscal**.
  - **O que a arena precisa antes:** conta na **Focus NFe** (focusnfe.com.br), contratada e paga pela própria arena, com o **certificado digital A1** da empresa enviado no painel da Focus; **inscrição estadual** e **CSC** da Sefaz para a NFC-e; **inscrição municipal** para a NFS-e (e a cidade atendida pela Focus). Os códigos fiscais (NCM, CFOP, CST/CSOSN, item da lista de serviços, alíquota do ISS, códigos do IBS/CBS) são passados pelo **contador**.
  - **Configuração fiscal:** marque **Emitir notas fiscais**, escolha o ambiente (**Homologação** para testar, sem valor fiscal; **Produção** para notas válidas), cole o **token da Focus NFe** do mesmo ambiente e clique em **Testar conexão**. O token fica guardado só no servidor e não aparece mais na tela (para trocar, cole outro). Preencha CNPJ, razão social, inscrições, código IBGE do município, UF e regime (Simples, MEI ou normal).
  - **NFC-e (produtos do PDV):** CFOP, CST/CSOSN, origem e unidade padrão; NCM padrão opcional. Cada produto pode ter os próprios **NCM, CFOP e CST/CSOSN** em **Gerenciamento de Produtos › Editar › Dados fiscais para a NFC-e** (ou pela planilha de importação, colunas **NCM, CFOP, CST/CSOSN**). Produto sem NCM não sai na nota. Em **Cartão no PDV conta como**, escolha se o cartão do PDV entra como crédito ou débito.
  - **NFS-e (recargas de tempo e serviços):** escolha o padrão **da prefeitura (municipal)** ou **NFS-e Nacional**. Municipal: item da lista de serviços (LC 116), código tributário do município, CNAE e alíquota. Nacional: código de tributação nacional do ISSQN, CST e classificação do IBS/CBS (reforma tributária), série e próximo número da DPS. Marque **Incluir os serviços vendidos no PDV** para que xerox, impressão, Corujão etc. também saiam em NFS-e.
  - **Emissão:** com **Emitir sozinho** ligado, cada venda do PDV (parte dos produtos = NFC-e; parte dos serviços = NFS-e) e cada recarga paga (balcão, visitante, PIX no PC) entra na fila em poucos segundos. Só entram as vendas feitas **depois** de ligar. Cliente com CPF no cadastro sai identificado na NFS-e; visitante e cliente sem CPF saem como consumidor não identificado.
  - **Sem internet:** a venda nunca trava. A nota fica **Pendente** e é reenviada sozinha quando a conexão volta (sem duplicar). A NFS-e passa por **Processando** até a prefeitura responder.
  - **Notas emitidas:** situação de cada nota (Pendente, Processando, Autorizada, Com erro, Cancelada), com **DANFC-e** / **Ver nota**, **XML** e **Consulta** (abrem no navegador para imprimir ou mandar ao contador). **Com erro** mostra a mensagem da Sefaz ou da prefeitura: corrija (ex.: o NCM do produto) e clique em **Reenviar**.
  - **Cancelar nota:** pede o **motivo** (15 a 255 caracteres) e a **senha do administrador**. A NFC-e só pode ser cancelada em até **30 minutos** depois de autorizada; a NFS-e depende da prefeitura (algumas só cancelam no site delas). Cancelar a venda no PDV **não** cancela a nota: cancele também em Notas emitidas.
  - Tudo fica no **Log** (tipo "fiscal"): notas autorizadas, recusadas e canceladas.
- **Importar produtos:** em **Gerenciamento de Produtos › Importar planilha**, use Excel (.xlsx) ou CSV com **Código, Nome, Categoria, Custo, Preço de venda e Margem (%)** (opcionais: Código de barras, Estoque e, para a nota fiscal, NCM, CFOP e CST/CSOSN). Clique em **Baixar modelo** para ver o formato. A prévia mostra cada linha como **NOVO**, **ATUALIZA** ou **ERRO** antes de confirmar. O produto que já tem o mesmo código (Cód.), código de barras ou nome é atualizado; os outros são cadastrados. Com margem, o preço de venda é calculado (custo + margem, arredondado para cima no real). Categorias novas são criadas. Sem a coluna Estoque, o estoque não muda. O código de outro sistema (ou o EAN) vira o código de barras do produto.
- **Leitor de código de barras e de QR Code:** qualquer leitor USB ou Bluetooth que funcione como teclado (o padrão desses aparelhos; configure com **Enter no final**) é reconhecido em qualquer tela, sem precisar clicar num campo:
  - em **Vendas (PDV)**, o bipe adiciona o produto ao carrinho;
  - em **Gerenciamento de Produtos** e **Estoque**, abre o produto para editar; código novo oferece **cadastrar** com o código já preenchido;
  - nas outras telas, mostra nome, preço e estoque (consulta de preço).
  O campo **Código de barras / QR Code** do produto aceita também o texto de um QR Code. Um QR Code com endereço também é aceito quando termina com o código cadastrado. Se o leitor estiver no modo serial (COM), mude para o modo **USB HID / teclado** (código no manual do leitor). Leitores com idioma do teclado diferente podem trocar símbolos em QR Codes com endereço: números e letras saem sempre certos.

## 9. Faturas (administrador)

- Escolha **Diário, Mensal ou Anual**, a data e, se quiser, um **Usuário/Nick**, e clique em **Atualizar**. Na mesma linha: **Exportar relatório CSV** e **+ Despesa**.
- Mostra receita válida, despesas, resultado (receita − despesas), ticket médio, evolução por dia e a lista de faturas e transações (recargas e vendas do PDV).
- **Ver fatura** → imprimir ou salvar em PDF (comprovante interno, não fiscal). O comprovante sai limpo, sem o endereço/IP do servidor, data de impressão ou título do navegador no topo e no rodapé.
- **Cancelar** exige motivo, mantém o registro no histórico e estorna minutos e medalhas. Não é permitido se o cliente já usou o tempo/medalhas ou se a recarga foi feita durante uma sessão.
- O CSV inclui todas as transações e despesas do período, inclusive as canceladas (identificadas), e abre no Excel.

---

## 10. Fidelidade, medalhas e promoções

- **Promoções** (botão na tela **Fidelidade**, ao lado de **Mensagem do prêmio**): cadastre nome, minutos e preço total; edite, desative ou remova. As promoções ativas aparecem no Adicionar tempo e no Visitante. Alterar uma promoção não muda recargas já registradas.
- **Configurar programa:** todos os clientes ativos participam automaticamente (menos os que estiverem com "Ativar programa fidelidade" desmarcado). As **medalhas** (antes chamadas de pontos) só são geradas em **recargas com promoção**, pela regra de valor x medalhas, que pode variar por dia da semana, e na participação em **Corujão/Viradão**. Defina quantas medalhas liberam o prêmio e quantos minutos ele dá (ex.: 10 medalhas = 60 minutos). **Instalação nova:** o programa vem **zerado** (medalhas necessárias, minutos do prêmio, valor gasto e medalhas de cada dia = 0); nada rende até o administrador colocar os valores que quiser. Com 0 medalhas necessárias ou 0 minutos, o prêmio fica desligado; com R$ 0 ou 0 medalhas num dia, aquele dia não rende medalhas. Servidores que já estavam configurados continuam com os valores salvos.
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
- No plano Pro, os clientes também veem os três Top 10 no **app do cliente** (app.gamezoney.com), na aba **Ranking**, só com os nicks.

## 15. Configuração (administrador)

A Configuração é dividida em **abas no topo** (como Caixa e Produtos/Serviços): **Licença, Personalizar visual, Contas de acesso, Máquinas, Backup, Servidor IP, Autoatendimento, Avisos no PC, Impressão, Boot pela rede e Multi-Unidade**. Clique na aba para ver só aquela área, sem rolar a página; o painel lembra a última aba aberta.

- **Licença** (primeira aba da Configuração): o GameZoney pode ser usado grátis, com as **funções essenciais e o autoatendimento**, por **30 dias** a partir da primeira vez que o Servidor abre. Depois, ele funciona com um **plano da sua conta gamezoney.com** (**Standard** ou **Pro**, mensal ou anual, com renovação automática no cartão). O quadro mostra a situação (**Teste grátis**, **Plano Standard/Pro ativo**, **renovação pendente**, **plano vencido** ou **teste encerrado**), a conta, até quando vale e o **código desta instalação**.
  - **Ver planos** abre gamezoney.com: o dono da arena cria a conta (e-mail/senha ou Google), escolhe o plano e o período e paga com cartão de crédito no próprio site.
  - **Entrar com a conta gamezoney.com**: digite o **mesmo e-mail e senha do site** (precisa de internet nesse momento). O plano passa a valer neste computador. A senha **não** fica guardada no Servidor. Quem entra no site com Google cria uma senha em gamezoney.com › Entrar › Esqueci a senha.
  - O Servidor confere o plano sozinho com gamezoney.com a cada 6 horas (e ao abrir). Renovou no site? Ele recebe a nova validade sozinho; **Atualizar plano** confere na hora. **Sem internet**, o plano continua valendo até a data mostrada.
  - **Renovação pendente:** se a renovação não for paga, aparece um aviso no topo e o plano continua funcionando por **7 dias**. Depois, ou ao fim do teste sem plano, os dados continuam guardados e o painel abre normalmente, mas ficam bloqueados **recargas, iniciar sessão, visitantes, PDV, Corujão/Viradão, abrir caixa e cadastrar cliente** até entrar com uma conta com plano ativo. Sessões em andamento continuam até o fim. Voltar o relógio do Windows não estende o teste nem o plano.
  - **Uma conta = um servidor por vez.** Ao entrar com uma conta que já está em uso em outro computador, o painel pergunta se quer **usar neste computador**; confirmando, o outro deixa de usar o plano na próxima conferência, e o dono recebe um e-mail avisando. **Sair da conta** desconecta este computador (para entrar em outro).
  - **Trocar o PC da recepção:** faça o backup completo, instale o Servidor no computador novo, restaure o backup e entre com a conta. Reinstalar o Servidor no mesmo computador não reinicia o teste.
  - **Licença vitalícia antiga (chave GZ-…):** virou plano **Standard por 12 meses** sem custo. O Servidor que já estava ativado continua funcionando e passa sozinho para o plano da conta quando tiver internet; dá para entrar com a conta a qualquer momento.
  - **O que cada plano libera:**
    - **Free (teste grátis de 30 dias, sem entrar na conta):** funções essenciais (sessões, caixa, vendas, clientes, fidelidade, Corujão/Viradão, avisos, Wake-on-LAN…) e **Autoatendimento no PC** (PIX e criar conta); PCs e consoles ilimitados; sem cartão de crédito; os dados ficam guardados ao assinar. **Controle de impressão, Gerenciamento NF-e, Gerenciar App e Multi-Unidade ficam bloqueados** até entrar com a conta de um plano.
    - **Ao entrar com a conta gamezoney.com** (Configuração › Licença), o servidor identifica o plano e libera os recursos dele na hora.
    - **Standard:** todas as funções do dia a dia — PCs, consoles, VR e simuladores ilimitados (VR/simulador em PC usa o GameZoney Cliente; ligado na TV pelo HDMI é controlado pela TV), layout personalizado do login (Servidor/Cliente), **PIX integrado no PC (autoatendimento)**, **Controle de impressão** (só nos planos Standard e Pro), avisos automáticos, Wake-on-LAN, fidelidade, Corujão/Viradão, caixa, estoque e PDV, suporte completo.
    - **Pro:** tudo do Standard + **Gerenciar App** (app do cliente e conquistas) + **Gerenciamento de NF-e** (notas fiscais de entrada e **emissão de NFC-e e NFS-e** pela Focus NFe) + **Multi-Unidade** + **Personalizar visual** (logo e cor da arena) (Multi-Unidade = acompanhar várias lojas em Minha conta).
    - Nenhum plano mostra anúncios.
- **Proteção do sistema:** ao abrir, o GameZoney confere todos os seus arquivos. Se algum foi alterado, trocado ou apagado (por exemplo, por um antivírus ou por alguém tentando burlar a licença), aparece "Os arquivos do GameZoney Servidor foram alterados ou estão corrompidos": reinstale pelo instalador de gamezoney.com (os dados são mantidos). Se alguém tentar mexer no sistema em funcionamento (depurador), o painel mostra "Proteção do GameZoney ativada" e bloqueia recargas, sessões novas e vendas até fechar e abrir o GameZoney de novo.
- **Servidor reinstalado:** se o GameZoney Servidor for desinstalado e instalado de novo **sem restaurar o backup**, ele ganha uma identidade nova e os PCs não o reconhecem mais como o mesmo. Agora cada PC percebe isso sozinho: se em 90 segundos só aparecer na rede esse servidor novo (e nenhum com a identidade antiga), o PC pede autorização a ele. Aprove em **Computadores › solicitações** e confirme o código na tela do PC, como na primeira instalação. Uma sessão em andamento **não é interrompida**: o PC espera ela terminar para pedir. Se o servidor antigo voltar antes da aprovação, o PC volta para ele sozinho. Com vários servidores desconhecidos na rede, o PC não escolhe nenhum. Para não precisar aprovar os PCs de novo, ao reinstalar use **Restaurar backup GameZoney** (menu Iniciar) com o backup de Documentos\gamezoney\backup: a identidade antiga volta junto e os PCs reconectam sozinhos.
- **Abertura:** ao abrir, aparece a janelinha "GameZoney — Iniciando o servidor…" e o painel abre assim que o servidor fica pronto (normalmente em 1 a 2 segundos, mesmo com anos de dados; na primeira abertura depois de instalar pode levar um pouco mais, porque o antivírus examina os arquivos novos). Ao encerrar pelo ícone, a janela do painel some na hora e aparece "Encerrando o servidor…" por poucos segundos. Não precisa clicar de novo: se clicar, o GameZoney espera e mostra o painel quando estiver pronto.
- **Teste grátis por computador:** os 30 dias contam a partir da primeira vez que o GameZoney abriu **neste computador**; desinstalar, apagar os dados e reinstalar não reinicia o teste.
- **Atualizar o GameZoney:** baixe o **GameZoney-Instalador.exe** em gamezoney.com › Minha conta › Downloads. No PC da recepção, encerre o servidor pelo ícone ao lado do relógio e instale por cima marcando **GameZoney Servidor**; nos PCs, use **Fechar aplicativo** no modo administrador e instale marcando **GameZoney Cliente**. Os dados, saldos e configurações são mantidos (faça um backup completo antes, por segurança).
- **Leve nos PCs e no servidor:** o GameZoney Cliente mantém **uma única conexão** aberta com o servidor (não abre um programa novo a cada consulta) e conversa com ele a cada **5 segundos** (a cada 2 segundos só enquanto a recepção está vendo a tela daquele PC ou há impressão esperando aprovação). Com o PC livre, as impressoras só são conferidas quando o Windows avisa de um documento novo (ou a cada 10 segundos). No servidor, o histórico com mais de **90 dias** (sessões encerradas, recargas já usadas, cupons, extrato de medalhas e movimentos de estoque) fica guardado numa parte própria do banco de dados: o servidor trabalha só com os últimos meses e fica rápido mesmo depois de anos de uso. **Nada é apagado** — relatórios, Estatística, Faturas, Sessão, extrato de medalhas, Ranking e caixas antigos continuam mostrando o período inteiro. Na primeira vez, o servidor faz uma cópia do banco antes (pasta `backups` dos dados). Cupons antigos podem ser reimpressos e cancelados como antes; recargas antigas já usadas continuam sem poder ser canceladas.
- **Configuração das máquinas** (vale para todos os PCs, nunca para TVs): **Bloquear Gerenciador de Tarefas** e **Bloquear Configurações** (fecha o app Configurações do Windows e o ajuste de data e hora durante a sessão). As antigas opções de Painel de Controle e da tela Ctrl+Alt+Del foram retiradas e ficam desligadas nos PCs. A coluna "Recebimento pelos clientes" mostra se cada PC aplicou. O modo administrador no PC suspende as restrições.
- **Nome da arena/organização** (todos os planos): fica no **Perfil** (botão ao lado de **Sair**), no campo **Arena/Organização**; só o administrador muda. O nome sai no topo do cupom de venda, no fechamento de caixa, nas faturas, no relatório financeiro (CSV) e no nome das planilhas e PDFs exportados (clientes, sessões, fidelidade, Log). Em branco, sai **GameZoney**.
- **Personalizar visual** (plano Pro): logo da sua arena no lugar da logo GameZoney, no painel e nos PCs, e a **cor de destaque** (o dourado). Envie a **logo do Servidor** em PNG (até 1 MB); marque **Usar a mesma logo nos PCs** ou envie outra **logo dos PCs**. **Tamanho ideal (OBS na própria tela):** logo do Servidor (painel, canto superior esquerdo) **horizontal, 960 × 250 px** (proporção 4:1); logo dos PCs (também na tela da TV e no **app do cliente**) **quadrada, 512 × 512 px**; PNG com fundo transparente, desenho centralizado e pouca margem. Usando a mesma logo nos dois, prefira a quadrada (logo muito larga e baixa fica pequena nos PCs e no app). A logo dos PCs (ou, sem ela, a do Servidor) também aparece no topo do **app do cliente** no lugar do ícone GZ, e trocar a logo troca no app sozinho (o cliente vê ao abrir ou atualizar o app). A cor é sugerida a partir da logo e pode ser ajustada (cores muito escuras são recusadas, para os textos continuarem legíveis); a prévia mostra como fica. **Aplicar visual** recarrega o painel com a logo e a cor novas. O fundo escuro, os textos e as cores de aviso continuam iguais: só a aparência muda. Os PCs recebem o visual sozinhos e aplicam quando o GameZoney Cliente abrir de novo (ex.: ao reiniciar o PC). A **tela da TV no fim da sessão** (resumo com nome, horários e tempo) passa a mostrar a mesma logo dos PCs e o título na sua cor, na hora. **Voltar ao padrão GameZoney** apaga a personalização. Se o plano deixar de ser Pro, o visual GameZoney volta sozinho (a personalização fica guardada e volta com o Pro). As logos ficam na pasta de dados e entram no backup completo.
- **Contas de acesso:** administradores e operadores (senha de 4 a 24 caracteres). O administrador principal ativa/desativa contas.
- **Backup completo:** seção 16.
- **Servidor IP** (abaixo do backup): mostra o IP (ou o domínio, em nuvem) que as TVs e os PCs usam para chegar ao servidor — só o IP, sem a porta.
  - Botão **Servidor IP**: escolha a rede da máquina (**cabo de rede** ou **Wi-Fi**, com o IP de cada uma); ou **Servidor em nuvem / outro endereço** (domínio, ex.: `https://gamezoney.exemplo.com.br`).
  - **Rede com vários roteadores, switches ou pontos de Wi-Fi** (sub-redes, ex.: recepção em 192.168.0.x e PCs em 192.168.1.x): funciona, desde que tudo seja a rede da própria arena. O firewall do GameZoney aceita as faixas de rede privada (10.x, 172.16–31.x, 192.168.x) e nunca a internet. O PC novo procura a recepção também nas outras faixas; se não achar sozinho, clique em **Informar IP do servidor** na tela de configuração do PC e digite o IP que aparece aqui. Depois de autorizado, o PC pode mudar de faixa/roteador sem nova autorização, e se a recepção ganhar outro IP os PCs a encontram de novo sozinhos. Rede de visitantes isolada (que bloqueia a comunicação entre aparelhos) continua impedindo a conexão. Ligar os PCs pela rede (Wake-on-LAN) em outra faixa depende do roteador repassar o pacote.
  - Botão **Atualizar Automático ›**: use quando o IP da máquina mudar (troca de roteador, cabo ↔ Wi-Fi). No topo do resultado aparece se o servidor está **disponível localmente (rede local)** ou **em nuvem**.
    - **Rede local:** confere o IP em uso e ajusta o endereço, testa a conexão das TVs, a dos PCs e a busca dos PCs na rede e confere o **firewall do Windows** — se faltar regra, recria (o Windows pede confirmação de administrador). Os PCs reencontram o servidor no novo IP sozinhos.
    - **Nuvem** (endereço com domínio): mantém o endereço, confere se o domínio é encontrado e responde, e se o servidor também responde na rede local.
    - Também mostra a data e a hora do computador do servidor. O resultado aparece em lista (✔/✖) e vai para o Log.
- **Valor da hora:** fica na engrenagem do card **Valor da hora**, no Painel de controle (mudar o valor pede a senha do administrador).
- **Data e hora:** sempre as do computador do servidor (relógio do Windows); não há fuso para configurar. O servidor usa o fuso do Windows; se o fuso não for reconhecido, ou se o relógio tiver sido acertado à mão (ex.: horário de verão desligado), vale **a hora que o computador está mostrando**. Para dar o nome certo ao fuso, o servidor usa o **país do Windows** (região e idioma): no Brasil reconhece Fernando de Noronha (UTC−2), Brasília (UTC−3), Amazonas (UTC−4) e Acre (UTC−5); também Argentina, Bolívia, Peru, Uruguai, Paraguai, Venezuela, Chile, Colômbia, Equador, México, EUA, Canadá, Portugal e outros. Confira a região em Configurações do Windows › Hora e idioma › Região. Ajustou o relógio do Windows? Feche e abra o GameZoney Servidor (ou use **Atualizar Automático**) para ele passar a usar a hora nova.

---

- **Gerenciar App (plano Pro):** item próprio no menu, abaixo do **Ranking** (só aparece com o plano Pro, para administradores), com duas abas:
  - **App do cliente:** marque **Ligar o app do cliente**, escolha o **endereço** (letras minúsculas, números e hífen, ex.: `arena-centro`) e clique em **Salvar**. O link dos clientes é **app.gamezoney.com/** seguido do endereço (ex.: **app.gamezoney.com/arena-centro**); divulgue no balcão, nas redes sociais e no papel de parede dos PCs. Precisa estar com a conta gamezoney.com do plano Pro em Configuração › Licença e com internet; **não precisa de domínio, VPS nem abrir portas** (o servidor se liga sozinho ao gamezoney.com). A situação mostra **Conectado ao app.gamezoney.com** quando está tudo certo. No celular, o cliente entra com o **mesmo nick e senha do PC** e vê: **Início** (saldo de tempo, medalhas, progresso da fidelidade e o tempo da sessão em andamento), **Estações** (livres, ocupadas com o tempo que falta, em manutenção ou desligadas; filtro **PCs, Consoles/VR e Simuladores**, conforme o **Tipo no app do cliente** de cada estação, cada uma com a foto do tipo), **Conquistas** (progresso de cada uma), **Ranking** (os mesmos Top 10 do painel: **Medalhas**, **Corujão/Viradão** e **Recargas do mês**, só com o nick de cada cliente e, nas recargas, a quantidade, sem valores; a linha do próprio cliente aparece marcada como "você") e **Histórico** (sessões, recargas e medalhas). O visual do app é preto com detalhes dourados; com o **Personalizar visual** (Pro), o app usa a logo e a cor da arena (ex.: azul) em todo o efeito. O app só mostra informações: recargas e sessões continuam na recepção e nos PCs. Os dados dos clientes não ficam guardados no site: ficam no servidor da arena e só passam pelo gamezoney.com na hora da consulta. Com o servidor desligado ou sem internet, o app avisa que a arena está sem conexão. Trocar a senha do cliente desconecta o app dele; 5 senhas erradas seguidas bloqueiam o login daquele nick por 15 minutos.
  - **Conquistas:** **+ Nova conquista** com ícone, nome, descrição, o que o cliente precisa (**Horas jogadas**, **Sessões jogadas**, **Participações em Corujão/Viradão** ou **Recargas (R$)**), a **meta** e quantas **medalhas** ela dá. Quando o cliente completa, as medalhas entram na Fidelidade (aparecem no extrato como "Conquista: nome") e, se ele estiver jogando, aparece o aviso no PC. Quem **já cumpre a meta** recebe assim que a conquista é criada. Cada conquista é entregue uma vez por cliente; **Editar** muda nome, meta e medalhas (vale para quem ainda não completou) e **Remover** tira da lista (quem já completou continua com as medalhas). Visitantes não participam. Cliente com fidelidade desligada completa a conquista, mas sem medalhas.
- **Multi-Unidade (plano Pro):** acompanhe faturamento, caixa, PCs em uso e estatísticas de cada loja à distância, em **gamezoney.com › Minha conta › Unidades** (celular ou computador). Cada conta registra até **5 unidades**; para registrar mais, abra um chamado em Minha conta › Suporte ou escreva para suporte@gamezoney.com.
  - Dê um **nome à unidade**, marque **Enviar o resumo desta unidade** e clique em **Salvar**. O resumo vai a cada 5 minutos (não vão nomes, CPF ou telefone de clientes). Começa **desligado**.
  - **Várias filiais numa só conta:** na conta do gestor, em Minha conta › Unidades, clique em **Gerar código** e cole o código (GZU-XXXX-XXXX) em **Código de vínculo do gestor** no servidor de cada loja.
  - Cada loja precisa do seu próprio plano Pro (uma conta = um servidor por vez). Gerar outro código ou remover a unidade no site para de mostrar a loja.

- **Controle de impressão** (planos **Standard** e **Pro**; no teste grátis fica bloqueado e os PCs imprimem direto): marque **Exigir aprovação da recepção para imprimir** e escolha o serviço usado na cobrança (ex.: Impressão). Vale para as impressoras instaladas nos PCs (USB ou rede), com o GameZoney Cliente atualizado. No modo administrador do PC nada é parado. A lista **Últimas impressões** mostra o que foi aprovado, cobrado, recusado ou cancelado no PC.
- **Boot pela rede (diskless):** pré-configuração para PCs sem disco que carregam o Windows de um **servidor de imagem** na rede (iSCSI + PXE, como CCBoot ou iCafeCloud, instalado à parte — o GameZoney não substitui esse servidor). Informe o IP do servidor de imagem, a porta iSCSI (3260), o servidor PXE e a imagem, e marque os PCs que dão boot pela rede. **Salvar e conferir** testa se o servidor de imagem responde e se os PCs já têm o MAC para ligar pela rede. O GameZoney Cliente vai instalado dentro da imagem.

- **Autoatendimento no PC:** a tela de login do PC fica com os botões **Entrar · Criar conta · Pagar via PIX** (nessa ordem; Criar conta e Pagar via PIX só aparecem quando ligados aqui). Durante a sessão, a barra do tempo ganha **+ Tempo** (PIX).
  - **Criar conta:** nome, nick, telefone (WhatsApp), senha e confirmar senha → **Criar conta** (ou Cancelar). Com o PIX ligado, abre na hora a **forma de pagamento** (PIX): o cliente escolhe o pacote, paga o QR Code e, aprovado, aparece a caixa **Pagamento aprovado!**: o tempo já está na conta nova e o cliente entra com o **login e a senha** dele (o nick já fica preenchido).
  - **Pagar via PIX (sem conta):** só o **e-mail** + o pacote; aprovado, o PC é **liberado na hora** como **visitante** com o tempo contando (igual ao Visitante da recepção, com o e-mail guardado). Quem já tem conta clica em **Já tenho conta** e paga com nick e senha; aprovado, aparece a caixa **Pagamento aprovado!** e o cliente entra com o login e a senha.
  - **+ Tempo:** com a sessão em andamento, o cliente compra mais tempo por PIX; aprovado, o tempo entra na sessão deste PC.
  - **OBS em cima do QR Code:** preencha **Nome da organização ou do proprietário**; no PC aparece "OBS: <nome>" acima do QR Code (em todos os pagamentos), para o cliente conferir para quem está pagando.
  - **Testar Mercado Pago** (ao lado de Salvar, com o Access Token salvo): confere se o servidor alcança o Mercado Pago e se o Access Token é aceito, mostrando a conta que vai receber os PIX. Não é preciso liberar nada no firewall: o servidor só faz uma conexão de saída HTTPS (porta 443) para api.mercadopago.com, que o Windows já permite; os PCs não falam com o Mercado Pago, só com o servidor.
  - **Permitir que o cliente crie a própria conta no PC:** o cliente informa nome, nick, telefone (opcional) e a senha, e já entra com ela.
  - **Recarga por PIX no PC:** o cliente digita o nick e a senha, escolhe o pacote (os **valores** configurados e, se marcado, as **promoções** ativas), paga o QR Code (ou o PIX copia e cola) no app do banco e, assim que o pagamento é aprovado, o tempo entra sozinho na conta e aparece a caixa **Pagamento aprovado!** pedindo para o cliente entrar com o **login e a senha** — sem fila no balcão. Pago só com o **e-mail** (sem conta), o PC é **liberado na hora** da aprovação. O PIX expira em 15 minutos.
  - **Pacotes no PC:** os pacotes que aparecem no PC são as **promoções cadastradas em Promoções**. Em Configuração › Autoatendimento no PC › **Pacotes no PC**, marque quais promoções o cliente vê (nome, preço e tempo iguais aos da promoção). Promoção nova não entra sozinha: volte aqui e marque. Promoção inativa ou sem preço aparece desmarcada e não pode ser escolhida. (O antigo campo de valores em reais saiu; para cobrar um valor solto, use o Outro valor.)
  - **Outro valor:** marque **Permitir que o cliente digite o valor que quiser** e informe o **Valor mínimo** (ex.: 5,00 = aceita PIX de R$ 5,00 para cima) e o **Valor máximo**. No PC aparece **Outro valor** na lista de pacotes; o cliente digita quanto quer pagar e vê na hora quanto tempo ganha (calculado pelo valor da hora). Os pacotes prontos e as promoções continuam aparecendo.
  - O PIX cai na conta **Mercado Pago da arena**: cole o **Access Token de produção** (APP_USR-…) do Mercado Pago da arena. Ele fica guardado só neste servidor e não aparece de novo na tela; **Remover o Access Token** apaga.
  - A recarga entra como **venda PIX no caixa aberto** (operador "pix-automatico"). Com o caixa fechado, o PIX no PC fica indisponível. O servidor confere os pagamentos no Mercado Pago a cada poucos segundos, inclusive se o PC for desligado no meio. **Últimos PIX no PC** mostra cada pagamento (aguardando, pago, expirado). Se aparecer "Pago • lance manual", lance a recarga na recepção.

## 16. Backup

- **Configuração > Backup completo do servidor:** backup diário automático (padrão às 03:00) em **Documentos\gamezoney\backup**, mais o botão **Criar backup completo agora**. Cada ZIP leva banco, usuários e senhas protegidas, saldos, histórico, faturas, despesas, fidelidade, configurações, imagens, pareamentos das TVs e a identidade dos PCs. **Ficam guardados os backups automáticos dos últimos 7 dias** (os mais antigos são apagados sozinhos depois de cada backup automático que dá certo); **os backups feitos pelo botão Criar backup completo agora nunca são apagados**. Ao atualizar, os backups da pasta antiga **Documentos\bkp gamezoney** são movidos para **Documentos\gamezoney\backup** (nada é apagado; os antigos que o servidor não sabe se foram automáticos são tratados como manuais e ficam guardados).
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

**Fim da sessão (limpeza).** Os programas abertos **depois do login** (jogos, lançadores e seus auxiliares) são fechados; os que já estavam abertos antes do login ficam. Nada de perfis, senhas, favoritos ou arquivos é apagado. O resumo da sessão aparece na tela por até 30 segundos. Se algum programa não fechar (anticheat/administrador ou janela que não fecha), o PC **não fica mais bloqueado** em "Limpeza pendente": a tela avisa quais programas continuam abertos, o próximo cliente entra normalmente e pode fechá-los (fica anotado no `session-cleanup.log`).

**Proteção.** Durante a sessão o cliente aplica as restrições da Configuração das máquinas, fecha o Cheat Engine e o app Configurações/data e hora (se **Bloquear Configurações** estiver marcado). O tempo usa relógio interno, não o relógio do Windows. A pasta do programa fica protegida contra alteração por usuários comuns. O **MonitorGZ** reabre o cliente se ele for fechado à força (sem zerar o tempo nem duplicar crédito).

**Modo administrador (manutenção).**
- No PC, **Acesso administrativo (recepção)** com uma conta Administrador do servidor: a barra mostra ADMIN, as restrições ficam suspensas e não há consumo de saldo. **Sair do administrador** reaplica tudo. **Fechar aplicativo** fecha o cliente (para atualizar).
- Sem servidor, a **senha de manutenção** local do PC dá o mesmo acesso.
- Os PCs também podem ser liberados em modo administrador pelo painel (Ações dos PCs).
- **Manutenção do Windows sem o cliente abrir:** entre no PC como administrador (modo administrador › **Fechar aplicativo**), abra o **Gerenciador de Tarefas › Inicializar** (ou Configurações › Aplicativos › Inicialização) e **Desabilite** a entrada **GameZoneyCliente** (MonitorGZ). Ao reiniciar, o GameZoney Cliente **não abre** (fica anotado no `monitor.log`). Terminada a manutenção, **Habilite** a entrada de novo (ou reinstale o Cliente, que reativa sozinho) e reinicie. Só um administrador do Windows consegue desabilitar essa entrada; a conta dos clientes não. Pelo atalho da área de trabalho o cliente continua abrindo normalmente.

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
- **Desinstalar o Servidor:** remove o programa e tudo o que o servidor criou no computador (pasta do programa, dados da janela do painel, banco de dados, pareamentos, certificados e registros), **menos os backups**. Antes de apagar, ele pergunta: **Sim** = remover tudo (menos os backups) · **Não** = manter os dados. Ao escolher Sim, uma cópia do banco é guardada antes em `%LOCALAPPDATA%\GameZoney\data\backups` (`antes-desinstalar-…sqlite`). Ficam: **Documentos\gamezoney\backup**, a pasta `data\backups` e as cópias `data-anterior-*` da restauração. Desinstalação silenciosa mantém os dados.

---

## 20. Problemas comuns

| Situação | O que fazer |
|---|---|
| Painel do servidor com a tela escura | Libere o Edge/WebView2 no programa que os desativou e instale o WebView2 Runtime da Microsoft; reabra o servidor |
| Aviso "precisa do componente WebView2" (Windows Server/VPS) | Responda **Sim** para instalar (com internet) ou reinstale o GameZoney Servidor com internet; o servidor continua funcionando no ícone perto do relógio |
| PC "Sem conexão com o servidor" | Confira se o servidor está aberto; leia o motivo na tela (seção 18); na recepção, Reparar conexão de rede |
| PC novo não aparece para autorizar | Mesma rede da arena (não use Wi-Fi de visitantes); em outro roteador/Wi-Fi da arena, use **Informar IP do servidor** no PC; firewall do servidor (Reparar conexão de rede) |
| TV não troca de HDMI | Confira IP, entrada HDMI e pareamento (Parear TV); Testar HDMI |
| TV não mostra o resumo | Configuração > Servidor IP > **Atualizar Automático**; a TV precisa alcançar a porta 3000 |
| IP do servidor mudou | Configuração > Servidor IP > **Atualizar Automático** (ajusta o endereço, confere portas e firewall) |
| Recarga recusada "Abra o caixa" | Caixa > Abrir caixa |
| Barra do PC sumiu | Ctrl+Alt+T |
| PC preso em "Limpeza pendente" | O PC não fica mais preso: a tela avisa quais programas ficaram abertos; entre e feche-os na tela. Se persistir, atualize o GameZoney Cliente pelo GameZoney-Instalador.exe |
| Esqueceu a senha do administrador | Restaure um backup (seção 16) ou peça suporte |
