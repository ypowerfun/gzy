# GameZoney — site gamezoney.com (venda, contas e licenças)

> **Atualização premium (05/11/2026):** leia primeiro [ALTERACOES-PREMIUM.md](ALTERACOES-PREMIUM.md) para conhecer as mudanças, os testes e o procedimento de atualização de uma VPS existente.

Software proprietário e confidencial da GameZoney. Não divulgar.

O site roda no VPS da Oracle (Ubuntu 22.04 ARM, IP **137.131.177.64**) com banco de dados próprio (SQLite em `/var/lib/gamezoney-site/site.sqlite`, cópia automática diária em `/var/lib/gamezoney-site/backups`).

**O que o site faz:**
- **Página inicial:** título, subtítulo, tela do sistema num monitor, recursos, galeria de telas (capturas reais do painel em `public/img/telas/<tela>-<pt|en|es>.jpg`), preços, dúvidas e **Novas Atualizações**. Rodapé com idioma do site: **Português (Brasil), English, Español** (`public/i18n-site.js` + dicionário `public/i18n-site-dict.js`; ao criar texto novo, incluir a tradução). Os e-mails enviados pelo site continuam em português.
- **Contas:** criar conta com e-mail e senha ou **Entrar com Google**; também tem "esqueci a senha".
- **Minha conta:** downloads dos instaladores, licenças (chave e botão **Liberar** para trocar de computador), compra por **PIX** e chamados de suporte.
- **Compra:** com o Mercado Pago configurado, o cliente recebe o QR Code PIX e a licença sai sozinha quando o pagamento é aprovado. Sem Mercado Pago, o PIX é manual (chave `PIX_KEY`) e você confirma o pagamento em `/admin`.
- **Ativação:** o GameZoney Servidor chama `/api/license/activate`. O site devolve um certificado assinado (chave `license-private.pem`); depois de ativada, a licença vale para sempre, mesmo offline.
- **Troca de computador (1.6):** se a chave já está ativada em outro computador, o Servidor pede o **e-mail e a senha da conta dona da chave**; com o login certo a licença passa para o computador novo e o dono recebe um e-mail de aviso. Outra conta não troca a chave. Toda troca (pelo Servidor, por Liberar em Minha conta ou pelo `/admin`) fica na tabela `license_transfers`; em `/admin › Licenças` aparece o número de trocas, de computadores e o selo **Suspeita de revenda** com 3 ou mais trocas em 30 dias.
- **Feedback:** recebe o "Perfil › Feedback" enviado pelos servidores GameZoney (`/api/feedback`).
- **Avaliações:** em Minha conta › Avaliar, o cliente dá de 1 a 5 estrelas, escreve o texto e pode enviar até 2 imagens (.jpg/.png, até 2 MB cada). As imagens ficam em `/var/lib/gamezoney-site/media/reviews`. Na página inicial aparecem só as **3 avaliações escolhidas em `/admin › Avaliações`** (posição 1, 2 e 3), com nome e organização (campo Organização em Meus dados) e sem data.
- **Chat ao vivo ("Fale conosco"):** botão no canto de todas as páginas. O visitante informa nome, e-mail e WhatsApp e conversa com você. Responda em `/admin › Chat ao vivo`. Enquanto o `/admin` está aberto, o visitante vê **Online agora**; fechado, vê "Deixe sua mensagem" e você recebe um e-mail a cada conversa nova. A resposta pode ir também por e-mail (caixa "enviar também por e-mail").
- **Instagram:** ícone no rodapé com link para https://www.instagram.com/gamezoney_.
- **Design do site (1.7):** em `/admin › Design do site` clique em **Abrir editor** (ou abra qualquer página com `?design=1` estando logado como administrador).
  - Clique em qualquer texto, imagem, botão ou bloco: **editar o texto** (por idioma: escolha Português, English ou Español no painel), **link** dos botões, **trocar imagem** (logo, banners, fotos: .png, .jpg ou .webp até 3 MB), **tamanho** (30% a 300%), **mover** (setas ou arrastando) e **Excluir (esconder)**.
  - Tamanho e posição são separados para **computador** e **celular** (estreite a janela ou use o modo celular do navegador para editar o celular).
  - Topo e rodapé valem para todas as páginas. Nada vai ao ar até clicar em **Salvar alterações**. **Restaurar este elemento**, **Restaurar página original** (no editor) e **Restaurar original / Restaurar o site inteiro** (no /admin) voltam ao original.
  - Os arquivos HTML não mudam: as alterações ficam no banco (tabela `settings`, chave `design`) e as imagens em `/var/lib/gamezoney-site/media/design` (entram no backup diário). Preço e faixa do topo continuam em Preço e promoção.
  - Se uma atualização futura mudar o HTML de um trecho editado, a alteração daquele trecho é ignorada (o site não quebra); é só editar de novo.
