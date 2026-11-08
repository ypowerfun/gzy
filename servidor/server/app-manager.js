'use strict';
// 1.0.8 (plano Pro): Configuração › Gerenciamento do App — tudo pronto para levar o Servidor para a nuvem e o gestor
// acompanhar a arena de fora da loja. Aqui ficam só os DADOS (domínio, HTTPS, hospedagem/VPS, acesso remoto e contato
// do suporte) e a lista do que falta. NUNCA guarda senhas: o suporte GameZoney pede o restante na hora, pelo AnyDesk.
// Enquanto a versão em nuvem não é ligada, o painel continua acessível só na rede local (network-guard.js não muda).
const dns = require('node:dns').promises;
const fail = m => { throw new Error(m); };
const HOST = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const HTTPS = {auto: 'Automático (Let\'s Encrypt)', own: 'Certificado próprio', none: 'Ainda não tenho'};
const OS = {linux: 'Linux (Ubuntu/Debian)', windows: 'Windows Server', other: 'Outro'};
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

function config(store) { return store.state.settings.cloudApp ||= {domain: '', https: 'none', port: 443, remoteAccess: false, host: {provider: '', address: '', os: 'linux', user: ''}, support: {anydesk: '', contact: ''}, notes: ''}; }

function save(store, input, actor) {
  const domain = clean(input.domain, 253).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (domain && !HOST.test(domain)) fail('Domínio inválido. Exemplo: arena.minhaloja.com.br');
  const https = HTTPS[input.https] ? input.https : 'none';
  const port = Number(input.port || 443); if (!Number.isInteger(port) || port < 1 || port > 65535) fail('Porta pública inválida (1 a 65535).');
  const address = clean(input.hostAddress, 253).toLowerCase();
  if (address && !HOST.test(address) && !IPV4.test(address)) fail('Endereço da hospedagem/VPS inválido (IP ou nome, ex.: 203.0.113.10).');
  const anydesk = clean(input.anydesk, 40);
  if (anydesk && !/^[0-9 ]{9,13}$|^[a-z0-9._-]{3,30}@ad$/i.test(anydesk)) fail('ID do AnyDesk inválido (9 a 10 números, ex.: 123 456 789).');
  const notes = clean(input.notes, 600);
  if (/senha|password/i.test(notes + ' ' + clean(input.hostUser, 60))) fail('Não escreva senhas aqui. O suporte GameZoney pede o que faltar na hora, pelo AnyDesk.');
  const next = {domain, https, port, remoteAccess: input.remoteAccess === true || input.remoteAccess === 'true' || input.remoteAccess === 'on',
    host: {provider: clean(input.hostProvider, 60), address, os: OS[input.hostOs] ? input.hostOs : 'linux', user: clean(input.hostUser, 60)},
    support: {anydesk, contact: clean(input.contact, 80)}, notes, updatedAt: Date.now(), updatedBy: actor};
  return store.change(actor, 'config', `Gerenciamento do App atualizado${domain ? ': ' + domain : ''}${next.remoteAccess ? ' • acesso remoto do gestor ligado' : ''}`, () => { store.state.settings.cloudApp = next; return next; });
}

async function checks(store, lookup = dns.lookup) {
  const c = config(store), list = [];
  list.push({id: 'domain', name: 'Domínio do servidor', ok: !!c.domain, detail: c.domain || 'Informe o domínio ou subdomínio (ex.: arena.minhaloja.com.br)'});
  if (c.domain) {
    let ips = []; try { ips = (await Promise.race([lookup(c.domain, {all: true}), new Promise((_, r) => setTimeout(() => r(new Error('tempo')), 4000))])).map(a => a.address); } catch { }
    const match = !c.host.address || !IPV4.test(c.host.address) || ips.includes(c.host.address);
    list.push({id: 'dns', name: 'Domínio apontando para a hospedagem', ok: ips.length > 0 && match, detail: !ips.length ? 'O domínio ainda não foi encontrado (crie o registro A no DNS do domínio)' : match ? ips.join(', ') : `${ips.join(', ')} — diferente do IP da VPS (${c.host.address})`});
  }
  list.push({id: 'https', name: 'Certificado HTTPS', ok: c.https !== 'none', detail: HTTPS[c.https]});
  list.push({id: 'host', name: 'Hospedagem / VPS', ok: !!c.host.address, detail: c.host.address ? `${c.host.provider ? c.host.provider + ' • ' : ''}${c.host.address} • ${OS[c.host.os]}` : 'Informe o IP ou o nome da VPS'});
  list.push({id: 'remote', name: 'Acesso remoto do gestor', ok: c.remoteAccess, detail: c.remoteAccess ? 'Ligado (vale quando o servidor estiver na nuvem, com verificação em duas etapas)' : 'Desligado'});
  list.push({id: 'support', name: 'Contato para o suporte GameZoney', ok: !!(c.support.anydesk || c.support.contact), detail: [c.support.anydesk && 'AnyDesk ' + c.support.anydesk, c.support.contact].filter(Boolean).join(' • ') || 'Opcional: ID do AnyDesk e WhatsApp para o suporte finalizar a configuração', optional: true});
  const missing = list.filter(x => !x.ok && !x.optional).map(x => x.name);
  return {config: c, checks: list, ready: !missing.length, missing, options: {https: HTTPS, os: OS}};
}

// texto enviado ao suporte (pelo mesmo canal do Feedback): sem senhas, só o que está na tela
function supportText(store, result, version) {
  const c = result.config;
  return ['[Gerenciamento do App] Pedido de configuração do servidor na nuvem', `Versão do servidor: ${version}`,
    `Domínio: ${c.domain || '—'} • HTTPS: ${HTTPS[c.https]} • porta ${c.port}`, `Hospedagem: ${c.host.provider || '—'} • ${c.host.address || '—'} • ${OS[c.host.os]} • usuário ${c.host.user || '—'}`,
    `Acesso remoto do gestor: ${c.remoteAccess ? 'ligado' : 'desligado'}`, `AnyDesk: ${c.support.anydesk || '—'} • Contato: ${c.support.contact || '—'}`,
    `Falta: ${result.missing.join(', ') || 'nada — pronto para ligar'}`, c.notes ? `Observações: ${c.notes}` : ''].filter(Boolean).join('\n');
}

module.exports = {config, save, checks, supportText, HTTPS, OS};
