'use strict';
// GameZoney — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 1.3.3 (plano Pro): "Personalizar visual". A arena envia a logo (PNG) do Servidor e/ou do Cliente e escolhe a cor de
// destaque (sugerida a partir da logo no painel). Só muda a APARÊNCIA:
//  - Painel: /logo-gamezoney.png passa a ser a logo da arena e os tons dourados dos CSS viram tons da cor escolhida
//    (mesma claridade relativa de cada tom; o fundo escuro, os textos e as cores de alerta/aviso não mudam).
//  - Cliente (PCs): recebe a revisão em /pc/state (branding.rev) e baixa logo + cor por /pc/branding.
//  - Sem o Pro (plano vencido/trocado) volta sozinho ao visual GameZoney; os arquivos ficam guardados.
//  - "Voltar ao padrão GameZoney" apaga a personalização (vale sem o Pro).
const fs = require('node:fs'), path = require('node:path');
const {fail} = require('./store');

const MAX_BYTES = 1024 * 1024, MAX_SIDE = 2048, MIN_SIDE = 16;
const PRO_MSG = 'Personalizar visual: disponível no plano Pro. Entre com a conta gamezoney.com do plano Pro em Configuração › Licença.';

// ---------- cores ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; if (!s) return [l * 255, l * 255, l * 255];
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p); };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
// luminância relativa (WCAG)
const luminance = hex => { const [r, g, b] = hexToRgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const BASE = rgbToHsl(...hexToRgb('#d4a017')); // dourado de destaque do GameZoney (h 43,6°, s ~80%, l ~46%)
// tom dourado do GameZoney? (matiz 39–52°, saturado, nem quase preto nem quase branco). Âmbar de aviso (#f2a93b, ~36°) fica fora.
const isGold = ([h, s, l]) => h >= 39 && h <= 52 && s >= .45 && l >= .12 && l <= .9;
function mapColor(rgb, target) {
  const hsl = rgbToHsl(...rgb); if (!isGold(hsl)) return null;
  const [th, ts, tl] = target;
  // mantém a diferença de matiz/saturação/claridade de cada tom em relação ao dourado base (cor padrão = visual igual)
  return hslToRgb(th + (hsl[0] - BASE[0]), clamp(ts * hsl[1] / BASE[1], 0, 1), clamp(hsl[2] + (tl - BASE[2]), .04, .96));
}
function recolor(text, color) {
  const target = rgbToHsl(...hexToRgb(color));
  return String(text)
    .replace(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi, m => { const c = mapColor(hexToRgb(m), target); return c ? rgbToHex(...c) : m; })
    .replace(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*[\d.]+\s*)?\)/gi, (m, r, g, b, a) => {
      const c = mapColor([+r, +g, +b], target); if (!c) return m; const [x, y, z] = c.map(Math.round);
      return a ? `rgba(${x},${y},${z}${a.replace(/\s+/g, '')})` : `rgb(${x},${y},${z})`;
    });
}

// ---------- PNG ----------
function decodePng(data) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(String(data || ''));
  if (!m) fail('Envie a logo em PNG.');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > MAX_BYTES) fail('Logo muito grande: até 1 MB.');
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 33 || !sig.every((b, i) => buf[i] === b) || buf.toString('latin1', 12, 16) !== 'IHDR') fail('O arquivo não é um PNG válido.');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (w < MIN_SIDE || h < MIN_SIDE || w > MAX_SIDE || h > MAX_SIDE) fail(`A logo deve ter de ${MIN_SIDE} a ${MAX_SIDE} pixels de largura e altura.`);
  return buf;
}

module.exports = function branding(store, options = {}) {
  const dir = path.join(options.directory || '.', 'branding');
  const allowed = () => (options.allowed ? !!options.allowed() : true);
  const cfg = () => (store.state.settings.branding ??= {});
  const file = which => path.join(dir, which + '.png');
  const has = which => !!cfg()[which] && fs.existsSync(file(which));
  const active = () => allowed() && !!cfg().enabled;
  const clientLogo = () => (has('client') ? 'client' : has('server') ? 'server' : null);

  function status() {
    const c = cfg();
    return {allowed: allowed(), enabled: !!c.enabled, active: active(), color: c.color || '', serverLogo: has('server'), clientLogo: has('client'), rev: c.rev || 0,
      serverV: c.server?.v || 0, clientV: c.client?.v || 0};
  }
  function save(input, actor) {
    if (!allowed()) fail(PRO_MSG);
    const color = String(input.color || '').trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) fail('Escolha a cor de destaque.');
    // a cor fica sobre o fundo escuro: muito escura deixa botões e títulos ilegíveis
    if (luminance(color) < 0.09) fail('Cor muito escura para o fundo escuro do GameZoney: escolha um tom mais claro para os textos continuarem legíveis.');
    const writes = {};
    for (const [key, which] of [['serverLogo', 'server'], ['clientLogo', 'client']]) {
      if (input[key] === undefined || input[key] === '') continue;           // mantém
      writes[which] = input[key] === null ? null : decodePng(input[key]);     // null = remover
    }
    if (input.sameLogo && writes.server) writes.client = writes.server;
    const will = which => (writes[which] !== undefined ? !!writes[which] : has(which));
    if (!will('server') && !will('client')) fail('Envie pelo menos uma logo em PNG.');
    fs.mkdirSync(dir, {recursive: true});
    return store.change(actor, 'config', `Visual personalizado aplicado (cor ${color})`, () => {
      const c = cfg(), now = Date.now();
      for (const [which, buf] of Object.entries(writes)) {
        if (buf === null) { try { fs.rmSync(file(which), {force: true}); } catch { } delete c[which]; continue; }
        fs.writeFileSync(file(which) + '.tmp', buf); fs.renameSync(file(which) + '.tmp', file(which)); c[which] = {v: now};
      }
      Object.assign(c, {enabled: true, color, rev: now});
      return status();
    });
  }
  function reset(actor) {
    return store.change(actor, 'config', 'Visual voltou ao padrão GameZoney', () => {
      for (const which of ['server', 'client']) { try { fs.rmSync(file(which), {force: true}); } catch { } }
      store.state.settings.branding = {enabled: false, rev: Date.now()};
      return status();
    });
  }
  // PCs: revisão a comparar no /pc/state ('' = visual padrão) e os dados no /pc/branding
  const pcRev = () => (active() ? String(cfg().rev || 0) : '');
  function pcData() {
    if (!active()) return {rev: '', color: '', logo: ''};
    const which = clientLogo();
    return {rev: pcRev(), color: cfg().color, logo: which ? fs.readFileSync(file(which)).toString('base64') : ''};
  }
  // painel
  const serverLogoFile = () => (active() && has('server') ? file('server') : null);
  const css = text => (active() ? recolor(text, cfg().color) : text);
  const version = () => (active() ? String(cfg().rev || 0) : '0');
  return {status, save, reset, pcRev, pcData, serverLogoFile, css, version, active};
};
module.exports.recolor = recolor;
module.exports.decodePng = decodePng;
module.exports.luminance = luminance;
