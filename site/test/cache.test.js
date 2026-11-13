'use strict';
// 2.18: Minha conta ficava em "Carregando sua conta…" — a página nova (sem o botão Excluir avaliação) rodava o conta.js
// ANTIGO guardado no navegador (mesmo ?v=), que dava erro antes de carregar a conta.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createApp}=require('../server');
const PUB=path.join(__dirname,'../public');
test('2.18: página HTML sempre conferida; .js/.css com ?v= guardados; sem ?v= conferidos',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-site-cache-'));const {privateKey}=crypto.generateKeyPairSync('ed25519');
 const app=createApp({env:{SITE_URL:'http://site.test',COOKIE_SECURE:'0',DATA_DIR:dir,DOWNLOADS_DIR:path.join(dir,'dl'),ADMIN_EMAILS:'',ADMIN_MFA:'0',LICENSE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),MP_ACCESS_TOKEN:'',GOOGLE_CLIENT_ID:'',SMTP_HOST:''},mail:{enabled:false,send:async()=>{}}});
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});const base='http://127.0.0.1:'+server.address().port;
 t.after(()=>{server.close();app.locals.close();fs.rmSync(dir,{recursive:true,force:true,maxRetries:5})});
 const cc=async u=>{const r=await fetch(base+u);assert.equal(r.status,200,u);await r.arrayBuffer();return r.headers.get('cache-control')};
 for(const u of ['/','/conta','/admin','/entrar.html','/carrinho.html','/atualizacoes.html','/en/','/app/arena-x'])assert.equal(await cc(u),'no-cache',u);
 assert.equal(await cc('/conta.js?v=1'),'public, max-age=86400');assert.equal(await cc('/site.css?v=1'),'public, max-age=86400');
 assert.equal(await cc('/conta.js'),'no-cache');
});
test('2.18: todo .js/.css das páginas tem ?v= e cada versão é a mesma em todas as páginas',()=>{
 const pages=[...fs.readdirSync(PUB).filter(f=>f.endsWith('.html')).map(f=>path.join(PUB,f)),path.join(PUB,'app/index.html'),path.join(__dirname,'../private/guia.html')];
 const ver={};
 for(const p of pages)for(const m of fs.readFileSync(p,'utf8').matchAll(/(?:src|href)="(\/[^"?]+\.(?:js|css))(\?v=[^"]+)?"/g)){
  assert.ok(m[2],`${path.basename(p)}: ${m[1]} sem ?v=`);
  if(ver[m[1]])assert.equal(m[2],ver[m[1]],`${m[1]} com versões diferentes`);ver[m[1]]=m[2];
 }
});
test('2.18: Minha conta — todo #id que o conta.js usa existe na página (ou é criado pelo próprio script) e erro mostra Tentar novamente',()=>{
 const html=fs.readFileSync(path.join(PUB,'conta.html'),'utf8'),js=fs.readFileSync(path.join(PUB,'conta.js'),'utf8');
 const ids=new Set([...js.matchAll(/\$\('#([\w-]+)'\)/g)].map(m=>m[1]));assert.ok(ids.size>20);
 for(const id of ids)assert.ok(html.includes(`id="${id}"`)||js.includes(`id="${id}"`),`#${id} não existe em conta.html`);
 assert.ok(!ids.has('license-list')&&!ids.has('review-remove'),'itens retirados na 2.17');
 assert.match(js,/load\(\)\.catch\(loadError\)/);assert.match(js,/Tentar novamente/);assert.ok(!/(?<![\w.])load\(\);/.test(js),'toda chamada de load() trata o erro');
});
