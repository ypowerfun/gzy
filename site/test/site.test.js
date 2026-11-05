'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createApp,newKey,normalizeKey}=require('../server');
const serverLicense=require('../../servidor/server/license');

async function boot(t,env={},extra={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-site-'));const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
 fs.mkdirSync(path.join(dir,'downloads'));fs.writeFileSync(path.join(dir,'downloads','GameZoney-Teste.exe'),'MZ');
 const mails=[];const app=createApp({env:{SITE_URL:'http://site.test',COOKIE_SECURE:'0',DATA_DIR:dir,DOWNLOADS_DIR:path.join(dir,'downloads'),ADMIN_EMAILS:'dono@gamezoney.com',LICENSE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),MP_ACCESS_TOKEN:'',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',SMTP_HOST:'',...env},mail:{enabled:true,send:async(to,subject,text)=>{mails.push({to,subject,text});return true}},log:{log(){},error(){}},...extra});
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});const base='http://127.0.0.1:'+server.address().port;
 t.after(()=>{server.close();app.locals.close();fs.rmSync(dir,{recursive:true,force:true})});
 const client=()=>{let cookie='';return async(url,body,status=200,opts={})=>{const r=await fetch(base+url,{redirect:'manual',method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body),...opts});const sc=r.headers.getSetCookie?.()||[];for(const c of sc){const [kv]=c.split(';');if(kv.startsWith('gzs='))cookie=kv.endsWith('=')?'':kv}const text=await r.text();assert.equal(r.status,status,url+' '+text);try{return JSON.parse(text)}catch{return {text,location:r.headers.get('location')}}}};
 return {base,client,mails,publicKey:publicKey.export({type:'spki',format:'pem'}),dir};
}

