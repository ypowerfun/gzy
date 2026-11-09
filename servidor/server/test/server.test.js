'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('../server');
test('Fluxo completo autenticado: promoção, TV, recarga, expiração, relatório e permissões',async t=>{
 const commands=[];let failHdmi=false,failPage=false;
 class FakeTV{constructor(tv){this.tv=tv}async hdmi(){if(failHdmi)throw Error('TV offline');commands.push(['hdmi',this.tv.id])}async openClientPage(url){if(failPage)throw Error('TV offline');commands.push(['page',url])}disconnect(){}}
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-api-'));const instance=createServer({directory,Vidaa:FakeTV,noTimer:true});require('./legacy-loyalty')(instance.store);await new Promise(r=>instance.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+instance.server.address().port;let cookie='';
 t.after(async()=>{await instance.close();fs.rmSync(directory,{recursive:true,force:true})});
 async function call(url,body,status=200,headers={}){const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const text=await r.text();return text?JSON.parse(text):null}
 await call('/api/state',undefined,401);assert.equal((await call('/api/auth')).setup,true);
 await call('/api/setup',{username:'admin',password:'password123'});await call('/api/setup',{username:'other',password:'password123'},400);await call('/api/login',{username:'admin',password:'wrong'},401);await call('/api/login',{username:'admin',password:'password123'});
 await call('/api/members',{name:'Blocked',username:'teste4',password:'Senha-Teste-123'},403,{Origin:'https://other.example'});
 const member=await call('/api/members',{name:'Ana <script>',username:'teste5',password:'Senha-Teste-123',phone:'123'});const promo=await call('/api/promotions',{name:'Combo',minutes:120,cents:1000});
 assert.equal(member.username,'teste5');assert.equal(member.hasPassword,true);assert(!JSON.stringify(member).includes('passwordHash'));await call('/api/login',{username:'teste5',password:'Senha-Teste-123'},401);
 failHdmi=true;await call('/api/credit',{memberId:member.id,promotionId:promo.id,stationId:'1'},400);assert.equal(instance.store.member(member.id).creditSeconds,0);assert.equal(instance.store.state.sales.length,0);failHdmi=false;
 await call('/api/credit',{memberId:member.id,promotionId:promo.id,stationId:'1'});assert.equal(commands[0][0],'hdmi');let active=instance.store.activeForMember(member.id);assert.equal(active.allocatedSeconds,10800);assert.equal(instance.store.state.sales[0].cents,1000);
 await call('/api/start',{memberId:member.id,stationId:'2'},400);await call('/api/credit',{memberId:member.id,minutes:30});active=instance.store.activeForMember(member.id);assert.equal(active.allocatedSeconds,12600);
 // Advance the server's durable deadline to simulate expiry without waiting.
 active.startedAt=Date.now()-9000000;active.endsAt=Date.now()-1;instance.store.persist();await instance.tick();await instance.tick();
 assert.equal(commands.filter(c=>c[0]==='page').length,1);const report=instance.store.state.sessions[0];assert.equal(report.status,'finished');assert.equal(report.usedSeconds,12600);assert.equal(report.remainingSeconds,0);
 const page=new URL(commands.find(c=>c[0]==='page')[1]);assert.equal(page.pathname,'/cliente.html');assert.equal(page.searchParams.get('session'),report.reportKey);const summary=await call('/tv/session/'+report.reportKey);assert.equal(summary.memberName,member.name);assert.equal(summary.usedSeconds,12600);await call('/tv/session/missing',undefined,404).catch(e=>{if(e instanceof SyntaxError)return;throw e});
 await call('/api/credit',{memberId:member.id,minutes:60,stationId:'1'});await call('/api/report',{sessionId:report.id},400);failPage=true;await call('/api/finish',{stationId:'1'});assert.equal(instance.store.state.sessions.at(-1).pageStatus,'failed');assert(instance.store.member(member.id).creditSeconds>3500);failPage=false;
 const snapshot=await call('/api/state');assert(!JSON.stringify(snapshot).includes('reportKey'));assert(!JSON.stringify(snapshot).includes('hash'));
 await call('/api/operators',{username:'cashier',password:'cashier123',role:'operator'});await call('/api/logout',{});await call('/api/login',{username:'cashier',password:'cashier123'});await call('/api/settings',{hourCents:800,serverUrl:'http://192.168.1.100:3000',timeZone:'America/Manaus'},400);await call('/api/members',{name:'Operador pode cadastrar',username:'teste7',password:'Senha-Teste-123'});assert((await call('/api/logs')).length>10);
});
