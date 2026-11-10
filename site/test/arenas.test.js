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
