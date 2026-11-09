'use strict';
// Busca do GameZoney Servidor na rede da arena (porta UDP 3444). Quem responde só informa endereço e identidade:
// a confiança continua sendo a impressão digital do certificado, conferida antes de qualquer senha/chave.
// 1.0.19: além do broadcast (que NÃO atravessa roteadores), consulta por unicast (atravessa roteadores, switches
// gerenciados, pontos de Wi-Fi e sub-redes da mesma rede da arena):
//  - target: um IP digitado na tela de configuração;
//  - known: o último endereço do servidor -> a faixa /24 inteira dele (o servidor ganhou outro IP pelo DHCP);
//  - wide: faixas vizinhas das placas deste PC e as faixas mais comuns de roteadores (só quando a busca normal falha).
const dgram=require('node:dgram'),crypto=require('node:crypto'),os=require('node:os'),net=require('node:net');
const ip4=s=>String(s||'').trim().replace(/^https?:\/\//i,'').replace(/[:/].*$/,'');
const isPrivate=a=>{const p=a.split('.').map(Number);return p[0]===10||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||(p[0]===169&&p[1]===254);};
function localNets(){const out=[];for(const list of Object.values(os.networkInterfaces()))for(const n of list||[]){if(n.family!=='IPv4'&&n.family!==4||n.internal)continue;out.push(n);}return out;}
function prefixesFor({known,wide}){
 const set=new Set(),add=(a,b,c)=>{if(a>=0&&a<=255&&b>=0&&b<=255&&c>=0&&c<=255)set.add(a+'.'+b+'.'+c)};
 const k=ip4(known);if(net.isIPv4(k)&&isPrivate(k)){const p=k.split('.').map(Number);add(p[0],p[1],p[2]);}
 if(wide){
  for(const n of localNets()){if(!isPrivate(n.address))continue;const p=n.address.split('.').map(Number);for(let c=Math.max(0,p[2]-4);c<=Math.min(255,p[2]+4);c++)add(p[0],p[1],c);if(p[0]===192)for(let c=0;c<=15;c++)add(192,168,c);if(p[0]===10)for(let c=0;c<=10;c++)add(10,p[1],c);}
  for(let c=0;c<=15;c++)add(192,168,c);for(let c=0;c<=10;c++)add(10,0,c);for(let c=0;c<=3;c++)add(172,16,c);
 }
 return [...set].slice(0,64);
}
module.exports=function discover({port=3444,target,known,wide}={}){return new Promise((resolve,reject)=>{
 const socket=dgram.createSocket('udp4'),found=new Map(),nonce=crypto.randomBytes(16).toString('hex');let timer,repeat,finished=false;
 const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);clearInterval(repeat);try{socket.close()}catch{}if(error)reject(error);else resolve({servers:[...found.values()]})};
 socket.on('error',finish);socket.on('message',(bytes,remote)=>{if(bytes.length>2048)return;try{const r=JSON.parse(bytes);if(r.app!=='gamezoney-server'||r.version!==1||r.nonce!==nonce||!Number.isInteger(r.port)||r.port<1||r.port>65535||!/^[A-Fa-f0-9]{64}$/.test(r.fingerprint)||!net.isIPv4(remote.address))return;const server='https://'+remote.address+':'+r.port;found.set(server,{server,fingerprint:r.fingerprint.toUpperCase(),name:String(r.name||'GameZoney').slice(0,80)})}catch{}});
 const typed=ip4(target);if(target!==undefined&&target!==null&&String(target).trim()!==''&&!net.isIPv4(typed))return finish(new Error('Digite o IP do servidor (ex.: 192.168.0.10).'));
 socket.bind(0,'0.0.0.0',()=>{socket.setBroadcast(true);
  const addresses=new Set(net.isIPv4(typed)?[typed]:['255.255.255.255']);
  if(!net.isIPv4(typed))for(const n of localNets()){const ip=n.address.split('.').map(Number),mask=n.netmask.split('.').map(Number);addresses.add(ip.map((v,i)=>v|(255^mask[i])).join('.'))}
  const bytes=Buffer.from(JSON.stringify({app:'gamezoney-discover',version:1,nonce,padding:' '.repeat(128)}));
  const send=()=>{for(const address of addresses)socket.send(bytes,port,address,()=>{})};send();repeat=setInterval(send,700);
  // unicast em lotes pequenos (não inunda a rede): ~254 por faixa, 64 faixas no máximo
  const sweep=net.isIPv4(typed)?[]:prefixesFor({known,wide});let i=0;const hosts=sweep.length*254;
  const batch=()=>{if(finished)return;for(let n=0;n<400&&i<hosts;n++,i++){const prefix=sweep[Math.floor(i/254)],host=prefix+'.'+(i%254+1);if(!addresses.has(host))socket.send(bytes,port,host,()=>{});}if(i<hosts)setTimeout(batch,15);};
  if(sweep.length)batch();
  timer=setTimeout(()=>finish(),sweep.length?Math.min(6000,2600+sweep.length*60):2600);
 });
})};
module.exports.prefixesFor=prefixesFor;
