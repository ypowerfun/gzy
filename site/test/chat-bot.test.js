'use strict';
// 2.14: assistente do chat "Fale conosco" — banco próprio (sem IA), especialista online/offline, encerrar e avaliar, /admin › Assistente
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createApp}=require('../server');

async function boot(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-site-bot-'));const {privateKey}=crypto.generateKeyPairSync('ed25519');const mails=[];
 const app=createApp({env:{SITE_URL:'http://site.test',COOKIE_SECURE:'0',DATA_DIR:dir,DOWNLOADS_DIR:path.join(dir,'dl'),ADMIN_EMAILS:'dono@gamezoney.com',ADMIN_MFA:'0',LICENSE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),MP_ACCESS_TOKEN:'',GOOGLE_CLIENT_ID:'',SMTP_HOST:''},mail:{enabled:true,send:async(to,subject,text)=>{mails.push({to,subject,text});return true}},log:{log(){},error(){}}});
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});const base='http://127.0.0.1:'+server.address().port;
 t.after(()=>{server.close();app.locals.close();fs.rmSync(dir,{recursive:true,force:true,maxRetries:5})});
 const client=()=>{const jar={};return async(url,body,status=200)=>{const cookie=Object.entries(jar).map(([k,v])=>k+'='+v).join('; ');
  const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'http://site.test',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  for(const c of r.headers.getSetCookie?.()||[]){const [kv]=c.split(';');const i=kv.indexOf('=');const k=kv.slice(0,i),v=kv.slice(i+1);if(v)jar[k]=v;else delete jar[k]}
  const text=await r.text();assert.equal(r.status,status,url+' '+text);try{return JSON.parse(text)}catch{return {text}}}};
 const dono=client();await dono('/api/auth/register',{name:'Dono',email:'dono@gamezoney.com',password:'senha-do-dono'});
 const m=[...mails].reverse().find(x=>/verify\?t=/.test(x.text));await fetch(base+'/api/auth/verify?t='+m.text.match(/verify\?t=([a-f0-9]+)/)[1],{redirect:'manual'});
 return {client,mails,dono};
}

test('assistente: responde pelo banco próprio (planos, fiscal, concorrentes, instalação) sem IA',async t=>{
 const s=await boot(t);const v=s.client();
 let r=await v('/api/chat/start',{name:'Ana Paula',email:'ana@arena.com',message:'[Compra] Quanto custa o plano Pro?',lang:'pt'});
 assert.match(r.messages[1].text,/^Olá, Ana! Sou o assistente virtual da GameZoney\./);assert.match(r.messages[1].text,/Pro: R\$ 129,90\/mês/);
 for(const [q,re] of [['Vocês emitem nota fiscal?',/NFC-e.*Focus NFe/s],['Uso o NexCafé, consigo trazer meus clientes?',/Importar planilha/],['qual a diferença para o HandyCafé?',/Não comentamos outros sistemas/],
  ['como faço para instalar?',/marque Servidor/],['tem limite de PCs?',/ilimitados/],['obrigado!',/Por nada/],['how much does it cost?',/R\$ 29,90/]]){
  r=await v('/api/chat/send',{text:q});assert.equal(r.messages.at(-1).sender,'bot',q);assert.match(r.messages.at(-1).text,re,q);}
 assert.equal(r.chat.handoff,false);assert.equal(s.mails.filter(m=>/chat|especialista/.test(m.subject)).length,0);
 // o banco tem respostas usadas
 const b=await s.dono('/api/admin/bot');assert.ok(b.answers.length>=60);assert.ok(b.answers.find(a=>a.id==='precos').uses>=1);
});

