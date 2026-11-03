'use strict';
const {id,text,integer,fail}=require('./store');
const methods={cash:'Dinheiro',pix:'Pix',credit:'Cartão (Crédito)',debit:'Cartão (Débito)',unspecified:'Não informado'};
function payment(value){if(value===undefined)return 'unspecified';if(!Object.hasOwn(methods,value)||value==='unspecified')fail('Selecione a forma de pagamento.');return value;}
function adjust(store,input,actor){
 const type=input.type;if(!['transfer','remove'].includes(type))fail('Operação inválida.');
 const reason=text(input.reason,'Motivo',300),source=store.member(input.memberId),target=type==='transfer'?store.member(input.targetId):null;
 if(target?.id===source.id)fail('Escolha outro cliente para receber o saldo.');
 if(target&&!target.active)fail('O cliente de destino está inativo.');
 if(store.activeForMember(source.id)||target&&store.activeForMember(target.id))fail('Encerre a sessão dos clientes envolvidos antes de movimentar o saldo.');
 const seconds=input.all===true?source.creditSeconds:integer(input.minutes,1,43200,'Minutos')*60;
 if(!Number.isSafeInteger(seconds)||seconds<=0||seconds>source.creditSeconds)fail('Saldo insuficiente.');
 if(target&&!Number.isSafeInteger(target.creditSeconds+seconds))fail('Saldo de destino inválido.');
 return store.change(actor,'saldo',`${type==='transfer'?'Transferência':'Remoção'}: @${source.username}${target?' → @'+target.username:''}; ${seconds} segundos; ${reason}`,()=>{
  const at=Date.now(),record={id:id(),type,memberId:source.id,memberUsername:source.username,targetId:target?.id||null,targetUsername:target?.username||null,seconds,reason,actor,at,sourceBefore:source.creditSeconds,targetBefore:target?.creditSeconds??null};
  source.creditSeconds-=seconds;if(target)target.creditSeconds+=seconds;
  // An adjusted balance cannot subsequently be refunded as an untouched purchase.
  for(const sale of store.state.sales)if(sale.memberId===source.id&&sale.status!=='canceled'&&!sale.usedAt)sale.balanceAdjustedAt??=at;
  record.sourceAfter=source.creditSeconds;record.targetAfter=target?.creditSeconds??null;
  (store.state.balanceAdjustments??=[]).push(record);return record;
 });
}
function history(store,q){const nick=String(q.nick||'').trim().toLowerCase(),items=(store.state.balanceAdjustments||[]).filter(r=>!nick||r.memberUsername?.toLowerCase().includes(nick)||r.targetUsername?.toLowerCase().includes(nick)).slice().reverse();const pages=Math.max(1,Math.ceil(items.length/100)),page=Math.min(pages,Math.max(1,Number.parseInt(q.page)||1));return {items:items.slice((page-1)*100,page*100),page,pages,total:items.length};}
module.exports={payment,methods,adjust,history};
