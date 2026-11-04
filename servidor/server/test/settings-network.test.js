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
 await call('/api/settings',{serverUrl:'http://10.255.255.1:3000'});const auto=await call('/api/network/auto',{});assert.equal(auto.changed,true);assert.equal(instance.store.state.settings.serverUrl,auto.serverUrl);assert(netinfo.interfaces().some(i=>auto.serverUrl.includes(i.address)));assert(auto.checks.some(c=>c.name.startsWith('Firewall')));assert.equal((await call('/api/network/auto',{})).changed,false);
 const net=await call('/api/network');assert(Array.isArray(net.interfaces));assert.equal(typeof net.port,'number');
 await call('/api/operators',{username:'caixa',password:'caixa123',role:'operator'});await call('/api/logout',{});await call('/api/login',{username:'caixa',password:'caixa123'});await call('/api/network',undefined,400);await call('/api/network/auto',{},400);await call('/api/settings',{hourCents:1,authPassword:'caixa123'},400);assert.equal(instance.store.state.settings.hourCents,900);
});
test('1.0.5: banco novo usa IP e fuso desta máquina; endereço de fábrica antigo é corrigido sem mexer no resto',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-netdef-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let s=new Store(dir);assert.equal(s.state.settings.serverUrl,netinfo.defaultUrl()||'http://192.168.1.100:3000');assert.equal(s.state.settings.timeZone,netinfo.timeZone()||'America/Manaus');
 s.state.settings.serverUrl='http://192.168.1.100:3000';s.state.settings.timeZone='America/Belem';s.state.settings.hourCents=650;s.persist();s.db.close();
 s=new Store(dir);const ip=netinfo.defaultUrl();if(ip&&!netinfo.interfaces().some(i=>i.address==='192.168.1.100'))assert.equal(s.state.settings.serverUrl,ip);assert.equal(s.state.settings.timeZone,netinfo.timeZone()||'America/Belem');assert.equal(s.state.settings.hourCents,650);
 s.state.settings.serverUrl='http://10.0.0.5:3000';s.persist();s.db.close();s=new Store(dir);assert.equal(s.state.settings.serverUrl,'http://10.0.0.5:3000');s.db.close();
 assert.equal(netinfo.kindOf('Wi-Fi'),'wifi');assert.equal(netinfo.kindOf('Ethernet'),'cabo');assert.equal(netinfo.kindOf('vEthernet (WSL)'),'virtual');assert.equal(netinfo.kindOf('wlan0'),'wifi');
});
test('1.0.5: estações de exemplo e Remover console',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-ex-'));const instance=createServer({directory,noTimer:true});await new Promise(r=>instance.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+instance.server.address().port;let cookie='';
 t.after(async()=>{await instance.close();fs.rmSync(directory,{recursive:true,force:true})});
 async function call(url,body,status=200){const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();assert.equal(r.status,status,text);if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return text?JSON.parse(text):null}
 assert.deepEqual(instance.store.state.stations.map(s=>[s.name,s.kind]),[['Exemplo Console','tv'],['Exemplo PC','computer']]);
 await call('/api/setup',{username:'admin',password:'password123'});await call('/api/login',{username:'admin',password:'password123'});
 await call('/api/station/remove',{stationId:'2'},400);await call('/api/station/remove',{stationId:'1'});await call('/api/station/remove',{stationId:'1'},400);await call('/api/pc/remove',{stationId:'2'});
 const st=await call('/api/state');assert.equal(st.stations.length,0);assert.equal(instance.store.state.stations.length,2);
 const auto=await call('/api/network/auto',{});assert.equal(auto.mode,'local');assert.equal(typeof auto.available,'boolean');
 await call('/api/settings',{serverUrl:'https://gamezoney.invalid'});const cloud=await call('/api/network/auto',{});assert.equal(cloud.mode,'cloud');assert.equal(cloud.available,false);assert.equal(instance.store.state.settings.serverUrl,'https://gamezoney.invalid');
});
test('1.0.5: Corujão/Viradão — criar, participantes, pagamento no caixa, iniciar com medalhas; Ranking Top 10',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-ev-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const s=new Store(dir),ev=require('../events'),shop=require('../shop');
 const mk=n=>{const m={id:'m'+n,name:'N'+n,username:'nick'+n,active:true,creditSeconds:0,pointsMilli:0};s.state.members.push(m);return m};const a=mk(1),b=mk(2),c=mk(3);
 ev.medalSettings(s,{medals:'2,5'},'admin');assert.equal(s.state.settings.eventMedalsMilli,2500);
 const e=ev.create(s,{kind:'corujao',name:'Sexta',date:'2026-11-06',priceCents:3000},'admin');
 for(const m of [a,b,c])ev.addParticipant(s,{eventId:e.id,memberId:m.id},'op');assert.throws(()=>ev.addParticipant(s,{eventId:e.id,memberId:a.id},'op'));
 assert.throws(()=>ev.start(s,{eventId:e.id},'op'),/pagamento/);
 assert.throws(()=>ev.pay(s,{eventId:e.id,memberId:a.id},'op'),/forma de pagamento/);
 const sale=ev.pay(s,{eventId:e.id,memberId:a.id,paymentMethod:'pix'},'op');assert.equal(s.state.shopSales.at(-1).totalCents,3000);assert.equal(s.state.shopSales.at(-1).items[0].kind,'event');
 const sb=ev.pay(s,{eventId:e.id,memberId:b.id,paymentMethod:'cash'},'op');shop.cancelSale(s,{id:sb.id,reason:'desistiu'},'admin');assert.equal(ev.list(s).events[0].participants.find(p=>p.memberId===b.id).paid,false);
 ev.removeParticipant(s,{eventId:e.id,memberId:c.id},'op');assert.throws(()=>ev.removeParticipant(s,{eventId:e.id,memberId:a.id},'op'),/Pagamento já confirmado/);
 ev.start(s,{eventId:e.id},'op');assert.equal(a.pointsMilli,2500);assert.equal(b.pointsMilli,0);assert.throws(()=>shop.cancelSale(s,{id:sale.id,reason:'x'},'admin'),/já iniciado/);assert.throws(()=>ev.addParticipant(s,{eventId:e.id,memberId:c.id},'op'));
 ev.finish(s,{eventId:e.id},'op');
 const r=ev.ranking(s,{});assert.deepEqual(r.participations.map(x=>[x.username,x.count]),[['nick1',1]]);assert.equal(r.medals[0].username,'nick1');assert.equal(r.medals[0].medalsMilli,2500);
 s.state.sales.push({id:'x1',memberId:b.id,cents:700,status:'paid',at:Date.now()},{id:'x2',memberId:b.id,cents:700,status:'paid',at:Date.now()},{id:'x3',memberId:a.id,cents:5000,status:'paid',at:Date.now()},{id:'x4',memberId:a.id,cents:0,status:'paid',at:Date.now()},{id:'x5',memberId:c.id,cents:700,status:'canceled',at:Date.now()});
 const rr=ev.ranking(s,{});assert.deepEqual(rr.recharges.map(x=>[x.username,x.count]),[['nick2',2],['nick1',1]]);assert.equal(ev.ranking(s,{month:'2001-01'}).recharges.length,0);
 const e2=ev.create(s,{kind:'viradao',name:'Grátis',date:'2026-12-31',priceCents:0},'admin');ev.addParticipant(s,{eventId:e2.id,memberId:c.id},'op');ev.pay(s,{eventId:e2.id,memberId:c.id},'op');ev.remove(s,{eventId:ev.create(s,{name:'X',date:'2026-12-01',priceCents:0},'admin').id},'admin');assert.throws(()=>ev.remove(s,{eventId:e2.id},'admin'),/pagamentos/);
 s.db.close();
});
test('1.0.5: pagamento combinado (2 a 3 formas) em recarga e PDV; caixa soma cada forma',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-pay-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const s=new Store(dir),shop=require('../shop'),cash=require('../cash'),P=require('../payments');
 const m={id:'m1',name:'Ana',username:'ana',active:true,creditSeconds:0,pointsMilli:0};s.state.members.push(m);s.state.settings.hourCents=600;
 cash.open(s,{openingCents:0},'admin');
 const sale=s.credit('m1',{minutes:300,payments:[{method:'pix',cents:1000},{method:'credit',cents:1000},{method:'cash',cents:1000}]},'admin');
 assert.equal(sale.cents,3000);assert.equal(sale.paymentMethod,'mixed');assert.equal(sale.payments.length,3);assert.match(P.label(sale),/Pix R\$ 10,00 \+ Cartão \(Crédito\) R\$ 10,00 \+ Dinheiro R\$ 10,00/);
 assert.throws(()=>s.credit('m1',{minutes:300,payments:[{method:'pix',cents:1000},{method:'cash',cents:1000}]},'admin'),/soma/);
 assert.throws(()=>s.credit('m1',{minutes:300,payments:[{method:'pix',cents:3000}]},'admin'),/2 a 3/);
 assert.throws(()=>s.credit('m1',{minutes:300,payments:[{method:'pix',cents:1000},{method:'pix',cents:2000}]},'admin'),/repita/);
 assert.throws(()=>s.credit('m1',{minutes:300,payments:[{method:'pix',cents:1000},{method:'cash',cents:1000},{method:'debit',cents:500},{method:'credit',cents:500}]},'admin'),/2 a 3/);
 const p={id:'p1',name:'Coca',category:'Bebidas',priceCents:1000,costCents:500,stock:5,active:true};s.state.products.push(p);
 const ps=shop.sell(s,{items:[{kind:'product',id:'p1',qty:2}],payments:[{method:'pix',cents:1500},{method:'card',cents:500}]},'admin');assert.equal(ps.paymentMethod,'mixed');assert.equal(p.stock,3);
 assert.throws(()=>shop.sell(s,{items:[{kind:'product',id:'p1',qty:1}],payments:[{method:'pix',cents:500},{method:'credit',cents:500}]},'admin'),/inválida/);assert.equal(p.stock,3);
 const sum=cash.summary(s,cash.current(s));assert.equal(sum.methods.pix,2500);assert.equal(sum.methods.card,1500);assert.equal(sum.methods.cash,1000);assert.equal(sum.totalCents,5000);
 assert.match(shop.receiptLines(s,ps).join('\n'),/Pagamento combinado/);
 const single=s.credit('m1',{minutes:60,paymentMethod:'pix'},'admin');assert.equal(single.paymentMethod,'pix');assert.equal(single.payments,undefined);
 s.db.close();
});
test('1.0.5: Enviar Mensagem — PC conectado recebe no próximo contato; validações',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-msg-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const s=new Store(dir),pc=require('../pc')(s);const st=s.state.stations.find(x=>x.kind==='computer');
 pc.sendMessage(st.id,'Servidor encerra em *20 minutos!*',15);const out=pc.stationState(st);assert.equal(out.messages.length,1);assert.equal(out.messages[0].seconds,15);assert.match(out.messages[0].text,/20 minutos/);
 s.db.close();
});
