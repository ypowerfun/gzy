'use strict';
// 1.3.3 (plano Pro): Configuração › Personalizar visual — logo do Servidor e dos PCs (PNG) e cor de destaque.
// A cor é sugerida a partir da logo (tom mais presente e saturado) e pode ser ajustada. Só muda a aparência.
const GZ_BRAND_DEFAULT = '#d4a017';
function gzHex(r, g, b) { return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }
// cor principal de uma logo: histograma de matiz dos pixels opacos e coloridos (ignora preto, branco e cinza)
function gzLogoColor(img) {
  const c = document.createElement('canvas'), n = 96; c.width = n; c.height = n;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, n, n);
  const px = g.getImageData(0, 0, n, n).data, buckets = Array.from({length: 24}, () => ({w: 0, r: 0, g: 0, b: 0}));
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], gg = px[i + 1], b = px[i + 2], a = px[i + 3]; if (a < 180) continue;
    const max = Math.max(r, gg, b) / 255, min = Math.min(r, gg, b) / 255, l = (max + min) / 2, d = max - min;
    if (d < .12 || l < .14 || l > .93) continue;
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === r / 255 ? ((gg - b) / 255 / d) % 6 : max === gg / 255 ? (b - r) / 255 / d + 2 : (r - gg) / 255 / d + 4; h = (h * 60 + 360) % 360;
    const k = Math.floor(h / 15), w = s * (1 - Math.abs(l - .55));
    Object.assign(buckets[k], {w: buckets[k].w + w, r: buckets[k].r + r * w, g: buckets[k].g + gg * w, b: buckets[k].b + b * w});
  }
  const best = buckets.reduce((a, b) => (b.w > a.w ? b : a));
  if (!best.w) return null;
  let [r, g2, b] = [best.r / best.w, best.g / best.w, best.b / best.w];
  // claro o suficiente para aparecer sobre o fundo escuro
  const lum = (.2126 * r + .7152 * g2 + .0722 * b) / 255;
  if (lum < .42) { const f = .42 / Math.max(lum, .05); [r, g2, b] = [r, g2, b].map(v => v + (255 - v) * Math.min(.6, (f - 1) * .35)); }
  return gzHex(r, g2, b);
}
function gzReadPng(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.type !== 'image/png' && !/\.png$/i.test(file.name)) return reject(new Error('Envie a logo em PNG.'));
    if (file.size > 1024 * 1024) return reject(new Error('Logo muito grande: até 1 MB.'));
    const fr = new FileReader(); fr.onerror = () => reject(new Error('Não foi possível ler a logo.'));
    fr.onload = () => { const img = new Image(); img.onload = () => resolve({data: fr.result, img}); img.onerror = () => reject(new Error('O arquivo não é um PNG válido.')); img.src = fr.result; };
    fr.readAsDataURL(file);
  });
}
async function renderBranding(box) {
  if (!box || !isAdmin()) return;
  let st; try { st = await api('/branding'); } catch (e) { box.innerHTML = ''; return; }
  const locked = !st.allowed, color = st.color || GZ_BRAND_DEFAULT;
  box.innerHTML = `<section class="panel" id="brand-section"><h2>Personalizar visual</h2>
    ${locked ? '<p class="hint" style="color:#ffb84d">🔒 Disponível no plano Pro. Entre com a sua conta gamezoney.com do plano Pro em Configuração › Licença para liberar.</p>' : ''}
    <p class="hint">Troque a logo GameZoney pela logo da sua arena no painel e nos PCs, e escolha a cor de destaque (o dourado). O fundo escuro e as cores de aviso continuam iguais, para tudo seguir legível. Só muda a aparência: nada do funcionamento é alterado.</p>
    ${st.enabled && !locked ? '<p class="hint" style="color:var(--green)">✔ Visual personalizado ativo.</p>' : st.enabled && locked ? '<p class="hint">Visual personalizado guardado: volta a valer quando o plano Pro estiver ativo.</p>' : ''}
    <form id="brand-form" class="brand-form">
      <label>Logo do Servidor (painel) — PNG até 1 MB<input type="file" name="server" accept="image/png"></label>
      <label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="same" style="width:auto" ${st.clientLogo ? '' : 'checked'}> Usar a mesma logo nos PCs</label>
      <label id="brand-client-box" class="${st.clientLogo ? '' : 'hidden'}">Logo dos PCs (GameZoney Cliente) — PNG até 1 MB<input type="file" name="client" accept="image/png"></label>
      <label>Cor de destaque<span style="display:flex;gap:10px;align-items:center"><input type="color" name="color" value="${esc(color)}" style="width:64px;height:40px;padding:2px"><input name="hex" value="${esc(color)}" maxlength="7" style="width:120px" aria-label="Cor em hexadecimal"><small class="subtext" id="brand-suggest"></small></span></label>
      <div class="brand-preview" id="brand-preview" aria-label="Prévia"><img id="brand-preview-logo" alt="" src="/logo-gamezoney.png?v=${esc(String(st.rev || 0))}"><div><strong class="brand-preview-title">Painel de controle</strong><span class="brand-preview-line"></span><button type="button" class="brand-preview-btn" tabindex="-1">Liberar tempo</button></div></div>
      <div class="dialog-actions" style="justify-content:flex-start;flex-wrap:wrap"><button class="primary" style="flex:0 0 auto">Aplicar visual</button><button type="button" id="brand-reset" style="flex:0 0 auto">Voltar ao padrão GameZoney</button></div>
      <p class="hint">Os PCs recebem o visual novo sozinhos e aplicam quando o GameZoney Cliente abrir de novo (ex.: ao reiniciar o PC).</p>
    </form></section>`;
  const f = box.querySelector('#brand-form'), prev = box.querySelector('#brand-preview');
  const paint = c => { prev.style.setProperty('--brand', c); f.color.value = c; f.hex.value = c; };
  paint(color);
  f.same.onchange = () => box.querySelector('#brand-client-box').classList.toggle('hidden', f.same.checked);
  f.color.oninput = () => paint(f.color.value);
  f.hex.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(f.hex.value.trim())) paint(f.hex.value.trim().toLowerCase()); };
  let serverData = '', clientData = '';
  f.server.onchange = async () => {
    try { const r = await gzReadPng(f.server.files[0]); if (!r) return; serverData = r.data; box.querySelector('#brand-preview-logo').src = r.data;
      const sug = gzLogoColor(r.img); if (sug) { paint(sug); box.querySelector('#brand-suggest').textContent = 'Cor sugerida pela logo: ' + sug; } }
    catch (e) { f.server.value = ''; toast(e.message); }
  };
  f.client.onchange = async () => { try { const r = await gzReadPng(f.client.files[0]); clientData = r ? r.data : ''; } catch (e) { f.client.value = ''; toast(e.message); } };
  f.onsubmit = async e => {
    e.preventDefault(); const btn = f.querySelector('button.primary'); btn.disabled = true;
    try {
      await api('/branding', {color: f.color.value, serverLogo: serverData || undefined, clientLogo: f.same.checked ? undefined : (clientData || undefined), sameLogo: f.same.checked && !!serverData});
      toast('Visual aplicado. Recarregando o painel…'); setTimeout(() => location.reload(), 600);
    } catch (err) { toast(err.message); btn.disabled = false; }
  };
  box.querySelector('#brand-reset').onclick = async () => {
    if (!await ask('Voltar ao visual padrão GameZoney? As logos enviadas são apagadas e os PCs voltam ao visual GameZoney.')) return;
    try { await api('/branding/reset', {}); toast('Visual padrão GameZoney restaurado.'); setTimeout(() => location.reload(), 600); } catch (err) { toast(err.message); }
  };
  if (locked) f.querySelectorAll('input,button.primary').forEach(x => x.disabled = true);
}
