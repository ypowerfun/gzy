'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
// 3.0.48: todo módulo .js que o servidor carrega precisa estar no instalador (senão o servidor instalado não abre).
test('3.0.48: instalador do servidor inclui todos os módulos .js usados',()=>{
 const root=path.join(__dirname,'..'),iss=fs.readFileSync(path.join(root,'installer.iss'),'utf8');
 const listed=new Set([...iss.matchAll(/Source: "([^"\\]+\.js)"/g)].map(m=>m[1]));
 const needed=new Set(['server.js']);const queue=['server.js'];
 while(queue.length){const file=queue.shift();const src=fs.readFileSync(path.join(root,file),'utf8');for(const m of src.matchAll(/require\('\.\/([a-z0-9-]+)'\)/g)){const f=m[1]+'.js';if(!needed.has(f)&&fs.existsSync(path.join(root,f))){needed.add(f);queue.push(f);}}}
 for(const f of needed)assert(listed.has(f),'falta no installer.iss: '+f);
});
// 3.0.68: painel em janela própria. Sem os arquivos do WebView2 no instalador o painel voltaria a abrir no navegador.
test('3.0.68: instalador do servidor leva o WebView2 do painel e o iniciador usa a janela própria com reserva',()=>{
 const root=path.join(__dirname,'..'),iss=fs.readFileSync(path.join(root,'installer.iss'),'utf8'),launcher=fs.readFileSync(path.join(root,'Launcher.cs'),'utf8');
 for(const file of ['Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','runtimes\\win-x64\\native\\WebView2Loader.dll','runtimes\\win-x86\\native\\WebView2Loader.dll']){
  assert(iss.includes('Source: "'+file+'"'),'falta no installer.iss: '+file);
  assert(fs.existsSync(path.join(root,...file.split('\\'))),'arquivo faltando na pasta do servidor: '+file);
 }
 assert(iss.includes('Source: "LICENSE-*.txt"')&&fs.existsSync(path.join(root,'LICENSE-webview2.txt')),'licença do WebView2 deve ir junto');
 assert(/menu\.Items\.Add\("Abrir GameZoney",null,\(s,e\)=>ShowPanel\(\)\)/.test(launcher),'menu do ícone abre a janela própria');
 assert(!launcher.includes('menu.Items.Add("Abrir no navegador"')&&!launcher.includes('menu.Items.Add("Abrir pasta de dados"'),'1.0.5: menu do ícone sem Abrir no navegador e sem Abrir pasta de dados');
 assert(launcher.includes('new PanelHost(address,port,AppIcon(SystemInformation.IconSize),Log,OpenPanel)'),'reserva: sem WebView2 o painel abre no Edge/navegador');
 // 1.2.6: Windows sem WebView2/Edge (ex.: Windows Server em VPS): o instalador instala o WebView2 oficial e o painel nunca abre no navegador padrão
 assert(iss.includes('Source: "MicrosoftEdgeWebview2Setup.exe"')&&iss.includes('Check: GzNeedsWebView2')&&iss.includes('{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'),'instalador leva e roda o WebView2 quando falta');
 assert(launcher.includes('else WebView2Setup.Missing();')&&!/else Open\(address\);/.test(launcher),'sem WebView2 e sem Edge: avisa, nunca abre o navegador padrão');
 assert(launcher.includes('WebView2Setup.Install(Log)'),'oferece instalar o WebView2 e reabre na janela própria');
 assert(fs.readFileSync(path.join(root,'..','scripts','build-server.ps1'),'utf8').includes("SignerCertificate.Subject -match 'O=Microsoft Corporation'"),'gerador só aceita o instalador do WebView2 assinado pela Microsoft');
 assert(launcher.includes('shown=PanelHost.SignalRunning(port)')&&launcher.includes('if(!shown)OpenPanel('),'segunda abertura avisa o servidor aberto (1.0.7: espera a primeira ficar pronta antes de abrir o navegador)');
 assert(launcher.includes('Splash.Open()')&&launcher.includes('Splash.Close()'),'1.0.7: janela Iniciando o servidor na abertura');
 assert(/FormClosing\+=\(s,e\)=>\{if\(e\.CloseReason==CloseReason\.UserClosing\)\{e\.Cancel=true;Hide\(\)/.test(launcher),'fechar a janela só esconde o painel (servidor continua)');
 assert(launcher.includes('settings.AreDevToolsEnabled=false'),'ferramentas de desenvolvedor desligadas');
 assert(!/GZ_DATA_DIR[^;]*painel|Path\.Combine\(data,"painel/.test(launcher),'a janela do painel não usa a pasta de dados do servidor');
});
