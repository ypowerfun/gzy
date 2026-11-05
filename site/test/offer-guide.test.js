'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createApp}=require('../server');

async function boot(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-site-o-'));const {privateKey}=crypto.generateKeyPairSync('ed25519');const mails=[];
 const app=createApp({env:{SITE_URL:'http://site.test',COOKIE_SECURE:'0',DATA_DIR:dir,DOWNLOADS_DIR:path.join(dir,'dl'),ADMIN_EMAILS:'dono@gamezoney.com',LICENSE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),MP_ACCESS_TOKEN:'',GOOGLE_CLIENT_ID:'',SMTP_HOST:'',PRICE_CENTS:'',LIST_PRICE_CENTS:''},mail:{enabled:true,send:async(to,subject,text)=>{mails.push({to,subject,text});return true}},log:{log(){},error(){}}});
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});const base='http://127.0.0.1:'+server.address().port;
 t.after(()=>{server.close();app.locals.close();fs.rmSync(dir,{recursive:true,force:true})});
 const client=()=>{let cookie='';return async(url,body,status=200,headers={})=>{const r=await fetch(base+url,{redirect:'manual',method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)});
  for(const c of r.headers.getSetCookie?.()||[]){const [kv]=c.split(';');if(kv.startsWith('gzs='))cookie=kv.endsWith('=')?'':kv}
  const text=await r.text();assert.equal(r.status,status,url+' '+text);try{return JSON.parse(text)}catch{return {text,headers:r.headers}}}};
 const admin=async()=>{const c=client();await c('/api/auth/register',{name:'Dono',email:'dono@gamezoney.com',password:'senha-do-dono'});const m=mails.find(x=>x.to==='dono@gamezoney.com');await fetch(base+'/api/auth/verify?t='+m.text.match(/verify\?t=([a-f0-9]+)/)[1],{redirect:'manual'});return c};
 return {base,client,admin};
}

test('1.4: preço "de/por", texto da promoção e faixa do topo editáveis no /admin e usados na compra',async t=>{
 const s=await boot(t);const anon=s.client(),ana=s.client();
 let cfg=await anon('/api/config');assert.equal(cfg.priceCents,8990);assert.equal(cfg.listPriceCents,18990,'de R$ 189,90 por padrão');assert.equal(cfg.banner,'Black Friday GameZoney');
 await ana('/api/auth/register',{name:'Ana',email:'ana@x.com',password:'senha-forte-1'});
 await ana('/api/admin/offer',{priceCents:5000},403);
 const dono=await s.admin();
 await dono('/api/admin/offer',{priceCents:50,listPriceCents:0},400);
 await dono('/api/admin/offer',{priceCents:9990,listPriceCents:5000},400);
 const r=await dono('/api/admin/offer',{priceCents:7990,listPriceCents:19990,priceLabel:'Oferta de Natal',banner:'Natal GameZoney'});
 assert.deepEqual([r.offer.priceCents,r.offer.listPriceCents,r.offer.priceLabel,r.offer.banner],[7990,19990,'Oferta de Natal','Natal GameZoney']);
 cfg=await anon('/api/config');assert.equal(cfg.priceCents,7990);assert.equal(cfg.listPriceCents,19990);assert.equal(cfg.priceLabel,'Oferta de Natal');
 assert.equal((await dono('/api/admin/overview')).offer.priceCents,7990);
 // compra usa o preço novo
 const o=(await ana('/api/checkout',{})).order;assert.equal(o.amountCents,7990);
 // sem preço "de" e sem faixa
 await dono('/api/admin/offer',{priceCents:8990,listPriceCents:0,priceLabel:'',banner:''});cfg=await anon('/api/config');assert.equal(cfg.listPriceCents,0);assert.equal(cfg.banner,'');assert.equal(cfg.priceLabel,'Preço de Black Friday');
});

test('1.4: Guia só com login (página, imagens e modelo CSV)',async t=>{
 const s=await boot(t);const anon=s.client(),ana=s.client();
 const g=await anon('/guia',undefined,302);assert.match(g.headers.get('location'),/entrar\.html\?next=\/guia/);
 await anon('/guia.html',undefined,302);await anon('/guia-img/importar-pt.jpg',undefined,401);await anon('/guia/modelo-clientes.csv',undefined,302);
 await ana('/api/auth/register',{name:'Ana',email:'ana@x.com',password:'senha-forte-1'});
 const page=await ana('/guia');assert.match(page.text,/Conectar os PCs ao servidor/);assert.match(page.text,/Conectar TVs e consoles/);assert.match(page.text,/Importar clientes/);
 await ana('/guia-img/importar-pt.jpg',undefined,200,{'Sec-Fetch-Dest':'image','Sec-Fetch-Site':'same-origin'});
 await ana('/guia-img/importar-pt.jpg',undefined,403,{'Sec-Fetch-Dest':'document'});
 await ana('/guia-img/..%2F..%2Fserver.js',undefined,404);
 const csv=await ana('/guia/modelo-clientes.csv');assert.match(csv.text,/Nome;Nick;Tempo;Medalhas de fidelidade/);
 // a página não fica na pasta pública
 assert.notEqual((await fetch(s.base+'/private/guia.html')).status,200);
 const home=await (await fetch(s.base+'/')).text();assert.match(home,/Pacote Padrão/);assert.match(home,/Pacote Premium/);assert.match(home,/Layout personalizado \(no seu estilo\)/);assert.match(home,/>Atualizações</);assert.doesNotMatch(home,/Novas Atualizações/);
});