test('assistente: especialista online assume (assistente para); offline = devolutiva por e-mail; sem resposta vira pergunta pendente',async t=>{
 const s=await boot(t);const v=s.client(),w=s.client();
 // offline + pergunta sem resposta
 let r=await v('/api/chat/start',{name:'Rui',email:'rui@lan.com',message:'Qual é a capital da Mongólia?'});
 assert.match(r.messages.at(-1).text,/Não encontrei essa resposta.*não temos um especialista online.*rui@lan\.com/s);assert.equal(r.chat.handoff,true);assert.equal(r.chat.bot,true,'offline: o assistente continua ajudando');
 assert.equal(s.mails.filter(m=>/especialista/.test(m.subject)).length,1);
 r=await v('/api/chat/send',{text:'Tem teste grátis?'});assert.match(r.messages.at(-1).text,/30 dias grátis/);
 r=await v('/api/chat/send',{text:'atendente'});assert.match(r.messages.at(-1).text,/não temos um especialista online/);
 assert.equal(s.mails.filter(m=>/especialista/.test(m.subject)).length,1,'no máximo 1 e-mail a cada 30 min por conversa');
 let b=await s.dono('/api/admin/bot');assert.deepEqual(b.misses.map(m=>m.text),['Qual é a capital da Mongólia?']);
 // admin cadastra a resposta a partir da pergunta pendente: o assistente passa a responder
 await s.dono('/api/admin/bot/answer',{question:'Qual é a capital da Mongólia?',alt:'capital mongolia',keywords:'mongolia, capital',answer:'Ulan Bator.',missId:b.misses[0].id});
 b=await s.dono('/api/admin/bot');assert.equal(b.misses.length,0);assert.match((await s.dono('/api/admin/bot/test',{text:'capital da mongólia'})).text,/Ulan Bator/);
 // online (/admin aberto): pedir especialista pausa o assistente
 await s.dono('/api/admin/chats');
 r=await w('/api/chat/start',{name:'Bia',email:'bia@lan.com',message:'falar com especialista'});
 assert.match(r.messages.at(-1).text,/Já chamei um especialista/);assert.equal(r.chat.bot,false);
 r=await w('/api/chat/send',{text:'Quanto custa?'});assert.equal(r.messages.at(-1).sender,'user','assistente parado: o atendente responde');
 const a=await s.dono('/api/admin/chats');const bia=a.chats.find(c=>c.name==='Bia');assert.equal(bia.handoff,true);assert.ok(bia.unread>=1);
 // o atendente responde a outro cliente: o assistente para naquela conversa
 const rui=a.chats.find(c=>c.name==='Rui');await s.dono('/api/admin/chats/'+rui.id,{text:'Oi Rui, sou o especialista.'});
 r=await v('/api/chat/send',{text:'Tem teste grátis?'});assert.equal(r.messages.at(-1).sender,'user');
 // e pode devolver ao assistente
 await s.dono('/api/admin/chats/'+rui.id,{bot:true});r=await v('/api/chat/send',{text:'Tem teste grátis?'});assert.equal(r.messages.at(-1).sender,'bot');
 assert.ok(!s.mails.some(m=>m.to==='dono@gamezoney.com'&&/Bia/.test(m.text)),'online: sem e-mail');
});

test('assistente: cliente encerra e avalia a conversa; admin vê a nota e a média',async t=>{
 const s=await boot(t);const v=s.client();
 await v('/api/chat/rate',{stars:5},404);
 await v('/api/chat/start',{name:'Caio',email:'caio@lan.com',message:'Tem teste grátis?'});
 await v('/api/chat/rate',{stars:9},400);
 let r=await v('/api/chat/rate',{stars:4,comment:'Respondeu rápido'});assert.equal(r.chat.status,'closed');assert.equal(r.chat.closedBy,'user');assert.equal(r.chat.rated,true);
 await v('/api/chat/rate',{stars:5},409);
 assert.match((await v('/api/chat/send',{text:'oi'},409)).error,/Abra uma nova conversa/);
 const a=await s.dono('/api/admin/chats');assert.equal(a.chats[0].rating,4);assert.equal(a.chats[0].ratingComment,'Respondeu rápido');assert.deepEqual(a.ratings,{count:1,average:4});
 // encerrar sem avaliar (stars 0)
 await v('/api/chat/end',{});await v('/api/chat/start',{name:'Caio',email:'caio@lan.com',message:'oi'});r=await v('/api/chat/rate',{stars:0});assert.equal(r.chat.status,'closed');
 assert.equal((await s.dono('/api/admin/chats')).ratings.count,1);
 // conversa encerrada pelo atendente ainda pode ser avaliada
 await v('/api/chat/end',{});await v('/api/chat/start',{name:'Caio',email:'caio@lan.com',message:'oi'});
 const id=(await s.dono('/api/admin/chats')).chats.find(c=>c.status==='open').id;await s.dono('/api/admin/chats/'+id,{status:'closed'});
 r=await v('/api/chat');assert.equal(r.chat.closedBy,'admin');assert.equal(r.chat.rated,false);r=await v('/api/chat/rate',{stars:5});assert.equal(r.chat.closedBy,'admin');
});

