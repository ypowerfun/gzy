'use strict';
// Trust is the pinned certificate fingerprint, checked during first setup or imported.
// No credentials are transmitted until the TLS peer matches that fingerprint.
const https=require('https');
// 1.0.16: o Cliente mantém UM processo aberto (--serve) em vez de abrir um node.exe a cada consulta (a cada 2 s):
// menos processador, memória e antivírus no PC; a conexão segura fica aberta e é reaproveitada (Keep-Alive).
// Sem --serve continua o modo antigo (uma consulta por processo), usado como reserva pelo Cliente.
function run(input,agent,retry=true){return new Promise(resolve=>{let finished=false;const done=value=>{if(finished)return;finished=true;resolve(value)};
 try{const {settings,action,body}=typeof input==='string'?JSON.parse(input):input;if(action==='discover'){require('./discover')(body).then(data=>done({ok:true,data}),e=>done({ok:false,error:e.message}));return;}const server=new URL(settings.server);if(server.protocol!=='https:'||!['state','login','finish','setup','admin-login','admin-check','admin-logout','maintenance','disconnect','wallpaper','register-password','change-password','remote-admin','loyalty-ack','heartbeat','signup','pix/options','pix/create','pix/status','pix/cancel'].includes(action))throw Error('Configuração inválida.');
 const bytes=JSON.stringify(body);const req=https.request(new URL(action==='setup'?'/pc-setup/request':'/pc/'+action,server),{method:'POST',agent:agent||false,rejectUnauthorized:false,minVersion:'TLSv1.2',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(bytes),Authorization:'Bearer '+settings.token,'X-GZ-Device':settings.device}},res=>{let output='';res.setEncoding('utf8');res.on('data',chunk=>{output+=chunk;if(output.length>3000000)req.destroy(Error('Resposta muito grande.'))});res.on('end',()=>{try{const data=JSON.parse(output);done(res.statusCode===200?{ok:true,data}:{ok:false,status:res.statusCode,error:data.error||'Solicitação recusada.'})}catch{done({ok:false,error:'Resposta inválida do servidor.'})}});});
 /* 1.0.16: conexão reaproveitada (modo --serve) já foi conferida; a identidade continua sendo conferida em toda conexão nova */
 req.on('socket',socket=>{const check=()=>{socket.gzChecked=true;const actual=(socket.getPeerCertificate().fingerprint256||'').replaceAll(':','');socket.gzFingerprint=actual.toUpperCase();if(!actual||socket.gzFingerprint!==settings.fingerprint.toUpperCase()){req.destroy(Error('Identidade do servidor diferente. Solicite nova associação à recepção.'));return;}req.end(bytes)};if(socket.gzChecked)check();else socket.once('secureConnect',check)});
 req.on('error',error=>{/* conexão guardada que o servidor fechou ao mesmo tempo: tenta de novo uma vez em conexão nova */if(retry&&req.reusedSocket&&error.code==='ECONNRESET'){finished=true;run(input,agent,false).then(resolve);return;}done({ok:false,error:error.message})});const stateRequest=action==='state'||action==='heartbeat',socketTimeout=stateRequest?3500:6000,hardTimeout=stateRequest?4500:7000;req.setTimeout(socketTimeout,()=>req.destroy(Error('Sem resposta do servidor.')));const deadline=setTimeout(()=>req.destroy(Error('Tempo de conexão esgotado.')),hardTimeout);req.on('close',()=>clearTimeout(deadline));
 }catch(error){done({ok:false,error:error.message})}
});}
if(process.argv[2]==='--serve'){
 const agents=new Map(),agentFor=settings=>{const key=String(settings&&settings.server)+'|'+String(settings&&settings.fingerprint);let a=agents.get(key);if(!a){if(agents.size>8)agents.clear();a=new https.Agent({keepAlive:true,keepAliveMsecs:1000,maxSockets:4,maxFreeSockets:2,timeout:4000,maxCachedSessions:0/* sem retomada de sessão TLS: toda conexão nova mostra o certificado e a identidade é conferida */});agents.set(key,a)}return a};
 let buffer='';process.stdin.setEncoding('utf8');
 process.stdin.on('data',chunk=>{buffer+=chunk;if(buffer.length>5000000)process.exit(1);let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(!line)continue;let msg;try{msg=JSON.parse(line)}catch{continue}const id=msg.id;
  (msg.action==='discover'?run(msg,null):run(msg,agentFor(msg.settings))).catch(e=>({ok:false,error:String(e&&e.message||e)})).then(v=>process.stdout.write(JSON.stringify({id,...v})+'\n'))}});
 process.stdin.on('end',()=>process.exit(0));process.stdin.on('error',()=>process.exit(0));
}else{
 let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{input+=chunk;if(input.length>2500000)process.exit(1)});
 process.stdin.on('end',()=>run(input,null).then(value=>process.stdout.write(JSON.stringify(value))));
}
