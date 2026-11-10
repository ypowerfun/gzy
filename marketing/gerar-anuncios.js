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
  // 2026-11: ícones das novidades (Servidor 1.0.9 / Cliente 1.0.7)
  power: '<svg viewBox="0 0 48 48"><path d="M24 6v16" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M14 12a15 15 0 1 0 20 0" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>',
  impressora: '<svg viewBox="0 0 48 48"><path d="M14 18V6h20v12" fill="none" stroke="currentColor" stroke-width="3.5"/><rect x="6" y="18" width="36" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M14 28h20v14H14z" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M19 34h10M19 38h7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  nota: '<svg viewBox="0 0 48 48"><path d="M11 5h18l9 9v29H11z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M29 5v9h9M17 22h14M17 29h14M17 36h9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  lojas: '<svg viewBox="0 0 48 48"><path d="M5 18 9 8h30l4 10" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M5 18h38v4a6 6 0 0 1-12 0 6 6 0 0 1-12 0 6 6 0 0 1-14 0z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M9 28v14h30V28M20 42V33h8v9" fill="none" stroke="currentColor" stroke-width="3.5"/></svg>',
  foto: '<svg viewBox="0 0 48 48"><rect x="5" y="13" width="38" height="27" rx="4" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M17 13l3-6h8l3 6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><circle cx="24" cy="26" r="7" fill="none" stroke="currentColor" stroke-width="3.5"/></svg>',
  troca: '<svg viewBox="0 0 48 48"><path d="M8 16h28l-7-7M40 32H12l7 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // 2026-11-10: PIX no PC, leitor de código de barras e aviso de tempo
  pix: '<svg viewBox="0 0 48 48"><path d="M24 4 44 24 24 44 4 24z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M16 24l8-8 8 8-8 8z" fill="currentColor"/></svg>',
  barras: '<svg viewBox="0 0 48 48"><path d="M8 10v28M13 10v28M19 10v28M22 10v28M28 10v28M34 10v28M37 10v28M41 10v28" stroke="currentColor" stroke-width="3"/><path d="M4 24h40" stroke="#ff4d4d" stroke-width="2.5"/></svg>',
  aviso: '<svg viewBox="0 0 48 48"><rect x="4" y="7" width="40" height="26" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M17 41h14M24 33v8" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M24 13v9M24 26v1" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  vr: '<svg viewBox="0 0 48 48"><path d="M5 17a4 4 0 0 1 4-4h30a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4h-9l-3-5h-6l-3 5H9a4 4 0 0 1-4-4z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><circle cx="15" cy="23" r="3.5" fill="currentColor"/><circle cx="33" cy="23" r="3.5" fill="currentColor"/></svg>',
  xml: '<svg viewBox="0 0 48 48"><path d="M11 5h18l9 9v29H11z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M29 5v9h9" fill="none" stroke="currentColor" stroke-width="3"/><path d="M20 23l-5 5 5 5M29 23l5 5-5 5M26 21l-3 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  nfe: '<svg viewBox="0 0 48 48"><path d="M8 5h22l8 8v30H8z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M14 18h14M14 25h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="33" cy="35" r="9" fill="#0e0e10" stroke="currentColor" stroke-width="3.5"/><path d="M29 35l3 3 5-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  wifi: '<svg viewBox="0 0 48 48"><path d="M6 18a26 26 0 0 1 36 0M12 25a17 17 0 0 1 24 0M18 32a8 8 0 0 1 12 0" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="39" r="3" fill="currentColor"/></svg>'
};
// 2026-11-10 (pedido do dono): recursos em destaque SÓ na peça quadrada (vertical e horizontal continuam no estilo de antes: recursos/story/paisagem com a tela do painel); pro = selo PRO (o teste grátis não libera NF-e nem Multi-Unidade)
const NOVAS = [['vr', 'PCs, Consoles,<br>VRs e<br>Simuladores'], ['lojas', 'Multi-Unidade', true], ['troca', 'Troque de<br>sistema sem<br>perder nada'], ['xml', 'Importe o XML<br>da NF-e do<br>fornecedor', true], ['pix', 'PIX direto na<br>tela do PC'], ['trofeu', 'Fidelidade<br>e Ranking']];
const box = (list, size, fs = .105) => `<div style="display:flex;gap:${size * .1}px;justify-content:center">${list.map(([i, t, pro]) => `<div style="position:relative;width:${size}px;height:${size * .92}px;border-radius:${size * .09}px;border:3px solid #FDD034;background:linear-gradient(180deg,rgba(40,32,10,.92),rgba(14,14,16,.94));box-shadow:0 0 ${size * .2}px rgba(253,208,52,.35),inset 0 0 ${size * .15}px rgba(253,208,52,.18);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${size * .07}px;padding:0 ${size * .05}px">${pro ? `<div style="position:absolute;top:${size * .05}px;right:${size * .05}px;padding:${size * .012}px ${size * .04}px;border-radius:99px;background:${GOLD};color:#141008;font-size:${size * .065}px;font-weight:900;letter-spacing:1px">PRO</div>` : ''}<div style="width:${size * .34}px;height:${size * .34}px;color:#FDD034">${ICON[i]}</div><div style="font-weight:800;font-size:${size * fs}px;line-height:1.15;text-align:center;color:#fff;white-space:nowrap">${t}</div></div>`).join('')}</div>`;
const proNote = fs => `<div style="font-size:${fs}px;color:#cfd3da;font-weight:600"><span style="padding:2px 10px;border-radius:99px;background:${GOLD};color:#141008;font-weight:900;font-size:${fs * .8}px">PRO</span> recursos do plano Pro</div>`;
// planos (preços padrão de site/plans.js — conferir no /admin › Planos antes de anunciar)
const PLANOS = [
  {nome: 'Free', preco: 'Grátis', obs: '30 dias', itens: ['Funções essenciais', 'PIX no PC', 'PCs e consoles ilimitados', 'Sem cartão']},
  {nome: 'Standard', preco: 'R$ 29,90', obs: '/mês', top: true, itens: ['Todas as funções', 'PIX no PC', 'Controle de impressão', 'Suporte 24 horas']},
  {nome: 'Pro', preco: 'R$ 129,90', obs: '/mês', itens: ['Tudo do Standard', 'Nota fiscal (NF-e)', 'Várias lojas no celular', 'App personalizado']}];
