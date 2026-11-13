'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createApp}=require('../server');

async function boot(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gz-site-c-'));const {privateKey}=crypto.generateKeyPairSync('ed25519');const mails=[];
 const app=createApp({botDelayMs:0,env:{SITE_URL:'http://site.test',COOKIE_SECURE:'0',DATA_DIR:dir,DOWNLOADS_DIR:path.join(dir,'dl'),ADMIN_EMAILS:'dono@gamezoney.com', ADMIN_MFA:'0',LICENSE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),MP_ACCESS_TOKEN:'',GOOGLE_CLIENT_ID:'',SMTP_HOST:''},mail:{enabled:true,send:async(to,subject,text)=>{mails.push({to,subject,text});return true}},log:{log(){},error(){}}});
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});const base='http://127.0.0.1:'+server.address().port;
 t.after(()=>{server.close();app.locals.close();fs.rmSync(dir,{recursive:true,force:true})});
 const client=()=>{const jar={};return async(url,body,status=200)=>{const cookie=Object.entries(jar).map(([k,v])=>k+'='+v).join('; ');const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
  for(const c of r.headers.getSetCookie?.()||[]){const [kv]=c.split(';');const i=kv.indexOf('=');const k=kv.slice(0,i),v=kv.slice(i+1);if(v)jar[k]=v;else delete jar[k]}
  const text=await r.text();assert.equal(r.status,status,url+' '+text);try{return JSON.parse(text)}catch{return {text,type:r.headers.get('content-type')}}}};
 return {base,client,mails,dir};
}
const PNG='data:image/png;base64,'+Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.alloc(40,1)]).toString('base64');
const JPG='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.alloc(40,2)]).toString('base64');

