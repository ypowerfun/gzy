'use strict';
const dgram=require('node:dgram'),crypto=require('node:crypto'),os=require('node:os'),express=require('express');
const {id,fail}=require('./store');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
module.exports=function discovery(store,pc,identity){
 const pending=new Map(),router=express.Router();let socket;
 const clean=()=>{for(const [key,p] of pending)if(p.until<Date.now())pending.delete(key)};
 router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(!req.socket.encrypted)return res.status(403).json({error:'Use HTTPS para configurar o cliente.'});next()});
 router.post('/request',(req,res,next)=>{try{
  clean();const {device,secret}=req.body;const name=String(req.body.name||'').trim();
  if(!/^[a-f0-9]{32}$/.test(device)||!/^[a-f0-9]{64}$/.test(secret)||!name||name.length>60)fail('Pedido de configuração inválido.');
  let p=pending.get(device);if(p&&p.secretHash!==hash(secret))fail('Há outro pedido para este computador. Reinicie a configuração.');
  if(!p){if(pending.size>=64)fail('Muitos computadores aguardando. Tente novamente mais tarde.');p={device,name,ip:req.socket.remoteAddress.replace(/^::ffff:/,''),secretHash:hash(secret),code:hash('display:'+secret).slice(0,8).toUpperCase(),until:Date.now()+600000,status:'pending'};pending.set(device,p)}
  if(p.status==='approved'){
   const s=store.station(p.stationId);if(!s.active||s.pcTokenHash!==hash(p.token)||s.pcDevice!==device)fail('Autorização revogada. Inicie novamente.');
   return res.json({status:p.status,token:p.token,stationName:s.name,code:p.code});
  }
  res.json({status:p.status,code:p.code});
 }catch(e){next(e)}});
 router.use((e,req,res,next)=>res.status(400).json({error:e.message}));
 return {router,
  revokeStation(stationId,device){for(const p of pending.values())if(p.stationId===stationId||p.device===device){p.status='rejected';delete p.token}},
  list(){clean();return [...pending.values()].filter(p=>p.status==='pending').map(({device,name,ip,code,until})=>({device,name,ip,code,until}))},
  approve(device,stationId,name,actor){clean();const p=pending.get(device);if(!p||p.status!=='pending')fail('Pedido expirado ou já atendido.');
   let station=stationId?store.station(stationId):null;
   if(station&&(!station.active||station.kind!=='computer'||station.pcTokenHash||store.activeForStation(station.id)))fail('Escolha um computador livre ainda não autorizado, ou crie um novo.');
   const stationName=String(name||p.name).trim();if(!stationName||stationName.length>60)fail('Informe um nome de até 60 caracteres.');
   const token=crypto.randomBytes(32).toString('hex');
   store.change(actor,'computador','Computador autorizado pela rede: '+(station?.name||stationName),()=>{
    if(!station){station={id:id(),name:stationName,kind:'computer',ip:p.ip,active:true};store.state.stations.push(station)}
    station.pcTokenHash=hash(token);station.pcDevice=p.device;station.ip=p.ip;
   });
   p.token=token;p.stationId=station.id;p.status='approved';p.until=Date.now()+600000;
   return {ok:true,stationName:station.name,verification:identity().fingerprint.slice(0,12).toUpperCase()};
  },
  reject(device){clean();const p=pending.get(device);if(p?.status==='pending')p.status='rejected';return {ok:true}},
  start(port=3444){return new Promise((resolve,reject)=>{
   if(socket)return reject(Error('Descoberta já iniciada.'));socket=dgram.createSocket('udp4');let count=0,window=Date.now();
   socket.on('error',reject);socket.on('message',(bytes,remote)=>{if(bytes.length>1024)return;if(Date.now()-window>1000){count=0;window=Date.now()}if(++count>120)return;/* 1.2.5: vários PCs procurando ao mesmo tempo (servidor trocou de IP) */
    try{const query=JSON.parse(bytes);if(query.app!=='gamezoney-discover'||query.version!==1||!/^[a-f0-9]{32}$/.test(query.nonce))return;
     const info=identity();if(!info.fingerprint||!info.port)return;
     const response={app:'gamezoney-server',version:1,nonce:query.nonce,name:os.hostname(),...info};socket.send(Buffer.from(JSON.stringify(response)),remote.port,remote.address,()=>{});
    }catch{}
   });socket.bind(port,'0.0.0.0',()=>resolve(socket.address().port));
  })},
  running(){return !!socket},
  close(){if(socket){try{socket.close()}catch{}socket=null}pending.clear()}
 };
};
