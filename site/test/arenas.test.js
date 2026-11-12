'use strict';
// "+N arenas confiam" no topo da inicial: 5000 + 100 a cada 100 contas criadas
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createApp,arenasFor}=require('../server');
test('contador de arenas: 5000 + 100 a cada 100 cadastros, no /api/config e na inicial',async t=>{
 assert.equal(arenasFor(0),5000);assert.equal(arenasFor(99),5000);assert.equal(arenasFor(100),5100);assert.equal(arenasFor(105),5100);assert.equal(arenasFor(199),5100);assert.equal(arenasFor(200),5200);assert.equal(arenasFor(1234),6200);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-site-ar-'));const {privateKey}=crypto.generateKeyPairSync('ed25519');
 const app=createApp({env:{SITE_URL:'http://site.test',COOKIE_SECURE:'0',DATA_DIR:dir,DOWNLOADS_DIR:path.join(dir,'dl'),ADMIN_EMAILS:'',ADMIN_MFA:'0',LICENSE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),MP_ACCESS_TOKEN:'',GOOGLE_CLIENT_ID:'',SMTP_HOST:''},mail:{enabled:false,send:async()=>{}}});
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});const base='http://127.0.0.1:'+server.address().port;
 t.after(()=>{server.close();app.locals.close();fs.rmSync(dir,{recursive:true,force:true,maxRetries:5})});
 const cfg=await (await fetch(base+'/api/config')).json();assert.equal(cfg.arenas,5000);
 const html=await (await fetch(base+'/')).text();assert.match(html,/data-arenas>\+5000<\/span> <span>arenas confiam/);assert.match(html,/Sem cartão para testar/);assert.match(html,/10 anos de experiência/);
});
test('carrinho: observação com os requisitos do Pro (domínio etc.) aparece só no plano Pro',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/carrinho.html'),'utf8'),js=fs.readFileSync(path.join(__dirname,'../public/carrinho.js'),'utf8');
 assert.match(html,/id="cart-pro-obs"[^>]*>|class="cart-obs hidden" id="cart-pro-obs"/);for(const t of ['Domínio próprio','VPS ou IP fixo','Internet nas unidades','Focus NFe + certificado A1','XML do fornecedor'])assert.ok(html.includes(t),t);
 assert.match(js,/\$\('#cart-pro-obs'\)\.classList\.toggle\('hidden', plan !== 'pro'\)/);
 const w={};require('node:vm').runInNewContext(fs.readFileSync(path.join(__dirname,'../public/i18n-site-dict.js'),'utf8'),{window:w});for(const t of ['Domínio próprio','Requisitos do Pro'])assert.equal(w.GZ_SITE_DICT.exact[t].length,2,t);
});
test('2.13: Pro ganha o item "Emissão de NFC-e e NFS-e" uma vez, sem trocar a lista editada no /admin', async t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-site-pl4-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:5}));
 const {privateKey}=crypto.generateKeyPairSync('ed25519'),env={SITE_URL:'http://site.test',COOKIE_SECURE:'0',DATA_DIR:dir,DOWNLOADS_DIR:path.join(dir,'dl'),ADMIN_EMAILS:'',ADMIN_MFA:'0',LICENSE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),MP_ACCESS_TOKEN:'',GOOGLE_CLIENT_ID:'',SMTP_HOST:''};
 const make=async()=>{const app=createApp({env,mail:{enabled:false,send:async()=>{}}});const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});const cfg=await (await fetch('http://127.0.0.1:'+server.address().port+'/api/config')).json();server.close();app.locals.close();return cfg.plans.find(p=>p.id==='pro').features};
 // instalação nova: item já no padrão
 let pro=await make();assert.ok(pro.includes('Emissão de NFC-e e NFS-e'));
 // lista do Pro editada no /admin antes desta versão (sem o item): acrescenta logo depois do NF-e, mantendo o resto
 const {open}=require('../db'),db=open(dir);db.run("INSERT INTO settings(key,value) VALUES('plans',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify({pro:{features:['Tudo liberado','Gerenciamento de NF-e','Item do dono']}}));db.run("DELETE FROM settings WHERE key='plans_features_v4'");db.close();
 pro=await make();assert.deepEqual(pro,['Tudo liberado','Gerenciamento de NF-e','Emissão de NFC-e e NFS-e','Item do dono']);
 pro=await make();assert.equal(pro.filter(f=>f==='Emissão de NFC-e e NFS-e').length,1,'não duplica');
});
