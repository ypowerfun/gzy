const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store,verify}=require('../store');
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'prime-member-'));const s=new Store(directory);t.after(()=>{s.close();fs.rmSync(directory,{recursive:true,force:true})});return s}
test('Nick único sem distinção de maiúsculas; senha protegida, persistente e ausente do painel/log',t=>{
 const s=fixture(t);const m=s.memberSave({name:'Fulano',username:'Fulano.PS4',password:'Senha-Original-123',phone:'92999999999'},'admin');
 assert(verify('Senha-Original-123',m.passwordHash));assert.equal(m.passwordScheme,'scrypt-v1');
 assert.throws(()=>s.memberSave({name:'Outro',username:'fulano.ps4',password:'Outra-Senha-123'},'admin'),/já está cadastrado/);
 const pending=s.memberSave({name:'Sem senha',username:'semsenha'},'admin');assert.equal(s.publicMember(pending).hasPassword,false);// 3.0.39: senha do cliente de 4 a 20 caracteres
 assert.throws(()=>s.memberSave({name:'Curta',username:'curta',password:'abc'},'admin'),/4 a 20/);assert.throws(()=>s.memberSave({name:'Longa',username:'longa',password:'a'.repeat(21)},'admin'),/4 a 20/);const short=s.memberSave({name:'Curta',username:'curta',password:'abcd'},'admin');assert(verify('abcd',short.passwordHash));const long=s.memberSave({name:'Longa',username:'longa',password:'b'.repeat(20)},'admin');assert(verify('b'.repeat(20),long.passwordHash));
 assert.throws(()=>s.memberSave({name:'Sem nick',password:'Outra-Senha-123'},'admin'),/Nick/);
 const publicData=JSON.stringify(s.snapshot());assert(!publicData.includes(m.passwordHash));assert(!publicData.includes('Senha-Original'));assert(!publicData.includes('passwordScheme'));assert(s.publicMember(m).hasPassword);
 assert(!JSON.stringify(s.logs()).includes('Senha-Original'));
 const reopened=new Store(s.directory);assert(verify('Senha-Original-123',reopened.member(m.id).passwordHash));reopened.close();
 const before=m.passwordHash;s.memberSave({id:m.id,name:'Fulano atualizado',username:'Fulano.PS4',password:'',phone:'123'},'admin');assert.equal(s.member(m.id).passwordHash,before);
 s.memberSave({id:m.id,name:'Fulano',username:'Fulano.PS4',password:'Nova-Senha-123'},'admin');assert(verify('Nova-Senha-123',s.member(m.id).passwordHash));assert(!verify('Senha-Original-123',s.member(m.id).passwordHash));
});
test('Cadastros antigos mantêm saldo e sessões de TV sem senha; podem receber credenciais depois',t=>{
 const s=fixture(t);s.state.members.push({id:'old',name:'Cliente antigo',creditSeconds:600,active:true,phone:'123',notes:'Preservar'});s.persist();
 s.memberSave({id:'old',name:'Cliente antigo editado',username:'',password:''},'admin');assert.equal(s.member('old').creditSeconds,600);assert.equal(s.member('old').notes,'Preservar');
 const session=s.start('1','old','admin');assert.equal(session.memberId,'old');s.finish('1','admin','manual',session.startedAt);
 s.memberSave({id:'old',name:'Cliente antigo',username:'cliente.antigo',password:'Senha-Nova-123'},'admin');assert.equal(s.member('old').creditSeconds,600);assert(verify('Senha-Nova-123',s.member('old').passwordHash));
});


test('CPF opcional é normalizado, validado e não pode se repetir entre clientes',t=>{
 const s=fixture(t),a=s.memberSave({name:'Ana CPF',username:'anacpf',cpf:'529.982.247-25'},'admin');
 assert.equal(a.cpf,'52998224725');
 assert.equal(s.publicMember(a).cpf,'52998224725');
 assert.throws(()=>s.memberSave({name:'CPF inválido',username:'invalido',cpf:'111.111.111-11'},'admin'),/CPF inválido/);
 assert.throws(()=>s.memberSave({name:'CPF repetido',username:'repetido',cpf:'52998224725'},'admin'),/CPF já está cadastrado/);
});
test('3.0.45: Usuário/Nick com espaço e números',()=>{
 const fs=require('fs'),os=require('os'),path=require('path'),{Store}=require('../store');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'prime-nick-'));const s=new Store(dir);
 try{
  const m=s.memberSave({name:'João',username:'  Joao   da Silva 123 ',password:'1234'},'admin');assert.equal(m.username,'Joao da Silva 123');
  assert.equal(s.memberSave({name:'Num',username:'12345'},'admin').username,'12345');
  assert.throws(()=>s.memberSave({name:'Dup',username:'joao DA silva 123'},'admin'),/já está cadastrado/);
  for(const bad of ['ab','João 1','a'.repeat(33),'nick@x'])assert.throws(()=>s.memberSave({name:'X',username:bad},'admin'),/Usuário\/Nick/);
  const imp=require('../import');assert.equal(typeof imp,'object');
 }finally{s.close();fs.rmSync(dir,{recursive:true,force:true})}
});
