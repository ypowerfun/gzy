'use strict';
const {id,fail}=require('./store');
module.exports=store=>{
 const devices=new Map();
 const get=stationId=>{if(!devices.has(stationId))devices.set(stationId,{run:'',session:'',at:0,processes:[],commands:[],watchUntil:0,frame:null,locked:false,admin:false});return devices.get(stationId)};
 function pending(d,admin){
  return d.commands.filter(c=>!c.noRetry&&!c.result&&c.expires>Date.now()&&(!admin||['restart','shutdown'].includes(c.type))).map(c=>{c.sent=true;return c});
 }
 function receive(station,body,admin){
  const d=get(station.id),session=store.activeForStation(station.id)?.id||'';
  if(d.run!==body.clientRunId||d.session!==session||d.admin!==!!admin){
   // Comandos de energia já enviados sobrevivem a troca de sessão/admin para que
   // o PC possa desligar/reiniciar mesmo depois de entrar em modo administrador.
   d.commands=d.commands.filter(c=>c.sent&&['restart','shutdown'].includes(c.type)&&c.expires>Date.now());
   for(const c of d.commands)c.noRetry=false;
   d.frame=null;d.watchUntil=0;d.locked=false;d.processes=[];
  }
  d.run=String(body.clientRunId||'');d.session=session;d.admin=!!admin;d.at=Date.now();d.supported=body.remoteVersion===1;d.canTerminate=body.canTerminate===true;
  if(body.remoteSessionId===session&&session&&!admin&&Array.isArray(body.processes))d.processes=body.processes.slice(0,100).filter(p=>Number.isSafeInteger(p.pid)&&p.pid>0&&/^\d{10,20}$/.test(String(p.started))&&typeof p.name==='string').map(p=>({pid:p.pid,started:String(p.started),name:p.name.slice(0,160),status:['running','not-responding'].includes(p.status)?p.status:'unknown'}));
  if(Array.isArray(body.remoteResults))for(const r of body.remoteResults.slice(0,10)){const c=d.commands.find(c=>c.id===r.id&&!c.result);if(c){c.result=String(r.result||'Concluído').slice(0,300);store.log('cliente:'+station.name,'controle-remoto',c.type+': '+c.result);}}
  if(d.watchUntil>Date.now()&&session&&!admin&&body.remoteSessionId===session&&typeof body.screen==='string'&&body.screen.length<1500000&&/^[A-Za-z0-9+/]+=*$/.test(body.screen)){const bytes=Buffer.from(body.screen,'base64');if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)d.frame={image:body.screen,at:Date.now()};}
  if(d.watchUntil<=Date.now())d.frame=null;
  d.commands=d.commands.filter(c=>c.expires>Date.now()||c.result).slice(-30);
  return {locked:d.locked,watch:!admin&&!!session&&d.watchUntil>Date.now(),commands:pending(d,admin)};
 }
 function ready(stationId,{allowAdmin=false}={}){const s=store.station(stationId),d=get(stationId);if(s.kind!=='computer'||s.removedAt||Date.now()-d.at>15000||!d.supported||(!allowAdmin&&d.admin))fail('Conecte este PC com o Cliente 2.0 ou posterior.');return [s,d];}
 function command(input,actor){
  const power=['restart','shutdown'].includes(input.type),[s,d]=ready(input.stationId,{allowAdmin:power});
  if(!['lock','unlock','close','terminate','restart','shutdown','watch','unwatch','admin'].includes(input.type))fail('Comando inválido.');
  if(!['unwatch','restart','shutdown','admin'].includes(input.type)&&!store.activeForStation(s.id))fail('Inicie uma sessão de usuário neste PC.');
  if(input.type==='admin'&&d.admin)fail('Este computador já está em modo administrador.');
  if(input.type==='watch'){if(d.locked)fail('Desbloqueie o PC antes de visualizar.');d.watchUntil=Date.now()+15000;store.log(actor,'controle-remoto','Visualização de tela iniciada: '+s.name);return {ok:true};}
  if(input.type==='unwatch'){d.watchUntil=0;d.frame=null;store.log(actor,'controle-remoto','Visualização encerrada: '+s.name);return{ok:true};}
  if(input.type==='lock'||input.type==='unlock'){d.locked=input.type==='lock';d.frame=null;d.watchUntil=0;store.log(actor,'controle-remoto',(d.locked?'Bloqueio':'Desbloqueio')+': '+s.name);return{ok:true};}
  const c={id:id(),type:input.type,expires:Date.now()+30000,sessionId:d.session};
  if(c.type==='terminate'&&!d.canTerminate)fail('Atualize o GameZoney Cliente deste PC antes de finalizar tarefas.');
  if(c.type==='close'||c.type==='terminate'){if(d.session!==store.activeForStation(s.id)?.id)fail('A sessão mudou. Aguarde a atualização da lista.');const p=d.processes.find(p=>p.pid===input.pid&&p.started===input.started)||fail('Programa não pertence à lista atual da sessão.');c.pid=p.pid;c.started=p.started;c.name=p.name;}
  d.commands.push(c);store.log(actor,'controle-remoto',input.type+' solicitado em '+s.name+(c.name?' — '+c.name:''));return {ok:true,id:c.id};
 }
 function consumeAdmin(stationId,commandId){const d=get(stationId),c=d.commands.find(c=>c.id===String(commandId||'')&&c.type==='admin'&&!c.result&&c.expires>Date.now());if(!c)fail('Liberação administrativa expirou ou já foi utilizada.');const current=store.activeForStation(stationId)?.id||'';if(c.sessionId!==current)fail('A sessão mudou. Solicite a liberação novamente.');c.result='Modo administrador liberado.';return c;}
 function view(stationId,renew){const [s,d]=ready(stationId);if(d.session!==(store.activeForStation(stationId)?.id||'')){d.frame=null;d.watchUntil=0;d.processes=[];}if(renew&&d.watchUntil>Date.now()&&store.activeForStation(stationId)&&!d.locked)d.watchUntil=Date.now()+15000;return {canTerminate:d.canTerminate,processes:d.processes,locked:d.locked,watching:d.watchUntil>Date.now(),frame:d.watchUntil>Date.now()&&d.frame?.at>Date.now()-10000?d.frame:null,commands:d.commands.map(c=>({id:c.id,type:c.type,result:c.result||(c.expires<Date.now()?'Não confirmado; comando expirado.':'Aguardando cliente')}))};}
 return {receive,command,view,consumeAdmin,revoke:stationId=>devices.delete(stationId),device:stationId=>get(stationId)};
};
