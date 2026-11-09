'use strict';
// 1.2.5: fuso do computador do servidor; não reconhecido ou relógio ajustado à mão = horário que o computador mostra
const {test}=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),path=require('node:path');
const run=(tz,code)=>execFileSync(process.execPath,['-e',code],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ:tz,FORCE_COLOR:'0',NO_COLOR:'1'},encoding:'utf8'})/* sem códigos de cor (o gerador do Windows liga cores no Node) */.replace(/\x1b\[[0-9;]*m/g,'').trim();
test('1.2.5: fuso do servidor = o do computador; senão, o horário que o relógio do computador mostra',()=>{
  const n=require('../netinfo');
  // fuso reconhecido
  assert.equal(run('America/Sao_Paulo',"console.log(require('./netinfo').timeZone())"),'America/Sao_Paulo');
  assert.equal(run('UTC',"console.log(require('./netinfo').timeZone())"),'UTC');
  // fuso que o sistema não reconhece (antes virava America/Manaus = 1 h errado): usa a diferença do relógio da máquina
  // (TZ no formato POSIX, como 'XYZ+3', só existe no Linux; no Windows o computador fica em UTC e a regra abaixo continua valendo)
  if(process.platform!=='win32')assert.equal(run('XYZ+3',"console.log(require('./netinfo').timeZone())"),'Etc/GMT+3');
  // a hora mostrada pelo servidor é sempre a do computador
  for(const tz of ['America/Sao_Paulo','XYZ+3','America/Manaus','Asia/Tokyo','UTC'])assert.equal(run(tz,"const d=new Date(),z=require('./netinfo').timeZone();process.stdout.write(String(d.toTimeString().slice(0,5)===d.toLocaleTimeString('pt-BR',{timeZone:z}).slice(0,5)))"),'true',tz);
  // relógio ajustado à mão diferente do fuso (ex.: horário de verão desligado/ligado manualmente): vale o relógio
  const at=new Date(Date.UTC(2026,10,9,15,0)),manual=Object.assign(Object.create(Date.prototype),{getTime:()=>at.getTime(),valueOf:()=>at.getTime(),getTimezoneOffset:()=>120});
  assert.equal(n.machineZone(manual),'Etc/GMT+2');
  // diferença com meia hora (Índia/Nepal etc.)
  const half=Object.assign(Object.create(Date.prototype),{getTime:()=>at.getTime(),getTimezoneOffset:()=>-330});
  assert.equal(new Date(at).toLocaleTimeString('pt-BR',{timeZone:n.machineZone(half)}).slice(0,5),'20:30');
  assert.equal(n.zoneOffset('America/Sao_Paulo',at),-180);
  // 1.2.7: fuso pelo país da instalação (região/idioma do Windows), com o nome certo e a diferença do relógio
  const clock=o=>Object.assign(Object.create(Date.prototype),{getTime:()=>at.getTime(),getTimezoneOffset:()=>o});
  for(const [cc,o,z] of [['BR',120,'America/Noronha'],['BR',180,'America/Sao_Paulo'],['BR',240,'America/Manaus'],['BR',300,'America/Rio_Branco'],['AR',180,'America/Argentina/Buenos_Aires'],['BO',240,'America/La_Paz'],['PE',300,'America/Lima'],['UY',180,'America/Montevideo'],['VE',240,'America/Caracas'],['CO',300,'America/Bogota'],['US',300,'America/New_York'],['US',480,'America/Los_Angeles'],['MX',360,'America/Mexico_City'],['PT',0,'Europe/Lisbon']])
    assert.equal(n.countryZone(cc,clock(o)),z,cc+' UTC'+(-o/60));
  assert.equal(n.countryZone('PY',clock(-n.zoneOffset('America/Asuncion',at))),'America/Asuncion');
  assert.equal(n.countryZone('XX',clock(180)),'','país desconhecido: sem nome');
  assert.equal(n.timeZone(clock(240),'BR'),'America/Manaus','relógio do computador em UTC−4 no Brasil = Amazonas');
  assert.equal(n.timeZone(clock(-345),''),'+05:45','sem país: diferença do relógio (UTC+5:45, que nenhum PC do gerador usa)');
  for(const z of Object.values(n.COUNTRY_ZONES).flat())assert.doesNotThrow(()=>new Intl.DateTimeFormat('pt-BR',{timeZone:z}),z);
  if(process.platform!=='win32'){const env=(tz,lang)=>execFileSync(process.execPath,['-e',"process.stdout.write(require('./netinfo').timeZone())"],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ:tz,LANG:lang,LC_ALL:'',FORCE_COLOR:'0'},encoding:'utf8'});
    assert.equal(env('XYZ+3','pt_BR.UTF-8'),'America/Sao_Paulo');assert.equal(env('XYZ+5','pt_BR.UTF-8'),'America/Rio_Branco');assert.equal(env('XYZ+3','es_AR.UTF-8'),'America/Argentina/Buenos_Aires');}
});
