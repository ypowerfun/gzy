const discover=require(''+require('path').resolve(__dirname,'../../..')+'/cliente/windows-client-1.0.5/discover.js');const {spawn}=require('child_process'),crypto=require('crypto');
const show=(t,r)=>console.log(t.padEnd(52),r.servers.length?r.servers.map(s=>s.server).join(', '):'(nada)');
const call=(settings,action,body)=>new Promise(res=>{const c=spawn(process.execPath,['transport.js'],{cwd:''+require('path').resolve(__dirname,'../../..')+'/cliente/windows-client-1.0.5'});let o='';c.stdout.on('data',d=>o+=d);c.on('close',()=>res(JSON.parse(o)));c.stdin.end(JSON.stringify({settings,action,body}))});
(async()=>{
 show('1) só broadcast (como antes):',await discover({}));
 show('2) faixa do endereço anterior (known):',await discover({known:'https://192.168.0.10:3443'}));
 let t=Date.now();const w=await discover({wide:true});show('3) busca ampla (wide) em '+(Date.now()-t)+' ms:',w);
 show('4) IP digitado (target):',await discover({target:'192.168.0.10'}));
 // configuração do PC pela outra sub-rede: pedido → recepção aprova → token → consulta de estado
 const found=w.servers[0];const device=crypto.randomBytes(16).toString('hex'),secret=crypto.randomBytes(32).toString('hex');
 const base={server:found.server,fingerprint:found.fingerprint,token:'0'.repeat(64),device};
 let r;for(let i=0;i<20;i++){r=await call(base,'setup',{device,secret,name:'PC-SUBREDE-1'});if(r.ok&&r.data.status==='approved')break;await new Promise(z=>setTimeout(z,400));}
 console.log('5) pedido de autorização pela sub-rede 1:',r.ok?r.data.status+' ('+r.data.stationName+')':r.error);
 const st=await call({...base,token:r.data.token},'state',{clientRunId:'a'.repeat(32)});console.log('6) consulta de estado HTTPS atravessando o roteador:',st.ok?'OK — '+st.data.stationName:st.error);
})();
