'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('../server');
class FakeTV { async hdmi() {} async openClientPage() {} disconnect() {} }
// 3.0.69: o cliente usa só o app nativo GameZoney 2.0. A página do app no navegador (e os apps antigos 1.0.x, que abrem essa
// página) fica desligada por padrão; a API do app nativo e o app SV continuam. A recepção pode religar em Configurações → Apps.
test('3.0.69: app do cliente pelo navegador desligado por padrão; API do app nativo e app SV continuam; pode religar',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pa-web-client-'));
 const server=createServer({directory:dir,noTimer:true,Vidaa:FakeTV});/* GameZoney 1.0.1: API dos apps desligada por padrão; os testes dela ligam aqui */server.store.state.settings.mobile={...server.store.state.settings.mobile,enabled:true};
 t.after(async()=>{await server.close();fs.rmSync(dir,{recursive:true,force:true});});
 await new Promise(r=>server.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.server.address().port;
 for(const p of ['/mobile','/mobile/client','/mobile/client.js','/mobile/client.css','/mobile/app-shell.js','/mobile/install-hint.js','/mobile/manifest.webmanifest']){
  const r=await fetch(base+p);assert.equal(r.status,410,p);
  const html=await r.text();assert.match(html,/acesso pelo navegador foi desativado/,p);assert.doesNotMatch(html,/<script/,p);
 }
 const auth=await fetch(base+'/mobile/api/auth');assert.equal(auth.status,200,'API do app nativo continua');
 assert.ok((await auth.json()).csrfToken);
 assert.equal((await fetch(base+'/mobile/admin')).status,410,'3.0.70: app SV retirado');
 // religar pela configuração
 const saved=require('../mobile')(server.store,{isAdmin:()=>false,connected:()=>false}).configure({enabled:true,lanClient:true,webClient:true,publicUrl:''},'admin');
 assert.equal(saved.webClient,true);
 assert.equal((await fetch(base+'/mobile/client')).status,200,'religado: a página volta');
 assert.match(await (await fetch(base+'/mobile/client.js')).text(),/mobile\/api/);
 // salvar sem a opção (painel antigo) desliga de novo
 require('../mobile')(server.store,{}).configure({enabled:true,lanClient:true,publicUrl:''},'admin');
 assert.equal((await fetch(base+'/mobile/client')).status,410);
});
