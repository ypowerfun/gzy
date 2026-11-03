'use strict';
// 3.0.51: rede da arena (PCs dos clientes, Wi-Fi, TVs) só alcança o necessário; painel e app SV nunca pela rede local.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),https=require('https');
const {createServer}=require('../server');
const networkGuard=require('../network-guard');
const mobileService=require('../mobile');
class FakeTV{async hdmi(){}async openClientPage(){}disconnect(){}}
// Endereço desta máquina fora do loopback: simula um aparelho da rede da arena.
const lanAddress=Object.values(os.networkInterfaces()).flat().find(i=>i&&i.family==='IPv4'&&!i.internal&&!i.address.startsWith('169.254.'))?.address;
function get(url,headers={},extra={}){return new Promise((resolve,reject)=>{const lib=url.startsWith('https')?https:http;const req=lib.request(url,{headers,rejectUnauthorized:false,...extra},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString()}))});req.on('error',reject);req.end()})}
async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pa-guard-'));
 const server=createServer({directory:dir,noTimer:true,Vidaa:FakeTV});/* GameZoney 1.0.1: API dos apps desligada por padrão; os testes dela ligam aqui */server.store.state.settings.mobile={...server.store.state.settings.mobile,enabled:true};
 t.after(async()=>{await server.close();fs.rmSync(dir,{recursive:true,force:true})});
 await new Promise(r=>server.server.listen(0,'0.0.0.0',r));
 return {server,port:server.server.address().port};
}
function fakeReq(p,{address='192.168.1.50',encrypted=false,headers={}}={}){return {path:p,url:p,method:'GET',headers:{host:'192.168.1.100:3000',...headers},socket:{remoteAddress:address,encrypted}}}
function fakeRes(){const r={statusCode:200,headers:{},body:null,set(k,v){if(typeof k==='object')Object.assign(r.headers,k);else r.headers[k]=v;return r},status(c){r.statusCode=c;return r},type(){return r},json(b){r.body=b;return r},send(b){r.body=b;return r},sendStatus(c){r.statusCode=c;return r},sendFile(){r.body='file';return r}};return r}
function guarded(store,req){let passed=false;const res=fakeRes();networkGuard(store)(req,res,()=>{passed=true});return passed?'next':res.statusCode}

test('3.0.51: guarda de rede por origem (servidor, Caddy, PCs, TVs, Wi-Fi)',()=>{
 const store={state:{settings:{mobile:{enabled:true}},stations:[{id:'1',kind:'tv',ip:'192.168.1.111',active:true}]}};
 // próprio servidor: tudo
 for(const p of ['/','/index.html','/api/state','/health','/mobile/admin'])assert.equal(guarded(store,fakeReq(p,{address:'127.0.0.1'})),'next',p);
 // celular/PC na rede local (HTTP 3000): painel, API, app SV e arquivos internos escondidos
 for(const p of ['/','/index.html','/app.js','/lockdown.js','/api/state','/api/login','/health','/mobile/admin','/mobile/admin-api/auth','/mobile/admin-bridge.js','/mobile/admin.css','/pc/heartbeat','/pc-setup/request','/internal/stop','/cliente.html','/tv/session/x'])assert.equal(guarded(store,fakeReq(p)),404,p);
 // app do cliente pela rede local: liberado por padrão
 for(const p of ['/mobile','/mobile/client','/mobile/client.js','/mobile/client.css','/mobile/api/auth','/mobile/api/me','/logo-prime.png','/favicon.ico'])assert.equal(guarded(store,fakeReq(p)),'next',p);
 // ...e bloqueado quando a recepção desliga a opção
 store.state.settings.mobile.lanClient=false;
 for(const p of ['/mobile/client','/mobile/api/auth'])assert.equal(guarded(store,fakeReq(p)),404,p);
 // TV: somente do IP da TV cadastrada
 assert.equal(guarded(store,fakeReq('/cliente.html',{address:'192.168.1.111'})),'next');
 assert.equal(guarded(store,fakeReq('/tv/session/x',{address:'::ffff:192.168.1.111'})),'next');
 assert.equal(guarded(store,fakeReq('/api/state',{address:'192.168.1.111'})),404);
 store.state.stations[0].active=false;assert.equal(guarded(store,fakeReq('/cliente.html',{address:'192.168.1.111'})),404);
 // canal HTTPS dos PCs (3443): só /pc e /pc-setup
 for(const p of ['/pc/heartbeat','/pc-setup/request'])assert.equal(guarded(store,fakeReq(p,{encrypted:true})),'next',p);
 for(const p of ['/','/api/state','/mobile/client','/mobile/admin','/health','/cliente.html'])assert.equal(guarded(store,fakeReq(p,{encrypted:true})),404,p);
 // Caddy (HTTPS público): somente o app (/mobile). 3.0.70: arquivos do painel não passam mais (app SV retirado)
 const proxy={address:'127.0.0.1',headers:{'x-forwarded-for':'203.0.113.9','x-forwarded-proto':'https'}};
 for(const p of ['/mobile/client','/mobile/api/auth'])assert.equal(guarded(store,fakeReq(p,proxy)),'next',p);
 for(const p of ['/','/index.html','/api/state','/health','/lockdown.js','/cliente.html','/pc/heartbeat','/internal/stop','/app.js','/style.css','/theme-prime.css','/mobile-settings-ui.js'])assert.equal(guarded(store,fakeReq(p,proxy)),404,p);
});

