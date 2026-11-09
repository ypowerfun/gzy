'use strict';
// 1.0.16 (Cliente): transport.js --serve = UM processo node.exe aberto, conexão segura reaproveitada; identidade conferida em toda conexão nova
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto');
const {execFileSync,spawn}=require('node:child_process');const {createServer}=require('../server');
const client=['GameZoneyCliente_MOD','../cliente/windows-client-1.0.5'].map(d=>path.resolve(__dirname,'..','..',d)).find(d=>fs.existsSync(path.join(d,'transport.js')));
test('1.0.16: transporte do Cliente em processo único (--serve) e no modo antigo',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gz-tr-'));const pfx=path.join(directory,'server.pfx');execFileSync(path.join(__dirname,'..','CertTool.exe'),[pfx],{windowsHide:true});
 const app=createServer({directory,noTimer:true});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=await app.startPC(0,pfx);
 // proxy TCP só para contar quantas conexões novas o Cliente abre
 let connections=0;const proxy=net.createServer(c=>{connections++;const s=net.connect(port,'127.0.0.1');c.pipe(s).pipe(c);c.on('error',()=>s.destroy());s.on('error',()=>c.destroy())});await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
 app.store.state.stations.push({id:'pc1',kind:'computer',name:'PC 01',active:true});const token=app.pc.issue('pc1');
 const fingerprint=new crypto.X509Certificate(fs.readFileSync(pfx+'.cer')).fingerprint256.replace(/:/g,'');
 const settings={server:'https://127.0.0.1:'+proxy.address().port,fingerprint,token,device:'machine-000000000001'};
 const child=spawn(process.execPath,['transport.js','--serve'],{cwd:client,stdio:['pipe','pipe','pipe']});
 t.after(async()=>{child.kill();proxy.close();await app.close();fs.rmSync(directory,{recursive:true,force:true})});
 const waiting=new Map();let out='';child.stdout.setEncoding('utf8');child.stdout.on('data',d=>{out+=d;let i;while((i=out.indexOf('\n'))>=0){const m=JSON.parse(out.slice(0,i));out=out.slice(i+1);waiting.get(m.id)(m);waiting.delete(m.id)}});
 let n=0;const call=(action,body={},s=settings)=>new Promise(r=>{const id=++n;waiting.set(id,r);child.stdin.write(JSON.stringify({id,settings:s,action,body})+'\n')});
 const t0=Date.now();for(let i=0;i<20;i++){const r=await call('state',{clientRunId:'a'.repeat(32)});assert.equal(r.ok,true,r.error);assert.equal(r.data.stationName,'PC 01');}
 const both=await Promise.all([call('state'),call('heartbeat',{})]);assert.ok(both.every(r=>r.ok),JSON.stringify(both));
 assert.ok(connections<=2,'conexões abertas: '+connections+' (antes: uma por consulta)');console.log('# 22 consultas em',Date.now()-t0,'ms com',connections,'conexão(ões)');
 // ação não liberada e identidade errada continuam recusadas
 assert.match((await call('nao-existe')).error,/Configuração inválida/);
 const wrong=await call('state',{},{...settings,fingerprint:'0'.repeat(64)});assert.equal(wrong.ok,false,JSON.stringify(wrong));assert.match(wrong.error,/Identidade do servidor diferente/);
 // resposta de erro do servidor chega igual (status)
 const denied=await call('state',{},{...settings,token:'f'.repeat(64)});assert.equal(denied.ok,false);assert.equal(denied.status,401);
 // modo antigo (um processo por consulta) continua funcionando
 const once=await new Promise(r=>{const c=spawn(process.execPath,['transport.js'],{cwd:client});let o='';c.stdout.on('data',d=>o+=d);c.on('close',()=>r(o));c.stdin.end(JSON.stringify({settings,action:'state',body:{}}))});assert.equal(JSON.parse(once).ok,true,once);
 // fechar a entrada encerra o processo (Cliente fechado = node.exe some junto)
 child.stdin.end();const code=await new Promise(r=>child.once('exit',r));assert.equal(code,0);
});
