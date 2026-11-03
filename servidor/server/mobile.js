'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const {verify, normalizeNick} = require('./store');
const rankingsService = require('./rankings');
const tournamentsService = require('./tournaments');
const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const random = () => crypto.randomBytes(32).toString('hex');
const loopback = value => ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(value);
function privateAddress(value) {
  value = String(value || '').replace(/^::ffff:/, '');
  if (loopback(value)) return true;
  if (net.isIP(value) !== 4) return false;
  const [a,b] = value.split('.').map(Number);
  return a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31;
}
function publicOrigin(value) {
  if (!value) return '';
  const u = new URL(value);
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const localHost = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || privateAddress(host) || /^(?:0\.|127\.|169\.254\.|::|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i.test(host);
  if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash || localHost) throw Error('Informe um endereço público HTTPS, sem caminho ou credenciais.');
  return u.origin;
}
function medals(store, member, now) {
  const sessions = store.state.sessions.filter(s => s.memberId === member.id);
  const seconds = sessions.reduce((total,s) => total + Math.max(0, s.status === 'active' ? Math.min(s.allocatedSeconds, Math.floor((now - s.startedAt) / 1000)) : Number(s.usedSeconds) || 0), 0);
  const reward = store.state.loyaltyLedger.some(l => l.memberId === member.id && l.amount < 0 && /^resgate/i.test(l.reason || ''));
  return [
    {id:'first-session',name:'Primeira partida',description:'Inicie sua primeira sessão na arena.',earned:sessions.length > 0},
    ...[10,50,100].map(hours => ({id:'hours-'+hours,name:hours === 10 ? 'Em evolução' : hours === 50 ? 'Veterano da arena' : 'Lenda GameZoney',description:hours+' horas de uso acumuladas.',earned:seconds >= hours*3600,progress:Math.min(1, seconds/(hours*3600))})),
    {id:'loyal',name:'Cliente fiel',description:'Resgate seu primeiro prêmio de fidelidade.',earned:reward}
  ];
}
// 3.0.69: com o acesso pelo navegador desligado, a página e os scripts do app web respondem com este aviso (a API do app nativo continua).
const WEB_CLIENT = new Set(['/mobile', '/mobile/client', '/mobile/client.js', '/mobile/client.css', '/mobile/app-shell.js', '/mobile/install-hint.js', '/mobile/manifest.webmanifest']);
const WEB_CLIENT_OFF = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GameZoney</title>'
  + '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#08090d;color:#f5f5f7;font-family:system-ui,sans-serif;text-align:center;padding:24px}h1{font-size:24px}p{color:#969aa8;line-height:1.5}</style></head>'
  + '<body><main><h1>GameZoney</h1><p>O acesso pelo navegador foi desativado.<br>Use o app <b>GameZoney</b> no celular. Dúvidas: fale com a recepção.</p></main></body></html>';
