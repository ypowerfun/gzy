'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 3.0.52+: confere se TODAS as declarações de versão estão em 3.0.52 antes de gerar o instalador.
// (A versão anterior deste script forçava 3.0.50; agora ele só acerta package.json/package-lock.json e confere o resto.)
const fs=require('node:fs'),path=require('node:path');
const VERSION='1.0.1';
const root=path.resolve(__dirname,'..','server');
for(const name of ['package.json','package-lock.json']){
  const file=path.join(root,name),data=JSON.parse(fs.readFileSync(file,'utf8'));
  data.version=VERSION;
  if(data.packages?.[''])data.packages[''].version=VERSION;
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
}
const required={
  'server.js':[`version:'${VERSION}'`,`GameZoney SERVER ${VERSION}`,"require('./network-guard')"],
  'Launcher.cs':[`AssemblyVersion("${VERSION}.0")`,'RefreshHttpsStatus();','class PanelHost','class PanelWindow','PanelHost.SignalRunning(port)','SetProcessDPIAware','GetManifestResourceStream("prime.ico")'],
  'installer.iss':[`AppVersion=${VERSION}`,`GameZoney-Servidor-${VERSION}-Setup`,`VersionInfoVersion=${VERSION}.0`,'Source: "network-guard.js"','Source: "Microsoft.Web.WebView2.Core.dll"','Source: "Microsoft.Web.WebView2.WinForms.dll"','Source: "runtimes\\win-x64\\native\\WebView2Loader.dll"','Source: "runtimes\\win-x86\\native\\WebView2Loader.dll"'],
  'INSTALACAO.txt':[`SERVIDOR ${VERSION}`],
  'public/index.html':[`SERVER // ${VERSION}`],
  'public/mobile/client.html':['/mobile/manifest.webmanifest','/mobile/install-hint.js','/mobile/app-shell.js','/mobile/emblem.png','id="ranking-me"'],
  'public/mobile/client.css':['PREMIUM GAMING UI V2','rajdhani-700.woff2','user-select:none','bg-entrada.webp','bg-app.webp','eye-button'],
  'public/mobile/client.js':['renderHomeRanking','home-ranking','loyaltyOff','play-cta','history-date','station-art','monitorIcon','renderNotices','loadRankings','renderTournaments','toggleOptions','notice-close','selectstart','ranking-me','photoFallback'],
  'mobile.js':['SV_OFF_PAGE','WEB_CLIENT_OFF','webClient:input.webClient===true','rankingsService','/torneios','/rankings','/avatar/','rankingsLookup'],
  'tournaments.js':['redirect: \'error\''],
  'rankings.js':['redirect: \'error\'','avatarLink','privateAddress'],
  'shop.js':['marginPrice','Margem de lucro'],
  'public/shop-ui.js':['askFinishSale','marginPriceCents','Deseja realmente finalizar a venda?'],
  'public/app.js':['toggle-cash','pa-caixa-oculto','Ativar programa fidelidade','loyaltyEnabled'],
  'store.js':['loyaltyEnabled'],
  'business.js':['member.loyaltyEnabled===false','member?.loyaltyEnabled!==false'],
  'pc.js':['m.loyaltyEnabled===false?null']
};
const missing=[];
for(const [name,needles] of Object.entries(required)){
  const text=fs.readFileSync(path.join(root,name),'utf8');
  for(const needle of needles)if(!text.includes(needle))missing.push(`${name}: ${needle}`);
}
for(const file of ['Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','runtimes/win-x64/native/WebView2Loader.dll','runtimes/win-x86/native/WebView2Loader.dll','LICENSE-webview2.txt','network-guard.js','rankings.js','tournaments.js','public/mobile/art/trophy-gold.webp','public/mobile/manifest.webmanifest','public/mobile/install-hint.js','public/mobile/apple-touch-icon.png','public/mobile/icon-192.png','public/mobile/icon-512.png','public/mobile/icon-maskable-512.png','public/mobile/app-shell.js','public/mobile/emblem.png','public/mobile/fonts/rajdhani-600.woff2','public/mobile/fonts/rajdhani-700.woff2','public/mobile/fonts/OFL-Rajdhani.txt','public/mobile/art/bg-entrada.webp','public/mobile/art/bg-app.webp','public/mobile/art/hero-arena.webp','public/mobile/art/hourglass-red.webp','public/mobile/art/hourglass-gold.webp','public/mobile/art/shield-gold.webp','public/mobile/art/medal-gold.webp','public/mobile/art/medal-silver.webp','public/mobile/art/station-pc.webp','public/mobile/art/station-console.webp'])
  if(!fs.existsSync(path.join(root,file)))missing.push('arquivo faltando: '+file);
if(missing.length){console.error('Versão inconsistente:\n - '+missing.join('\n - '));process.exit(1);}
console.log(`Servidor ${VERSION} preparado e conferido.`);
