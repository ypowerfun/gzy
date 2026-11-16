'use strict';
// Servidor 1.4.7 (pedido do dono): Free grátis para sempre (com limites) e Standard com NFC-e/NFS-e e Logo e cor; Pro igual.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createApp}=require('../server');
test('1.4.7: planos Free (para sempre, com limites) e Standard ampliado — uma vez, preços e Pro mantidos', async t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-site-pl9-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:5}));
 const {privateKey}=crypto.generateKeyPairSync('ed25519'),env={SITE_URL:'http://site.test',COOKIE_SECURE:'0',DATA_DIR:dir,DOWNLOADS_DIR:path.join(dir,'dl'),ADMIN_EMAILS:'',ADMIN_MFA:'0',LICENSE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),MP_ACCESS_TOKEN:'',GOOGLE_CLIENT_ID:'',SMTP_HOST:''};
 const make=async()=>{const app=createApp({env,mail:{enabled:false,send:async()=>{}}});const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});const cfg=await (await fetch('http://127.0.0.1:'+server.address().port+'/api/config')).json();server.close();app.locals.close();return Object.fromEntries(cfg.plans.map(p=>[p.id,p]))};
 let P=await make();
 assert.ok(P.free.features.includes('Até 10 PCs e 2 consoles'));assert.ok(P.free.features.includes('Até 10 produtos, 5 serviços e 5 categorias'));assert.ok(!P.free.features.some(f=>/30 dias/.test(f)));
 for(const f of ['Emissão de NFC-e e NFS-e','Logo e cor da sua arena','Controle de impressão','PCs e consoles ilimitados'])assert.ok(P.standard.features.includes(f),f);
 const proBefore=P.pro.features;
 // listas salvas no /admin antes desta versão: Free e Standard trocam uma vez; preços e Pro continuam
 const {open}=require('../db');let db=open(dir);
 db.run("INSERT INTO settings(key,value) VALUES('plans',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify({free:{features:['Funções essenciais por 30 dias']},standard:{monthly:3490,features:['Velho']},pro:{features:['Item do dono do Pro']}}));
 db.run("DELETE FROM settings WHERE key='plans_features_v9'");db.close();
 P=await make();
 assert.equal(P.free.features[0],'Grátis para sempre, sem cartão');assert.ok(P.standard.features.includes('Emissão de NFC-e e NFS-e'));assert.equal(P.standard.monthly,3490,'preço mantido');
 assert.deepEqual(P.pro.features,['Item do dono do Pro'],'Pro não muda');
 // editado depois da migração: não troca de novo
 db=open(dir);const saved=JSON.parse(db.get("SELECT value FROM settings WHERE key='plans'").value);saved.free.features=['Do dono'];db.run("UPDATE settings SET value=? WHERE key='plans'",JSON.stringify(saved));db.close();
 P=await make();assert.deepEqual(P.free.features,['Do dono']);assert.ok(proBefore.length);
 // textos do site sem o teste de 30 dias
 const pub=f=>fs.readFileSync(path.join(__dirname,'../public',f),'utf8');
 for(const f of ['index.html','carrinho.html','conta.html','termos.html','site.js','conta.js','entrar.js'])assert.ok(!/30 dias/.test(pub(f)),f+' ainda fala em 30 dias');
});
