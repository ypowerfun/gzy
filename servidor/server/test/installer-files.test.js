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
// 1.0.3: sem WebView2. O painel abre no navegador padrão do Windows (Chrome, Firefox, Brave, Edge...), com reserva para
// os navegadores instalados quando o padrão não abre.
test('1.0.3: painel no navegador padrão, sem WebView2 no iniciador nem no instalador',()=>{
 const root=path.join(__dirname,'..'),iss=fs.readFileSync(path.join(root,'installer.iss'),'utf8'),launcher=fs.readFileSync(path.join(root,'Launcher.cs'),'utf8');
 assert(!/WebView2|PanelWindow|PanelHost/.test(launcher),'o iniciador não usa mais o WebView2');
 assert(!/Source: "[^"]*WebView2/i.test(iss)&&!iss.includes('webview2-installer.iss'),'o instalador não leva mais o WebView2');
 for(const file of ['Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','runtimes'])assert(!fs.existsSync(path.join(root,file)),'arquivo do WebView2 ainda na pasta: '+file);
 assert(iss.includes('Type: files; Name: "{app}\\Microsoft.Web.WebView2.Core.dll"')&&iss.includes('Type: filesandordirs; Name: "{app}\\runtimes"'),'a atualização apaga o WebView2 de instalações anteriores');
 assert(launcher.includes('Process.Start(new ProcessStartInfo(address){UseShellExecute=true})'),'abre no navegador padrão do Windows');
 for(const exe of ['chrome.exe','firefox.exe','brave.exe','msedge.exe'])assert(launcher.includes('"'+exe+'"'),'reserva: '+exe);
 assert(!launcher.includes('--app=')&&!launcher.includes('painel-edge'),'não força mais o Edge em modo aplicativo');
 assert(/menu\.Items\.Add\("Abrir GameZoney",null,\(s,e\)=>ShowPanel\(\)\)/.test(launcher)&&launcher.includes('void ShowPanel(){OpenPanel(address);}'),'menu do ícone abre o painel no navegador');
 assert(launcher.includes('if(!silent&&!selftest)OpenPanel('),'segunda abertura (atalho) abre o painel no navegador');
});