- **Parceiros (1.7):** em `/admin › Design do site › Parceiros` adicione nome, link (opcional, https://) e logo. Aparecem no rodapé de todas as páginas, ao lado dos idiomas, na ordem da lista (↑ ↓ para mudar).
- **Planos Standard e Pro (2.0):** a licença vitalícia não é mais vendida. Agora são **planos por assinatura**, mensal ou anual, com **cobrança automática no cartão de crédito** (assinatura do Mercado Pago).
  - **2.1:** três cartões: **Free** (teste de 30 dias; **Escolher plano** leva para **Minha conta › Downloads**, e quem não está logado entra e volta para lá), **Standard** no meio como **Mais popular** e **Pro**. A seção de planos fica logo abaixo de Recursos e o menu do topo tem **Atualizações** ao lado de Atendimento. No /admin, o Free só tem nome, itens e "Mais popular" (sem preço; não pode ser assinado nem dado como cortesia).
  - **Página inicial:** cartões dos planos com Mensal/Anual, preço "de" riscado, selo de desconto, "Mais popular" e os itens. **Escolher plano** abre o **carrinho** (`/carrinho#pro-anual`): período (1 mês ou 12 meses), resumo do pedido, economia e **Continuar** → cartão de crédito nos campos do Mercado Pago (dentro do site).
  - **/admin › Planos e assinaturas:** preço mensal e anual, preço "de", selo, itens e "Mais popular" de cada plano (vale na hora; assinaturas já feitas mantêm o valor). Lista de assinaturas, **Dar plano de cortesia** (1 a 60 meses), **Cancelar renovação** e **Encerrar agora** (fraude, estorno, revenda).
  - **Regras:** o plano só vale depois que o Mercado Pago confirma a cobrança; cada cobrança estende 1 mês ou 1 ano; cancelar para a renovação e o período pago continua valendo; sem renovar, **7 dias de tolerância** e depois o plano vence (no GameZoney Servidor, a partir da etapa 2). Uma assinatura automática por conta (para trocar de plano, cancela e assina de novo).
  - **Licenças vitalícias já vendidas** viraram **Standard com 12 meses grátis** (automático, na primeira abertura da versão 2.0; aparece em /admin como "Vitalícia convertida"). Os servidores que já estavam ativados continuam funcionando como antes até a etapa 2.
  - **Mercado Pago › Suas integrações › sua aplicação › Webhooks:** URL `https://gamezoney.com/api/mp/webhook` com os eventos **Pagamentos** e **Planos e assinaturas**. O site também confere as assinaturas sozinho a cada poucas horas.
  - `LEGACY_SALES=1` no `.env` religa a venda antiga da vitalícia (não recomendado).
- **Plano no GameZoney Servidor (2.2 / Servidor 1.0.6):** o dono entra em Configuração › Licença com o **mesmo e-mail e senha do site**. O site devolve um certificado assinado (chave `license-private.pem`) com o plano, "pago até" e o fim dos 7 dias de tolerância, preso àquele computador (`plan_installs`: **1 servidor por conta**).
  - Rotas usadas pelo Servidor: `/api/plan/login` (e-mail + senha, com o mesmo bloqueio de senha errada; conta em uso em outro computador pede confirmação, avisa o dono por e-mail e registra a troca), `/api/plan/refresh` (o Servidor renova sozinho a cada 6 h; se a conta passou para outro computador ou o plano acabou, responde `revoked`), `/api/plan/logout` e `/api/plan/from-license` (servidores com a licença vitalícia antiga passam sozinhos para o plano Standard convertido).
  - Em `/admin › Planos e assinaturas` aparece em qual computador (e quando foi visto) cada conta está usando o plano.
- **Pagamento dentro do site (1.9):** com `MP_PUBLIC_KEY` preenchida no `.env` (Public Key de produção, da mesma aplicação do `MP_ACCESS_TOKEN`), Minha conta › Comprar licença mostra um botão só, **Pagar com PIX ou cartão**, que abre o quadro do Mercado Pago (Checkout Bricks) na própria página: PIX (QR Code e copia e cola), crédito (até 12x) e débito.
  - Os dados do cartão são digitados nos campos do Mercado Pago; o site recebe só um token de uso único e cobra pela API. O valor é sempre o do pedido no servidor.
  - Aprovado: a chave aparece na hora e vai por e-mail. Recusado: aparece o motivo (ex.: limite insuficiente) e dá para tentar outro cartão ou o PIX. Em análise: a chave aparece quando o Mercado Pago aprovar (aviso automático + consulta).
  - Só a página Minha conta carrega o script do Mercado Pago (`sdk.mercadopago.com`); o resto do site continua sem scripts de fora.
  - Sem `MP_PUBLIC_KEY`, continua o jeito anterior (botão PIX + Checkout do Mercado Pago em outra página para o cartão).
- **E-mails com o visual GameZoney (1.8):** todos os e-mails do site (confirmação, boas-vindas, nova senha, licença, troca de computador, suporte e chat) saem com topo escuro e a logo, título, código/chave ou botão dourado em destaque, aviso de segurança ("a GameZoney nunca pede sua senha…") e rodapé. Vai junto a versão em texto simples (melhora a entrega no Hotmail/Outlook). A logo e as imagens enviadas pelo /admin podem ser abertas pelos programas de e-mail; as capturas do sistema continuam protegidas.
- **Comunicados e promoções (1.8):** em `/admin › Comunicados` escreva assunto, título (opcional), mensagem (`{nome}` vira o primeiro nome do cliente), botão e banner opcionais.
  - **Ver prévia** mostra o e-mail; **Enviar teste para mim** manda só para você; **Enviar comunicado** coloca na fila para **todos os cadastrados** ou **só e-mails confirmados**.
  - Sai **um e-mail por pessoa**, um a cada 4 segundos, até `MAIL_DAILY_LIMIT` por 24 h (padrão 300, no `.env`); o resto continua sozinho depois, mesmo se o site reiniciar. Em **Enviados** aparece o andamento, as falhas e **Cancelar envio**.
  - Todo comunicado tem **Cancelar inscrição** (link assinado + cabeçalho List-Unsubscribe, exigido por Gmail/Outlook). Quem cancela não recebe mais comunicados; o cliente também liga/desliga em **Minha conta › Meus dados**. E-mails da conta (licença, senha, suporte) continuam indo para todos.
  - Dica de entrega: comece com **só e-mails confirmados** e mensagens curtas; muitos endereços errados ou denúncias de spam derrubam a reputação do domínio.
- **Selo "Compra 100% segura" (1.7):** no rodapé de todas as páginas, no quadro de preço da página inicial e em Minha conta › Comprar licença ("Pagamento pelo Mercado Pago • Site protegido (HTTPS)"). Dá para mover, mudar o tamanho ou esconder pelo editor de design.
- **Idioma:** o site abre sempre em Português (Brasil); English e Español só quando o visitante escolhe no rodapé (a escolha fica lembrada).
- **Administração (`/admin`):** pedidos, licenças (emitir cortesia, liberar, bloquear), **chamados** (caixa própria com abas **Abertos** e **Fechados** e busca: escolha o chamado na lista, escreva a resposta e clique em **Responder e fechar**; ele vai para Fechados, o cliente recebe por e-mail e vê em Minha conta › Suporte; **Reabrir chamado** volta para Abertos), clientes, feedback e registro.

---

## 1. Oracle Cloud: abrir as portas 80 e 443

1. Abra o console da Oracle e vá em **Compute › Instâncias**. Abra a instância e, na **Sub-rede**, entre na **Security List**.
2. Clique em **Adicionar regras de entrada** (Add Ingress Rules) e crie duas:
   - CIDR de origem `0.0.0.0/0`, protocolo TCP, porta de destino **80**;
   - CIDR de origem `0.0.0.0/0`, protocolo TCP, porta de destino **443**.
   - Deixe **Intervalo de Portas de Origem** **vazio** (= Todos), como na regra do SSH (22). Se a origem ficar 80/443, o site não abre e o certificado HTTPS falha com "Timeout during connect".

O firewall interno do Ubuntu é liberado pelo script de instalação.

## 2. HostGator: apontar o domínio para o VPS

Na **Zona de DNS** da HostGator (domínio gamezoney.com), o site vai para o VPS e o **e-mail e o FTP continuam na HostGator (162.240.81.81)**.

Na zona original, `mail`, `ftp` e o **MX** apontam para `gamezoney.com`. Por isso, ajuste-os **antes** de mudar o registro A; senão o e-mail para de funcionar. Faça nesta ordem:

| # | Registro atual | O que fazer | Resultado |
|---|---|---|---|
| 1 | CNAME `mail.gamezoney.com.` → gamezoney.com | **Excluir** e **Adicionar Registro** tipo **A** | A `mail` → **162.240.81.81** |
| 2 | CNAME `ftp.gamezoney.com.` → gamezoney.com | **Excluir** e **Adicionar Registro** tipo **A** | A `ftp` → **162.240.81.81** |
| 3 | MX `gamezoney.com.` destino gamezoney.com | **Editar** o destino | MX prioridade 0 → **mail.gamezoney.com** |
| 4 | A `gamezoney.com.` → 162.240.81.81 | **Editar** o valor | A `gamezoney.com` → **137.131.177.64** |
| 5 | CNAME `www.gamezoney.com.` → gamezoney.com | **Manter** (segue o registro A) | www → VPS |

- Se houver registros **AAAA** para `gamezoney.com` ou `www`, apague.
- Se houver um **TXT** de SPF (`v=spf1 ...`), confira se ele tem `ip4:162.240.81.81` (ou `+mx`). Se tiver só `+a`, acrescente `ip4:162.240.81.81` antes do `~all`.
- **SMTP do site:** use em `SMTP_HOST` o nome do servidor da HostGator que aparece no cPanel em **E-mail › Contas de e-mail › Conectar dispositivos** (ex.: `br123.hostgator.com.br`). Esse nome tem certificado válido mesmo com o domínio apontando para o VPS.

A propagação do DNS leva até **4 horas** (TTL 14400). Para conferir, rode no Windows `nslookup gamezoney.com`: a resposta deve mostrar 137.131.177.64.

## 3. Enviar os arquivos e instalar

No **Windows (PowerShell)**, na pasta onde estão `gamezoney-site.zip`, `license-private.pem` e a chave SSH da Oracle:

```powershell
scp -i .\chave-oracle.key gamezoney-site.zip license-private.pem ubuntu@137.131.177.64:~
ssh -i .\chave-oracle.key ubuntu@137.131.177.64
```

No **VPS**:

```bash
sudo apt-get update && sudo apt-get install -y unzip
unzip -o gamezoney-site.zip && cd site
sudo bash deploy/instalar-vps.sh
```

O script faz tudo isto:
- instala Node 24 e Caddy (HTTPS automático com Let's Encrypt);
- cria o serviço `gamezoney-site` e o backup diário;
- copia a chave das licenças para `/var/lib/gamezoney-site/license-private.pem`;
- libera as portas 80 e 443 no Ubuntu.

> **`license-private.pem` é a chave que assina as licenças. Guarde uma cópia em local seguro (pendrive/cofre) e nunca a envie para ninguém nem para o Git.**
> - Se ela vazar, qualquer pessoa consegue gerar licenças.
> - Se ela se perder, o site não consegue mais ativar licenças para os servidores 1.0.5 já instalados.

## 4. Configurar (`/etc/gamezoney-site.env`)

```bash
sudo nano /etc/gamezoney-site.env      # edite e salve (Ctrl+O, Enter, Ctrl+X)
sudo systemctl restart gamezoney-site
```

- **`ADMIN_EMAILS`:** o seu e-mail. Crie a conta no site com esse e-mail e acesse `https://gamezoney.com/admin`.
- **`SUPPORT_WHATSAPP` / `SUPPORT_EMAIL`:** contatos exibidos em Minha conta › Suporte.
- **`PRICE_CENTS`, `PRICE_LABEL`, `LIST_PRICE_CENTS`:** preço (8990 = R$ 89,90), texto da promoção e o preço "de" riscado (opcional).

### PIX automático (Mercado Pago)

1. Entre em https://www.mercadopago.com.br/developers. Abra **Suas integrações** e crie uma aplicação (Pagamentos online, sem plataforma).
2. Em **Credenciais de produção**, copie o **Access Token** (`APP_USR-...`) para `MP_ACCESS_TOKEN`.
3. Em **Webhooks**, cadastre a URL `https://gamezoney.com/api/mp/webhook` com o evento **Pagamentos**.
   - Isto é opcional: o site também informa a URL em cada pagamento e confere o status sozinho.

Sem `MP_ACCESS_TOKEN`, o site mostra a chave `PIX_KEY` e você confirma o pagamento em `/admin` (botão **Confirmar pagamento**).

**Cartão de crédito ou débito:** com o `MP_ACCESS_TOKEN` preenchido, Minha conta mostra também **Cartão de crédito ou débito**. O cliente paga no Checkout do Mercado Pago (o site nunca vê os dados do cartão), volta para `/conta?pedido=...` e a chave sai sozinha quando o pagamento é aprovado (crédito em até 12x com juros do Mercado Pago, ou débito). Boleto fica desativado.

### Entrar com Google

1. Abra https://console.cloud.google.com e crie um projeto chamado "GameZoney".
2. Em **APIs e serviços › Tela de consentimento OAuth**, escolha Externo e preencha:
   - nome: GameZoney;
   - e-mail de suporte;
   - domínio: gamezoney.com;
   - links: https://gamezoney.com/privacidade.html e https://gamezoney.com/termos.html.
   Depois, publique o app ("Em produção").
3. Em **Credenciais › Criar credenciais › ID do cliente OAuth**, escolha o tipo **Aplicativo da Web** e preencha:
   - Origens JavaScript autorizadas: `https://gamezoney.com`;
   - URIs de redirecionamento autorizados: `https://gamezoney.com/auth/google/callback`.
4. Copie o **ID do cliente** e a **Chave secreta** para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.

### E-mail (SMTP)

O site envia por e-mail as boas-vindas, a chave da licença, o link de "esqueci a senha" e as respostas do suporte.

O plano da HostGator não traz contas de e-mail no cPanel; a aba E-mails oferece o **Titan** (pago depois de 30 dias). Escolha uma opção:

**Opção A — Gmail (grátis, até ~500 e-mails/dia).** Bom para começar.
1. Na conta Google que vai enviar, ative a **Verificação em duas etapas**.
2. Em **Conta Google › Segurança › Senhas de app**, crie "GameZoney site" e copie a senha de 16 letras.
3. Preencha:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=seuemail@gmail.com
   SMTP_PASS=<senha de app de 16 letras, sem espaços>
   MAIL_FROM=GameZoney <seuemail@gmail.com>
   ```

**Opção B — Titan da HostGator (`contato@gamezoney.com`, R$ 9,49/mês por conta após o teste).**
1. Em **E-mails**, crie a conta `contato` @gamezoney.com.
2. Confira a **Zona de DNS**. O MX deve apontar para `mx1.titan.email` (prioridade 10) e `mx2.titan.email` (prioridade 20), e deve existir um TXT `v=spf1 include:spf.titan.email ~all`. A HostGator costuma criar isso sozinha; se o MX continuar `mail.gamezoney.com`, troque.
3. Preencha:
   ```
   SMTP_HOST=smtp.titan.email
   SMTP_PORT=465
   SMTP_USER=contato@gamezoney.com
   SMTP_PASS=<senha da conta Titan>
   MAIL_FROM=GameZoney <contato@gamezoney.com>
   ```

O site se apresenta ao servidor de e-mail como `gamezoney.com` (domínio de `SITE_URL`). O Titan recusa o login (`535 authentication failed`) quando vem o nome da máquina do VPS. Para usar outro nome, preencha `SMTP_EHLO_NAME`.

Sem SMTP o site funciona, mas "esqueci a senha" fica indisponível. A chave da licença continua aparecendo em Minha conta.

## 5. Instaladores (Downloads)

Coloque os `.exe` em `/var/lib/gamezoney-site/downloads`. Eles aparecem em Minha conta › Downloads, e só quem tem conta baixa.

```powershell
scp -i .\chave-oracle.key .\GameZoney-Instalador-Servidor-1.0.5-Cliente-1.0.5.exe ubuntu@137.131.177.64:~
```
```bash
sudo mv ~/*.exe /var/lib/gamezoney-site/downloads/ && sudo chown gamezoney:gamezoney /var/lib/gamezoney-site/downloads/*
```

## 6. Atualizar o site

Envie o zip novo, descompacte e rode de novo `sudo bash deploy/instalar-vps.sh`. Banco, configuração, chave e downloads são mantidos.

## Visual e conteúdo (1.4)

- **Página inicial** no estilo Black Friday:
  - faixa no topo com o texto da promoção;
  - "Sua arena. No próximo nível." e foto da arena com o selo do preço;
  - destaques (PCs e consoles sem limite / Windows 10 e 11 / Suporte especializado);
  - "O centro de comando da sua arena";
  - recursos, telas, avaliações, pacotes, dúvidas e atualizações;
  - chamada final com o preço.

  A foto fica em `public/img/hero-arena.jpg`: troque por uma foto em alta resolução quando tiver.
- **Preço e promoção:** edite em `/admin › Preço e promoção`: preço "de" (riscado), preço "por", texto da promoção e faixa do topo.
  - O que for salvo vale na hora no site e nas próximas compras.
  - `PRICE_CENTS`, `LIST_PRICE_CENTS` e `PRICE_LABEL` do `.env` só valem até a primeira edição no admin.
- **Pacotes:**
  - **Pacote Padrão:** teste grátis de 30 dias.
  - **Pacote Premium:** licença vitalícia com layout personalizado, todas as funções, PCs e consoles sem limite, 1 licença por servidor, suporte completo e novas atualizações.
- **Telas:** o Painel de controle aparece com o menu lateral; Vendas (PDV), Corujão/Viradão, Caixa, Estoque e Ranking aparecem só com a área da tela.
- **Guia** (menu ao lado de Dúvidas, só para quem fez login; `/guia`): conectar os PCs ao servidor, conectar TVs e consoles, e importar clientes por CSV (com modelo para baixar).
  - A página e as imagens ficam em `private/` e só são entregues com a sessão aberta.
- **Menu:** "Novas Atualizações" passou a se chamar **Atualizações**.

## Segurança (1.3)

- **Administrador só com e-mail confirmado.** Quem cria conta recebe um link de confirmação. Ninguém vira administrador só por cadastrar o e-mail do `ADMIN_EMAILS`: o `/admin` exige o e-mail confirmado. Para confirmar o seu e-mail direto no VPS (se o e-mail não chegar):
  ```bash
  sudo -u gamezoney node /opt/gamezoney-site/tools/confirmar-email.js seu-email@exemplo.com
  ```
- **Passo a passo para liberar o `/admin`:**
  1. O seu e-mail precisa estar em `ADMIN_EMAILS` no `/etc/gamezoney-site.env` (confira com `sudo grep ADMIN_EMAILS /etc/gamezoney-site.env`; se mudar, rode `sudo systemctl restart gamezoney-site`).
  2. Crie a conta no site com esse mesmo e-mail.
  3. Clique no link de confirmação do e-mail **ou**, se ele não chegar, confirme pelo VPS com o comando acima (aparece `OK: e-mail confirmado para ...`).
  4. Saia da conta, entre de novo e abra `https://gamezoney.com/admin`.
- **E-mail voltou ("Undelivered Mail Returned to Sender") ou não chega no Hotmail/Outlook:** a Microsoft recusa e-mails de domínios sem autenticação. Na HostGator (Zona DNS de gamezoney.com) confira os registros TXT:
  - **SPF** (nome `@` / `gamezoney.com`): `v=spf1 include:spf.titan.email ~all`. Só pode existir **um** TXT começando com `v=spf1`; se já houver outro, junte os dois num só.
  - **DKIM:** no painel do Titan (Configurações do domínio › DKIM) copie o nome e o valor TXT que ele mostra e crie na HostGator.
  - **DMARC** (nome `_dmarc`): `v=DMARC1; p=none; rua=mailto:suporte@gamezoney.com`.
  - Espere até algumas horas para o DNS atualizar e use **Reenviar confirmação** em Minha conta. Veja também a pasta **Lixo eletrônico** do Hotmail.
  - Se continuar voltando, abra o anexo da mensagem devolvida (ForwardedMessage.eml): a linha com `550` ou `5.7.` diz o motivo. Se citar lista de bloqueio (block list / S3150), abra um chamado no suporte do Titan com essa mensagem.
- **Senha:** no máximo 10 senhas erradas por conta a cada 15 minutos, mais o limite por IP. As senhas são guardadas com scrypt, nunca em texto.
- **Proteções do site:**
  - Pedidos POST com sessão só valem vindos do próprio site (proteção contra CSRF), e o cookie de sessão é HttpOnly, Secure e SameSite.
  - Cabeçalhos CSP, X-Frame-Options e Permissions-Policy ativos.
  - Erros nunca mostram detalhes internos.
  - O redirecionamento só aceita endereços do próprio site.
  - Limite geral de requisições por IP.
  - Biblioteca de e-mail atualizada (nodemailer 10, sem vulnerabilidades conhecidas: `npm audit` = 0).
- **Capturas do sistema:** em alta resolução, sem clique direito/arrastar. Clicar amplia na própria página, e abrir o endereço da imagem direto ou usá-la em outro site é recusado. Nenhuma imagem exibida numa tela fica 100% protegida (print de tela continua possível), mas o download direto fica bloqueado.
- **VPS (`instalar-vps.sh`):**
  - O serviço do site roda isolado (systemd) e em modo produção.
  - O Caddy limita o envio a 12 MB e esconde o cabeçalho Server.
  - fail2ban bloqueia por 1 hora quem erra o SSH 5 vezes.
  - Atualizações de segurança automáticas (unattended-upgrades).
  - SSH só com chave, sem senha e sem login do root.
- **Mantenha em segredo:** `license-private.pem`, `/etc/gamezoney-site.env` (tokens e senhas) e a chave SSH. Se algum vazar, troque: gere outro Access Token no Mercado Pago e troque a senha do e-mail.

## Comandos úteis

```bash
sudo systemctl status gamezoney-site            # situação
sudo journalctl -u gamezoney-site -n 100        # log do site
sudo systemctl restart gamezoney-site caddy     # reiniciar
ls /var/lib/gamezoney-site/backups              # cópias diárias do banco
```

## Desenvolvimento

```bash
cd site && npm ci && node --test test/*.test.js
```
