# GameZoney Servidor 1.0.2 — gerar o instalador

> Software proprietário e confidencial da GameZoney. Todos os direitos reservados.

## O que instalar no PC que gera (uma vez só)
1. **Node.js 24 LTS** — https://nodejs.org (marque o npm). Ele também vai dentro do instalador como motor do servidor.
2. **Inno Setup 7 ou 6** — https://jrsoftware.org/isdl.php (o gerador acha sozinho o 7 ou o 6).
3. **.NET Framework 4.x** — já vem no Windows 10/11.
4. **Internet** na hora de gerar: o gerador baixa as dependências (npm) e o instalador oficial do **WebView2** da Microsoft
   (a assinatura digital da Microsoft é conferida; sem ela o instalador não é gerado).

## Gerar
1. Extraia a pasta num caminho curto (ex.: `C:\GZ\`).
2. **Dois cliques em `GERAR-INSTALADOR-SERVIDOR.cmd`**. Se o Windows mostrar "O Windows protegeu o computador", clique em
   **Mais informações → Executar assim mesmo**.
3. Ele confere os programas e a versão, baixa as dependências, compila as ferramentas (.exe), roda os testes e gera
   **`outputs\GameZoney-Servidor-1.0.2-Setup.exe`** (com o SHA-256). Se algum teste falhar, nada é gerado.

## O que o instalador faz no PC da recepção
- Instala o servidor, o painel em janela própria, os atalhos e as regras de firewall (somente rede local).
- **WebView2 da Microsoft** (motor da janela do painel): confere a versão instalada; se faltar ou for anterior à 120,
  instala/atualiza em silêncio (precisa de internet). Sem internet, avisa — o painel abre no navegador até lá.
- Instalado por cima da 1.0.1, mantém os dados (`%LOCALAPPDATA%\GameZoney\data`).

## Se o painel não aparecer
- A janela mostra **"Abrindo o painel…"**. Se em 20 s a página não aparecer, o painel abre sozinho no navegador.
- Ícone perto do relógio → **Abrir diagnóstico** (`server.log`): as linhas `Painel:` mostram a versão do WebView2 e a
  etapa em que parou. Ícone → **Abrir no navegador** sempre funciona.