async function confirm(s,email){const m=[...s.mails].reverse().find(x=>x.to===email&&/verify\?t=/.test(x.text));const t=m.text.match(/verify\?t=([a-f0-9]+)/)[1];const r=await fetch(s.base+'/api/auth/verify?t='+t,{redirect:'manual'});if(!/verificado=1/.test(r.headers.get('location')))throw new Error('confirmação falhou')}
test('site: conta por e-mail, compra por PIX manual confirmada pelo administrador, ativação e troca de computador',async t=>{
 const s=await boot(t);const ana=s.client(),dono=s.client(),anon=s.client();
 assert.equal((await anon('/api/me')).user,null);
 await ana('/api/auth/register',{name:'Ana',email:'ana@arena.com',password:'curta'},400);
 const r=await ana('/api/auth/register',{name:'Ana Souza',email:'Ana@Arena.com',password:'senha-forte-1'});assert.equal(r.user.email,'ana@arena.com');
 await anon('/api/auth/register',{name:'Outra',email:'ana@arena.com',password:'senha-forte-2'},409);
 await anon('/api/auth/login',{email:'ana@arena.com',password:'errada-123'},400);
 assert.equal((await ana('/api/me')).licenses.length,0);
 // downloads só com conta
 assert.match((await anon('/download/GameZoney-Teste.exe',undefined,302)).location,/entrar/);
 assert.equal((await ana('/download/GameZoney-Teste.exe')).text,'MZ');await ana('/download/..%2Fsite.sqlite',undefined,404);
 // POST sem JSON é recusado (proteção contra formulário de outro site)
 await ana('/api/checkout',undefined,415,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'a=1'});
 // PIX manual (sem Mercado Pago configurado)
 await ana('/api/checkout',{method:'card'},400);const o=(await ana('/api/checkout',{})).order;assert.equal(o.provider,'manual');assert.equal(o.amountCents,8990);assert.equal(o.status,'pending');
 assert.equal((await ana('/api/checkout',{})).order.id,o.id,'reaproveita o pedido pendente');
 await ana('/api/admin/overview',undefined,403);
 await dono('/api/auth/register',{name:'Dono',email:'dono@gamezoney.com',password:'senha-do-dono'});await confirm(s,'dono@gamezoney.com');
 const ov=await dono('/api/admin/overview');assert.equal(ov.stats.users,2);assert.equal(ov.orders[0].status,'pending');
 await dono(`/api/admin/orders/${o.id}/approve`,{});
 const paid=(await ana('/api/orders/'+o.id)).order;assert.equal(paid.status,'paid');assert.match(paid.licenseKey,/^GZ(-[A-Z0-9]{4}){4}$/);
 assert.ok(s.mails.some(m=>m.to==='ana@arena.com'&&m.text.includes(paid.licenseKey)),'e-mail com a chave');
 const lic=(await ana('/api/me')).licenses[0];assert.equal(lic.key,paid.licenseKey);assert.equal(lic.active,false);
 // ativação pelo GameZoney Servidor (aceita a chave sem traços); certificado confere com a verificação do servidor
 const install1=crypto.randomUUID(),install2=crypto.randomUUID();
 await anon('/api/license/activate',{key:'GZ-0000-0000-0000-0000',installId:install1},404);
 const act=await anon('/api/license/activate',{key:paid.licenseKey.replace(/-/g,'').toLowerCase(),installId:install1,machine:'RECEPCAO',version:'1.0.5'});
 const data=serverLicense.verifyToken(act.token,install1,s.publicKey);assert.ok(data);assert.equal(data.key,paid.licenseKey);assert.equal(data.email,'ana@arena.com');assert.equal(data.plan,'lifetime');
 assert.equal(serverLicense.verifyToken(act.token,install2,s.publicKey),null);
 await anon('/api/license/activate',{key:paid.licenseKey,installId:install1});
 const busy=await anon('/api/license/activate',{key:paid.licenseKey,installId:install2},409);assert.match(busy.error,/RECEPCAO/);
 // outro cliente não libera a licença da Ana
 await dono(`/api/licenses/${lic.id}/release`,{},404);
 await ana(`/api/licenses/${lic.id}/release`,{});
 assert.ok(serverLicense.verifyToken((await anon('/api/license/activate',{key:paid.licenseKey,installId:install2,machine:'NOVO'})).token,install2,s.publicKey));
 // bloqueio pelo administrador
 await dono(`/api/admin/licenses/${lic.id}`,{status:'blocked'});await anon('/api/license/activate',{key:paid.licenseKey,installId:install2},403);
 await dono(`/api/admin/licenses/${lic.id}`,{status:'active'});
 // licença de cortesia
 const c=await dono('/api/admin/licenses',{email:'ana@arena.com',note:'cortesia'});assert.notEqual(c.key,paid.licenseKey);assert.equal((await ana('/api/me')).licenses.length,2);
 await dono('/api/admin/licenses',{email:'ninguem@x.com'},404);
 // suporte
 await ana('/api/support',{subject:'Ajuda',message:'Como ativo a licença?'});const tk=(await dono('/api/admin/overview')).tickets[0];
 await dono('/api/admin/tickets/'+tk.id,{reply:'Configuração › Licença.',status:'closed'});assert.equal((await ana('/api/me')).tickets[0].reply,'Configuração › Licença.');
 // sair
 await ana('/api/auth/logout',{});assert.equal((await ana('/api/me')).user,null);
 await ana('/api/auth/login',{email:'ana@arena.com',password:'senha-forte-1'});assert.equal((await ana('/api/me')).user.name,'Ana Souza');
 // esqueci a senha
 await anon('/api/auth/forgot',{email:'ana@arena.com'});const link=s.mails.find(m=>m.subject.includes('redefinir')).text.match(/t=([a-f0-9]+)/)[1];
 await anon('/api/auth/reset',{token:'x',password:'nova-senha-123'},400);await anon('/api/auth/reset',{token:link,password:'nova-senha-123'});
 await anon('/api/auth/reset',{token:link,password:'outra-senha-123'},400);
 await ana('/api/auth/login',{email:'ana@arena.com',password:'nova-senha-123'});
});

