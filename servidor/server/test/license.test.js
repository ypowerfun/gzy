'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {createServer}=require('../server'),license=require('../license');
const sign=(data,privateKey)=>{const body=Buffer.from(JSON.stringify(data)).toString('base64url');return body+'.'+crypto.sign(null,Buffer.from(body,'base64url'),privateKey).toString('base64url')};

test('1.0.5: licença — teste de 30 dias, bloqueio só de venda/tempo novo depois do teste e ativação vitalícia assinada',async t=>{
 const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');const pub=publicKey.export({type:'spki',format:'pem'});
 // site falso: aceita GZ-AAAA-BBBB-CCCC-DDDD e devolve o certificado assinado para o installId enviado
 let lastBody=null;const site=http.createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{lastBody=JSON.parse(raw);res.setHeader('Content-Type','application/json');
  if(req.url!=='/api/license/activate'||lastBody.key!=='GZ-AAAA-BBBB-CCCC-DDDD'){res.statusCode=404;return res.end(JSON.stringify({error:'Chave não encontrada.'}))}
  res.end(JSON.stringify({token:sign({v:1,key:lastBody.key,installId:lastBody.installId,email:'dono@arena.com',plan:'lifetime',issuedAt:Date.now()},privateKey)}))})});
 await new Promise(r=>site.listen(0,'127.0.0.1',r));const old=process.env.GZ_SITE_URL;process.env.GZ_SITE_URL='http://127.0.0.1:'+site.address().port;
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-license-'));const instance=createServer({directory,noTimer:true,license:{publicKey:pub}});
 await new Promise(r=>instance.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+instance.server.address().port;let cookie='';
 t.after(async()=>{await instance.close();site.close();fs.rmSync(directory,{recursive:true,force:true});if(old===undefined)delete process.env.GZ_SITE_URL;else process.env.GZ_SITE_URL=old});
 async function call(url,body,status=200){const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();assert.equal(r.status,status,url+' '+text);if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return text?JSON.parse(text):null}
 await call('/api/setup',{username:'admin',password:'password123'});await call('/api/login',{username:'admin',password:'password123'});
 let L=await call('/api/license');assert.equal(L.mode,'trial');assert.equal(L.daysLeft,30);assert.ok(L.installId);
 // teste vencido: venda/tempo novo bloqueados (402), resto continua (dados guardados)
 instance.store.state.license.trialStartedAt=Date.now()-31*86400000;
 L=await call('/api/license');assert.equal(L.mode,'expired');assert.equal(L.daysLeft,0);
 const blocked=await call('/api/members',{name:'Ana',username:'ana',password:'Senha-1234'},402);assert.match(blocked.error,/30 dias/);
 await call('/api/shop/sale',{items:[]},402);await call('/api/credit',{memberId:'x',minutes:60},402);
 await call('/api/state');await call('/api/profile/lang',{lang:'en'});
 // chave errada / formato inválido
 await call('/api/license/activate',{key:'abc'},400);
 const wrong=await call('/api/license/activate',{key:'GZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ'},400);assert.match(wrong.error,/não encontrada/);
 // ativação (aceita minúsculas e sem traços)
 L=await call('/api/license/activate',{key:'gzaaaabbbbccccdddd'});assert.equal(L.mode,'licensed');assert.equal(L.key,'GZ-AAAA-****-****-DDDD');assert.equal(L.email,'dono@arena.com');
 assert.equal(lastBody.installId,instance.store.state.runtime.installId);
 await call('/api/members',{name:'Ana',username:'ana',password:'Senha-1234'});
 // certificado de outra instalação ou adulterado não vale
 assert.equal(license.verifyToken(instance.store.state.license.token,'outra-instalacao',pub),null);
 const [b,sig]=instance.store.state.license.token.split('.');const fake=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(b,'base64url')),email:'x'})).toString('base64url');
 assert.equal(license.verifyToken(fake+'.'+sig,instance.store.state.runtime.installId,pub),null);
 // chave da GameZoney (embutida) não aceita certificado assinado por outra chave
 assert.equal(license.verifyToken(instance.store.state.license.token,instance.store.state.runtime.installId),null);
 assert.equal(license.normalizeKey(' gz-aaaa bbbb-cccc-dddd '),'GZ-AAAA-BBBB-CCCC-DDDD');
});

test('1.0.5: licença — início do teste guardado fora da pasta de dados (reinstalar não reinicia o teste)',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-license-marker-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const markerFile=path.join(dir,'gz-license.json'),old=Date.now()-10*86400000;fs.writeFileSync(markerFile,JSON.stringify({trialStartedAt:old}));
 const store={state:{runtime:{}}};const lic=license(store,{markerFile});
 assert.equal(store.state.license.trialStartedAt,old);assert.equal(lic.status().daysLeft,20);
 const store2={state:{runtime:{},license:{trialStartedAt:Date.now()-40*86400000}}};license(store2,{markerFile});
 assert.equal(JSON.parse(fs.readFileSync(markerFile,'utf8')).trialStartedAt,store2.state.license.trialStartedAt);
});

test('1.0.5 (troca de computador): chave ativada em outro computador — pede e-mail e senha da conta gamezoney.com e ativa neste',async t=>{
 const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');const pub=publicKey.export({type:'spki',format:'pem'});let lastBody=null;
 const site=http.createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{lastBody=JSON.parse(raw);res.setHeader('Content-Type','application/json');
  if(lastBody.email===undefined){res.statusCode=409;return res.end(JSON.stringify({error:'Esta chave já está ativada em outro computador (RECEPCAO).',needLogin:true,machine:'RECEPCAO'}))}
  if(lastBody.email!=='dono@arena.com'||lastBody.password!=='senha-do-site'){res.statusCode=400;return res.end(JSON.stringify({error:'E-mail ou senha incorretos.'}))}
  res.end(JSON.stringify({token:sign({v:1,key:lastBody.key,installId:lastBody.installId,email:'dono@arena.com',plan:'lifetime',issuedAt:Date.now()},privateKey)}))})});
 await new Promise(r=>site.listen(0,'127.0.0.1',r));const old=process.env.GZ_SITE_URL;process.env.GZ_SITE_URL='http://127.0.0.1:'+site.address().port;
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-license-'));const instance=createServer({directory,noTimer:true,license:{publicKey:pub}});
 await new Promise(r=>instance.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+instance.server.address().port;let cookie='';
 t.after(async()=>{await instance.close();site.close();fs.rmSync(directory,{recursive:true,force:true});if(old===undefined)delete process.env.GZ_SITE_URL;else process.env.GZ_SITE_URL=old});
 async function call(url,body,status=200){const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();assert.equal(r.status,status,url+' '+text);if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return text?JSON.parse(text):null}
 await call('/api/setup',{name:'Dono',username:'admin',password:'senha123'});await call('/api/login',{username:'admin',password:'senha123'});
 const key='GZ-AAAA-BBBB-CCCC-DDDD';
 const busy=await call('/api/license/activate',{key},400);assert.equal(busy.needLogin,true);assert.equal(busy.machine,'RECEPCAO');assert.equal(lastBody.password,undefined);
 const bad=await call('/api/license/activate',{key,email:'dono@arena.com',password:'errada'},400);assert.match(bad.error,/incorretos/);assert.equal(bad.needLogin,undefined);
 const L=await call('/api/license/activate',{key,email:' dono@arena.com ',password:'senha-do-site'});assert.equal(L.mode,'licensed');assert.equal(lastBody.email,'dono@arena.com');
 // a senha da conta do site não fica guardada no servidor
 assert.doesNotMatch(JSON.stringify(instance.store.state),/senha-do-site/);
});