test('assistente: /admin › Assistente — editar, esconder e restaurar respostas da base; só administrador',async t=>{
 const s=await boot(t);const v=s.client();
 await v('/api/admin/bot',undefined,401);
 const b=await s.dono('/api/admin/bot');const precos=b.answers.find(a=>a.id==='precos');assert.equal(precos.source,'base');
 await s.dono('/api/admin/bot/answer',{id:'precos',question:precos.question,alt:precos.alt,keywords:precos.keywords,answer:'Preço especial: fale conosco.'});
 assert.match((await s.dono('/api/admin/bot/test',{text:'quanto custa?'})).text,/Preço especial/);
 await s.dono('/api/admin/bot/answer/precos/remove',{});assert.ok(!(await s.dono('/api/admin/bot')).answers.some(a=>a.id==='precos'));
 await s.dono('/api/admin/bot/restore',{id:'precos'});assert.match((await s.dono('/api/admin/bot/test',{text:'quanto custa?'})).text,/R\$ 29,90/);
 await s.dono('/api/admin/bot/answer',{question:'x',answer:'resposta'},400);
});

test('assistente: banco base sem ids repetidos e guia igual ao GUIA-GAMEZONEY.md do servidor',()=>{
 const base=require('../bot/perguntas');assert.equal(new Set(base.map(b=>b.id)).size,base.length);
 for(const b of base){assert.ok(b.q&&b.a,b.id);assert.doesNotMatch(b.a,/token|senha do admin[^i]|license-private/i,b.id)}
 const repo=path.join(__dirname,'../../servidor/server/GUIA-GAMEZONEY.md');
 if(fs.existsSync(repo))assert.equal(fs.readFileSync(path.join(__dirname,'../bot/guia.md'),'utf8'),fs.readFileSync(repo,'utf8'),'copie o GUIA-GAMEZONEY.md para site/bot/guia.md');
 const {wantsHuman}=require('../bot');for(const x of ['falar com agente','falar com especialista','especialista','atendente','quero falar com um humano','talk to an agent','hablar con un asesor'])assert.ok(wantsHuman(x),x);
 for(const x of ['quanto custa','o agente de rede','tem teste'])assert.ok(!wantsHuman(x),x);
});

test('assistente: sem resposta do cliente em 5 min (sem especialista) a conversa é encerrada; com especialista não',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-site-idle-'));const {privateKey}=crypto.generateKeyPairSync('ed25519');
 const app=createApp({chatIdleMs:300,env:{SITE_URL:'http://site.test',COOKIE_SECURE:'0',DATA_DIR:dir,DOWNLOADS_DIR:path.join(dir,'dl'),ADMIN_EMAILS:'dono@gamezoney.com',ADMIN_MFA:'0',LICENSE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),MP_ACCESS_TOKEN:'',GOOGLE_CLIENT_ID:'',SMTP_HOST:''},mail:{enabled:true,send:async()=>true},log:{log(){},error(){}}});
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});const base='http://127.0.0.1:'+server.address().port;
 t.after(()=>{server.close();app.locals.close();fs.rmSync(dir,{recursive:true,force:true,maxRetries:5})});
 const client=()=>{const jar={};return async(url,body,status=200)=>{const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'http://site.test',Cookie:Object.entries(jar).map(([k,v])=>k+'='+v).join('; ')},body:body===undefined?undefined:JSON.stringify(body)});
  for(const c of r.headers.getSetCookie?.()||[]){const [kv]=c.split(';');const i=kv.indexOf('=');if(kv.slice(i+1))jar[kv.slice(0,i)]=kv.slice(i+1);else delete jar[kv.slice(0,i)]}const x=await r.json();assert.equal(r.status,status,url+' '+JSON.stringify(x));return x}};
 const a=client(),b=client();
 await a('/api/chat/start',{name:'Ana',email:'ana@x.com',message:'Tem teste grátis?'});
 await b('/api/chat/start',{name:'Bia',email:'bia@x.com',message:'especialista'});
 await a('/api/chat/send',{text:'Quanto custa?'});
 await new Promise(r=>setTimeout(r,450));
 let r=await a('/api/chat');assert.equal(r.chat.status,'closed');assert.equal(r.chat.closedBy,'timeout');assert.match(r.messages.at(-1).text,/não recebemos resposta em 5 minutos/);
 assert.match((await a('/api/chat/send',{text:'oi'},409)).error,/falta de resposta/);
 r=await b('/api/chat');assert.equal(r.chat.status,'open','pediu especialista: não encerra sozinho');
 await a('/api/chat/end',{});r=await a('/api/chat/start',{name:'Ana',email:'ana@x.com',message:'oi'});assert.equal(r.chat.status,'open');
});