test('site: PIX automático e cartão (Mercado Pago) — confirmação conferida na API e não pelo corpo do aviso',async t=>{
 const payments=new Map(),prefs=[];let seq=1000;
 const fakeFetch=async(url,opts={})=>{const u=new URL(url);const json=(code,body)=>({ok:code<300,status:code,json:async()=>body});
  if(u.pathname==='/v1/payments'&&opts.method==='POST'){const b=JSON.parse(opts.body);assert.equal(opts.headers.Authorization,'Bearer TESTE');assert.equal(b.payment_method_id,'pix');assert.equal(b.transaction_amount,89.9);assert.equal(b.notification_url,'http://site.test/api/mp/webhook');
   const id=String(++seq);payments.set(id,{id,status:'pending',transaction_amount:b.transaction_amount,external_reference:b.external_reference});return json(201,{id:Number(id),status:'pending',point_of_interaction:{transaction_data:{qr_code:'000201PIX',qr_code_base64:'iVBOR',ticket_url:'https://mp/t'}}})}
  if(u.pathname==='/checkout/preferences'&&opts.method==='POST'){const b=JSON.parse(opts.body);assert.equal(b.items[0].unit_price,89.9);assert.equal(b.notification_url,'http://site.test/api/mp/webhook');assert.match(b.back_urls.success,/\/conta\?pedido=/);assert.ok(b.payment_methods.excluded_payment_types.some(t=>t.id==='ticket'));prefs.push(b);return json(201,{id:'pref-'+prefs.length,init_point:'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-'+prefs.length})}
  if(u.pathname==='/v1/payments/search'){const ref=u.searchParams.get('external_reference');return json(200,{results:[...payments.values()].filter(p=>p.external_reference===ref)})}
  const m=u.pathname.match(/^\/v1\/payments\/(\d+)$/);if(m)return payments.has(m[1])?json(200,payments.get(m[1])):json(404,{message:'not found'});
  return json(404,{})};
 const s=await boot(t,{MP_ACCESS_TOKEN:'TESTE'},{fetch:fakeFetch});const ana=s.client(),anon=s.client();
 await ana('/api/auth/register',{name:'Ana',email:'ana@arena.com',password:'senha-forte-1'});
 const o=(await ana('/api/checkout',{})).order;assert.equal(o.provider,'mercadopago');assert.equal(o.pixCode,'000201PIX');assert.equal(o.pixQr,'iVBOR');
 // aviso falso (sem pagamento aprovado) não libera nada
 await anon('/api/mp/webhook',{type:'payment',data:{id:'1001'}});assert.equal((await ana('/api/orders/'+o.id)).order.status,'pending');
 // pagamento aprovado com valor menor não libera
 payments.get('1001').status='approved';payments.get('1001').transaction_amount=1;assert.equal((await ana('/api/orders/'+o.id)).order.status,'pending');
 payments.get('1001').transaction_amount=89.9;
 await anon('/api/mp/webhook?type=payment&data.id=1001',{});await new Promise(r=>setTimeout(r,50));
 const paid=(await ana('/api/orders/'+o.id)).order;assert.equal(paid.status,'paid');assert.ok(paid.licenseKey);
 // aviso repetido não gera outra licença
 await anon('/api/mp/webhook',{type:'payment',data:{id:'1001'}});await new Promise(r=>setTimeout(r,50));assert.equal((await ana('/api/me')).licenses.length,1);
 assert.equal((await anon('/api/config')).pix,true);assert.equal((await anon('/api/config')).card,true);
 // cartão de crédito/débito (Checkout do Mercado Pago): pedido próprio, link de pagamento e confirmação pelo aviso
 const c=(await ana('/api/checkout',{method:'card'})).order;assert.equal(c.method,'card');assert.match(c.checkoutUrl,/mercadopago\.com\.br/);assert.notEqual(c.id,o.id);
 assert.equal((await ana('/api/checkout',{method:'card'})).order.id,c.id,'reaproveita o pedido de cartão pendente');
 // cartão recusado não cancela o pedido (o cliente pode tentar outro cartão)
 payments.set('2001',{id:'2001',status:'rejected',transaction_amount:89.9,external_reference:c.id});
 await anon('/api/mp/webhook',{type:'payment',data:{id:'2001'}});await new Promise(r=>setTimeout(r,50));assert.equal((await ana('/api/orders/'+c.id)).order.status,'pending');
 payments.set('2002',{id:'2002',status:'approved',transaction_amount:89.9,external_reference:c.id});
 await anon('/api/mp/webhook',{type:'payment',data:{id:'2002'}});await new Promise(r=>setTimeout(r,50));
 const cp=(await ana('/api/orders/'+c.id)).order;assert.equal(cp.status,'paid');assert.ok(cp.licenseKey);assert.equal((await ana('/api/me')).licenses.length,2);
 // aviso de pagamento de outro pedido/desconhecido não libera nada
 payments.set('2003',{id:'2003',status:'approved',transaction_amount:89.9,external_reference:'nao-existe'});await anon('/api/mp/webhook',{type:'payment',data:{id:'2003'}});await new Promise(r=>setTimeout(r,50));assert.equal((await ana('/api/me')).licenses.length,2);
});

