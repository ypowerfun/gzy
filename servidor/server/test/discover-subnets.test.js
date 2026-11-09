'use strict';
// 1.0.19 (Cliente): busca da recepção em outras faixas (roteadores, switches, Wi-Fi da arena)
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),dgram=require('node:dgram');
const dir=['GameZoneyCliente_MOD','../cliente/windows-client-1.0.5'].map(d=>path.resolve(__dirname,'..','..',d)).find(d=>fs.existsSync(path.join(d,'discover.js')));
const discover=require(path.join(dir,'discover.js'));
test('1.0.19: faixas procuradas por unicast e IP digitado',async()=>{
  assert.deepEqual(discover.prefixesFor({known:'https://192.168.0.10:3443'}),['192.168.0']);
  assert.deepEqual(discover.prefixesFor({known:'https://8.8.8.8:3443'}),[],'nunca procura fora da rede privada');
  const wide=discover.prefixesFor({wide:true});assert.ok(wide.includes('192.168.0')&&wide.includes('192.168.1')&&wide.includes('10.0.0')&&wide.includes('172.16.0'));assert.ok(wide.length<=64);
  await assert.rejects(discover({target:'meu-servidor'}),/IP do servidor/);
  // IP digitado: pergunta direto (unicast) e aceita só resposta válida com a mesma "senha" da pergunta
  const fake=dgram.createSocket('udp4');await new Promise(r=>fake.bind(0,'127.0.0.1',r));
  fake.on('message',(b,rem)=>{const q=JSON.parse(b);fake.send(Buffer.from(JSON.stringify({app:'gamezoney-server',version:1,nonce:q.nonce,port:3443,fingerprint:'A'.repeat(64),name:'Recepção'})),rem.port,rem.address);fake.send(Buffer.from(JSON.stringify({app:'gamezoney-server',version:1,nonce:'x'.repeat(32),port:3443,fingerprint:'B'.repeat(64)})),rem.port,rem.address);});
  const r=await discover({target:'127.0.0.1',port:fake.address().port});fake.close();
  assert.equal(r.servers.length,1);assert.equal(r.servers[0].server,'https://127.0.0.1:3443');assert.equal(r.servers[0].fingerprint,'A'.repeat(64));
});
