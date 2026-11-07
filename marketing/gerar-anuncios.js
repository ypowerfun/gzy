// Uso (com Playwright instalado): node marketing/gerar-anuncios.js — refaz as imagens de marketing/anuncios a partir do site.
// Gera as peças de anúncio do GameZoney (Instagram/Facebook/WhatsApp/Google) no estilo "patrocinado" com selos de recursos.
const {chromium} = require('playwright'), fs = require('fs'), path = require('path');
const PUB = '/home/user/gzy/site/public', OUT = '/home/user/gzy/marketing/anuncios';
fs.mkdirSync(OUT, {recursive: true});
const b64 = (f, t) => `data:${t};base64,` + fs.readFileSync(path.join(PUB, f)).toString('base64');
const hero = b64('img/hero-arena.jpg', 'image/jpeg'), logo = b64('logo-gamezoney.png', 'image/png');
const shot = n => b64(`img/telas/${n}-pt.jpg`, 'image/jpeg');
const GOLD = 'linear-gradient(180deg,#FFEC6C,#FDD034 55%,#F0B11E)';
const ICON = {
  pc: '<svg viewBox="0 0 48 48"><rect x="4" y="7" width="40" height="26" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M17 41h14M24 33v8" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M15 20h8M19 16v8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="31" cy="18" r="2.2" fill="currentColor"/><circle cx="35" cy="22" r="2.2" fill="currentColor"/></svg>',
  caixa: '<svg viewBox="0 0 48 48"><rect x="6" y="18" width="36" height="22" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M12 18V8h18v10" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M16 13h10M14 27h4M22 27h4M30 27h4M14 33h20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  trofeu: '<svg viewBox="0 0 48 48"><path d="M14 6h20v12a10 10 0 0 1-20 0z" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M14 10H7v4a7 7 0 0 0 7 7M34 10h7v4a7 7 0 0 1-7 7M24 28v8M16 42h16M18 36h12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>',
  relogio: '<svg viewBox="0 0 48 48"><circle cx="24" cy="26" r="16" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M24 17v10l7 4M19 5h10" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>',
  cadeado: '<svg viewBox="0 0 48 48"><rect x="9" y="21" width="30" height="21" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="24" cy="31" r="3" fill="currentColor"/></svg>',
  wifi: '<svg viewBox="0 0 48 48"><path d="M6 18a26 26 0 0 1 36 0M12 25a17 17 0 0 1 24 0M18 32a8 8 0 0 1 12 0" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="39" r="3" fill="currentColor"/></svg>'
};
const TILES = [['pc', 'PCs e<br>Consoles'], ['caixa', 'Caixa<br>e PDV'], ['trofeu', 'Fidelidade<br>e Corujão'], ['relogio', 'Teste grátis<br>30 dias']];
const tiles = (list, size) => `<div style="display:flex;gap:${size * .12}px;justify-content:center">${list.map(([i, t]) => `<div style="width:${size}px;height:${size * 1.02}px;border-radius:${size * .1}px;border:3px solid #FDD034;background:linear-gradient(180deg,rgba(40,32,10,.92),rgba(14,14,16,.94));box-shadow:0 0 ${size * .2}px rgba(253,208,52,.35),inset 0 0 ${size * .15}px rgba(253,208,52,.18);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${size * .08}px"><div style="width:${size * .4}px;height:${size * .4}px;color:#FDD034">${ICON[i]}</div><div style="font-weight:800;font-size:${size * .15}px;line-height:1.12;text-align:center;color:#fff">${t}</div></div>`).join('')}</div>`;
const page = (w, h, body) => `<html><head><style>*{box-sizing:border-box}body{margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:Inter,'Inter Display',Arial,sans-serif;background:#07090d;color:#fff}svg{width:100%;height:100%;display:block}.g{background:${GOLD};-webkit-background-clip:text;background-clip:text;color:transparent}</style></head><body><div style="position:absolute;inset:0;background:url(${hero}) center/cover;filter:brightness(.38) saturate(1.1)"></div><div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,rgba(253,208,52,.16),transparent 60%),linear-gradient(180deg,rgba(7,9,13,.55),rgba(7,9,13,.25) 40%,rgba(7,9,13,.92))"></div>${body}</body></html>`;
const frame = (img, w, rot = -3) => `<div style="width:${w}px;border-radius:18px;border:4px solid #FDD034;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 60px rgba(253,208,52,.35);transform:rotate(${rot}deg)"><img src="${img}" style="width:100%;display:block"></div>`;
const PECAS = {
  // Instagram/Facebook feed 4:5
  'feed-1080x1350-recursos': [1080, 1350, `<div style="position:absolute;inset:0;padding:70px 60px;display:flex;flex-direction:column;align-items:center">
    <img src="${logo}" style="width:360px"><div style="margin-top:44px;font-size:96px;font-weight:900;font-style:italic;line-height:.98;text-align:center;letter-spacing:-2px">SISTEMA PARA<br><span class="g">LAN HOUSE</span></div>
    <div style="margin-top:14px;font-size:44px;font-weight:600;color:#e7eaf0">e Arena Gamer</div>
    <div style="margin-top:46px">${frame(shot('painel'), 760)}</div>
    <div style="position:absolute;bottom:70px;left:0;right:0">${tiles(TILES, 220)}</div></div>`],
  'feed-1080x1350-pc-trava': [1080, 1350, `<div style="position:absolute;inset:0;padding:80px 70px">
    <img src="${logo}" style="width:300px"><div style="margin-top:70px;font-size:92px;font-weight:900;font-style:italic;line-height:1;letter-spacing:-2px">O tempo<br>acabou?<br><span class="g">O PC trava<br>sozinho.</span></div>
    <div style="margin-top:36px;font-size:40px;line-height:1.35;color:#e7eaf0;max-width:860px">Sem discussão no balcão. PCs e consoles liberam quando o cliente paga e bloqueiam no fim do tempo.</div>
    <div style="position:absolute;right:70px;top:300px;width:230px;height:230px;color:#FDD034;filter:drop-shadow(0 0 30px rgba(253,208,52,.6))">${ICON.cadeado}</div>
    <div style="position:absolute;bottom:80px;left:70px;right:70px;display:flex;align-items:center;justify-content:space-between"><div style="padding:30px 46px;border-radius:18px;background:${GOLD};color:#141008;font-size:44px;font-weight:900">Teste grátis 30 dias</div><div style="font-size:40px;font-weight:800">gamezoney.com</div></div></div>`],
  // Stories / Reels / Status do WhatsApp 9:16 (topo e base livres para os botões do app)
  'story-1080x1920': [1080, 1920, `<div style="position:absolute;inset:0;padding:260px 60px 0;display:flex;flex-direction:column;align-items:center">
    <img src="${logo}" style="width:380px"><div style="margin-top:50px;font-size:108px;font-weight:900;font-style:italic;line-height:.98;text-align:center;letter-spacing:-2px">SISTEMA PARA<br><span class="g">LAN HOUSE</span></div>
    <div style="margin-top:16px;font-size:48px;font-weight:600;color:#e7eaf0">e Arena Gamer</div>
    <div style="margin-top:60px">${frame(shot('painel'), 860, -2)}</div>
    <div style="margin-top:70px">${tiles(TILES, 225)}</div>
    <div style="margin-top:60px;padding:30px 60px;border-radius:20px;background:${GOLD};color:#141008;font-size:50px;font-weight:900">Teste grátis · gamezoney.com</div></div>`],
  // Facebook/Google Display quadrado
  'quadrado-1080x1080': [1080, 1080, `<div style="position:absolute;inset:0;padding:64px 60px;display:flex;flex-direction:column;align-items:center">
    <img src="${logo}" style="width:330px"><div style="margin-top:40px;font-size:92px;font-weight:900;font-style:italic;line-height:.98;text-align:center;letter-spacing:-2px">SISTEMA PARA<br><span class="g">LAN HOUSE</span></div>
    <div style="margin-top:14px;font-size:42px;font-weight:600;color:#e7eaf0">PCs, consoles, caixa e fidelidade</div>
    <div style="position:absolute;bottom:64px;left:0;right:0">${tiles(TILES, 215)}</div></div>`],
  // Google Display / link do Facebook 1,91:1
  'paisagem-1200x628': [1200, 628, `<div style="position:absolute;inset:0;padding:50px 56px">
    <img src="${logo}" style="width:250px"><div style="margin-top:30px;font-size:70px;font-weight:900;font-style:italic;line-height:.98;letter-spacing:-1.5px">SISTEMA PARA<br><span class="g">LAN HOUSE</span></div>
    <div style="margin-top:14px;font-size:30px;color:#e7eaf0;max-width:560px">PCs, consoles, recargas, PDV, caixa e fidelidade em um só sistema.</div>
    <div style="margin-top:28px;display:inline-block;padding:16px 30px;border-radius:12px;background:${GOLD};color:#141008;font-size:28px;font-weight:900">Teste grátis 30 dias</div>
    <div style="position:absolute;right:40px;top:90px">${frame(shot('painel'), 500, -3)}</div></div>`]
};
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  for (const [name, [w, h, body]] of Object.entries(PECAS)) {
    await p.setViewportSize({width: w, height: h}); await p.setContent(page(w, h, body)); await p.waitForTimeout(300);
    await p.screenshot({path: path.join(OUT, `gamezoney-${name}.jpg`), type: 'jpeg', quality: 90});
  }
  await b.close(); for (const f of fs.readdirSync(OUT)) console.log(f, fs.statSync(path.join(OUT, f)).size);
})();
