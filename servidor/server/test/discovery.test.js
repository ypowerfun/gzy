'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),https=require('node:https');
const {execFileSync,spawn}=require('node:child_process');const {createServer}=require('../server');
const clientRoot=process.env.PRIME_CLIENT_TEST_EXE?path.dirname(process.env.PRIME_CLIENT_TEST_EXE):['../cliente/windows-client-1.0.5','prime-arena-client','GameZoneyCliente_MOD'].map(folder=>path.resolve(__dirname,'../..',folder)).find(folder=>fs.existsSync(path.join(folder,'transport.js')));
if(!clientRoot)throw Error('Fonte do cliente Windows não encontrada para testar descoberta.');
function bridge(input){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(clientRoot,'transport.js')],{windowsHide:true});let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('exit',code=>{try{if(code)throw Error(err);resolve(JSON.parse(out))}catch(e){reject(e)}});child.stdin.end(JSON.stringify(input))})}
test('Descoberta UDP e cadastro HTTPS: aprovação administrativa, vínculo exclusivo, recusa e pin',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'prime-discovery-')),pfx=path.join(directory,'server.pfx');execFileSync(path.join(__dirname,'../CertTool.exe'),[pfx],{windowsHide:true});
 const app=createServer({directory,noTimer:true});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});const port=await app.startPC(0,pfx),udp=await app.discovery.start(0),base='http://127.0.0.1:'+app.server.address().port;
 const found=await bridge({action:'discover',settings:{},body:{target:'127.0.0.1',port:udp}});assert.equal(found.ok,true);assert.equal(found.data.servers.length,1);
 const settings={...found.data.servers[0],token:'0'.repeat(64),device:crypto.randomBytes(16).toString('hex')};assert.equal(settings.server,'https://127.0.0.1:'+port);assert.equal(settings.fingerprint,new crypto.X509Certificate(fs.readFileSync(pfx+'.cer')).fingerprint256.replaceAll(':',''));
 const body={device:settings.device,name:'PC de teste',secret:crypto.randomBytes(32).toString('hex')};let result=await bridge({action:'setup',settings,body});assert.equal(result.data.status,'pending');assert(!result.data.token);
 assert.equal((await bridge({action:'state',settings,body:{}})).ok,false);
 assert.equal((await bridge({action:'setup',settings,body:{...body,secret:'f'.repeat(64)}})).ok,false);
 const publicPending=JSON.stringify(app.discovery.list());assert(!publicPending.includes(body.secret));assert(!publicPending.includes('secretHash'));assert.equal(app.discovery.list().length,1);
 let cookie='';async function api(url,body){const r=await fetch(base+'/api'+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')}}
 assert.equal((await api('/pc/approve',{device:body.device})).status,401);
 await api('/setup',{username:'admin',password:'Senha-admin-123'});cookie=(await api('/login',{username:'admin',password:'Senha-admin-123'})).cookie.split(';')[0];
 assert.equal((await api('/state')).data.pendingPCs[0].code,result.data.code);
 const approved=await api('/pc/approve',{device:body.device,name:'PC 03'});assert.equal(approved.status,200);assert.equal(approved.data.verification,settings.fingerprint.slice(0,12));
 result=await bridge({action:'setup',settings,body});assert.equal(result.data.status,'approved');settings.token=result.data.token;assert.equal((await bridge({action:'state',settings,body:{}})).data.stationName,'PC 03');
 assert.equal((await bridge({action:'state',settings:{...settings,device:'f'.repeat(32)},body:{}})).ok,false);
 const pcId=app.store.state.stations.find(s=>s.name==='PC 03').id;
 const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=';
 assert.equal((await api('/pc/layout',{stationId:pcId,image,position:'left'})).status,200);
 assert.equal((await api('/pc/layout',{stationId:'1',image,position:'left'})).status,400);
 assert.equal((await api('/pc/layout',{stationId:pcId,image:Buffer.from('invalid').toString('base64'),position:'left'})).status,400);
 const layout=(await bridge({action:'state',settings,body:{}})).data.loginLayout;assert.equal(layout.position,'left');
 assert.equal((await bridge({action:'wallpaper',settings,body:{}})).data.image,image);
 assert.equal((await bridge({action:'wallpaper',settings:{...settings,token:'0'.repeat(64)},body:{}})).status,401);
 assert.equal((await api('/pc/layout',{stationId:pcId,clear:true,position:'right'})).status,200);
 assert.equal((await bridge({action:'wallpaper',settings,body:{}})).data.image,null);
 const seen=app.pc.seen.get(app.store.state.stations.find(s=>s.name==='PC 03').id);
 assert.equal((await bridge({action:'state',settings:{...settings,fingerprint:'0'.repeat(64)},body:{}})).ok,false);assert.equal(app.pc.seen.get(app.store.state.stations.find(s=>s.name==='PC 03').id),seen);
 assert.equal((await api('/pc/approve',{device:body.device,name:'Duplicado'})).status,400);
 const other={...body,device:crypto.randomBytes(16).toString('hex'),secret:crypto.randomBytes(32).toString('hex')};await bridge({action:'setup',settings,body:other});
 assert.equal((await api('/pc/approve',{device:other.device,stationId:app.store.state.stations.find(s=>s.name==='PC 03').id})).status,400);
 await api('/pc/reject',{device:other.device});assert.equal((await bridge({action:'setup',settings,body:other})).data.status,'rejected');
 assert.equal((await fetch(base+'/pc-setup/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).status,403);
 assert(!JSON.stringify((await api('/state')).data).includes(settings.token));assert(!JSON.stringify(app.store.state).includes(settings.token));
 // Remoção exige administrador e PC sem sessão; revoga inclusive entregas antigas de configuração.
 const station=app.store.state.stations.find(s=>s.name==='PC 03'),stationId=station.id;
 assert.equal((await api('/pc/remove',{stationId:'1'})).status,400);
 // Keep this assertion about a connected PC, regardless of subprocess startup
 // time in the test runner (production considers heartbeats older than 10s offline).
 app.pc.seen.set(stationId,Date.now());
 assert.equal((await api('/pc/remove',{stationId})).status,400); // conectado
 const member=app.store.memberSave({name:'Teste remoção',username:'remocao',password:'Senha-teste-123'},'admin');app.store.credit(member.id,{minutes:10},'admin');
 app.store.start(stationId,member.id,'admin');app.pc.seen.set(stationId,Date.now()-20000);
 assert.equal((await api('/pc/remove',{stationId})).status,400); // sessão mesmo offline
 app.store.finish(stationId,'admin','manual');const history=JSON.stringify(app.store.state.sessions),balance=app.store.member(member.id).creditSeconds;
 assert.equal((await api('/pc/remove',{stationId})).status,200);
 assert(!(await api('/state')).data.stations.some(s=>s.id===stationId));assert.equal(app.pc.seen.has(stationId),false);
 assert.equal((await bridge({action:'state',settings,body:{}})).ok,false);
 assert.equal((await bridge({action:'setup',settings,body})).data.status,'rejected');
 assert.equal((await api('/pc/enroll',{stationId})).status,400);
 assert.equal((await api('/stations',{id:stationId,name:'Restaurar',kind:'computer',active:true})).status,400);
 assert.equal(JSON.stringify(app.store.state.sessions),history);assert.equal(app.store.member(member.id).creditSeconds,balance);
 const {Store}=require('../store');const reopened=new Store(directory);assert(!reopened.snapshot().stations.some(s=>s.id===stationId));assert(reopened.station(stationId).removedAt);assert(!reopened.station(stationId).pcTokenHash);reopened.close();
 const fresh={device:crypto.randomBytes(16).toString('hex'),secret:crypto.randomBytes(32).toString('hex'),name:'PC reconfigurado'};
 assert.equal((await bridge({action:'setup',settings,body:fresh})).data.status,'pending');
 assert.equal((await api('/pc/approve',{device:fresh.device,stationId})).status,400);
 assert.equal((await api('/pc/approve',{device:fresh.device})).status,200);
 const freshToken=(await bridge({action:'setup',settings,body:fresh})).data.token;
 assert.equal((await bridge({action:'state',settings:{...settings,device:fresh.device,token:freshToken},body:{}})).ok,true);
 const freshStation=app.store.state.stations.find(s=>s.name===fresh.name);freshStation.active=false;app.store.persist();
 await api('/operators',{username:'operador',password:'Senha-operador-123',role:'operator'});cookie=(await api('/login',{username:'operador',password:'Senha-operador-123'})).cookie.split(';')[0];assert.equal((await api('/pc/reject',{device:body.device})).status,400);assert.deepEqual((await api('/state')).data.pendingPCs,[]);assert.equal((await api('/pc/remove',{stationId:freshStation.id})).status,400);assert.equal((await api('/pc/layout',{stationId:freshStation.id,clear:true,position:'center'})).status,400);
 cookie=(await api('/login',{username:'admin',password:'Senha-admin-123'})).cookie.split(';')[0];assert.equal((await api('/pc/remove',{stationId:freshStation.id})).status,200);
});
