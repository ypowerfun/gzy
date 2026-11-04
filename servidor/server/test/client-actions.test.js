'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
// 2.0.37: toda ação que o cliente envia ao servidor precisa estar liberada no transport.js do cliente
// (antes "remote-admin" faltava e a liberação do modo administrador pela recepção falhava com "Configuração inválida.").
test('2.0.37: transport.js do cliente libera todas as ações usadas pelo cliente e existentes no servidor',t=>{
 const dir=['prime-arena-client','GameZoneyCliente_MOD','../cliente/windows-client-1.0.5'].map(d=>path.resolve(__dirname,'..','..',d)).find(d=>fs.existsSync(path.join(d,'transport.js'))&&fs.existsSync(path.join(d,'Client.cs')));
 if(!dir){t.skip('pasta do cliente não encontrada');return;}
 const transport=fs.readFileSync(path.join(dir,'transport.js'),'utf8'),list=JSON.parse(transport.match(/\[('state'[^\]]*)\]/)[0].replace(/'/g,'"'));
 const cs=fs.readdirSync(dir).filter(f=>f.endsWith('.cs')).map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
 const used=new Set([...cs.matchAll(/Post\("([a-z-]+)"/g)].map(m=>m[1]));for(const m of cs.matchAll(/"(admin-logout|finish)"/g))used.add(m[1]);used.delete('discover');
 const server=fs.readFileSync(path.join(__dirname,'..','pc.js'),'utf8'),routes=new Set([...server.matchAll(/(?:operation|router\.post)\('\/([a-z-]+)'/g)].map(m=>m[1]));
 for(const action of used){assert(list.includes(action),'transport.js não libera: '+action);if(action!=='setup')assert(routes.has(action),'servidor sem a rota: '+action);}
});
