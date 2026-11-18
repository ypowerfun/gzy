'use strict';
// Servidor 1.4.7 (pedido do dono): Free grátis para sempre (com limites) e Standard com NFC-e/NFS-e e Logo e cor; Pro igual.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createApp}=require('../server');
test('1.4.7/2.26: itens dos planos Free, Standard e Pro (lista do dono) — troca uma vez, preços mantidos', async t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-site-pl9-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:5}));
 const {privateKey}=crypto.generateKeyPairSync('ed25519'),env={SITE_URL:'http://site.test',COOKIE_SECURE:'0',DATA_DIR:dir,DOWNLOADS_DIR:path.join(dir,'dl'),ADMIN_EMAILS:'',ADMIN_MFA:'0',LICENSE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),MP_ACCESS_TOKEN:'',GOOGLE_CLIENT_ID:'',SMTP_HOST:''};
 const make=async()=>{const app=createApp({env,mail:{enabled:false,send:async()=>{}}});const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});const cfg=await (await fetch('http://127.0.0.1:'+server.address().port+'/api/config')).json();server.close();app.locals.close();return Object.fromEntries(cfg.plans.map(p=>[p.id,p]))};
 let P=await make();
 assert.deepEqual(P.free.features,['Todas as funções liberadas','Autoatendimento no PC (PIX)','PCs e Consoles limitados','Produtos/Serviços limitados','Seus dados ficam guardados ao assinar','Sem anúncios']);
 assert.deepEqual(P.standard.features,['Todas as funções liberadas','Autoatendimento no PC (PIX)','Emissão de NFC-e e NFS-e','Logo e cor da sua arena (Visual)','Controle de impressão','PCs, Consoles, VR e Simuladores ilimitados','Produtos/Serviços ilimitados','Suporte completo (24 horas)','Sem anúncios']);
 assert.deepEqual(P.pro.features,['Todas as funções liberadas','Autoatendimento no PC (PIX)','Emissão de NFC-e e NFS-e','Logo e cor da sua arena (Visual)','Controle de impressão','PCs, Consoles, VR e Simuladores ilimitados','Produtos/Serviços ilimitados','Apps do cliente e da recepção','Multi-Unidade','Suporte completo (24 horas)','Sem anúncios']);
 const proBefore=P.pro.features;
 // listas salvas no /admin antes desta versão: Free e Standard trocam uma vez; preços e Pro continuam
 const {open}=require('../db');let db=open(dir);
 db.run("INSERT INTO settings(key,value) VALUES('plans',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify({free:{features:['Funções essenciais por 30 dias']},standard:{monthly:3490,features:['Velho']},pro:{features:['Item do dono do Pro']}}));
 db.run("DELETE FROM settings WHERE key='plans_features_v10'");db.close();
 P=await make();
 assert.equal(P.free.features[2],'PCs e Consoles limitados');assert.ok(P.standard.features.includes('Produtos/Serviços ilimitados'));assert.equal(P.standard.monthly,3490,'preço mantido');
 assert.deepEqual(P.pro.features,proBefore,'2.26: Pro também na lista nova');
 // editado depois da migração: não troca de novo
 db=open(dir);const saved=JSON.parse(db.get("SELECT value FROM settings WHERE key='plans'").value);saved.free.features=['Do dono'];db.run("UPDATE settings SET value=? WHERE key='plans'",JSON.stringify(saved));db.close();
 P=await make();assert.deepEqual(P.free.features,['Do dono']);assert.ok(proBefore.length);
 // textos do site sem o teste de 30 dias
 const pub=f=>fs.readFileSync(path.join(__dirname,'../public',f),'utf8');
 for(const f of ['index.html','carrinho.html','conta.html','termos.html','site.js','conta.js','entrar.js'])assert.ok(!/30 dias/.test(pub(f)),f+' ainda fala em 30 dias');
 // 2.29: o site não fala mais em teste grátis/30 dias em nenhuma página (só o plano Free para sempre)
 for(const f of fs.readdirSync(path.join(__dirname,'../public')).filter(f=>/\.(html|js)$/.test(f)&&!/^i18n-|^admin/.test(f)))assert.ok(!/30 dias|teste grátis|Testar grátis|começar o teste|teste termina/i.test(pub(f)),f+' ainda fala em teste');
 assert.ok(!/(grátis|teste)[^.'\\]{0,40}30 dias|teste grátis/i.test(fs.readFileSync(path.join(__dirname,'../bot/perguntas.js'),'utf8').replace(/alt: \[[^\]]*\]/g,'').replace(/kw: \[[^\]]*\]/g,'')),'assistente sem teste de 30 dias');
 // 2.26: textos retirados a pedido do dono
 for(const f of fs.readdirSync(path.join(__dirname,'../public')).filter(f=>f.endsWith('.html')))for(const t of ['Gestão profissional.','Assinatura mensal ou anual no cartão.','Explore as telas reais do GameZoney.'])assert.ok(!pub(f).includes(t),f+': '+t);
});
