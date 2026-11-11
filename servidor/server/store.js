'use strict';
const {DatabaseSync,backup}=require('node:sqlite');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const netinfo=require('./netinfo');
const id=()=>crypto.randomUUID();
const fail=(message)=>{throw new Error(message)};
function text(value,label,max=120){const s=String(value??'').trim();if(!s||s.length>max)fail(label+' inválido.');return s;}
function integer(v,min,max,label){const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)fail(label+' inválido.');return n;}
function cpfDigits(value){return String(value??'').replace(/\D/g,'').slice(0,11);}
function validCpf(value){const cpf=cpfDigits(value);if(!cpf)return true;if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false;for(let t=9;t<11;t++){let sum=0;for(let i=0;i<t;i++)sum+=Number(cpf[i])*(t+1-i);let d=(sum*10)%11;if(d===10)d=0;if(d!==Number(cpf[t]))return false;}return true;}
function passwordHash(password,salt=crypto.randomBytes(16).toString('hex'),minimum=4){/* senha do servidor (operadores): 4 a 24 caracteres */const maximum=minimum===1?128:24;if(typeof password!=='string'||password.length<minimum||password.length>maximum)fail(minimum===1?'Digite uma senha de até 128 caracteres.':'A senha deve ter entre 4 e 24 caracteres.');return salt+':'+crypto.scryptSync(password,salt,64).toString('hex');}
// 3.0.39: senha de CLIENTE (cadastro no servidor e primeiro acesso no PC): de 4 a 20 caracteres.
// 3.0.45: Usuário/Nick (login do cliente) aceita espaços e números. Espaços repetidos viram um só.
const NICK_PATTERN=/^(?=.{3,32}$)[A-Za-z0-9._-]+(?: [A-Za-z0-9._-]+)*$/;
function normalizeNick(value){return String(value??'').trim().replace(/\s+/g,' ');}
const MEMBER_PASSWORD_MIN=4,MEMBER_PASSWORD_MAX=20;
function memberPasswordHash(password){if(typeof password!=='string'||password.length<MEMBER_PASSWORD_MIN||password.length>MEMBER_PASSWORD_MAX)fail('A senha do cliente deve ter de 4 a 20 caracteres.');return passwordHash(password,undefined,1);}
function verify(password,hash){try{const [salt,value]=hash.split(':');return crypto.timingSafeEqual(Buffer.from(value,'hex'),crypto.scryptSync(String(password),salt,64))}catch{return false}}
const CHECKPOINT_FIELDS=['lastClientSyncAt','lastClientRemainingSeconds','lastClientRunId','lastClientSystemUptimeMs'];
const HOT_DAYS=90,HIST_MAX=8e15;
const ARCHIVE={sessions:r=>Number(r.startedAt),sales:r=>Number(r.at),shopSales:r=>Number(r.at),loyaltyLedger:r=>Number(r.at),stockMoves:r=>Number(r.at)};
const ARCHIVE_LABEL={sessions:'sessões',sales:'recargas',shopSales:'cupons',loyaltyLedger:'movimentos de medalhas',stockMoves:'movimentos de estoque'};
class Store{
 constructor(directory,opts={}){this.directory=directory;/* 1.2.9: instalação nova do GameZoney.exe vem SEM estações de exemplo (server.js passa examples:false); os testes continuam com elas */const examples=opts.examples!==false;fs.mkdirSync(directory,{recursive:true});this.db=new DatabaseSync(path.join(directory,'gamezoney.sqlite'));this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL, type TEXT NOT NULL, detail TEXT NOT NULL); CREATE TABLE IF NOT EXISTS live (key TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS hist (kind TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(kind,id)); CREATE INDEX IF NOT EXISTS hist_at ON hist(kind,at);');
 if(!this.db.prepare('PRAGMA table_info(logs)').all().some(c=>c.name==='memberId'))this.db.exec('ALTER TABLE logs ADD COLUMN memberId TEXT');
 const row=this.db.prepare('SELECT data FROM state WHERE id=1').get();
 this.state=row?JSON.parse(row.data):{schema:1,settings:{hourCents:700,serverUrl:netinfo.defaultUrl()||'http://192.168.1.100:3000',timeZone:netinfo.timeZone()||'America/Manaus'},operators:[],members:[],promotions:[],stations:examples?[/* 1.0.5: estações de exemplo (removíveis: Remover console / Remover computador) */{id:'1',name:'Exemplo Console',kind:'tv',ip:'192.168.1.111',brand:'',hdmi:1,active:true},{id:'2',name:'Exemplo PC',kind:'computer',ip:'',active:true}]:[],sessions:[],sales:[]};
 /* 1.2.1: aplica o que foi gravado em linhas pequenas depois da última gravação completa (presença do servidor e ponto de controle das sessões) */if(row)this.applyLive();
 /* 1.0.5: endereço de fábrica nunca configurado e que não é deste PC passa a ser o IP atual da máquina */if(row&&this.state.settings.serverUrl==='http://192.168.1.100:3000'&&!netinfo.interfaces().some(i=>i.address==='192.168.1.100')){const url=netinfo.defaultUrl();if(url){this.state.settings.serverUrl=url;this.pendingLog='Endereço do servidor ajustado para o IP desta máquina: '+url}}
 /* 1.0.5: fuso horário automático = fuso do Windows onde o servidor está instalado */{const tz=netinfo.timeZone();if(tz&&tz!==this.state.settings.timeZone){if(row)this.pendingLog=(this.pendingLog?this.pendingLog+' • ':'')+'Horário ajustado ao do computador do servidor ('+this.state.settings.timeZone+' → '+tz+')';this.state.settings.timeZone=tz}}
 this.state.settings.machinePolicy??={taskManager:true,controlPanel:false,securityOptions:false,dateTime:true,revision:1};
 /* 1.0.5: opções "Bloquear Painel de Controle e Configurações" e "Restringir opções da tela Ctrl+Alt+Del" retiradas: ficam desligadas (nova revisão faz os PCs restaurarem o estado anterior). */{const mp=this.state.settings.machinePolicy;if(mp.controlPanel||mp.securityOptions){mp.controlPanel=false;mp.securityOptions=false;mp.revision=(mp.revision||0)+1;this.pendingLog=(this.pendingLog?this.pendingLog+' • ':'')+'Restrições retiradas (Painel de Controle e tela Ctrl+Alt+Del) desligadas nos PCs'}}
 this.state.runtime??={};this.state.recoveryReviews??=[];
 require('./business').init(this);require('./shop').init(this);require('./cash').init(this);require('./stats').init(this);require('./events').init(this);this.persist();if(this.pendingLog){this.log('sistema','config',this.pendingLog);delete this.pendingLog}}
 persist(){this.db.prepare('INSERT INTO state(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(this.state));/* o estado completo já leva os pontos de controle */this.db.exec("DELETE FROM live WHERE key LIKE 'cp:%'");}
 /* 1.2.1: gravações leves. Antes, o aviso de presença (a cada 5 s) e cada consulta de um PC em sessão regravavam o estado INTEIRO
    (dezenas de MB depois de meses de uso: centenas de GB por dia no disco e o painel parado ~0,2 s a cada vez). Agora só uma linha pequena. */
 liveSet(key,data){this.db.prepare('INSERT INTO live(key,data) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').run(key,JSON.stringify(data));}
 persistRuntime(){const r=this.state.runtime||{};this.liveSet('runtime',{lastAliveAt:r.lastAliveAt,cleanShutdown:r.cleanShutdown});}
 checkpoint(session){const d={};for(const k of CHECKPOINT_FIELDS)if(session[k]!==undefined)d[k]=session[k];this.liveSet('cp:'+session.id,d);}
 applyLive(){for(const r of this.db.prepare('SELECT key,data FROM live').all()){try{const d=JSON.parse(r.data);if(r.key==='runtime'){const rt=this.state.runtime??={};if((Number(d.lastAliveAt)||0)>(Number(rt.lastAliveAt)||0)){rt.lastAliveAt=d.lastAliveAt;rt.cleanShutdown=d.cleanShutdown;}}else if(r.key.startsWith('cp:')){const s=(this.state.sessions||[]).find(x=>x.id===r.key.slice(3)&&x.status==='active');if(s&&(Number(d.lastClientSyncAt)||0)>(Number(s.lastClientSyncAt)||0))for(const k of CHECKPOINT_FIELDS)if(d[k]!==undefined)s[k]=d[k];}}catch{}}}
 change(actor,type,detail,fn){const old=JSON.stringify(this.state);this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.persist();this.db.prepare('INSERT INTO logs(at,actor,type,detail) VALUES(?,?,?,?)').run(new Date().toISOString(),actor,type,detail);const memberId=result?.memberId||(type==='membro'?result?.id:null);if(memberId)this.db.prepare('UPDATE logs SET memberId=? WHERE id=last_insert_rowid()').run(memberId);this.db.exec('COMMIT');return result}catch(e){this.db.exec('ROLLBACK');this.state=JSON.parse(old);throw e}}
 log(actor,type,detail,memberId=null){this.db.prepare('INSERT INTO logs(at,actor,type,detail) VALUES(?,?,?,?)').run(new Date().toISOString(),String(actor),String(type),String(detail).slice(0,2000));if(memberId)this.db.prepare('UPDATE logs SET memberId=? WHERE id=last_insert_rowid()').run(String(memberId));}
 activeForStation(station){return this.state.sessions.find(s=>s.stationId===station&&s.status==='active')}
 activeForMember(member){return this.state.sessions.find(s=>s.memberId===member&&s.status==='active')}
 remaining(session,now=Date.now()){return Math.max(0,Math.ceil((session.endsAt-now)/1000))}
 member(memberId){return this.state.members.find(m=>m.id===memberId)||fail('Cliente não encontrado.')}
 station(stationId){return this.state.stations.find(s=>s.id===stationId)||fail('Estação não encontrada.')}
 publicMember(m){const {passwordHash,passwordScheme,...safe}=m;return {...safe,username:m.username||'',hasPassword:!!passwordHash}}
 memberSave(input,actor){
  const name=text(input.name,'Nome'),existing=input.id?this.member(input.id):null;
  const username=normalizeNick(input.username??existing?.username??'');
  if((!existing||username)&&!NICK_PATTERN.test(username))fail('Usuário/Nick: use de 3 a 32 caracteres entre letras sem acento, números, espaço, ponto, hífen ou sublinhado.');
  if(existing?.username&&!username)fail('O Usuário/Nick não pode ficar vazio.');
  if(username&&this.state.members.some(m=>m.id!==existing?.id&&(m.username||'').toLowerCase()===username.toLowerCase()))fail('Este Usuário/Nick já está cadastrado.');
  const cpf=cpfDigits(input.cpf??existing?.cpf??'');
  if(cpf&&!validCpf(cpf))fail('CPF inválido. Confira os 11 dígitos.');
  if(cpf&&this.state.members.some(m=>m.id!==existing?.id&&cpfDigits(m.cpf)===cpf))fail('Este CPF já está cadastrado para outro cliente.');
  const changePassword=input.password!==undefined&&input.password!=='';

  if(changePassword&&!username)fail('Informe o Usuário/Nick antes de definir a senha.');
  const hash=changePassword?memberPasswordHash(input.password):null;
  // 3.0.67: "Ativar programa fidelidade" por cliente (padrão: ativo). Desativado = não ganha pontos nem o prêmio automático.
  const loyaltyEnabled=input.loyaltyEnabled===undefined?existing?.loyaltyEnabled!==false:input.loyaltyEnabled!==false&&input.loyaltyEnabled!=='false';
  const loyaltyChanged=!!existing&&(existing.loyaltyEnabled!==false)!==loyaltyEnabled;
  const saved=this.change(actor,'membro','Cadastro de cliente atualizado: '+name,()=>{let m=existing||{id:id(),creditSeconds:0,pointsMilli:0,createdAt:Date.now()};if(!existing)this.state.members.push(m);Object.assign(m,{name,username,cpf,phone:String(input.phone??m.phone??'').trim().slice(0,40),/* 1.0.5: e-mail opcional */email:(()=>{const e=String(input.email??m.email??'').trim().slice(0,120);if(e&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))fail('E-mail inválido.');return e})(),notes:String(input.notes??m.notes??'').trim().slice(0,500),active:input.active??m.active??true,loyaltyEnabled});if(hash){m.passwordHash=hash;m.passwordScheme='scrypt-v1'}return m});
  if(loyaltyChanged)this.log(actor,'fidelidade',(loyaltyEnabled?'Programa fidelidade ATIVADO para ':'Programa fidelidade DESATIVADO para ')+name+(saved.username?' (@'+saved.username+')':''));
  return saved;
 }
 quote(input){if(input.promotionId){const p=this.state.promotions.find(p=>p.id===input.promotionId&&p.active);if(!p)fail('Promoção indisponível.');return{minutes:p.minutes,cents:p.cents,label:p.name,promotionId:p.id}}
  // 3.0.28: recarga informada em VALOR. O cliente paga exatamente o valor informado e recebe os minutos
  // proporcionais ao valor da hora, arredondados para o minuto mais proximo.
  if(input.mode==='value'||(input.cents!==undefined&&input.minutes===undefined)){const hour=Number(this.state.settings.hourCents)||0;if(hour<=0)fail('Configure o valor da hora antes de recarregar por valor.');const cents=integer(input.cents,1,100000000,'Valor da recarga');const minutes=Math.round(cents*60/hour);if(minutes<1)fail('Valor insuficiente para 1 minuto.');if(minutes>43200)fail('Valor acima do limite de 720 horas.');return{minutes,cents,label:'R$ '+(cents/100).toFixed(2).replace('.',',')+' ('+minutes+' minutos)',promotionId:null,byValue:true}}const minutes=integer(input.minutes,1,43200,'Minutos');return{minutes,cents:Math.round(minutes*this.state.settings.hourCents/60),label:minutes+' minutos',promotionId:null}}
 credit(memberId,input,actor,now=Date.now()){const m=this.member(memberId);if(!m.active)fail('Cliente inativo.');const quote=this.quote(input),P=require('./payments');let payments=null,paymentMethod;/* 1.0.5: pagamento combinado (2 a 3 formas) */if(P.wants(input)&&quote.cents>0){payments=P.combined(input.payments,quote.cents,P.RECHARGE);paymentMethod='mixed'}else paymentMethod=require("./balance").payment(input.paymentMethod);return this.change(actor,'recarga',`${m.name}: +${quote.minutes} min • R$ ${(quote.cents/100).toFixed(2)}`,()=>{const session=this.activeForMember(memberId);if(session&&session.endsAt<=now)fail('Sessão em encerramento; tente novamente.');if(session){session.allocatedSeconds+=quote.minutes*60;session.endsAt+=quote.minutes*60000;session.timeAddedAt=now}else m.creditSeconds+=quote.minutes*60;const sale={id:id(),memberId,memberName:m.name,memberUsername:m.username,...quote,paymentMethod,...(payments?{payments}:{}),at:now,actor,cashId:require('./cash').openId(this)};/* 3.0.49: pacote gratis */if(quote.cents===0&&input.freeNote){sale.free=true;sale.freeNote=String(input.freeNote).slice(0,300);sale.authorizedBy=String(input.authorizedBy||actor).slice(0,60);}require('./business').sold(this,sale,m,session);this.state.sales.push(sale);return sale})}
 start(stationId,memberId,actor,now=Date.now()){const station=this.station(stationId),m=this.member(memberId);if(!station.active||!m.active)fail('Estação ou cliente inativo.');if(this.activeForStation(stationId)||this.activeForMember(memberId))fail('Estação ou cliente já possui sessão aberta.');if(m.creditSeconds<=0)fail('Adicione minutos ao cliente antes de iniciar.');return this.change(actor,'inicio',`${m.name} iniciou em ${station.name}`,()=>{const session={id:id(),stationId,stationName:station.name,memberId,memberName:m.name,memberUsername:m.username,startedAt:now,endsAt:now+m.creditSeconds*1000,allocatedSeconds:m.creditSeconds,status:'active',reportKey:crypto.randomBytes(24).toString('hex')};require('./business').started(this,session);m.creditSeconds=0;this.state.sessions.push(session);return session})}
 finish(stationId,actor,reason='manual',now=Date.now()){const session=this.activeForStation(stationId);if(!session)fail('Não há sessão ativa nesta estação.');return this.change(actor,'fim',`${session.memberName} encerrou em ${session.stationName} (${reason})`,()=>{const end=Math.min(now,session.endsAt);const remaining=this.remaining(session,now);const owner=this.member(session.memberId);owner.creditSeconds+=remaining;Object.assign(session,{status:'finished',finishedAt:end,usedSeconds:session.allocatedSeconds-remaining,remainingSeconds:remaining,reason,pageStatus:'pending'});if(owner.guest){session.guest=true;session.guestForfeitSeconds=owner.creditSeconds;owner.creditSeconds=0;owner.active=false;}require('./business').finished(this,session);return session})}
 finishRecovered(stationId,actor,reason,remainingSeconds,meta={},now=Date.now()){const session=this.activeForStation(stationId);if(!session)fail('Não há sessão ativa nesta estação.');const remaining=Math.max(0,Math.min(session.allocatedSeconds,Math.ceil(Number(remainingSeconds)||0)));return this.change(actor,'fim',`${session.memberName} recuperado em ${session.stationName} (${reason})`,()=>{const owner=this.member(session.memberId);owner.creditSeconds+=remaining;if(owner.guest){session.guest=true;session.guestForfeitSeconds=owner.creditSeconds;owner.creditSeconds=0;owner.active=false;}Object.assign(session,{status:'finished',finishedAt:Math.min(now,session.endsAt),usedSeconds:Math.max(0,session.allocatedSeconds-remaining),remainingSeconds:remaining,reason,pageStatus:'pending',recovery:{...meta,remainingSeconds:remaining,recoveredAt:now}});require('./business').finished(this,session);return session})}
 logs(query={}){const conditions=[],args=[];if(query.type){conditions.push('type=?');args.push(query.type)}if(query.nick||query.search){const nick=String(query.nick||query.search).trim().toLowerCase();const ids=this.state.members.filter(m=>(m.username||'').toLowerCase().includes(nick)).map(m=>m.id);if(!ids.length)return [];conditions.push('memberId IN ('+ids.map(()=>'?').join(',')+')');args.push(...ids)}if(query.from){conditions.push('at>=?');args.push(query.from)}if(query.to){conditions.push('at<=?');args.push(query.to)}return this.db.prepare('SELECT * FROM logs'+(conditions.length?' WHERE '+conditions.join(' AND '):'')+' ORDER BY id DESC LIMIT 1000').all(...args)}
 snapshot(){const recent=this.state.sessions.slice(-500),seen=new Set(recent.map(s=>s.id));return{settings:this.state.settings,members:this.state.members.filter(m=>!(m.guest&&!m.active)).map(m=>this.publicMember(m)),stations:this.state.stations.filter(s=>!s.removedAt).map(({pcTokenHash,pcDevice,...s})=>({...s,pcPaired:!!pcTokenHash})),promotions:this.state.promotions.filter(p=>!p.removedAt),sessions:[...this.state.sessions.filter(s=>s.status==='active'&&!seen.has(s.id)),...recent],sales:this.state.sales.slice(-500),serverNow:Date.now()}}
 async backup(){const dir=path.join(this.directory,'backups');fs.mkdirSync(dir,{recursive:true});const target=path.join(dir,'gamezoney-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite');await backup(this.db,target);return target}
 /* 1.2.2: HISTÓRICO ANTIGO EM TABELA PRÓPRIA (hist). Registros com mais de HOT_DAYS dias que não podem mais mudar
    (sessões encerradas, recargas já usadas/canceladas, cupons fora de Corujão/Viradão, extrato de medalhas, movimentos de estoque)
    saem do estado em memória: cada gravação e a memória do servidor passam a depender só dos últimos meses.
    Quem precisa do período inteiro (relatórios, estatística, extrato, caixas antigos, ranking) lê por history()/view(). */
 history(kind,from=0,to=HIST_MAX){const hot=this.state[kind]||[],ids=new Set(hot.map(r=>r&&r.id));const old=this.db.prepare('SELECT data FROM hist WHERE kind=? AND at>=? AND at<? ORDER BY at').all(kind,Math.max(0,Math.floor(from)),Math.min(HIST_MAX,Math.ceil(to))).map(r=>{const x=JSON.parse(r.data);Object.defineProperty(x,'archived',{value:true,enumerable:false});return x}).filter(x=>!ids.has(x.id));if(!old.length)return hot.slice();/* intercala por data mantendo a ordem do estado */const t=ARCHIVE[kind],out=[];let i=0;for(const h of hot){const th=t(h);while(i<old.length&&t(old[i])<=th)out.push(old[i++]);out.push(h);}while(i<old.length)out.push(old[i++]);return out;}
 /* cópia só para leitura: o estado com o histórico do período (arquivado + recente) nos lugares de sempre */
 view(from=0,to=HIST_MAX){const v=Object.create(this),state={...this.state};for(const k of Object.keys(ARCHIVE))state[k]=this.history(k,from,to);Object.defineProperty(v,'state',{value:state});return v;}
 archivedCount(){const o={};for(const r of this.db.prepare('SELECT kind,COUNT(*) n FROM hist GROUP BY kind').all())o[r.kind]=r.n;return o;}
 async archiveOld(now=Date.now(),days=HOT_DAYS){
  const cutoff=now-days*86400000,s=this.state;s.archive??={medalsMilli:{}};s.archive.medalsMilli??={};
  const lastStart=new Map();for(const x of s.sessions||[])if(x&&x.memberId)lastStart.set(x.memberId,Math.max(lastStart.get(x.memberId)||0,Number(x.startedAt)||0));
  const ok=t=>Number.isFinite(t)&&t>0&&t<cutoff;
  const rules={sessions:x=>x.status!=='active'&&ok(x.startedAt)&&ok(Number(x.finishedAt)||x.startedAt),
   sales:x=>ok(x.at)&&(x.status==='canceled'||!!x.usedAt||!!x.balanceAdjustedAt||(lastStart.get(x.memberId)||0)>=x.at),
   shopSales:x=>ok(x.at)&&!x.eventId,loyaltyLedger:x=>ok(x.at),stockMoves:x=>ok(x.at)};
  const plan={};let total=0;for(const k of Object.keys(ARCHIVE)){const list=s[k]||[],out=list.filter(x=>x&&x.id&&rules[k](x));if(out.length){plan[k]=out;total+=out.length;}}
  if(!total)return {moved:0};
  /* primeira vez: cópia do banco antes de mexer (pasta backups) */
  if(!s.archive.firstBackupAt){const dir=path.join(this.directory,'backups');fs.mkdirSync(dir,{recursive:true});await backup(this.db,path.join(dir,'antes-arquivar-historico-'+new Date(now).toISOString().replace(/[:.]/g,'-')+'.sqlite'));}
  /* depois do await o estado pode ter mudado: refaz a lista */
  const counts={};total=0;const before={},medals={...s.archive.medalsMilli};
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const ins=this.db.prepare('INSERT INTO hist(kind,id,at,data) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET at=excluded.at,data=excluded.data');
   for(const k of Object.keys(ARCHIVE)){const list=s[k]||[];before[k]=list;const keep=[];let n=0;
    for(const x of list){if(x&&x.id&&rules[k](x)){ins.run(k,String(x.id),Math.floor(ARCHIVE[k](x)),JSON.stringify(x));n++;if(k==='loyaltyLedger'&&!/^Resgate/.test(x.reason||''))medals[x.memberId]=(medals[x.memberId]||0)+(Number(x.amount)||0);}else keep.push(x);}
    if(n){s[k]=keep;counts[k]=n;total+=n;}}
   s.archive.medalsMilli=medals;s.archive.firstBackupAt??=now;s.archive.lastAt=now;
   this.persist();
   this.db.prepare('INSERT INTO logs(at,actor,type,detail) VALUES(?,?,?,?)').run(new Date(now).toISOString(),'sistema','sistema','Histórico com mais de '+days+' dias guardado no arquivo do banco: '+Object.entries(counts).map(([k,n])=>n+' '+ARCHIVE_LABEL[k]).join(', '));
   this.db.exec('COMMIT');
  }catch(e){this.db.exec('ROLLBACK');for(const k of Object.keys(before))s[k]=before[k];throw e;}
  return {moved:total,counts};
 }
 findArchived(kind,id){const r=this.db.prepare('SELECT data FROM hist WHERE kind=? AND id=?').get(kind,String(id));if(!r)return null;const x=JSON.parse(r.data);Object.defineProperty(x,'archived',{value:true,enumerable:false});return x;}
 /* traz de volta para o estado (sem apagar do arquivo; a versão do estado vale e substitui o arquivo no próximo arquivamento) */
 revive(kind,id){const hot=this.state[kind]||(this.state[kind]=[]),found=hot.find(x=>x&&x.id===id);if(found)return found;const r=this.db.prepare('SELECT data FROM hist WHERE kind=? AND id=?').get(kind,String(id));if(!r)return null;const x=JSON.parse(r.data),t=ARCHIVE[kind](x);let i=hot.length;while(i>0&&!(ARCHIVE[kind](hot[i-1])<=t))i--;hot.splice(i,0,x);return x;}
 close(){this.db.close()}
}
module.exports={HOT_DAYS,Store,id,text,integer,fail,cpfDigits,validCpf,passwordHash,memberPasswordHash,verify,MEMBER_PASSWORD_MIN,MEMBER_PASSWORD_MAX,NICK_PATTERN,normalizeNick};
