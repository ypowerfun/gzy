'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// Confere se TODAS as declarações de versão estão iguais (VERSION) antes de gerar o instalador.
// Acerta package.json/package-lock.json e confere o resto.
const fs=require('node:fs'),path=require('node:path');
const VERSION='1.3.0';
const root=path.resolve(__dirname,'..','server');
for(const name of ['package.json','package-lock.json']){
  const file=path.join(root,name),data=JSON.parse(fs.readFileSync(file,'utf8'));
  data.version=VERSION;
  if(data.packages?.[''])data.packages[''].version=VERSION;
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
}
// 1.1.9: BOM duplicado no início (EF BB BF EF BB BF) faz o Inno Setup não reconhecer o "#define GzRole" da 1ª linha
// ("Undeclared identifier: GzRole"). Corrige sozinho nos arquivos do Servidor, do Cliente e do instalador único.
for(const dir of [root,path.resolve(root,'..'),path.resolve(root,'..','..','cliente','windows-client-1.0.5'),path.resolve(root,'..','..','unico')]){
  if(!fs.existsSync(dir))continue;
  for(const name of fs.readdirSync(dir)){
    if(!/\.(iss|cs|ps1|cmd|txt|md|js|cjs)$/i.test(name))continue;
    const file=path.join(dir,name);let data=fs.readFileSync(file),fixed=false;
    while(data.length>=6&&data[0]===0xEF&&data[1]===0xBB&&data[2]===0xBF&&data[3]===0xEF&&data[4]===0xBB&&data[5]===0xBF){data=data.subarray(3);fixed=true;}
    if(fixed){fs.writeFileSync(file,data);console.log('Corrigido início duplicado (BOM) em '+path.relative(path.resolve(root,'..','..'),file));}
  }
}
const required={
  'server.js':[`version:'${VERSION}'`,`GameZoney SERVER ${VERSION}`,"require('./network-guard')"],
  'Launcher.cs':[`AssemblyVersion("${VERSION}.0")`,'CheckIntegrity();','--disable-sigusr1','class PanelHost','class PanelWindow','PanelHost.SignalRunning(port)','SetProcessDPIAware','GetManifestResourceStream("gamezoney.ico")'],
  'installer.iss':[`AppVersion=${VERSION}`,`GameZoney-Servidor-${VERSION}-Setup`,`VersionInfoVersion=${VERSION}.0`,'Source: "network-guard.js"','Source: "Microsoft.Web.WebView2.Core.dll"','Source: "Microsoft.Web.WebView2.WinForms.dll"','Source: "runtimes\\win-x64\\native\\WebView2Loader.dll"','Source: "runtimes\\win-x86\\native\\WebView2Loader.dll"'],
  // 1.2.0: a descrição do instalador não mostra mais a versão (só para a equipe)
  'INSTALACAO.txt':['INSTALAÇÃO DO SERVIDOR','Gerenciamento NF-e'],
  'INSTALACAO-en.txt':['SERVER INSTALLATION','NF-e management'],
  'shop.js':['marginPrice','Margem de lucro'],
  'public/shop-ui.js':['askFinishSale','marginPriceCents','Deseja realmente finalizar a venda?'],
  'public/app.js':['toggle-cash','gz-caixa-oculto','Ativar programa fidelidade','loyaltyEnabled'],
  'store.js':['loyaltyEnabled'],
  'business.js':['member.loyaltyEnabled===false','member?.loyaltyEnabled!==false'],
  'pc.js':['m.loyaltyEnabled===false?null']
};
const missing=[];
for(const [name,needles] of Object.entries(required)){
  const text=fs.readFileSync(path.join(root,name),'utf8');
  for(const needle of needles)if(!text.includes(needle))missing.push(`${name}: ${needle}`);
}
for(const file of ['GzIntegrity.dev.cs','../tools/protect/protect.cjs','../tools/protect/package-lock.json','Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','runtimes/win-x64/native/WebView2Loader.dll','runtimes/win-x86/native/WebView2Loader.dll','LICENSE-webview2.txt','network-guard.js'])
  if(!fs.existsSync(path.join(root,file)))missing.push('arquivo faltando: '+file);
if(missing.length){console.error('Versão inconsistente:\n - '+missing.join('\n - '));process.exit(1);}
console.log(`Servidor ${VERSION} preparado e conferido.`);