test('site: login com Google cria ou liga a conta pelo e-mail verificado',async t=>{
 const idToken=claims=>'x.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.y';let claims;
 const fakeFetch=async(url,opts)=>{assert.equal(url,'https://oauth2.googleapis.com/token');const p=new URLSearchParams(opts.body);assert.equal(p.get('code'),'CODE');assert.equal(p.get('redirect_uri'),'http://site.test/auth/google/callback');return {ok:true,status:200,json:async()=>({id_token:idToken(claims)})}};
 const s=await boot(t,{GOOGLE_CLIENT_ID:'cid',GOOGLE_CLIENT_SECRET:'sec'},{fetch:fakeFetch});
 const flow=async(expectOk=true)=>{let cookie='';const r1=await fetch(s.base+'/auth/google?next=/conta',{redirect:'manual'});const loc=new URL(r1.headers.get('location'));assert.equal(loc.host,'accounts.google.com');
  const g=r1.headers.getSetCookie().find(x=>x.startsWith('gzg=')).split(';')[0];const state=loc.searchParams.get('state');
  const r2=await fetch(s.base+'/auth/google/callback?code=CODE&state='+state,{redirect:'manual',headers:{Cookie:g}});const sc=r2.headers.getSetCookie().find(x=>x.startsWith('gzs=')&&!x.startsWith('gzs=;'));
  if(expectOk){assert.equal(r2.headers.get('location'),'/conta');cookie=sc.split(';')[0]}else assert.match(r2.headers.get('location'),/entrar\.html\?erro=/);
  return cookie};
 const ana=s.client();await ana('/api/auth/register',{name:'Ana',email:'ana@arena.com',password:'senha-forte-1'});
 claims={iss:'https://accounts.google.com',aud:'cid',exp:Date.now()/1000+60,sub:'g-1',email:'ANA@arena.com',email_verified:true,name:'Ana G'};
 const cookie=await flow();const me=await (await fetch(s.base+'/api/me',{headers:{Cookie:cookie}})).json();assert.equal(me.user.email,'ana@arena.com');assert.equal(me.user.google,true);assert.equal(me.user.name,'Ana');
 claims={...claims,sub:'g-2',email:'novo@gmail.com',name:'Novo Cliente'};const c2=await flow();assert.equal((await (await fetch(s.base+'/api/me',{headers:{Cookie:c2}})).json()).user.name,'Novo Cliente');
 claims={...claims,sub:'g-3',email:'x@y.com',aud:'outro'};await flow(false);
 claims={...claims,aud:'cid',email_verified:false};await flow(false);
 // estado (state) diferente é recusado
 const r=await fetch(s.base+'/auth/google/callback?code=CODE&state=errado',{redirect:'manual',headers:{Cookie:'gzg=abc.L2NvbnRh'}});assert.match(r.headers.get('location'),/erro=/);
 // conta criada só pelo Google não entra por senha
 const anon=s.client();assert.match((await anon('/api/auth/login',{email:'novo@gmail.com',password:'qualquer-123'},400)).error,/Google/);
});

test('site: feedback dos servidores, páginas e chaves',async t=>{
 const s=await boot(t);const anon=s.client();
 await anon('/api/feedback',{id:'f1',name:'Ana',email:'ana@a.com',comment:'Muito bom!',at:new Date().toISOString(),serverVersion:'1.0.5',installId:'abc'});
 await anon('/api/feedback',{id:'f1',name:'Ana',email:'ana@a.com',comment:'Repetido',serverVersion:'1.0.5'});
 await anon('/api/feedback',{id:'f2',comment:''},400);
 const dono=s.client();await dono('/api/auth/register',{name:'Dono',email:'dono@gamezoney.com',password:'senha-do-dono'});await confirm(s,'dono@gamezoney.com');
 const fb=(await dono('/api/admin/overview')).feedback;assert.equal(fb.length,1);assert.equal(fb[0].comment,'Muito bom!');
 const home=await (await fetch(s.base+'/')).text();assert.match(home,/GameZoney \| O Sistema Completo de Gestão para Arena Gamer, PCs e Consoles/);assert.match(home,/gerencie a lanchonete e proteja seus PCs em uma única plataforma simples e com suporte completo/);assert.match(home,/10 anos de experiência/);assert.match(home,/Novas Atualizações/);assert.match(home,/data-lang="en"/);
 assert.equal((await fetch(s.base+'/nao-existe')).status,404);
 const cfg=await anon('/api/config');assert.equal(cfg.priceCents,8990);assert.equal(cfg.trialDays,30);assert.equal(cfg.google,false);
 for(let i=0;i<50;i++)assert.match(newKey(),/^GZ(-[A-HJ-NP-Z2-9]{4}){4}$/);
 assert.equal(normalizeKey('gz abcd-efgh ijkl mnop'),'GZ-ABCD-EFGH-IJKL-MNOP');
});
