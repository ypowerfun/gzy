'use strict';
// Rede da arena (PCs dos clientes, Wi-Fi, TVs) só alcança o necessário; o painel nunca pela rede local.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),https=require('https');
const {createServer}=require('../server');
const networkGuard=require('../network-guard');
class FakeTV{async hdmi(){}async openClientPage(){}disconnect(){}}
// Endereço desta máquina fora do loopback: simula um aparelho da rede da arena.
const lanAddress=Object.values(os.networkInterfaces()).flat().find(i=>i&&i.family==='IPv4'&&!i.internal&&!i.address.startsWith('169.254.'))?.address;
function get(url,headers={},extra={}){return new Promise((resolve,reject)=>{const lib=url.startsWith('https')?https:http;const req=lib.request(url,{headers,rejectUnauthorized:false,...extra},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString()}))});req.on('error',reject);req.end()})}
async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-guard-'));
 const server=createServer({directory:dir,noTimer:true,Vidaa:FakeTV});
 t.after(async()=>{await server.close();fs.rmSync(dir,{recursive:true,force:true})});
 await new Promise(r=>server.server.listen(0,'0.0.0.0',r));
 return {server,port:server.server.address().port};
}
function fakeReq(p,{address='192.168.1.50',encrypted=false,headers={}}={}){return {path:p,url:p,method:'GET',headers:{host:'192.168.1.100:3000',...headers},socket:{remoteAddress:address,encrypted}}}
function fakeRes(){const r={statusCode:200,headers:{},body:null,set(k,v){if(typeof k==='object')Object.assign(r.headers,k);else r.headers[k]=v;return r},status(c){r.statusCode=c;return r},type(){return r},json(b){r.body=b;return r},send(b){r.body=b;return r},sendStatus(c){r.statusCode=c;return r},sendFile(){r.body='file';return r}};return r}
function guarded(store,req){let passed=false;const res=fakeRes();networkGuard(store)(req,res,()=>{passed=true});return passed?'next':res.statusCode}

test('guarda de rede por origem (servidor, proxy, PCs, TVs, Wi-Fi)',()=>{
 const store={state:{settings:{},stations:[{id:'1',kind:'tv',ip:'192.168.1.111',active:true}]}};
 // próprio servidor: tudo
 for(const p of ['/','/index.html','/api/state','/health','/theme-gamezoney.css'])assert.equal(guarded(store,fakeReq(p,{address:'127.0.0.1'})),'next',p);
 // celular/PC na rede local (HTTP 3000): nada (painel, API, arquivos internos e o antigo app web escondidos)
 for(const p of ['/','/index.html','/app.js','/lockdown.js','/api/state','/api/login','/health','/mobile','/mobile/client','/mobile/api/auth','/logo-gamezoney.png','/favicon.ico','/pc/heartbeat','/pc-setup/request','/internal/stop','/cliente.html','/tv/session/x'])assert.equal(guarded(store,fakeReq(p)),404,p);
 // TV: somente do IP da TV cadastrada
 assert.equal(guarded(store,fakeReq('/cliente.html',{address:'192.168.1.111'})),'next');
 assert.equal(guarded(store,fakeReq('/logo.jpg',{address:'192.168.1.111'})),'next'); assert.equal(guarded(store,fakeReq('/tv-wallpaper.jpg',{address:'192.168.1.111'})),'next','1.3.5: wallpaper da TV depois do resumo');assert.equal(guarded(store,fakeReq('/tv-wallpaper.jpg',{address:'192.168.1.50'})),404,'outro aparelho não abre');
 assert.equal(guarded(store,fakeReq('/tv/session/x',{address:'::ffff:192.168.1.111'})),'next');
 assert.equal(guarded(store,fakeReq('/api/state',{address:'192.168.1.111'})),404);
 store.state.stations[0].active=false;assert.equal(guarded(store,fakeReq('/cliente.html',{address:'192.168.1.111'})),404);
 // canal HTTPS dos PCs (3443): só /pc e /pc-setup
 for(const p of ['/pc/heartbeat','/pc-setup/request'])assert.equal(guarded(store,fakeReq(p,{encrypted:true})),'next',p);
 for(const p of ['/','/api/state','/mobile/client','/health','/cliente.html'])assert.equal(guarded(store,fakeReq(p,{encrypted:true})),404,p);
 // pedido repassado por proxy (X-Forwarded-*): nada passa
 const proxy={address:'127.0.0.1',headers:{'x-forwarded-for':'203.0.113.9','x-forwarded-proto':'https'}};
 for(const p of ['/','/index.html','/api/state','/health','/mobile/client','/mobile/api/auth','/cliente.html','/pc/heartbeat','/internal/stop','/app.js'])assert.equal(guarded(store,fakeReq(p,proxy)),404,p);
});

test('servidor real recusa o painel para quem não está no próprio servidor',{skip:!lanAddress&&'sem endereço de rede'},async t=>{
 const f=await fixture(t);const lan=`http://${lanAddress}:${f.port}`,local=`http://127.0.0.1:${f.port}`;
 try{await get(lan+'/health')}catch(e){t.skip('endereço de rede indisponível: '+e.code);return}
 for(const p of ['/','/index.html','/app.js','/api/auth','/health','/mobile/client','/mobile/api/auth'])assert.equal((await get(lan+p)).status,404,p);
 assert.equal((await get(local+'/health')).status,200);
 assert.equal((await get(local+'/')).status,200);
 assert.equal((await get(local+'/api/auth')).status,200);
 // o antigo app web não existe mais nem no próprio servidor
 for(const p of ['/mobile/client','/mobile/api/auth','/mobile-settings-ui.js','/mobile/emblem.png'])assert.equal((await get(local+p)).status,404,p);
 // TV: liberada somente quando o IP de onde vem o pedido é o da TV cadastrada
 assert.equal((await get(lan+'/cliente.html')).status,404);
 f.server.store.state.stations[0].ip=lanAddress;
 assert.equal((await get(lan+'/cliente.html')).status,200);
 // canal HTTPS dos PCs
 const port=await f.server.startPC(0);const pc=`https://${lanAddress}:${port}`;
 for(const p of ['/','/api/auth','/mobile/client','/health'])assert.equal((await get(pc+p)).status,404,p);
 assert.equal((await get(pc+'/pc/heartbeat',{},{method:'POST'})).status,401,'agente dos PCs continua alcançando /pc');
});
