# GameZoney — Gestão Gamer (Servidor 1.2.2 · Cliente 1.0.17)

Gerenciador de arena gamer: **Servidor** (PC da recepção, painel em janela própria, uso na rede local) e **Cliente** (PCs gamers).
Todos os direitos reservados à GameZoney. Software proprietário e confidencial.

## Pastas
| Pasta | O que é |
|---|---|
| `servidor/` | Código do Servidor (Node 24 + painel) |
| `cliente/windows-client-1.0.5/` | Código do Cliente Windows (.exe nativo + monitor), gerador `GERAR-INSTALADOR-CLIENTE.cmd` |
| `unico/` + `GERAR-INSTALADOR-UNICO.cmd` | Instalador único com as caixas "GameZoney Servidor" e "GameZoney Cliente" |
| `marca/` | Logo GZ e banner originais (referência do visual dourado/preto/vermelho) |
| `ferramentas/` | `gerar-imagens-marca.py` (ícones, logos e papel de parede a partir da marca; uso só no desenvolvimento) |

## Gerar os instaladores (no Windows 10/11)
Requisitos no PC que gera (uma vez só): **Node.js 24 LTS** com npm (https://nodejs.org), **Inno Setup 7 ou 6**
(https://jrsoftware.org/isdl.php, detectado sozinho) e **.NET Framework 4.x** (já vem no Windows 10/11).

Extraia o projeto num caminho curto (ex.: `C:\GZ\`) e dê dois cliques no `.cmd`. Se o Windows mostrar
"O Windows protegeu o computador": **Mais informações → Executar assim mesmo** (ou, antes de extrair, botão direito no
.zip → Propriedades → **Desbloquear**). O gerador do servidor confere as versões, baixa as dependências fixadas (npm),
compila as ferramentas e roda os testes: se algum teste falhar, o instalador **não** é gerado.

- **Tudo em um:** dois cliques em `GERAR-INSTALADOR-UNICO.cmd` → `saida\GameZoney-Instalador.exe` (um arquivo só; a versão aparece só na janela do gerador e nos detalhes do arquivo)
- Só o cliente: `cliente\windows-client-1.0.5\GERAR-INSTALADOR-CLIENTE.cmd` → `cliente\outputs\GameZoney-Cliente-1.0.5-Setup.exe`

Os instaladores não têm nada de app Android/iOS.

## Atualizar uma arena
1. Servidor: painel → Backup → fazer backup; feche o servidor (ícone perto do relógio → Encerrar servidor) e rode o
   novo instalador **na mesma conta do Windows**. Os dados (`%LOCALAPPDATA%\GameZoney\data`) são preservados.
2. PCs: entre com um administrador do servidor (botão Entrar), feche o cliente e rode o instalador do cliente **por cima**,
   com a conta dos clientes conectada no Windows. Associação do PC, fundo de login e firewall são preservados.
3. Passo a passo de uso, instalação, desinstalação e problemas comuns: `GUIA-GAMEZONEY.md`.

## TVs
O servidor já vem pronto para TVs **VIDAA** (Hisense/Toshiba, pareamento com PIN) e **Android TV / Google TV**
(ADB pela rede, porta 5555, pareamento aceitando "Permitir depuração" na TV). No painel: Painel de controle →
estação → "Sistema da TV". Detalhes em `servidor/server/INSTALACAO.txt`.

## Testes
- Servidor: `cd servidor/server && npm ci && node --test` (backup e PC HTTPS precisam do Windows).
- Cliente: compilar com `build.ps1` (gerador `GERAR-INSTALADOR-CLIENTE.cmd`).
