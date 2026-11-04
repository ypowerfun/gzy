# GameZoney Servidor 1.0.4 — gerar o instalador

> Software proprietário e confidencial da GameZoney. Todos os direitos reservados.

## O que instalar no PC que gera (uma vez só)
1. **Node.js 24 LTS** — https://nodejs.org (marque o npm). Ele também vai dentro do instalador como motor do servidor.
2. **Inno Setup 7 ou 6** — https://jrsoftware.org/isdl.php (o gerador acha sozinho o 7 ou o 6).
3. **.NET Framework 4.x** — já vem no Windows 10/11.
4. **Internet** na hora de gerar: o gerador baixa as dependências (npm).

## Gerar
1. Extraia a pasta num caminho curto (ex.: `C:\GZ\`).
2. **Dois cliques em `GERAR-INSTALADOR-SERVIDOR.cmd`**. Se o Windows mostrar "O Windows protegeu o computador", clique em
   **Mais informações → Executar assim mesmo**.
3. Ele confere os programas e a versão, baixa as dependências, compila as ferramentas (.exe), roda os testes e gera
   **`outputs\GameZoney-Servidor-1.0.4-Setup.exe`** (com o SHA-256). Se algum teste falhar, nada é gerado.

## O que o instalador faz no PC da recepção
- Instala o servidor, os atalhos e as regras de firewall (somente rede local).
- O painel abre como **aplicativo** (janela própria, sem abas nem barra de endereço) no **navegador da arena**: o padrão do
  Windows primeiro (Chrome, Brave, Vivaldi, Opera; Firefox em janela nova), depois os instalados — o Edge só por último.
  Não usa WebView2.
- Instalado por cima da 1.0.1/1.0.2, mantém os dados (`%LOCALAPPDATA%\GameZoney\data`) e apaga os arquivos do WebView2 da 1.0.2.

## Se o painel não aparecer
- Ícone do GameZoney perto do relógio → **Abrir GameZoney**.
- Ou digite no navegador deste computador: **http://127.0.0.1:3000**.
- Ícone → **Abrir diagnóstico** (`server.log`) mostra o que o servidor registrou.
