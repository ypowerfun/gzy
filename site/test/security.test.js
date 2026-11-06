'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createApp}=require('../server');

async function boot(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-site-s-'));const {privateKey}=crypto.generateKeyPairSync('ed25519');const mails=[];
 const app=createApp({env:{SITE_URL:'https://gamezoney.com',COOKIE_SECURE:'0',DATA_DIR:dir,DOWNLOADS_DIR:path.join(dir,'dl'),ADMIN_EMAILS:'dono@gamezoney.com',LICENSE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),MP_ACCESS_TOKEN:'',GOOGLE_CLIENT_ID:'',SMTP_HOST:''},mail:{enabled:true,send:async(to,subject,text)=>{mails.push({to,subject,text});return true}},log:{log(){},error(){}}});
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});const base='http://127.0.0.1:'+server.address().port;
 t.after(()=>{server.close();app.locals.close();fs.rmSync(dir,{recursive:true,force:true})});
 const client=()=>{let cookie='';return async(url,body,status=200,headers={})=>{const r=await fetch(base+url,{redirect:'manual',method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie,...headers},body:body===undefined?undefined:(typeof body==='string'?body:JSON.stringify(body))});
  for(const c of r.headers.getSetCookie?.()||[]){const [kv]=c.split(';');if(kv.startsWith('gzs='))cookie=kv.endsWith('=')?'':kv}
  const text=await r.text();assert.equal(r.status,status,url+' '+text);try{return JSON.parse(text)}catch{return {text,headers:r.headers}}}};
 return {base,client,mails,dir};
}

test('segurança: admin só com e-mail confirmado (ninguém vira admin só cadastrando o e-mail do dono)',async t=>{
 const s=await boot(t);const intruso=s.client();
 await intruso('/api/auth/register',{name:'Intruso',email:'dono@gamezoney.com',password:'senha-qualquer-1'});
 const r=await intruso('/api/admin/overview',undefined,403);assert.match(r.error,/Confirme o seu e-mail/);
 assert.equal((await intruso('/api/me')).admin,false);
 // link inválido não confirma
 const bad=await fetch(s.base+'/api/auth/verify?t=abc',{redirect:'manual'});assert.match(bad.headers.get('location'),/verificado=0/);
 // só quem recebe o e-mail (o dono de verdade) confirma
 const t2=s.mails.find(m=>m.to==='dono@gamezoney.com').text.match(/verify\?t=([a-f0-9]+)/)[1];
 await fetch(s.base+'/api/auth/verify?t='+t2,{redirect:'manual'});
 await intruso('/api/admin/overview');assert.equal((await intruso('/api/me')).user.emailVerified,true);
 // reenviar confirmação
 const outro=s.client();await outro('/api/auth/register',{name:'Outro',email:'outro@x.com',password:'senha-qualquer-1'});
 assert.equal((await outro('/api/auth/verify/resend',{})).sent,true);
});

test('segurança: bloqueio de senha errada por conta, redirecionamento aberto, origem, erros sem detalhes e cabeçalhos',async t=>{
 const s=await boot(t);const a=s.client(),b=s.client();
 await a('/api/auth/register',{name:'Ana',email:'ana@x.com',password:'senha-certa-123'});
 for(let i=0;i<10;i++)await b('/api/auth/login',{email:'ana@x.com',password:'errada-'+i},400);
 const blocked=await b('/api/auth/login',{email:'ana@x.com',password:'senha-certa-123'},429);assert.match(blocked.error,/Muitas tentativas/);
 // redirecionamento aberto: "//site-falso" não é aceito como destino
 const g=await fetch(s.base+'/auth/google?next=//evil.com',{redirect:'manual'});assert.match(g.headers.get('location'),/entrar\.html/);
 // POST com sessão vindo de outro site é recusado (CSRF)
 await a('/api/profile',{name:'Ana',phone:'',organization:''},403,{Origin:'https://evil.com'});
 await a('/api/profile',{name:'Ana',phone:'',organization:''},200,{Origin:'https://gamezoney.com'});
 // JSON inválido e erro interno não mostram detalhes (stack)
 const j=await a('/api/auth/login','{"email":',400);assert.equal(j.error,'Requisição inválida.');
 const m=await fetch(s.base+'/media/reviews/nao-existe.png');assert.equal(m.status,404);assert.doesNotMatch(await m.text(),/at |node_modules|Error:/);
 // cabeçalhos de segurança
 const h=(await fetch(s.base+'/')).headers;
 assert.match(h.get('content-security-policy'),/object-src 'none'/);assert.equal(h.get('x-frame-options'),'DENY');assert.equal(h.get('x-content-type-options'),'nosniff');
 assert.ok(h.get('permissions-policy'));assert.equal(h.get('strict-transport-security'),null,'COOKIE_SECURE=0 no teste');assert.equal(h.get('x-powered-by'),null);
 // capturas do sistema: carregam na página (<img>), mas abrir o endereço direto/baixar é recusado
 assert.equal((await fetch(s.base+'/img/telas/painel-pt.jpg',{headers:{'Sec-Fetch-Dest':'image','Sec-Fetch-Site':'same-origin'}})).status,200);
 assert.equal((await fetch(s.base+'/img/telas/painel-pt.jpg',{headers:{'Sec-Fetch-Dest':'document','Sec-Fetch-Site':'none'}})).status,403);
 assert.equal((await fetch(s.base+'/img/telas/painel-pt.jpg',{headers:{'Sec-Fetch-Dest':'image','Sec-Fetch-Site':'cross-site'}})).status,403);
 // arquivos internos nunca são servidos
 for(const u of ['/site.sqlite','/../server.js','/license-private.pem','/data/site.sqlite','/.env','/package.json'])assert.notEqual((await fetch(s.base+u)).status,200,u);
 // XSS: nome com HTML volta como texto (JSON) e a página escapa
 await a('/api/profile',{name:'<img src=x onerror=alert(1)>',phone:'',organization:'<script>x</script>'});
 const me=await a('/api/me');assert.equal(me.user.name,'<img src=x onerror=alert(1)>');
 const js=await (await fetch(s.base+'/site.js')).text();assert.match(js,/esc\(r\.name\)/);
});

test('2.1: envios grandes (imagens) só são lidos depois de conferir login/administrador', async t => {
  const {createApp} = require('../server'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gz-site-big-'));
  const app = createApp({campaignIntervalMs: 0, planSyncIntervalMs: 0, env: {SITE_URL: 'http://site.test', COOKIE_SECURE: '0', DATA_DIR: dir, DOWNLOADS_DIR: path.join(dir, 'dl'), ADMIN_EMAILS: 'dono@gamezoney.com', MP_ACCESS_TOKEN: '', GOOGLE_CLIENT_ID: '', SMTP_HOST: ''}, mail: {enabled: false, send: async () => false}, log: {log() {}, error() {}}});
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = 'http://127.0.0.1:' + server.address().port;
  t.after(() => { server.close(); app.locals.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  const big = JSON.stringify({data: 'x'.repeat(4 * 1024 * 1024)});
  assert.equal((await fetch(base + '/api/admin/design/image', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: big})).status, 403);
  assert.equal((await fetch(base + '/api/reviews', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: big})).status, 401);
});