// 3.0.70: app GameZoney SV (administração pelo celular) retirado — fica só o app do cliente. A administração é feita
// somente pelo painel no PC do servidor. Qualquer endereço do SV (/mobile/admin, /mobile/admin-api, arquivos) responde 410 com este aviso.
const SV_OFF = 'O app GameZoney SV foi retirado. A administração é feita pelo painel no PC do servidor. Pode desinstalar este app.';
const SV_OFF_PAGE = WEB_CLIENT_OFF.replace('O acesso pelo navegador foi desativado.<br>Use o app <b>GameZoney</b> no celular. Dúvidas: fale com a recepção.', SV_OFF);
module.exports = function mobileService(store, pc, options = {}) {
  const sessions = new Map(), rates = new Map();
  const now = options.now || Date.now;
  const cookieName = kind => kind === 'admin' ? 'prime_mobile_admin' : 'prime_mobile_member';
  // 3.0.61: torneios disponíveis do site (ChatGPT Sites), buscados pelo servidor e entregues ao app
  const tournaments = tournamentsService(store, {fetch:options.tournamentsFetch, now});
  // 3.0.63: rankings do site (ChatGPT Sites) de volta, buscados pelo servidor e entregues ao app
  const rankings = rankingsService(store, {fetch:options.rankingsFetch, lookup:options.rankingsLookup, now});
  // 3.0.69: webClient = app do cliente pelo NAVEGADOR (página /mobile/client e apps antigos 1.0.x). Desligado por padrão: o cliente usa o app nativo 2.0.
  // GameZoney 1.0.1: sem apps Android/iOS — a API de celular fica desligada (sem opção no painel).
  const config = () => ({enabled:store.state.settings.mobile?.enabled === true,lanClient:store.state.settings.mobile?.lanClient !== false,webClient:store.state.settings.mobile?.webClient === true,publicUrl:process.env.PRIME_MOBILE_PUBLIC_URL || store.state.settings.mobile?.publicUrl || '',
    tournamentsUrl:store.state.settings.mobile?.tournamentsUrl || '',tournamentsDefault:tournamentsService.DEFAULT_URL,tournamentsStatus:tournaments.status(),
    rankingsUrl:store.state.settings.mobile?.rankingsUrl || '',rankingsDefault:rankingsService.DEFAULT_URL,rankingsStatus:rankings.status()});
  function transport(req) {
    let host;
    try { host = new URL('http://'+req.headers.host); } catch { return null; }
    if (host.username || host.password || host.pathname !== '/' || host.search || host.hash) return null;
    const forwarded = req.headers['x-forwarded-for'] || req.headers['x-forwarded-proto'] || req.headers['x-forwarded-host'];
    const configured = config().publicUrl;
    if (configured) {
      let target;try { target = new URL(publicOrigin(configured)); } catch { return null; }
      if (host.host === target.host && (req.socket.encrypted || loopback(req.socket.remoteAddress) && req.headers['x-forwarded-proto'] === 'https')) return {origin:target.origin,secure:true,admin:true,rateAddress:loopback(req.socket.remoteAddress) ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',').at(-1).trim() : req.socket.remoteAddress};
    }
    if (!forwarded && privateAddress(req.socket.remoteAddress) && privateAddress(host.hostname)) return {origin:(req.socket.encrypted?'https:':'http:')+'//'+host.host,secure:!!req.socket.encrypted,admin:loopback(req.socket.remoteAddress),rateAddress:req.socket.remoteAddress};
    return null;
  }
  function prune() {
    for (const [key,s] of sessions) if (s.until <= now() || s.absolute <= now()) sessions.delete(key);
    for (const [key,r] of rates) if (r.until <= now()) rates.delete(key);
  }
  function read(req, kind, context) {
    const raw = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName(kind)+'='))?.slice(cookieName(kind).length+1);
    const key = raw && /^[a-f0-9]{64}$/.test(raw) ? digest(raw) : '';
    const session = sessions.get(key);
    if (!session || session.kind !== kind || session.origin !== context.origin || session.until <= now() || session.absolute <= now()) { if (key) sessions.delete(key);return null; }
    if (session.id) {
      const who = (kind === 'admin' ? store.state.operators : store.state.members).find(x => x.id === session.id && x.active !== false && !x.guest);
      const hash = kind === 'admin' ? who?.hash : who?.passwordHash;
      if (!who || !hash || digest(hash) !== session.identityHash || kind === 'admin' && !['admin','operator'].includes(who.role)) {sessions.delete(key);return null;}
      session.who = who;
      session.until = Math.min(now()+24*3600000,session.absolute);
    }
    session.key = key;return session;
  }
  function issue(res,kind,context,who=null) {
    prune();if(sessions.size>=5000)throw Error('Muitos acessos. Tente novamente em alguns minutos.');
    const raw=random(),entry={kind,id:who?.id || null,identityHash:who?digest(kind==='admin'?who.hash:who.passwordHash):null,csrf:random(),origin:context.origin,until:now()+(who?24*3600000:600000),absolute:now()+(who?7*24*3600000:600000)};
    sessions.set(digest(raw),entry);
    res.set('Set-Cookie',`${cookieName(kind)}=${raw}; HttpOnly; SameSite=Strict; Path=/mobile; Max-Age=${who?604800:600}${context.secure?'; Secure':''}`);
    return entry;
  }
  function csrf(req,session) {
    const value=String(req.headers['x-prime-csrf'] || '');
    return !!session && value.length === session.csrf.length && crypto.timingSafeEqual(Buffer.from(value),Buffer.from(session.csrf));
  }
  function rateAllowed(context,kind,name) {
    prune();const keys=[kind+':ip:'+context.rateAddress,kind+':name:'+digest(name)];
    if(keys.some(key=>(rates.get(key)?.count||0)>=10))return false;
    if(rates.size>10000)return false;
    for(const key of keys){const rate=rates.get(key)||{count:0,until:now()+900000};rate.count++;rates.set(key,rate);}
    return true;
  }
  function anonymousAllowed(context,kind) {
    prune();
    const key=kind+':anonymous:'+context.rateAddress;
    const rate=rates.get(key)||{count:0,until:now()+600000};
    if(rate.count>=120||rates.size>=10000)return false;
    rate.count++;rates.set(key,rate);return true;
  }
  function me(member) {
    const at=now(),active=store.activeForMember(member.id);
    return {serverNow:at,timeZone:store.state.settings.timeZone,
      member:{id:member.id,name:member.name,username:member.username,creditSeconds:member.creditSeconds,pointsMilli:member.pointsMilli||0,loyaltyEnabled:member.loyaltyEnabled!==false},
      activeSession:active?{stationName:active.stationName,remainingSeconds:store.remaining(active,at),startedAt:active.startedAt}:null,
      medals:medals(store,member,at),
      stations:store.state.stations.filter(s=>s.active&&!s.removedAt).map(s=>({id:s.id,name:s.name,kind:s.kind,status:pc.isAdmin(s.id)?'maintenance':store.activeForStation(s.id)?'busy':s.kind==='computer'&&!pc.connected(s.id)?'offline':'available'})),
      rewards:[
        ...(store.state.settings.loyalty?.enabled !== false && store.state.settings.loyalty?.thresholdMilli > 0 ? [{id:'automatic-program',name:'Tempo fidelidade (automático)',minutes:store.state.settings.loyalty.rewardMinutes,costMilli:store.state.settings.loyalty.thresholdMilli}] : []),
        ...(store.state.rewards||[]).filter(r=>r.active).map(r=>({id:r.id,name:r.name,minutes:r.minutes,costMilli:r.costMilli}))
      ],
      recentSessions:store.state.sessions.filter(s=>s.memberId===member.id&&s.status!=='active').slice(-30).reverse().map(s=>({stationName:s.stationName,startedAt:s.startedAt,finishedAt:s.finishedAt,usedSeconds:s.usedSeconds}))
    };
  }
  function middleware(req,res,next) {
    if (!req.path.startsWith('/mobile/') && req.path !== '/mobile') return next();
    try {
      res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});
      res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
      if(/^\/mobile\/admin(?:$|[-./])/.test(req.path))return req.path.startsWith('/mobile/admin-api')?res.status(410).json({error:SV_OFF}):res.status(410).type('html').send(SV_OFF_PAGE);
      if (!config().enabled) return res.status(503).json({error:'O acesso dos apps está desativado no servidor.'});
      const context=transport(req);
      if(!context)return res.status(403).json({error:'Use o endereço da rede local ou o HTTPS público configurado na recepção.'});
      if(req.headers.origin&&req.headers.origin!==context.origin)return res.status(403).json({error:'Origem não permitida.'});
      if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Abra o app diretamente.'});
      // 3.0.51: o app SV (administração) nunca funciona pela rede local: só pelo HTTPS público (ou no próprio servidor).
      if(/^\/mobile\/admin(?:$|[-./])/.test(req.path)&&!context.admin)return res.status(403).json({error:'O GameZoney SV funciona somente pelo endereço HTTPS público configurado na recepção.'});
      const api=req.path.startsWith('/mobile/api/'),adminApi=req.path.startsWith('/mobile/admin-api/');
      if(!api&&!adminApi) {
        if(req.method!=='GET'&&req.method!=='HEAD')return res.sendStatus(405);
        if(req.path==='/mobile/admin') {
          const html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8').replace('<script src="/lockdown.js"></script>','').replace('</head>','<link rel="stylesheet" href="/mobile/admin.css"><script src="/mobile/admin-bridge.js"></script></head>');
          return res.type('html').send(html);
        }
        if(WEB_CLIENT.has(req.path)&&!config().webClient)return res.status(410).type('html').send(WEB_CLIENT_OFF);
        if(req.path==='/mobile/client'||req.path==='/mobile')return res.sendFile(path.join(__dirname,'public','mobile','client.html'));
        // Static member UI has no inline code and cannot load third-party scripts.
        return next();
      }
      const kind=adminApi?'admin':'member',prefix=adminApi?'/mobile/admin-api':'/mobile/api',route=req.path.slice(prefix.length);
      let session=read(req,kind,context);
      if(req.method==='GET'&&route==='/auth') {
        if(!session){
          if(!anonymousAllowed(context,kind))return res.status(429).json({error:'Muitas conexões novas. Aguarde alguns minutos e tente novamente.'});
          session=issue(res,kind,context);
        }
        return res.json({setup:false,csrfToken:session.csrf,...(adminApi?{operator:session.id?{id:session.who.id,username:session.who.username,role:session.who.role}:null}:{member:session.id?{id:session.who.id,name:session.who.name,username:session.who.username}:null})});
      }
      if(!['GET','HEAD'].includes(req.method)&&!csrf(req,session))return res.status(403).json({error:'A sessão de acesso expirou. Reabra o app para entrar.'});
      if(req.method==='POST'&&route==='/login') {
        const rawName=String(req.body?.username||'').slice(0,80);
        const name=(adminApi?rawName.trim():normalizeNick(rawName)).toLowerCase(),password=req.body?.password;
        if(!rateAllowed(context,kind,name))return res.status(429).json({error:'Muitas tentativas. Aguarde 15 minutos.'});
        const who=(adminApi?store.state.operators:store.state.members).find(x=>(x.username||'').toLowerCase()===name&&x.active!==false&&!x.guest);
        const hash=adminApi?who?.hash:who?.passwordHash;
        if(typeof password!=='string'||password.length>128||!hash||!verify(password,hash)||adminApi&&!['admin','operator'].includes(who?.role)) {
          store.log('app','login','Tentativa de acesso móvel recusada ('+kind+')');
          return res.status(401).json({error:'Usuário/Nick ou senha incorretos. Se ainda não cadastrou uma senha, procure a recepção.'});
        }
        if(session)sessions.delete(session.key);
        session=issue(res,kind,context,who);
        rates.delete(kind+':name:'+digest(name));rates.delete(kind+':ip:'+context.rateAddress);
        store.log(who.username,'login','Acesso pelo app '+(adminApi?'GameZoney SV':'GameZoney'),adminApi?null:who.id);
        return res.json({ok:true,csrfToken:session.csrf});
      }
      if(!session?.id)return res.status(401).json({error:'Entre novamente com seu usuário e senha.'});
      if(req.method==='POST'&&route==='/logout') {
        sessions.delete(session.key);res.set('Set-Cookie',`${cookieName(kind)}=; HttpOnly; SameSite=Strict; Path=/mobile; Max-Age=0${context.secure?'; Secure':''}`);
        return res.json({ok:true});
      }
      if(!adminApi) {
        if(req.method==='GET'&&route==='/me')return res.json(me(session.who));
        // 3.0.61: torneios do site · 3.0.63: rankings do site · 3.0.65: fotos do ranking
        if(req.method==='GET'&&route==='/torneios'){tournaments.forMember().then(value=>res.json(value),()=>res.json({available:false,page:tournamentsService.PAGE_URL,error:'Torneios indisponíveis no momento.'}));return;}
        if(req.method==='GET'&&route==='/rankings'){rankings.forMember(session.who).then(value=>res.json(value),()=>res.json({available:false,error:'Rankings indisponíveis no momento.'}));return;}
        // 3.0.65: foto do jogador no ranking (baixada e conferida pelo servidor; o app nunca acessa o site direto)
        if(req.method==='GET'&&route.startsWith('/avatar/')){rankings.avatar(route.slice(8)).then(img=>{if(!img)return res.status(404).json({error:'Foto indisponível.'});res.set({'Content-Type':img.type,'Content-Length':String(img.buf.length),'Cache-Control':'private, max-age=21600','Content-Security-Policy':"default-src 'none'; sandbox",'Cross-Origin-Resource-Policy':'same-origin','Content-Disposition':'inline'});res.end(img.buf);},()=>res.status(404).json({error:'Foto indisponível.'}));return;}
        return res.status(404).json({error:'Operação não disponível no app do cliente.'});
      }
      if(['/setup','/auth','/login','/logout'].includes(route))return res.status(403).json({error:'Operação não disponível pelo app.'});
      // This property is created internally only; no HTTP header can set it.
      // All business routes retain their existing administrator/owner checks.
      req.primeMobileAdmin={operator:session.who,token:session.key};
      req.url='/api'+req.url.slice(prefix.length);
      return next();
    } catch(error) { return res.status(400).json({error:error.message}); }
  }
  return {middleware,config,me,tournaments,rankings,configure(input,actor) {
    const next={enabled:input.enabled!==false,lanClient:input.lanClient!==false,webClient:input.webClient===true,publicUrl:publicOrigin(String(input.publicUrl||'').trim()),tournamentsUrl:tournamentsService.validateUrl(input.tournamentsUrl),rankingsUrl:rankingsService.validateUrl(input.rankingsUrl)};
    const changedTournaments=next.tournamentsUrl!==(store.state.settings.mobile?.tournamentsUrl||'');
    const changedRankings=next.rankingsUrl!==(store.state.settings.mobile?.rankingsUrl||'');
    store.change(actor,'config','Configuração dos apps móveis atualizada',()=>{store.state.settings.mobile=next;});
    if(changedTournaments)tournaments.refresh().catch(()=>{});
    if(changedRankings)rankings.refresh().catch(()=>{});
    if(!next.enabled)sessions.clear();return next;
  }};
};
module.exports.privateAddress=privateAddress;
module.exports.publicOrigin=publicOrigin;