const planos = (w, f = 1) => `<div style="display:flex;gap:${18 * f}px;justify-content:center;align-items:stretch">${PLANOS.map(p => `<div style="width:${w}px;padding:${26 * f}px ${18 * f}px;border-radius:${20 * f}px;border:${p.top ? 4 : 2}px solid ${p.top ? '#FDD034' : 'rgba(253,208,52,.45)'};background:linear-gradient(180deg,rgba(40,32,10,.94),rgba(14,14,16,.95));box-shadow:${p.top ? `0 0 ${50 * f}px rgba(253,208,52,.45)` : 'none'};position:relative;text-align:center">${p.top ? `<div style="position:absolute;top:${-20 * f}px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:${6 * f}px ${16 * f}px;border-radius:99px;background:${GOLD};color:#141008;font-size:${20 * f}px;font-weight:900">MAIS POPULAR</div>` : ''}<div style="font-size:${40 * f}px;font-weight:900;font-style:italic" class="${p.top ? 'g' : ''}">${p.nome}</div><div style="margin-top:${10 * f}px;font-size:${44 * f}px;font-weight:900;white-space:nowrap">${p.preco}</div><div style="font-size:${22 * f}px;font-weight:700;color:#cfd3da">${p.obs === '/mês' ? 'por mês' : 'por ' + p.obs}</div><div style="margin-top:${16 * f}px;display:flex;flex-direction:column;gap:${9 * f}px">${p.itens.map(i => `<div style="font-size:${22 * f}px;font-weight:600;color:#e7eaf0;line-height:1.2"><span style="color:#FDD034">✔</span> ${i}</div>`).join('')}</div></div>`).join('')}</div>`;
const TILES = [['pc', 'PCs e<br>Consoles'], ['caixa', 'Caixa<br>e PDV'], ['trofeu', 'Fidelidade<br>e Corujão'], ['relogio', 'Teste grátis<br>30 dias']];
const tiles = (list, size) => `<div style="display:flex;gap:${size * .12}px;justify-content:center">${list.map(([i, t]) => `<div style="width:${size}px;height:${size * 1.02}px;border-radius:${size * .1}px;border:3px solid #FDD034;background:linear-gradient(180deg,rgba(40,32,10,.92),rgba(14,14,16,.94));box-shadow:0 0 ${size * .2}px rgba(253,208,52,.35),inset 0 0 ${size * .15}px rgba(253,208,52,.18);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${size * .08}px"><div style="width:${size * .4}px;height:${size * .4}px;color:#FDD034">${ICON[i]}</div><div style="font-weight:800;font-size:${size * .15}px;line-height:1.12;text-align:center;color:#fff">${t}</div></div>`).join('')}</div>`;
const page = (w, h, body) => `<html><head><style>*{box-sizing:border-box}body{margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:Inter,'Inter Display',Arial,sans-serif;background:#07090d;color:#fff}svg{width:100%;height:100%;display:block}.g{background:${GOLD};-webkit-background-clip:text;background-clip:text;color:transparent}</style></head><body><div style="position:absolute;inset:0;background:url(${hero}) center/cover;filter:brightness(.38) saturate(1.1)"></div><div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,rgba(253,208,52,.16),transparent 60%),linear-gradient(180deg,rgba(7,9,13,.55),rgba(7,9,13,.25) 40%,rgba(7,9,13,.92))"></div>${body}</body></html>`;
const frame = (img, w, rot = -3) => `<div style="width:${w}px;border-radius:18px;border:4px solid #FDD034;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 60px rgba(253,208,52,.35);transform:rotate(${rot}deg)"><img src="${img}" style="width:100%;display:block"></div>`;
const PECAS = {
  // Instagram/Facebook feed 4:5
  'feed-1080x1350-recursos': [1080, 1350, `<div style="position:absolute;inset:0;padding:70px 60px;display:flex;flex-direction:column;align-items:center">
    <img src="${logo}" style="width:360px"><div style="margin-top:44px;font-size:96px;font-weight:900;font-style:italic;line-height:.98;text-align:center;letter-spacing:-2px">SISTEMA PARA<br><span class="g">ARENA GAMER</span></div>
    <div style="margin-top:14px;font-size:44px;font-weight:600;color:#e7eaf0">Lan Houses e Cyber cafés</div>
    <div style="margin-top:46px">${frame(shot('painel'), 760)}</div>
    <div style="position:absolute;bottom:70px;left:0;right:0">${tiles(TILES, 220)}</div></div>`],
  'feed-1080x1350-pc-trava': [1080, 1350, `<div style="position:absolute;inset:0;padding:80px 70px">
    <img src="${logo}" style="width:300px"><div style="margin-top:70px;font-size:92px;font-weight:900;font-style:italic;line-height:1;letter-spacing:-2px">O tempo<br>acabou?<br><span class="g">O PC trava<br>sozinho.</span></div>
    <div style="margin-top:36px;font-size:40px;line-height:1.35;color:#e7eaf0;max-width:860px">Sem discussão no balcão. PCs e consoles liberam quando o cliente paga e bloqueiam no fim do tempo.</div>
    <div style="position:absolute;right:70px;top:300px;width:230px;height:230px;color:#FDD034;filter:drop-shadow(0 0 30px rgba(253,208,52,.6))">${ICON.cadeado}</div>
    <div style="position:absolute;bottom:80px;left:70px;right:70px;display:flex;align-items:center;justify-content:space-between"><div style="padding:30px 46px;border-radius:18px;background:${GOLD};color:#141008;font-size:44px;font-weight:900">Teste grátis 30 dias</div><div style="font-size:40px;font-weight:800">gamezoney.com</div></div></div>`],
  // Stories / Reels / Status do WhatsApp 9:16 (topo e base livres para os botões do app)
  'story-1080x1920': [1080, 1920, `<div style="position:absolute;inset:0;padding:260px 60px 0;display:flex;flex-direction:column;align-items:center">
    <img src="${logo}" style="width:380px"><div style="margin-top:50px;font-size:108px;font-weight:900;font-style:italic;line-height:.98;text-align:center;letter-spacing:-2px">SISTEMA PARA<br><span class="g">ARENA GAMER</span></div>
    <div style="margin-top:16px;font-size:48px;font-weight:600;color:#e7eaf0">Lan Houses e Cyber cafés</div>
    <div style="margin-top:60px">${frame(shot('painel'), 860, -2)}</div>
    <div style="margin-top:70px">${tiles(TILES, 225)}</div>
    <div style="margin-top:60px;padding:30px 60px;border-radius:20px;background:${GOLD};color:#141008;font-size:50px;font-weight:900">Teste grátis · gamezoney.com</div></div>`],
  // Facebook/Google Display quadrado
  'quadrado-1080x1080': [1080, 1080, `<div style="position:absolute;inset:0;padding:64px 60px;display:flex;flex-direction:column;align-items:center">
    <img src="${logo}" style="width:330px"><div style="margin-top:40px;font-size:92px;font-weight:900;font-style:italic;line-height:.98;text-align:center;letter-spacing:-2px">SISTEMA PARA<br><span class="g">ARENA GAMER</span></div>
    <div style="margin-top:14px;font-size:42px;font-weight:600;color:#e7eaf0">Lan Houses e Cyber cafés</div>
    <div style="position:absolute;bottom:64px;left:0;right:0">${tiles(TILES, 215)}</div></div>`],
  // 2026-11: NOVIDADES (Servidor 1.0.9 / Cliente 1.0.7) — feed, story, quadrado e paisagem
  'feed-1080x1350-troca-sistema': [1080, 1350, `<div style="position:absolute;inset:0;padding:80px 70px">
    <img src="${logo}" style="width:300px"><div style="margin-top:70px;font-size:56px;font-weight:700;color:#e7eaf0">Vai trocar de sistema?</div>
    <div style="margin-top:14px;font-size:100px;font-weight:900;font-style:italic;line-height:.98;letter-spacing:-2px">TRAGA SEUS<br><span class="g">CLIENTES.</span></div>
    <div style="margin-top:40px;font-size:40px;line-height:1.35;color:#e7eaf0;max-width:900px">Importe nick, tempo e medalhas de fidelidade do seu sistema atual em poucos minutos, por planilha. Nenhum cliente fica para trás.</div>
    <div style="position:absolute;right:70px;top:320px;width:200px;height:200px;color:#FDD034;filter:drop-shadow(0 0 30px rgba(253,208,52,.6))">${ICON.troca}</div>
    <div style="position:absolute;bottom:80px;left:70px;right:70px;display:flex;align-items:center;justify-content:space-between"><div style="padding:30px 46px;border-radius:18px;background:${GOLD};color:#141008;font-size:44px;font-weight:900">Teste grátis 30 dias</div><div style="font-size:40px;font-weight:800">gamezoney.com</div></div></div>`],
  'quadrado-1080x1080-novidades': [1080, 1080, `<div style="position:absolute;inset:0;padding:48px 50px;display:flex;flex-direction:column;align-items:center">
    <img src="${logo}" style="width:270px"><div style="margin-top:22px"><div style="font-size:70px;font-weight:900;font-style:italic;line-height:.98;text-align:center;letter-spacing:-2px">TUDO QUE SUA<br><span class="g">ARENA PRECISA</span></div></div>
    <div style="margin-top:34px">${box(NOVAS.slice(0, 3), 290)}</div><div style="margin-top:20px">${box(NOVAS.slice(3), 290)}</div>
    <div style="position:absolute;bottom:40px;left:56px;right:56px;display:flex;align-items:center;justify-content:space-between">${proNote(24)}<div style="font-size:32px;font-weight:800">gamezoney.com</div></div></div>`],
  // 2026-11-10: PLANOS (Free / Standard / Pro) — o que cada um libera
  'feed-1080x1350-planos': [1080, 1350, `<div style="position:absolute;inset:0;padding:70px 50px;display:flex;flex-direction:column;align-items:center">
    <img src="${logo}" style="width:330px"><div style="margin-top:40px;font-size:40px;font-weight:800;letter-spacing:8px;color:#FDD034">PLANOS</div>
    <div style="margin-top:10px;font-size:84px;font-weight:900;font-style:italic;line-height:.98;text-align:center;letter-spacing:-2px">ESCOLHA O<br><span class="g">SEU PLANO</span></div>
    <div style="margin-top:90px">${planos(320, 1.18)}</div>
    <div style="position:absolute;bottom:70px;left:60px;right:60px;display:flex;align-items:center;justify-content:space-between"><div style="padding:26px 40px;border-radius:16px;background:${GOLD};color:#141008;font-size:40px;font-weight:900">Comece grátis</div><div style="font-size:38px;font-weight:800">gamezoney.com</div></div></div>`],
  'story-1080x1920-planos': [1080, 1920, `<div style="position:absolute;inset:0;padding:250px 40px 0;display:flex;flex-direction:column;align-items:center">
    <img src="${logo}" style="width:380px"><div style="margin-top:46px;font-size:46px;font-weight:800;letter-spacing:10px;color:#FDD034">PLANOS</div>
    <div style="margin-top:12px;font-size:100px;font-weight:900;font-style:italic;line-height:.98;text-align:center;letter-spacing:-2px">ESCOLHA O<br><span class="g">SEU PLANO</span></div>
    <div style="margin-top:100px">${planos(320, 1.05)}</div>
    <div style="margin-top:90px;padding:30px 60px;border-radius:20px;background:${GOLD};color:#141008;font-size:50px;font-weight:900">Comece grátis · gamezoney.com</div></div>`],
  'quadrado-1080x1080-planos': [1080, 1080, `<div style="position:absolute;inset:0;padding:56px 50px;display:flex;flex-direction:column;align-items:center">
    <img src="${logo}" style="width:300px"><div style="margin-top:30px;font-size:74px;font-weight:900;font-style:italic;line-height:.98;text-align:center;letter-spacing:-2px">ESCOLHA O <span class="g">SEU PLANO</span></div>
    <div style="margin-top:80px">${planos(310, 1.05)}</div>
    <div style="position:absolute;bottom:56px;left:60px;right:60px;display:flex;align-items:center;justify-content:space-between"><div style="padding:24px 38px;border-radius:16px;background:${GOLD};color:#141008;font-size:38px;font-weight:900">Comece grátis</div><div style="font-size:36px;font-weight:800">gamezoney.com</div></div></div>`],
  'paisagem-1200x628-planos': [1200, 628, `<div style="position:absolute;inset:0;padding:40px 46px">
    <img src="${logo}" style="width:220px"><div style="margin-top:20px;font-size:54px;font-weight:900;font-style:italic;line-height:.98;letter-spacing:-1.5px">ESCOLHA O<br><span class="g">SEU PLANO</span></div>
    <div style="margin-top:22px;display:inline-block;padding:14px 26px;border-radius:12px;background:${GOLD};color:#141008;font-size:26px;font-weight:900">Comece grátis</div>
    <div style="position:absolute;right:36px;top:64px">${planos(232, .74)}</div></div>`],
  // 2026-11-10: PIX no PC (autoatendimento, todos os planos)
  'feed-1080x1350-pix': [1080, 1350, `<div style="position:absolute;inset:0;padding:80px 70px">
    <img src="${logo}" style="width:300px"><div style="margin-top:70px;font-size:56px;font-weight:700;color:#e7eaf0">Fila no balcão?</div>
    <div style="margin-top:14px;font-size:100px;font-weight:900;font-style:italic;line-height:.98;letter-spacing:-2px">PAGOU NO PIX,<br><span class="g">JÁ JOGA.</span></div>
    <div style="margin-top:40px;font-size:40px;line-height:1.35;color:#e7eaf0;max-width:900px">O cliente cria a conta e paga pelo PIX direto no PC. Pagamento aprovado, o tempo entra sozinho. Disponível em todos os planos.</div>
    <div style="position:absolute;right:70px;top:300px;width:200px;height:200px;color:#FDD034;filter:drop-shadow(0 0 30px rgba(253,208,52,.6))">${ICON.pix}</div>
    <div style="position:absolute;bottom:80px;left:70px;right:70px;display:flex;align-items:center;justify-content:space-between"><div style="padding:30px 46px;border-radius:18px;background:${GOLD};color:#141008;font-size:44px;font-weight:900">Teste grátis 30 dias</div><div style="font-size:40px;font-weight:800">gamezoney.com</div></div></div>`],
  'story-1080x1920-pix': [1080, 1920, `<div style="position:absolute;inset:0;padding:260px 70px 0;display:flex;flex-direction:column;align-items:center;text-align:center">
    <img src="${logo}" style="width:380px"><div style="margin-top:80px;width:260px;height:260px;color:#FDD034;filter:drop-shadow(0 0 40px rgba(253,208,52,.6))">${ICON.pix}</div>
    <div style="margin-top:70px;font-size:60px;font-weight:700;color:#e7eaf0">Fila no balcão?</div>
    <div style="margin-top:14px;font-size:118px;font-weight:900;font-style:italic;line-height:.98;letter-spacing:-2px">PAGOU NO PIX,<br><span class="g">JÁ JOGA.</span></div>
    <div style="margin-top:50px;font-size:46px;line-height:1.35;color:#e7eaf0">O cliente paga direto no PC e o tempo entra sozinho, sem fila no balcão.</div>
    <div style="margin-top:90px;padding:30px 60px;border-radius:20px;background:${GOLD};color:#141008;font-size:50px;font-weight:900">Teste grátis · gamezoney.com</div></div>`],
  // Google Display / link do Facebook 1,91:1
  'paisagem-1200x628': [1200, 628, `<div style="position:absolute;inset:0;padding:50px 56px">
    <img src="${logo}" style="width:250px"><div style="margin-top:30px;font-size:70px;font-weight:900;font-style:italic;line-height:.98;letter-spacing:-1.5px">SISTEMA PARA<br><span class="g">ARENA GAMER</span></div>
    <div style="margin-top:10px;font-size:34px;font-weight:600;color:#fff">Lan Houses e Cyber cafés</div>
    <div style="margin-top:12px;font-size:26px;color:#e7eaf0;max-width:560px">PCs, consoles, recargas, PDV, caixa e fidelidade em um só sistema.</div>
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
