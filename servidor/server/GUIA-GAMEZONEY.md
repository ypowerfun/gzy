# Atualização 2.2 — PCs encontrados pela rede

Atualize o servidor antes de instalar o Cliente 1.1. Os PCs novos aparecem em Computadores / TVs aguardando autorização, sem exportar arquivos. Confira o código mostrado no PC, autorize e compare a identidade do servidor nos dois computadores. O instalador 2.2.1 configura o firewall automaticamente para os PCs nos perfis Público, Privado e Domínio, com alcance local. Autorize a solicitação do Windows; há um atalho Reparar conexao de rede caso a etapa falhe. Consulte GUIA-CLIENTE.md para as etapas completas.

# GameZoney — Atualização do servidor 2.1.0

Esta versão acrescenta suporte ao GameZoney Cliente para computadores Windows. O funcionamento das TVs e os dados anteriores são preservados. Consulte GUIA-CLIENTE.md para instalação, associação, restrições e recuperação.

## Computadores

Cadastre cada estação como Computador / Cliente GameZoney. Use Associar PC para baixar um arquivo exclusivo, que será importado no cliente da máquina correspondente. Somente o administrador pode gerar esse arquivo. Uma nova associação invalida a anterior. O cliente confirma sua presença a cada poucos segundos; o painel mostra se está conectado. Inicie sessões pela recepção somente quando o cliente estiver conectado, ou permita que o cliente entre com nick/senha no próprio PC.

## Comunicação

O servidor usa HTTPS na porta TCP 3443 para os computadores. O HTTP na porta 3000 continua atendendo TVs e painel local. A identidade é gerada no primeiro início desta versão e salva nos arquivos pc-server.pfx e pc-server.pfx.cer da pasta de dados. Preserve esses arquivos junto do banco e dos pareamentos das TVs nas cópias de segurança. Se o firewall bloquear, permita TCP 3443 na rede privada da arena. Não exponha essas portas na Internet.

## Atualização

Encerre o servidor pela bandeja e instale na mesma pasta e mesma conta Windows. Abra pelo atalho. Cadastros, saldos e pareamentos serão preservados. Não instale o cliente no computador da recepção.

---

# GameZoney — Servidor 2.0.1

## Instalar e abrir

1. Feche o servidor antigo (a janela de comandos da versão ZIP). Ele usa a mesma porta 3000.
2. Execute **GameZoney-Servidor-2.0.1-Setup.exe** no computador da recepção. Requer Windows 10/11 de 64 bits. O pacote já inclui Node.js e dependências; a instalação não baixa componentes.
3. Escolha se deseja um atalho e se o servidor deve iniciar quando você entrar no Windows.
4. Abra **GameZoney Servidor**. Crie o administrador com uma senha de pelo menos 8 caracteres. Não existe senha padrão.
5. O painel abre em uma janela própria do GameZoney (3.0.68; motor WebView2 do Windows). Fechar a janela só esconde o painel — o servidor continua no ícone perto do relógio ("Abrir GameZoney" mostra de novo; "Abrir no navegador" abre no Edge/navegador). Sem o WebView2, abre em uma janela do Microsoft Edge, quando disponível, ou no navegador padrão. Também pode ser acessado neste computador em http://127.0.0.1:3000.

O servidor permanece na bandeja do Windows, próximo ao relógio. Fechar a janela do painel ou sair da conta não encerra o servidor. Clique com o botão direito no ícone para abrir o painel, acessar dados e diagnóstico ou encerrar o servidor.

Esta versão funciona na sessão do usuário do Windows, e não como serviço anterior ao login. Mantenha o computador ligado, conectado à rede e sem suspensão durante o atendimento. Ao desligar o servidor, ele deixa de enviar comandos às TVs. O prazo das sessões continua correndo e é recuperado na próxima abertura.

## Configurar as TVs existentes

Em **Hora e configurações**, confira o endereço do servidor. O valor inicial é **http://192.168.1.100:3000**, usado nos testes anteriores. Se o IP mudou, informe o atual. Prefira reservar o IP no roteador para que ele não mude.

Em **Computadores / TVs → Configurar**, informe nome, IP e entrada HDMI. TV 1 inicia configurada como Toshiba (`tos`), IP 192.168.1.111, HDMI 1. TV 2 usa 192.168.1.112 e detecta a marca. Ajuste conforme sua rede.