async function confirm(s,email){const m=[...s.mails].reverse().find(x=>x.to===email&&/verify\?t=/.test(x.text));const t=m.text.match(/verify\?t=([a-f0-9]+)/)[1];const r=await fetch(s.base+'/api/auth/verify?t='+t,{redirect:'manual'});if(!/verificado=1/.test(r.headers.get('location')))throw new Error('confirmação falhou')}
test('site: avaliações — 1 a 5 estrelas, até 2 imagens .jpg/.png, organização e as 3 da página inicial escolhidas pelo administrador',async t=>{
 const s=await boot(t);const anon=s.client(),dono=s.client();
 await dono('/api/auth/register',{name:'Dono',email:'dono@gamezoney.com',password:'senha-do-dono'});await confirm(s,'dono@gamezoney.com');
 await anon('/api/reviews',{stars:5,text:'Muito bom mesmo'},401);
 const users=[];for(let i=1;i<=4;i++){const c=s.client();await c('/api/auth/register',{name:'Cliente '+i,email:`c${i}@arena.com`,password:'senha-forte-1'});users.push(c)}
 const [a,b,c,d]=users;
 await a('/api/profile',{name:'Ana Souza',phone:'',organization:'Arena Centro'});assert.equal((await a('/api/me')).user.organization,'Arena Centro');
 await a('/api/reviews',{stars:0,text:'Muito bom mesmo'},400);await a('/api/reviews',{stars:6,text:'Muito bom mesmo'},400);await a('/api/reviews',{stars:5,text:'curto'},400);
 await a('/api/reviews',{stars:5,text:'Muito bom mesmo',images:[PNG,JPG,PNG]},400);
 await a('/api/reviews',{stars:5,text:'Muito bom mesmo',images:['data:image/gif;base64,R0lGODlh']},400);
 await a('/api/reviews',{stars:5,text:'Muito bom mesmo',images:['data:image/png;base64,'+Buffer.from('não é png').toString('base64')]},400);
 const ra=(await a('/api/reviews',{stars:5,text:'Sistema excelente para a arena!',images:[PNG,JPG]})).review;
 assert.equal(ra.images.length,2);assert.equal(ra.organization,'Arena Centro');assert.equal(ra.createdAt,undefined,'sem data para o público');
 const img=await anon(ra.images[0]);assert.match(img.type,/image\/png/);
 assert.ok(s.mails.some(m=>m.to==='dono@gamezoney.com'&&/nova avaliação/.test(m.subject)));
 // editar: mantém 1 imagem e troca a outra; a removida é apagada do disco
 const ra2=(await a('/api/reviews',{stars:4,text:'Sistema excelente, recomendo!',keepImages:[ra.images[0]],images:[PNG]})).review;
 assert.equal(ra2.images.length,2);assert.equal(ra2.stars,4);assert.ok(!ra2.images.includes(ra.images[1]));
 assert.equal(fs.existsSync(path.join(s.dir,'media','reviews',path.basename(ra.images[1]))),false);
 // 2.4: enviou + editou 1 vez = fechada (nem editar de novo, nem excluir e avaliar outra vez)
 assert.equal((await a('/api/reviews/mine')).canWrite,false);
 await a('/api/reviews',{stars:4,text:'Sistema excelente, recomendo!',keepImages:ra2.images,images:[JPG]},403);
 await b('/api/reviews',{stars:5,text:'Controle de tempo perfeito.'});await c('/api/reviews',{stars:3,text:'Bom, mas pode melhorar.'});await d('/api/reviews',{stars:5,text:'A lanchonete ficou organizada.'});
 // nada na página inicial até o administrador escolher
 assert.equal((await anon('/api/reviews/featured')).reviews.length,0);
 await a('/api/admin/reviews/x',{featured:1},403);
 const all=(await dono('/api/admin/overview')).reviews;assert.equal(all.length,4);
 const id=n=>all.find(r=>r.email===`c${n}@arena.com`).id;
 await dono('/api/admin/reviews/'+id(4),{featured:1});await dono('/api/admin/reviews/'+id(1),{featured:2});await dono('/api/admin/reviews/'+id(2),{featured:3});
 await dono('/api/admin/reviews/'+id(3),{featured:4},400);
 let f=(await anon('/api/reviews/featured')).reviews;assert.deepEqual(f.map(r=>r.name),['Cliente 4','Ana Souza','Cliente 2']);
 assert.equal(f[1].organization,'Arena Centro');assert.equal(f[1].createdAt,undefined);assert.equal(f[1].email,undefined);
 // trocar a posição 1 tira a anterior; ocultar some da página inicial
 await dono('/api/admin/reviews/'+id(3),{featured:1});f=(await anon('/api/reviews/featured')).reviews;assert.deepEqual(f.map(r=>r.name),['Cliente 3','Ana Souza','Cliente 2']);
 await dono('/api/admin/reviews/'+id(2),{hidden:true});assert.equal((await anon('/api/reviews/featured')).reviews.length,2);
 // o cliente não exclui mais (pedido do dono); o administrador exclui e as imagens são apagadas
 await a('/api/reviews/remove',{},403);assert.ok((await a('/api/reviews/mine')).review);
 await dono('/api/admin/reviews/'+id(1),{remove:true});assert.equal((await a('/api/reviews/mine')).review,null);
 assert.equal(fs.readdirSync(path.join(s.dir,'media','reviews')).length,0);
 await dono('/api/admin/reviews/'+id(4),{remove:true});assert.equal((await dono('/api/admin/overview')).reviews.length,2);
});

