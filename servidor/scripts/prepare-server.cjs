'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// Confere se TODAS as declarações de versão estão iguais antes de gerar o instalador (acerta package.json/package-lock.json).
const fs=require('node:fs'),path=require('node:path');
const VERSION='1.0.3';
const root=path.resolve(__dirname,'..','server');
for(const name of ['package.json','package-lock.json']){
  const file=path.join(root,name),data=JSON.parse(fs.readFileSync(file,'utf8'));
  data.version=VERSION;
  if(data.packages?.[''])data.packages[''].version=VERSION;
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
}
const required={
  'server.js':[`version:'${VERSION}'`,`GameZoney SERVER ${VERSION}`,"require('./network-guard')"],
  'Launcher.cs':[`AssemblyVersion("${VERSION}.0")`,'RefreshHttpsStatus();','static void OpenPanel(string address)','UseShellExecute=true','InstalledBrowsers()','SetProcessDPIAware','GetManifestResourceStream("gamezoney.ico")'],
  'installer.iss':[`AppVersion=${VERSION}`,`GameZoney-Servidor-${VERSION}-Setup`,`VersionInfoVersion=${VERSION}.0`,'Source: "network-guard.js"','Source: "androidtv.js"'],
  'INSTALACAO.txt':[`SERVIDOR ${VERSION}`],
  'public/index.html':[`SERVER // ${VERSION}`,'theme-gamezoney.css','logo-gamezoney.png'],
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
for(const file of ['network-guard.js','androidtv.js','gamezoney.ico','public/logo-gamezoney.png','public/theme-gamezoney.css'])
  if(!fs.existsSync(path.join(root,file)))missing.push('arquivo faltando: '+file);
for(const gone of ['Microsoft.Web.WebView2.Core.dll','runtimes'])if(fs.existsSync(path.join(root,gone)))missing.push('arquivo do WebView2 não deveria existir mais: '+gone);
if(/Source: "[^"]*WebView2/i.test(fs.readFileSync(path.join(root,'installer.iss'),'utf8')))missing.push('installer.iss ainda leva arquivo do WebView2');
if(missing.length){console.error('Versão inconsistente:\n - '+missing.join('\n - '));process.exit(1);}
console.log(`Servidor ${VERSION} preparado e conferido.`);
