# GameZoney — Servidor 2.5.0 e Cliente 1.5.0

Atualize o servidor e os clientes por cima das versões anteriores, na mesma conta do Windows. Encerre o servidor antes de instalar; nos PCs, use Manutenção / recepção para encerrar o cliente antes da atualização. Preserve os dados.

## Autorização após remoção
Ao abrir o Cliente 1.5 com uma associação removida, ele detecta a recusa do servidor e solicita automaticamente nova autorização. Isso também funciona após desinstalar e reinstalar mantendo os dados locais. O cliente permanece bloqueado e exibe um código; na recepção, entre como administrador e confira o código em “PC aguardando autorização”. Autorize como novo computador.

Nenhum cliente inicia sessão enquanto a autorização estiver pendente ou a conexão estiver indisponível. A manutenção com a senha local continua disponível para o administrador. Uma credencial administrativa já validada online neste PC pode ser usada localmente durante indisponibilidade, além da senha de manutenção. A reinstalação não apaga nem revela a senha local de manutenção.

A recuperação automática usa o servidor e a identidade já confirmados anteriormente. Se o endereço ou certificado do servidor mudou, utilize o atalho Reconfigurar conexão com o servidor após entrar em manutenção. Falta de rede não gera novos cadastros. Uma instalação limpa, sem dados anteriores, abre o assistente de descoberta e exige aprovação inicial.

## Fundo da tela de login por computador
No servidor, entre como administrador e abra Computadores/TVs. No cartão da máquina desejada, clique em **Layout do login**. Selecione JPG ou PNG, escolha Esquerda, Centro ou Direita para os campos de login e clique em **Enviar layout para esta máquina**. A imagem selecionada aparece na prévia antes do envio.

O painel prepara uma imagem de até 1920 × 1080. A imagem mantém a proporção, podendo ter margens; o formulário usa fundo escuro e letras brancas. A logo fixa foi retirada. O fundo é apenas da tela de login do aplicativo, não do Windows nem dos jogos. Para retirar o fundo, marque Remover imagem e usar fundo escuro.

O cliente conectado recebe a imagem nas próximas consultas. Máquinas desligadas recebem ao reconectar. O fundo recebido fica guardado localmente para continuar aparecendo sem rede. TVs não são alteradas.

Para cópia de segurança completa, guarde também a pasta wallpapers junto com o banco de dados do servidor. O backup do banco sozinho contém as referências às imagens, não os arquivos.

## Verificação
Foram executados os testes do servidor, incluindo controle de autorização, revogação, recebimento de imagem por HTTPS e validação dos arquivos. O teste nativo, em desktop isolado, verificou login bloqueado antes da aprovação, pedido repetido com a mesma identidade, autorização e aplicação de fundo/posição. Nesse teste, gravação de credenciais e políticas do Windows foram simuladas para não alterar o computador de desenvolvimento. A instalação real e a conexão devem ser conferidas nas máquinas da arena.