test('3.0.51/3.0.70: app SV recusado (retirado) mesmo se chegar ao módulo móvel',()=>{
 const store={state:{settings:{mobile:{enabled:true}},operators:[],members:[],stations:[]}};
 const mobile=mobileService(store,{});
 for(const p of ['/mobile/admin','/mobile/admin-api/auth','/mobile/admin-bridge.js','/mobile/admin.css']){
  const res=fakeRes();let passed=false;mobile.middleware(fakeReq(p),res,()=>{passed=true});
  assert.equal(passed,false,p);assert.equal(res.statusCode,410,p);assert.match(String(res.body.error||res.body),/SV foi retirado/);
 }
 // app do cliente pela rede local continua funcionando
 const res=fakeRes();mobile.middleware({...fakeReq('/mobile/api/auth')},res,()=>{});
 assert.equal(res.statusCode,200);assert.ok(res.body.csrfToken);
 // configuração salva a opção da rede local
 const saved=mobileService({state:{settings:{}},change:(a,b,c,fn)=>fn()},{}).configure({enabled:true,lanClient:false,publicUrl:''},'admin');
 assert.equal(saved.lanClient,false);
});

test('3.0.51: servidor real recusa o painel para quem não está no próprio servidor',{skip:!lanAddress&&'sem endereço de rede'},async t=>{
 const f=await fixture(t);const lan=`http://${lanAddress}:${f.port}`,local=`http://127.0.0.1:${f.port}`;
 // PC sem rede ativa (adaptador desligado/virtual): não há como simular um aparelho da rede; o teste por origem acima cobre a regra.
 try{await get(lan+'/mobile/client')}catch(e){t.skip('endereço de rede indisponível: '+e.code);return}
 for(const p of ['/','/index.html','/app.js','/api/auth','/health','/mobile/admin','/mobile/admin-api/auth'])assert.equal((await get(lan+p)).status,404,p);
 assert.notEqual((await get(lan+'/mobile/client')).status,404,'app do cliente passa pela guarda');
 assert.equal((await get(local+'/health')).status,200);
 assert.equal((await get(local+'/')).status,200);
 assert.equal((await get(local+'/api/auth')).status,200);
 // TV: liberada somente quando o IP de onde vem o pedido é o da TV cadastrada
 assert.equal((await get(lan+'/cliente.html')).status,404);
 f.server.store.state.stations[0].ip=lanAddress;
 assert.equal((await get(lan+'/cliente.html')).status,200);
 // canal HTTPS dos PCs
 const port=await f.server.startPC(0);const pc=`https://${lanAddress}:${port}`;
 for(const p of ['/','/api/auth','/mobile/client','/mobile/admin','/health'])assert.equal((await get(pc+p)).status,404,p);
 assert.equal((await get(pc+'/pc/heartbeat',{},{method:'POST'})).status,401,'agente dos PCs continua alcançando /pc');
});

test('3.0.52: app do cliente instalável na Tela de Início (manifesto, ícones e aviso)',async t=>{
 const f=await fixture(t);const local=`http://127.0.0.1:${f.port}`;
 // 3.0.69: a página web do cliente só existe com o acesso pelo navegador ligado (Configurações → Apps)
 f.server.store.state.settings.mobile={...f.server.store.state.settings.mobile,webClient:true};
 const html=(await get(local+'/mobile/client')).body;
 for(const tag of ['rel="manifest" href="/mobile/manifest.webmanifest"','rel="apple-touch-icon" href="/mobile/apple-touch-icon.png"','apple-mobile-web-app-capable','/mobile/install-hint.js'])assert(html.includes(tag),tag);
 const manifest=JSON.parse((await get(local+'/mobile/manifest.webmanifest')).body);
 assert.equal(manifest.start_url,'/mobile/client');assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons)assert.equal((await get(local+icon.src)).status,200,icon.src);
 for(const p of ['/mobile/apple-touch-icon.png','/mobile/install-hint.js'])assert.equal((await get(local+p)).status,200,p);
 // pela rede local e pelo HTTPS público (Caddy) os arquivos de instalação passam pela guarda
 const store={state:{settings:{mobile:{enabled:true}},stations:[]}};
 for(const p of ['/mobile/manifest.webmanifest','/mobile/apple-touch-icon.png','/mobile/icon-192.png','/mobile/icon-512.png','/mobile/icon-maskable-512.png','/mobile/install-hint.js','/mobile/app-shell.js','/mobile/emblem.png','/mobile/fonts/rajdhani-600.woff2','/mobile/fonts/rajdhani-700.woff2',
   ...['bg-entrada','bg-app','hero-arena','hourglass-red','hourglass-gold','shield-gold','medal-gold','medal-silver','station-pc','station-console','trophy-gold'].map(n=>`/mobile/art/${n}.webp`)]){
  assert.equal(guarded(store,fakeReq(p)),'next',p);
  assert.equal(guarded(store,fakeReq(p,{address:'127.0.0.1',headers:{'x-forwarded-for':'203.0.113.9'}})),'next',p);
 }
 // 3.0.57: as ilustrações existem e saem como imagem WebP
 for(const n of ['bg-entrada','bg-app','hero-arena','hourglass-red','medal-gold']){const r=await get(`${local}/mobile/art/${n}.webp`);assert.equal(r.status,200,n)}
});
