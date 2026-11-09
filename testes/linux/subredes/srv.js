const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');const {createServer}=require(''+require('path').resolve(__dirname,'../../..')+'/servidor/server/server');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gznet-'));const app=createServer({directory:dir,noTimer:true});
await new Promise(r=>app.server.listen(3000,'0.0.0.0',r));const port=await app.startPC(3443);await app.discovery.start(3444);
console.log('servidor pronto em 192.168.0.10: PCs 3443, busca 3444');
// recepção aprova sozinha o 1º pedido (simula o clique em Autorizar no painel)
const t=setInterval(()=>{for(const p of app.discovery.list()){const r=app.discovery.approve(p.device,'','PC da sub-rede 1','admin');console.log('APROVADO no painel:',p.name,'vindo de',p.ip,'→',r.stationName||'ok');}},300);
setTimeout(()=>{clearInterval(t);app.close().then(()=>process.exit(0))},Number(process.argv[2]||40000));})();
