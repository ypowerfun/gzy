# Proteção do Cliente

Durante uma sessão de usuário, o GameZoney mantém as restrições do Windows já configuradas e acrescenta proteção contra alteração de data/hora e contra o uso do Cheat Engine.

O Cliente encerra imediatamente processos reconhecidos como Cheat Engine por nome do processo ou metadados do executável. Também fecha as telas de Configurações/Painel de Controle relacionadas às alterações do sistema durante a sessão. O cálculo do tempo usa `Stopwatch`/uptime monotônico, e por isso não depende do relógio de calendário do Windows.

O instalador 2.0.18 exige privilégio administrativo para proteger a pasta do programa. Ao final da instalação, a pasta recebe os atributos oculto/sistema, fica com leitura/execução para usuários comuns e controle total apenas para Administradores e SYSTEM. Os dados operacionais (`client.dat`, checkpoint de sessão, fundo e logs locais) continuam na pasta de dados do usuário para o funcionamento normal do Cliente.

Essas proteções não substituem uma política corporativa de Windows/AppLocker/WDAC quando o usuário recebe privilégios de administrador local. O ambiente de jogos deve operar com conta Windows padrão para que a proteção seja efetiva.

## Bloquear configuração de data e hora
Opção global em Servidor > Configuração > Configuração das máquinas. Durante a sessão o cliente fecha a janela "Data e Hora" do Windows, o applet timedate e o app Configurações (onde fica a página Data e hora). Desmarcada, o ajuste de data/hora volta a ficar disponível; o app Configurações continua bloqueado apenas se "Bloquear Painel de Controle e Configurações" estiver marcado. O tempo da sessão usa relógio monotônico e nunca depende do relógio do Windows.

## Permissão das restrições do Windows
O Cliente roda com a conta do PC (sem administrador) e grava as restrições configuradas no servidor em
`HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\System` (Gerenciador de Tarefas, Bloquear, Alterar senha)
e `...\Policies\Explorer` (Painel de Controle, Sair). Se o Windows negar a gravação nessas chaves (por exemplo, outro programa
ou uma política do Windows mudou a permissão delas), o Cliente não consegue aplicar as restrições e **não deixa clientes entrarem**
(como sempre foi). Até as versões anteriores a tela mostrava apenas "Sem conexão com o servidor"; agora mostra:

> Este PC não conseguiu aplicar as restrições do Windows (… foi negado). Na recepção: entre como administrador e use menu Iniciar >
> GameZoney Cliente > Reparar restrições do Windows.

- **Instalador:** no fim da instalação devolve à conta conectada ao Windows a permissão total **somente nessas duas chaves**
  (e remove regras de negar nelas para essa conta, Todos, Usuários, Usuários autenticados e Interativo). Se nem o administrador
  puder mudar a permissão, a posse da chave passa para Administradores antes. Registro em `%ProgramData%\GameZoney\client-install.log`.
- **Atalho "Reparar restrições do Windows"** (menu Iniciar > GameZoney Cliente): faz o mesmo para a conta que abriu o atalho; o
  Windows pede a autorização de administrador. Use com a conta do PC, entrando antes como administrador no Cliente.
- **Administrador:** se o Windows negar a retirada das restrições, o administrador do servidor entra mesmo assim (as restrições
  continuam valendo para ele até o reparo); o fato fica no `connection.log`.
- O painel do servidor continua mostrando o erro em Configuração das máquinas > Recebimento pelos clientes ("Falha: …").
- Antes, quando funcionava, a conta do PC já tinha essa permissão: o reparo só a devolve, não abre nada além disso.

