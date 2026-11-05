# GameZoney — atualização visual premium

Entrega de 05/11/2026, preparada a partir do `gamezoney-site.zip` fornecido. O ZIP original foi preservado. Esta versão foi implementada e verificada localmente; ainda não foi publicada em gamezoney.com.

## O que mudou

- Identidade preto/grafite e dourado, tipografia gamer, fotografia de arena já presente no projeto, maior contraste e hierarquia consistente.
- Abertura com benefício principal, licença vitalícia e teste gratuito em destaque.
- Recursos organizados em três grupos; demonstração com seis abas, capturas reais, navegação por teclado e ampliação acessível.
- Oferta central com pagamento único, escopo da licença e próximo passo explícitos. Preço, preço anterior, texto promocional e faixa continuam seguindo a configuração existente no painel administrativo.
- Menu funcional no celular, rodapé organizado, atalhos para conteúdo, foco visível e adaptação para telas estreitas.
- Cadastro, login e recuperação de acesso com o mesmo padrão visual. Google aparece quando a integração está configurada. O destino da compra ou do suporte é mantido após o login, inclusive via Google.
- Conta com navegação por seção: visão geral, downloads, licenças, compra, pedidos, suporte, avaliações e perfil. Botão para copiar a chave e tratamento de cópia indisponível. Atualizações do pagamento não interrompem a seção escolhida pelo cliente.
- Nova página de atendimento e chat com assunto de compra/suporte, campos identificados e telefone opcional. O indicador online continua usando a presença real do administrador.
- Histórico de novidades em página própria; guia e páginas auxiliares seguem a identidade visual.
- Removidas as notas editoriais de rascunho das páginas institucionais e adicionados índices. O conteúdo jurídico original foi preservado; esta entrega não é uma revisão jurídica.
- Traduções dos novos textos em inglês e espanhol. Português continua sendo o padrão.
- URLs dos arquivos alterados com versão para evitar reutilização de scripts e estilos antigos em cache.

## Estrutura

`public/premium.css` contém o novo padrão visual; `public/premium.js`, os comportamentos compartilhados; `public/i18n-premium.js`, as traduções adicionais. Esses arquivos complementam a estrutura existente, sem adicionar framework ou etapa de compilação.

As páginas HTML, `public/site.js`, `public/entrar.js` e `public/conta.js` foram ajustados. No backend, a mudança de produção em `server.js` limita-se à validação do destino interno do login com Google, permitindo os fragmentos da conta. Não houve mudança de esquema do banco nem das regras de cobrança e emissão das licenças.

O ZIP mantém a pasta raiz `site/`, como no arquivo original. Não inclui `node_modules`, banco de demonstração, sessões, chaves privadas, credenciais ou dados do ambiente local de teste. As fotos, logos e telas originais acompanham o código.

## Validação realizada

- `npm test`: **12 testes passaram, nenhum falhou** (Node 24.21.0).
- Cobertura existente de cadastro, autenticação, permissões, ofertas, guia, chat, avaliações, pedidos, pagamentos simulados e emissão/ativação de licenças.
- Testes de retorno seguro do Google para compra/suporte e rejeição de destinos externos.
- Regressão da consulta de pagamento: o cliente permanece na seção escolhida ao navegar durante a confirmação.
- Navegador: abertura em 1366 px, celular em 390/320 px e tablet em 768 px; sem transbordamento horizontal nas páginas verificadas.
- Menu mobile, abas por teclado, ampliação e fechamento com Escape, restauração de foco, troca PT/EN/ES, entrada com conta local, recuperação de acesso, envio de chamado local e acesso ao guia.
- Conferidos cadastro, oferta, conta, atendimento e páginas institucionais. Nenhum erro de console nas verificações.
- Verificação das 11 páginas HTML: sem IDs duplicados, arquivos estáticos ausentes ou âncoras locais quebradas.

Os testes usam integrações simuladas. Não houve pagamento real, envio externo de e-mail ou login real no Google. As verificações de licença usam um verificador independente do certificado assinado, pois o módulo do aplicativo desktop referenciado pelos testes originais não acompanha o ZIP. O aplicativo desktop distribuído não foi executado nesta entrega.

## Atualizar uma VPS que já está em funcionamento

Esta é uma atualização do site existente. O procedimento abaixo segue os caminhos informados no projeto original. Execute na VPS, após enviar o novo ZIP. Reserve uma breve janela de manutenção para a parada do serviço.

1. Extraia para uma pasta nova, evitando misturar o pacote com versões anteriores:

   ```bash
   mkdir -p ~/gamezoney-premium-20261105
   unzip gamezoney-site-premium.zip -d ~/gamezoney-premium-20261105
   cd ~/gamezoney-premium-20261105/site
   ```

2. Confira os caminhos reais e faça backup antes da troca. O diretório protegido abaixo guarda código, configuração, banco, mídia, downloads e a chave existente. É uma cópia completa da instalação; verifique se há espaço disponível.

   ```bash
   BACKUP_DIR="/var/backups/gamezoney-premium-$(date +%Y%m%d-%H%M%S)"
   sudo install -d -m 700 "$BACKUP_DIR"
   sudo systemctl stop gamezoney-site
   sudo cp -a /opt/gamezoney-site "$BACKUP_DIR/app"
   sudo cp -a /var/lib/gamezoney-site "$BACKUP_DIR/data"
   sudo cp -a /etc/gamezoney-site.env "$BACKUP_DIR/gamezoney-site.env"
   ```

3. Se os backups concluíram sem erro, copie somente o código. Este comando preserva arquivos locais de configuração, dados, downloads e chaves. Não usa `--delete`.

   ```bash
   sudo rsync -a --exclude node_modules --exclude data --exclude downloads \
     --exclude '*.pem' --exclude .env ./ /opt/gamezoney-site/
   cd /opt/gamezoney-site
   sudo npm ci --omit=dev --no-audit --no-fund
   sudo systemctl start gamezoney-site
   sudo systemctl is-active gamezoney-site
   curl -fsS http://127.0.0.1:8080/api/config
   ```

   Se uma etapa falhar, interrompa a atualização e restaure o código do backup antes de iniciar o serviço. Não substitua o banco ou a chave por arquivos de outra instalação. A chave privada existente deve continuar a mesma.

4. Confira no domínio: página inicial, menu em celular, preço vigente, cadastro/login, recuperação de senha, downloads, conta e chat. Faça a validação das integrações reais de Google, SMTP e Mercado Pago no seu fluxo habitual. Se houver cache de HTML no proxy/CDN, limpe esse cache após a troca.

O instalador original `deploy/instalar-vps.sh` permanece no pacote para referência, mas também altera pacotes, Caddy, firewall e SSH. O procedimento acima evita refazer a infraestrutura em uma atualização apenas do site.

Para uma primeira instalação, consulte `LEIA-ME-SITE.md`. Não copie o banco local de testes para a produção. As configurações de oferta e atendimento já salvas na VPS continuam sendo a referência do site.
