# GameZoney — Gestão Gamer 1.0.5

Gerenciador de arena gamer: **Servidor** (PC da recepção, painel em janela própria) e **Cliente** (PCs gamers).
Todos os direitos reservados à GameZoney. Software proprietário e confidencial.

## Pastas
| Pasta | O que é |
|---|---|
| `servidor/` | Código do Servidor (Node 24 + painel), gerador `GERAR-INSTALADOR-SERVIDOR.cmd` |
| `cliente/windows-client-1.0.5/` | Código do Cliente Windows (.exe nativo + monitor), gerador `GERAR-INSTALADOR-CLIENTE.cmd` |
| `unico/` + `GERAR-INSTALADOR-UNICO.cmd` | Instalador único com as caixas "Instalar Servidor versão 1.0.5" e "Instalar Cliente versão 1.0.5" |
| `marca/` | Logo GZ e banner originais (referência do visual dourado/preto/vermelho) |
| `ferramentas/` | `gerar-imagens-marca.py` (ícones, logos e papel de parede a partir da marca) e `trocar-marca.py` |

## Gerar os instaladores (no Windows 10/11)
Requisitos no PC que gera: Inno Setup 7 ou 6 (detectado sozinho), Node.js 24, .NET Framework 4.x.

- **Tudo em um:** dois cliques em `GERAR-INSTALADOR-UNICO.cmd` → `saida\GameZoney-Instalador-Servidor-1.0.5-Cliente-1.0.5.exe`
- Só o servidor: `servidor\GERAR-INSTALADOR-SERVIDOR.cmd` → `servidor\outputs\GameZoney-Servidor-1.0.5-Setup.exe`
- Só o cliente: `cliente\windows-client-1.0.5\GERAR-INSTALADOR-CLIENTE.cmd` → `cliente\outputs\GameZoney-Cliente-1.0.5-Setup.exe`

Os instaladores não têm nada de app Android/iOS.

## TVs
O servidor já vem pronto para TVs **VIDAA** (Hisense/Toshiba, pareamento com PIN) e **Android TV / Google TV**
(ADB pela rede, porta 5555, pareamento aceitando "Permitir depuração" na TV). No painel: Computadores / TVs →
estação → "Sistema da TV". Detalhes em `servidor/server/INSTALACAO.txt`.

## Testes
- Servidor: `cd servidor/server && npm ci && node --test` (backup e PC HTTPS precisam do Windows).
- Cliente: compilar com `build.ps1` (gerador `GERAR-INSTALADOR-CLIENTE.cmd`).