Para aproveitar um pareamento anterior, use **Importar pareamento** e selecione o arquivo correspondente, por exemplo `dados/tv-1.json` da versão anterior. Importe apenas na TV correspondente. Também é possível usar **Parear TV** e depois **Informar PIN** com o código que aparece naquele momento na televisão. Um PIN antigo não deve ser reutilizado.

O instalador não altera o pareamento nem os arquivos da aplicação antiga. Sem importação, será necessário parear novamente. Configurações e saldos antigos não são migrados automaticamente.

As TVs precisam alcançar a porta TCP 3000 deste computador para mostrar o resumo. Se o Windows solicitar liberação de rede ao iniciar, permita o acesso na sua rede privada. Não exponha o servidor na Internet. O painel administrativo aceita acesso apenas do próprio computador servidor; as TVs acessam somente a página de resumo.

## Atendimento e saldo

1. Abra **Clientes → Novo cliente**, preencha nome, Usuário/Nick e senha (mínimo de 8 caracteres). Telefone e observações são opcionais.
2. Clique no **nome do cliente**. Informe minutos ou selecione uma promoção.
3. Para iniciar imediatamente, selecione uma estação livre em **Iniciar após a recarga**. A TV recebe a troca de HDMI antes de o servidor registrar o início da sessão. Se o comando falhar, essa recarga com início imediato não é registrada; corrija a conexão e tente novamente.
4. Para reservar os minutos, escolha **Guardar no saldo do cliente**. Mais tarde, use **Iniciar sessão** na estação e selecione o cliente.
5. Durante a sessão, uma nova recarga aumenta o prazo sem reiniciar o relógio.

Um cliente pode usar apenas uma estação por vez. O início utiliza todo o saldo disponível. A contagem independe do usuário ou jogo escolhido no console. O envio de HDMI é confirmado pelo protocolo, mas a aplicação não detecta a imagem apresentada fisicamente na TV.

**Encerrar** devolve os segundos não utilizados ao saldo do cliente. Quando o prazo termina, a sessão é encerrada automaticamente. Não há cobrança adicional por atraso do servidor ao detectar o fim.

## Hora e promoções

O valor inicial é **R$ 7,00 por hora**. Minutos avulsos são calculados proporcionalmente, com arredondamento para centavos. Exemplo: 30 minutos = R$ 3,50.

Em **Hora e configurações → Promoções**, cadastre nome, duração em minutos e preço total. As promoções ativas aparecem na caixa de recarga. É possível editar ou desativar uma promoção. Alterações de preço não mudam recargas já registradas. O registro não processa pagamentos nem emite documento fiscal.

## Tela de sessão finalizada

Ao terminar, o servidor solicita à TV que abra sua página local com:

- Sessão finalizada;
- nome do usuário e estação;
- hora de início e término;
- tempo utilizado;
- tempo restante devolvido, inclusive zero quando esgotado.

O histórico mostra **Envio solicitado**, **Carregado** (quando a TV confirma que abriu a página) ou **Falhou**. Se houver falha de rede, use **Sessões → Ver resumo → Mostrar este resumo na TV** após restabelecer a conexão. Um resumo antigo não pode interromper uma nova sessão em andamento.

A mudança de tela depende da TV ligada, do serviço VIDAA disponível e da rede. Falha na TV não apaga a sessão nem devolve novamente o mesmo saldo. Não há sobreposição de cronômetro sobre o jogo HDMI nesta versão.

## Computadores, operadores e log

Computadores associados ao GameZoney Cliente podem liberar o uso, exibir contador e apresentar a tela final. Consulte o guia do cliente para os limites das restrições em contas administradoras.

O administrador pode configurar TVs, preços, promoções e criar outros operadores. O operador de atendimento pode cadastrar clientes, adicionar tempo, iniciar e encerrar sessões, consultar histórico e log. Cada operador pode alterar a própria senha.

O sistema registra início/fim de sessões, recargas e preços, alterações de cadastro, login, configurações e falhas de TV. Em **Sistema de log**, filtre os registros e exporte CSV. A consulta mostra até 1.000 registros; todos permanecem no banco. O histórico visual mostra as últimas 500 sessões e todas as que ainda estão ativas.

## Dados, cópias e atualização

Os dados são gravados em **%LOCALAPPDATA%\GameZoney\data** da conta do Windows que executa o programa:

- `gamezoney.sqlite`: clientes, operadores, saldos, sessões, promoções e log;
- `pairing`: pareamento das TVs;
- `backups`: cópias do banco criadas ao iniciar, diariamente e pelo botão de backup;
- `server.log`: diagnóstico técnico recente.

Use **Criar cópia de segurança** e copie o arquivo gerado para outro dispositivo. Preserve também a pasta `pairing`. As cópias locais não são sincronizadas para nuvem e não são removidas automaticamente; acompanhe o espaço disponível.

Para restaurar: encerre o servidor pela bandeja, guarde uma cópia de toda a pasta atual e substitua a pasta de dados por uma pasta nova contendo a cópia desejada renomeada para `gamezoney.sqlite` e a pasta `pairing`. Não misture um banco restaurado com arquivos `-wal` ou `-shm` antigos. Na dúvida, peça ajuda antes de restaurar para evitar substituir atendimento recente.

O instalador atualiza os arquivos do programa; os dados ficam separados. A desinstalação preserva os dados. Use a mesma conta do Windows para reencontrá-los. O servidor não deve ser executado duas vezes nem junto da versão antiga.

## Validação desta entrega

Testados localmente: preço/promoções, recarga, início e encerramento, saldo restante sem duplicidade, persistência após reinício, cópia de segurança, login/permissões, falhas simuladas de TV, protocolo VIDAA com respostas simuladas, telas do painel e inicialização/encerramento pelo executável com Node incluído.

Os comandos VIDAA derivam da versão que você confirmou funcionando. A nova versão precisa de um teste final na TV real para validar o resumo completo e o acesso pela rede. O instalador não possui assinatura digital de editor.

## Desenvolvimento e componentes

O código usa Node.js 24.21.0, Express, MQTT.js, SQLite do Node e um iniciador Windows em C#. As licenças de dependências acompanham o pacote. A autenticação VIDAA usa a referência comunitária vidaa-control e os arquivos de cliente já autorizados, conforme `LICENSE-vidaa-control.txt`.

Para desenvolvimento: instale Node 24, execute `npm ci`, `npm test` e `npm start`. `PRIME_DATA_DIR` permite escolher uma pasta de testes. `PORT` permite outra porta. O executável instalado usa 3000.

Para recompilar o iniciador, use o compilador C# do .NET Framework com referências `System.Windows.Forms.dll`, `System.Drawing.dll`, opção `target:winexe` e `prime.ico`. Para gerar o instalador, compile `installer.iss` com Inno Setup após copiar `node.exe` para `runtime` e instalar as dependências de produção. Não inclua banco, pareamentos pessoais ou dados de teste no pacote.

## Atualização 2.0.1 — cadastro e ícone

Instale sobre a mesma pasta da versão 2.0.0, usando a mesma conta do Windows. Primeiro encerre o servidor pelo ícone da bandeja e feche todas as janelas antigas do painel. Saldos, sessões e pareamentos ficam preservados na pasta de dados. Abra novamente pelo atalho GameZoney.

O cadastro de clientes agora armazena nome, nick, senha protegida e telefone. O nick usa 3 a 32 letras sem acento, números, ponto, hífen ou sublinhado; não pode ser repetido, mesmo mudando maiúsculas e minúsculas. A senha não aparece no painel, nos logs ou nas respostas de cadastro. Na edição, deixá-la vazia mantém a senha atual; preenchê-la define uma nova senha.

Clientes antigos continuam funcionando nas TVs. Edite cada cadastro para acrescentar nick e senha quando quiser preparar o acesso futuro aos computadores. Essas credenciais são de clientes, separadas das contas de operadores da recepção. O cliente de computadores 1.0 valida essas credenciais no servidor. Nas TVs, selecione o cliente com saldo e a estação livre no painel e inicie sem solicitar a senha do cliente.

A janela web agora publica o mesmo arquivo de ícone usado pelo instalador e pelo executável. Feche e reabra a janela após atualizar. Ícones fixados anteriormente na barra de tarefas podem manter uma cópia antiga em cache; nesse caso, desafixe o antigo e fixe a nova janela.

Versao 2.3.0: nova aba Configuracao das maquinas. Consulte GUIA-CLIENTE.md para controles globais e limites de Ctrl+Alt+Del. Atualize os clientes para 1.3.0.

Versao 2.4: Cadastrar administrador na Configuracao das maquinas. Contas Administrador podem liberar restricoes no Cliente 1.4. Consulte GUIA-CLIENTE.md.