test('site: chat ao vivo — visitante conversa com o administrador; online enquanto o /admin está aberto; aviso por e-mail',async t=>{
 const s=await boot(t);const vis=s.client(),dono=s.client(),outro=s.client();
 await dono('/api/auth/register',{name:'Dono',email:'dono@gamezoney.com',password:'senha-do-dono'});await confirm(s,'dono@gamezoney.com');
 let st=await vis('/api/chat');assert.equal(st.chat,null);assert.equal(st.online,false);
 await vis('/api/chat/start',{name:'',email:'x@y.com',message:'oi'},400);await vis('/api/chat/start',{name:'Rui',email:'invalido',message:'oi'},400);
 await vis('/api/chat/send',{text:'oi'},404);
 const r=await vis('/api/chat/start',{name:'Rui Lima',email:'rui@lan.com',phone:'92 99999-0000',message:'Quero saber do preço'});
 // 2.14: o assistente responde na hora; o dono só recebe e-mail quando o cliente pede um especialista (ou o assistente não resolve)
 assert.equal(r.messages.length,2);assert.equal(r.messages[1].sender,'bot');assert.match(r.messages[1].text,/Olá, Rui! Sou o assistente virtual/);assert.match(r.messages[1].text,/Standard/);
 assert.ok(!s.mails.some(m=>m.to==='dono@gamezoney.com'&&/chat/.test(m.subject)),'sem e-mail enquanto o assistente resolve');
 const ps=await vis('/api/chat/send',{text:'Funciona com PS5?'});assert.match(ps.messages.at(-1).text,/consoles são controlados pela TV/i);
 const esp=await vis('/api/chat/send',{text:'quero falar com um especialista'});assert.match(esp.messages.at(-1).text,/não temos um especialista online.*rui@lan\.com/);assert.equal(esp.chat.handoff,true);
 assert.ok(s.mails.some(m=>m.to==='dono@gamezoney.com'&&/especialista/.test(m.subject)&&/Funciona com PS5\?/.test(m.text)),'admin offline recebe e-mail com a conversa');
 // outra pessoa não vê a conversa
 assert.equal((await outro('/api/chat')).chat,null);
 await vis('/api/admin/chats',undefined,401);await outro('/api/auth/register',{name:'Outro',email:'outro@x.com',password:'senha-forte-1'});await outro('/api/admin/chats',undefined,403);
 let a=await dono('/api/admin/chats');assert.equal(a.chats.length,1);assert.equal(a.chats[0].unread,1);assert.equal(a.chats[0].handoff,true);assert.equal(a.chats[0].name,'Rui Lima');
 assert.equal((await vis('/api/chat')).online,true,'admin com o /admin aberto aparece online');
 a=await dono('/api/admin/chats?id='+a.chats[0].id);assert.deepEqual(a.messages.filter(m=>m.sender==='user').map(m=>m.text),['Quero saber do preço','Funciona com PS5?','quero falar com um especialista']);
 assert.equal((await dono('/api/admin/chats')).chats[0].unread,0);
 const n=s.mails.length;await dono('/api/admin/chats/'+a.chats[0].id,{text:'Sim! Funciona com PS5 na TV.',email:true});
 assert.equal(s.mails.length,n+1);assert.equal(s.mails.at(-1).to,'rui@lan.com');
 st=await vis('/api/chat');assert.equal(st.messages.at(-1).sender,'admin');assert.equal(st.messages.at(-1).text,'Sim! Funciona com PS5 na TV.');
 st=await vis('/api/chat?after='+st.messages.at(-1).id);assert.equal(st.messages.length,0);
 await dono('/api/admin/chats/'+a.chats[0].id,{status:'closed'});assert.equal((await dono('/api/admin/chats')).chats[0].status,'closed');
 await vis('/api/chat/end',{});assert.equal((await vis('/api/chat')).chat,null);
});

test('site: página inicial tem avaliações, Instagram e chat; idioma padrão português',async t=>{
 const s=await boot(t);const html=await (await fetch(s.base+'/')).text();assert.match(html,/id="avaliacoes"/);
 const js=await (await fetch(s.base+'/site.js')).text();assert.match(js,/https:\/\/www\.instagram\.com\/gamezoney_/);assert.match(js,/Fale conosco/);
 const i18n=await (await fetch(s.base+'/i18n-site.js')).text();assert.doesNotMatch(i18n,/navigator\.language/);
});
