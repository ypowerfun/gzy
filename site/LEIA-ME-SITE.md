# GameZoney — site gamezoney.com (venda, contas e licenças)

Software proprietário e confidencial da GameZoney. Não divulgar.

O site roda no VPS da Oracle (Ubuntu 22.04 ARM, IP **137.131.177.64**) com banco de dados próprio (SQLite em `/var/lib/gamezoney-site/site.sqlite`, cópia automática diária em `/var/lib/gamezoney-site/backups`).

**O que o site faz:**
- **Página inicial:** título, subtítulo, recursos, preços (teste grátis de 30 dias e licença vitalícia de R$ 89,90 de Black Friday) e perguntas frequentes.
- **Contas:** criar conta com e-mail e senha ou **Entrar com Google**; também tem "esqueci a senha".
- **Minha conta:** downloads dos instaladores, licenças (chave e botão **Liberar** para trocar de computador), compra por **PIX** e chamados de suporte.
- **Compra:** com o Mercado Pago configurado, o cliente recebe o QR Code PIX e a licença sai sozinha quando o pagamento é aprovado. Sem Mercado Pago, o PIX é manual (chave `PIX_KEY`) e você confirma o pagamento em `/admin`.
- **Ativação:** o GameZoney Servidor chama `/api/license/activate`. O site devolve um certificado assinado (chave `license-private.pem`); depois de ativada, a licença vale para sempre, mesmo offline.
- **Feedback:** recebe o "Perfil › Feedback" enviado pelos servidores GameZoney (`/api/feedback`).
- **Administração (`/admin`):** pedidos, licenças (emitir cortesia, liberar, bloquear), chamados (responder por e-mail), clientes, feedback e registro.

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
