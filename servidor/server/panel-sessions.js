'use strict';
// 3.0.48: sessões do painel (login dos operadores/administradores).
// Antes: a sessão vencia 12 horas depois do login (mesmo com o painel em uso) e ficava só na memória, então qualquer
// reinício do servidor (atualização, queda de energia, reinício do PC) também pedia login de novo.
// Agora: a sessão fica ativa enquanto o painel for usado (renova sozinha a cada uso, validade de 365 dias sem uso) e é
// gravada no banco (somente o resumo SHA-256 do token, nunca o token), sobrevivendo a reinícios do servidor.
// Continua: "Sair" encerra a sessão; conta desativada ou senha alterada encerra as outras sessões da conta.
const crypto=require('crypto');
const DAY=86400000,TTL=365*DAY;
const hash=token=>crypto.createHash('sha256').update(String(token)).digest('hex');
module.exports=function panelSessions(store,{now=()=>Date.now()}={}){
 const map=new Map();let lastSave=0;
 for(const s of Array.isArray(store.state.panelSessions)?store.state.panelSessions:[])if(s&&typeof s.hash==='string'&&s.until>now())map.set(s.hash,{id:s.id,until:s.until,createdAt:s.createdAt||now()});
 const save=()=>{store.state.panelSessions=[...map].map(([h,s])=>({hash:h,id:s.id,until:s.until,createdAt:s.createdAt}));lastSave=now();try{store.persist()}catch{}};
 const keyOf=token=>map.has(token)?token:hash(token);
 const api={
  TTL,keyOf,
  get(token){if(!token)return undefined;const s=map.get(hash(token));if(!s)return undefined;if(s.until<=now()){map.delete(hash(token));save();return undefined}return s},
  set(token,value){map.set(hash(token),{id:value.id,until:value.until??now()+TTL,createdAt:now()});save();return api},
  // renova a validade a cada uso; grava no banco no máximo a cada 10 minutos (ou se faltar menos de 364 dias)
  touch(token){const s=api.get(token);if(!s)return undefined;const before=s.until;s.until=now()+TTL;if(now()-lastSave>600000||before-now()<TTL-DAY)save();return s},
  delete(key){const ok=map.delete(keyOf(key));if(ok)save();return ok},
  get size(){return map.size},
  [Symbol.iterator](){return [...map][Symbol.iterator]()}
 };
 return api;
};
