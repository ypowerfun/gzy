'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {createServer}=require('../server');
test('3.0.33: importar clientes (com pontos) é exclusivo do administrador principal',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'prime-import-owner-')),app=createServer({directory,noTimer:true});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await app.close();fs.rmSync(directory,{recursive:true,force:true})});
 const session=()=>{let cookie='';return async(url,body)=>{const r=await fetch('http://127.0.0.1:'+app.server.address().port+'/api'+url,{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,data:await r.json()}}};
 const dono=session(),ger=session();
 await dono('/setup',{username:'dono',password:'Senha-dono-123'});await dono('/login',{username:'dono',password:'Senha-dono-123'});
 assert.equal((await dono('/operators',{username:'gerente',password:'Senha-ger-123',role:'admin'})).status,200);
 assert.equal((await ger('/login',{username:'gerente',password:'Senha-ger-123'})).status,200);
 assert.equal((await dono('/state')).data.isOwner,true);assert.equal((await ger('/state')).data.isOwner,false);
 const file={fileName:'c.csv',data:Buffer.from('Nome;Nick;Tempo;Pontos fidelidade\nAna;ana_x;60;150\n','utf8').toString('base64')};
 let r=await ger('/members/import/preview',file);assert.notEqual(r.status,200);assert.match(r.data.error,/administrador principal/);
 r=await dono('/members/import/preview',file);assert.equal(r.status,200);assert.equal(r.data.rows[0].pointsMilli,150000);
 assert.notEqual((await ger('/members/import',{rows:r.data.rows})).status,200);
 const done=await dono('/members/import',{rows:r.data.rows});assert.equal(done.status,200);assert.equal(done.data.pointsMilli,150000);
 assert.equal(app.store.state.members.find(m=>m.username==='ana_x').pointsMilli,150000);
});
