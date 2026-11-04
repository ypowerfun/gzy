'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createServer} = require('../server');
const {passwordHash} = require('../store');
const {publicOrigin, privateAddress} = require('../mobile');
// node:fetch discards a custom Host header; use HTTP for reverse-proxy fixtures.
const http = require('node:http');
function request(url, options={}) {
  return new Promise((resolve,reject)=>{
    const req=http.request(url,{method:options.method||'GET',headers:options.headers||{}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));
      res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));
    });
    req.on('error',reject);if(options.body)req.write(options.body);req.end();
  });
}
class FakeTV { async hdmi() {} async openClientPage() {} disconnect() {} }
async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-mobile-test-'));
  let now = Date.now();
  const server = createServer({directory:dir, noTimer:true, Vidaa:FakeTV, mobile:{now:()=>now}});/* GameZoney 1.0.1: API dos apps desligada por padrão; os testes dela ligam aqui */server.store.state.settings.mobile={...server.store.state.settings.mobile,enabled:true};
  t.after(async () => { await server.close(); fs.rmSync(dir, {recursive:true, force:true}); });
  await new Promise(resolve => server.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:'+server.server.address().port;
  server.store.state.operators.push(
    {id:'owner', username:'admin', hash:passwordHash('admin-password'), role:'admin', owner:true, active:true},
    {id:'clerk', username:'operador', hash:passwordHash('clerk-password'), role:'operator', active:true}
  );
  const member = server.store.memberSave({name:'Ana', username:'ana nick', password:'abc123', phone:'9999999'}, 'admin');
  const other = server.store.memberSave({name:'Outra pessoa', username:'outra', password:'secret1', phone:'8888888'}, 'admin');
  member.creditSeconds = 7200;
  server.store.persist();
  function client(kind='member', headers={}) {
    let cookie='', csrf='';
    const prefix = kind === 'admin' ? '/mobile/admin-api' : '/mobile/api';
    return {
      async call(route, body, extra={}) {
        const requestHeaders = {...headers, ...(cookie?{Cookie:cookie}:{}), ...(csrf?{'X-Prime-CSRF':csrf}:{}), ...extra};
        if(body !== undefined) requestHeaders['Content-Type'] = 'application/json';
        const response = await request(base+prefix+route, {method:body === undefined?'GET':'POST',headers:requestHeaders,body:body === undefined?undefined:JSON.stringify(body)});
        const set = response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
        const type=response.headers.get('content-type')||'';
        const data=type.includes('json')?await response.json():await response.text();
        if(data.csrfToken)csrf=data.csrfToken;
        return {status:response.status,data,headers:response.headers};
      },
      async login(username=kind==='admin'?'admin':'ana nick',password=kind==='admin'?'admin-password':'abc123') {
        assert.equal((await this.call('/auth')).status,200);
        const result = await this.call('/login',{username,password});
        assert.equal(result.status,200,JSON.stringify(result.data));
        return result;
      },
      cookie:()=>cookie
    };
  }
  return {server,base,member,other,client,advance:ms=>{now+=ms;}};
}
test('mobile: dados do membro isolados, login normalizado, estado real e fidelidade automática', async t => {
  const f=await fixture(t), app=f.client();
  assert.equal((await app.call('/me')).status,401);
  await app.login('  ANA   NICK  ');
  let r=await app.call('/me');assert.equal(r.status,200);
  assert.equal(r.data.member.creditSeconds,7200);
  assert.equal(r.data.rewards[0].id,'automatic-program');
  assert.equal(r.data.rewards[0].minutes,60);
  const json=JSON.stringify(r.data);
  for(const secret of ['passwordHash','9999999','8888888','Outra pessoa','pcToken','192.168.1.111','reportKey'])assert(!json.includes(secret),secret);
  assert.equal(r.data.medals[0].earned,false);
  f.server.store.start('1',f.member.id,'admin');
  r=await app.call('/me');
  assert.equal(r.data.member.creditSeconds,0);
  assert(r.data.activeSession.remainingSeconds>7190);
  assert.equal(r.data.stations.find(s=>s.id==='1').status,'busy');
  assert.equal(r.data.medals[0].earned,true);
  assert.equal((await app.call('/state')).status,404);
  assert.equal((await app.call('/credit',{memberId:f.other.id,minutes:60})).status,404);
  f.server.store.finish('1','admin','test');
  r=await app.call('/me');assert.equal(r.data.recentSessions.length,1);
  assert.equal((await app.call('/me?memberId='+f.other.id)).data.member.id,f.member.id);
});
test('mobile: CSRF obrigatório, cookies separados e logout efetivo', async t => {
  const f=await fixture(t), app=f.client();
  assert.equal((await app.call('/login',{username:'ana nick',password:'abc123'})).status,403);
  const pre=await app.call('/auth'), oldCookie=app.cookie();
  assert.match(pre.headers.get('set-cookie'),/HttpOnly/);assert.match(pre.headers.get('set-cookie'),/SameSite=Strict/);
  const login=await app.call('/login',{username:'ana nick',password:'abc123'});
  assert.equal(login.status,200);assert.notEqual(app.cookie(),oldCookie);
  assert.equal((await app.call('/logout',{}, {'X-Prime-CSRF':''})).status,403);
  assert.equal((await app.call('/me',undefined,{Origin:'https://evil.example'})).status,403);
  assert.equal((await app.call('/me',undefined,{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await fetch(f.base+'/mobile/admin-api/state',{headers:{Cookie:app.cookie()}})).status,410);
  assert.equal((await app.call('/logout',{})).status,200);
  assert.equal((await app.call('/me')).status,401);
});
// 3.0.70: app GameZoney SV retirado — nenhum endereço do SV administra nada, nem com a senha do administrador.
test('3.0.70: app SV retirado: páginas, arquivos e API do SV respondem 410 e não administram nada', async t => {
  const f=await fixture(t);
  for(const p of ['/mobile/admin','/mobile/admin-bridge.js','/mobile/admin.css']){
    const r=await fetch(f.base+p);assert.equal(r.status,410,p);assert.match(await r.text(),/app GameZoney SV foi retirado/,p);
  }
  const auth=await fetch(f.base+'/mobile/admin-api/auth');assert.equal(auth.status,410);assert.match((await auth.json()).error,/retirado/);
  assert.equal(auth.headers.get('set-cookie'),null,'o SV não abre sessão');
  const before=f.server.store.state.members.length;
  for(const [route,body] of [['/login',{username:'admin',password:'admin-password'}],['/members',{name:'Novo',username:'novo',password:'abc123'}],['/credit',{memberId:f.member.id,minutes:30}],['/setup',{username:'x',password:'password123'}]]){
    const r=await fetch(f.base+'/mobile/admin-api'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal(r.status,410,route);
  }
  assert.equal(f.server.store.state.members.length,before);assert.equal(f.member.creditSeconds,7200);
  // o app do cliente continua
  const app=f.client();assert.equal((await app.login()).status,200);assert.equal((await app.call('/me')).status,200);
});
test('mobile: expiração, desativação e troca de senha revogam acesso', async t => {
  const f=await fixture(t), app=f.client();await app.login();
  f.member.passwordHash=passwordHash('changed',undefined,1);
  assert.equal((await app.call('/me')).status,401);
  await app.login('ana nick','changed');f.member.active=false;
  assert.equal((await app.call('/me')).status,401);
  f.member.active=true;await app.login('ana nick','changed');
  f.advance(25*3600000);assert.equal((await app.call('/me')).status,401);
});
test('mobile: HTTPS público somente via proxy local confiável; API local não é exposta', async t => {
  const f=await fixture(t);
  f.server.store.state.settings.mobile={enabled:true,publicUrl:'https://arena.example'};
  const headers={Host:'arena.example','X-Forwarded-Proto':'https','X-Forwarded-For':'203.0.113.50'};
  const app=f.client('member',headers);const login=await app.login();
  assert.match(login.headers.get('set-cookie'),/; Secure/);
  assert.equal((await app.call('/me')).status,200);
  // 3.0.51: pelo proxy público o painel nem aparece (404), em vez de responder 403.
  assert.equal((await request(f.base+'/api/auth',{headers})).status,404);
  assert.equal((await request(f.base+'/api/setup',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'})).status,404);
  assert.equal((await request(f.base+'/mobile/api/auth',{headers:{Host:'arena.example'}})).status,403);
  assert.equal((await request(f.base+'/mobile/api/auth',{headers:{...headers,Host:'evil.example'}})).status,403);
  assert.equal((await app.call('/me',undefined,{Origin:'https://evil.example'})).status,403);
  f.server.store.state.settings.mobile.enabled=false;
  assert.equal((await app.call('/me')).status,503);
});
test('mobile: bloqueio após tentativas inválidas e recuperação após janela', async t => {
  const f=await fixture(t), app=f.client();await app.call('/auth');
  for(let i=0;i<10;i++)assert.equal((await app.call('/login',{username:'ana nick',password:'wrong'})).status,401);
  assert.equal((await app.call('/login',{username:'ana nick',password:'abc123'})).status,429);
  f.advance(16*60000);await app.login();
  assert.equal((await app.call('/me')).status,200);
});
test('mobile: páginas usam ponte móvel e política de conteúdo; configurações validadas', async t => {
  const f=await fixture(t);
  const response=await fetch(f.base+'/mobile/admin');
  assert.equal(response.status,410);assert(!(await response.text()).includes('<script'));
  assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal(publicOrigin('https://arena.example'),'https://arena.example');
  for(const value of ['http://arena.example','https://name:pwd@arena.example','https://arena.example/api','https://192.168.1.100','https://localhost','https://[::1]','https://0.0.0.0','https://169.254.1.2'])assert.throws(()=>publicOrigin(value));
  assert(privateAddress('192.168.1.100'));assert(privateAddress('::ffff:172.16.1.2'));assert(!privateAddress('8.8.8.8'));
});
test('mobile: preserva espaços de contas existentes e limita novas sessões anônimas', async t => {
  const f=await fixture(t);
  const existing=f.client();await existing.login();
  for(let i=1;i<120;i++)assert.equal((await f.client().call('/auth')).status,200);
  assert.equal((await f.client().call('/auth')).status,429);
  assert.equal((await existing.call('/auth')).status,200,'existing cookies do not consume anonymous quota');
  assert.equal((await existing.call('/me')).status,200);
  f.advance(11*60000);assert.equal((await f.client().call('/auth')).status,200);
});
