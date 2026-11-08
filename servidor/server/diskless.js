'use strict';
// 1.0.9: Boot pela rede (diskless) — PRÉ-CONFIGURAÇÃO. O GameZoney não é o servidor de imagem: o disco dos PCs fica num
// servidor de imagem separado (iSCSI + PXE, ex.: CCBoot, iCafeCloud ou outro). Aqui ficam os dados desse servidor, quais
// PCs dão boot pela rede e a conferência se ele responde (porta iSCSI). Com o Wake-on-LAN, "Ligar todos" liga os PCs e
// eles carregam o Windows da imagem. O GameZoney Cliente vai instalado DENTRO da imagem (cada PC continua com o seu nome).
const net = require('node:net');
const {fail} = require('./store');
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const PRODUCTS = {ccboot: 'CCBoot', icafecloud: 'iCafeCloud', outro: 'Outro (iSCSI + PXE)'};
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

function config(store) { return store.state.settings.diskless ||= {enabled: false, product: 'outro', serverIp: '', port: 3260, pxeIp: '', image: '', stations: [], notes: ''}; }
function save(store, input, actor) {
  const serverIp = clean(input.serverIp, 15), pxeIp = clean(input.pxeIp, 15);
  if (serverIp && !IPV4.test(serverIp)) fail('IP do servidor de imagem inválido (ex.: 192.168.0.10).');
  if (pxeIp && !IPV4.test(pxeIp)) fail('IP do servidor PXE inválido.');
  const port = Number(input.port || 3260); if (!Number.isInteger(port) || port < 1 || port > 65535) fail('Porta iSCSI inválida (padrão 3260).');
  const ids = new Set(store.state.stations.filter(s => s.kind === 'computer' && !s.removedAt).map(s => s.id));
  const stations = (Array.isArray(input.stations) ? input.stations : []).map(String).filter(id => ids.has(id));
  const notes = clean(input.notes, 600); if (/senha|password/i.test(notes)) fail('Não escreva senhas aqui.');
  const next = {enabled: input.enabled === true || input.enabled === 'true', product: PRODUCTS[input.product] ? input.product : 'outro', serverIp, port, pxeIp, image: clean(input.image, 80), stations, notes, updatedAt: Date.now()};
  return store.change(actor, 'config', `Boot pela rede ${next.enabled ? 'ligado' : 'desligado'}${serverIp ? ' • servidor de imagem ' + serverIp : ''} • ${stations.length} PC(s)`, () => { store.state.settings.diskless = next; return next; });
}
const probe = (host, port, ms = 2500) => new Promise(resolve => { const s = net.connect({host, port}); const end = ok => { s.destroy(); resolve(ok); }; s.setTimeout(ms, () => end(false)); s.once('connect', () => end(true)); s.once('error', () => end(false)); });
async function status(store) {
  const c = config(store), checks = [];
  checks.push({name: 'Servidor de imagem', ok: !!c.serverIp, detail: c.serverIp ? `${PRODUCTS[c.product]} • ${c.serverIp}` : 'Informe o IP do servidor de imagem'});
  if (c.serverIp) { const ok = await probe(c.serverIp, c.port); checks.push({name: 'Servidor de imagem respondendo', ok, detail: ok ? `porta ${c.port} aberta` : `sem resposta na porta ${c.port} (servidor desligado, firewall ou IP errado)`}); }
  checks.push({name: 'PCs com boot pela rede', ok: c.stations.length > 0, detail: c.stations.length ? `${c.stations.length} PC(s)` : 'Marque os PCs que vão dar boot pela rede'});
  const noMac = store.state.stations.filter(s => c.stations.includes(s.id) && !(s.network?.list || []).length).map(s => s.name);
  checks.push({name: 'Ligar pela rede (Wake-on-LAN)', ok: !noMac.length && c.stations.length > 0, detail: !c.stations.length ? 'Marque os PCs que vão dar boot pela rede' : noMac.length ? 'Sem MAC ainda: ' + noMac.slice(0, 6).join(', ') + (noMac.length > 6 ? '…' : '') : 'Pronto'});
  return {config: c, checks, products: PRODUCTS, computers: store.state.stations.filter(s => s.kind === 'computer' && !s.removedAt).map(s => ({id: s.id, name: s.name, mac: (s.network?.list || [])[0]?.mac || ''}))};
}
module.exports = {config, save, status, PRODUCTS};
