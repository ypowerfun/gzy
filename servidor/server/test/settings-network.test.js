'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('../server'),{Store}=require('../store'),netinfo=require('../netinfo');
test('1.0.5: valor da hora exige senha do administrador; endereço aceita IP da rede ou domínio (nuvem); campos ausentes ficam como estão',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-settings-'));const instance=createServer({directory,noTimer:true});await new Promise(r=>instance.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+instance.server.address().port;let cookie='';
 t.after(async()=>{await instance.close();fs.rmSync(directory,{recursive:true,force:true})});
 async function call(url,body,status=200){const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();assert.equal(r.status,status,text);if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return text?JSON.parse(text):null}
 await call('/api/setup',{username:'admin',password:'password123'});await call('/api/login',{username:'admin',password:'password123'});
 const s=instance.store.state.settings,before=s.hourCents;
 await call('/api/settings',{hourCents:900},400);await call('/api/settings',{hourCents:900,authPassword:'errada'},400);assert.equal(s.hourCents,before);
 await call('/api/settings',{hourCents:900,authPassword:'password123'});assert.equal(instance.store.state.settings.hourCents,900);
 await call('/api/settings',{serverUrl:'http://192.168.0.20:3000',timeZone:'America/Sao_Paulo'});let cur=instance.store.state.settings;assert.equal(cur.hourCents,900);assert.equal(cur.serverUrl,'http://192.168.0.20:3000');assert.equal(cur.timeZone,'America/Sao_Paulo');
 await call('/api/settings',{serverUrl:'https://gamezoney.exemplo.com.br/'});assert.equal(instance.store.state.settings.serverUrl,'https://gamezoney.exemplo.com.br');
 for(const bad of ['http://127.0.0.1:3000','http://localhost:3000','ftp://192.168.0.2','não é url'])await call('/api/settings',{serverUrl:bad},400);
 await call('/api/settings',{timeZone:'Lua/Base'},400);assert.equal(instance.store.state.settings.serverUrl,'https://gamezoney.exemplo.com.br');
 const net=await call('/api/network');assert(Array.isArray(net.interfaces));assert.equal(typeof net.port,'number');
 await call('/api/operators',{username:'caixa',password:'caixa123',role:'operator'});await call('/api/logout',{});await call('/api/login',{username:'caixa',password:'caixa123'});await call('/api/network',undefined,400);await call('/api/settings',{hourCents:1,authPassword:'caixa123'},400);assert.equal(instance.store.state.settings.hourCents,900);
});
test('1.0.5: banco novo usa IP e fuso desta máquina; endereço de fábrica antigo é corrigido sem mexer no resto',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-netdef-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let s=new Store(dir);assert.equal(s.state.settings.serverUrl,netinfo.defaultUrl()||'http://192.168.1.100:3000');assert.equal(s.state.settings.timeZone,netinfo.timeZone()||'America/Manaus');
 s.state.settings.serverUrl='http://192.168.1.100:3000';s.state.settings.timeZone='America/Belem';s.state.settings.hourCents=650;s.persist();s.db.close();
 s=new Store(dir);const ip=netinfo.defaultUrl();if(ip&&!netinfo.interfaces().some(i=>i.address==='192.168.1.100'))assert.equal(s.state.settings.serverUrl,ip);assert.equal(s.state.settings.timeZone,'America/Belem');assert.equal(s.state.settings.hourCents,650);
 s.state.settings.serverUrl='http://10.0.0.5:3000';s.persist();s.db.close();s=new Store(dir);assert.equal(s.state.settings.serverUrl,'http://10.0.0.5:3000');s.db.close();
 assert.equal(netinfo.kindOf('Wi-Fi'),'wifi');assert.equal(netinfo.kindOf('Ethernet'),'cabo');assert.equal(netinfo.kindOf('vEthernet (WSL)'),'virtual');assert.equal(netinfo.kindOf('wlan0'),'wifi');
});
