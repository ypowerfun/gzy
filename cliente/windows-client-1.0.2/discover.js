'use strict';
const dgram=require('node:dgram'),crypto=require('node:crypto'),os=require('node:os'),net=require('node:net');
module.exports=function discover({port=3444,target}={}){return new Promise((resolve,reject)=>{
 const socket=dgram.createSocket('udp4'),found=new Map(),nonce=crypto.randomBytes(16).toString('hex');let timer,repeat,finished=false;
 const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);clearInterval(repeat);socket.close();if(error)reject(error);else resolve({servers:[...found.values()]})};
 socket.on('error',finish);socket.on('message',(bytes,remote)=>{if(bytes.length>2048)return;try{const r=JSON.parse(bytes);if(r.app!=='gamezoney-server'||r.version!==1||r.nonce!==nonce||!Number.isInteger(r.port)||r.port<1||r.port>65535||!/^[A-Fa-f0-9]{64}$/.test(r.fingerprint)||!net.isIPv4(remote.address))return;const server='https://'+remote.address+':'+r.port;found.set(server,{server,fingerprint:r.fingerprint.toUpperCase(),name:String(r.name||'GameZoney').slice(0,80)})}catch{}});
 socket.bind(0,'0.0.0.0',()=>{socket.setBroadcast(true);const addresses=new Set(target?[target]:['255.255.255.255']);
  if(!target)for(const interfaces of Object.values(os.networkInterfaces()))for(const n of interfaces){if(n.family!=='IPv4'||n.internal)continue;const ip=n.address.split('.').map(Number),mask=n.netmask.split('.').map(Number);addresses.add(ip.map((v,i)=>v|(255^mask[i])).join('.'))}
  const bytes=Buffer.from(JSON.stringify({app:'gamezoney-discover',version:1,nonce,padding:' '.repeat(128)}));
  const send=()=>{for(const address of addresses)socket.send(bytes,port,address,()=>{})};send();repeat=setInterval(send,700);timer=setTimeout(()=>finish(),2600);
 });
})};
