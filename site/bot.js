'use strict';
// GameZoney — site gamezoney.com — software proprietário e confidencial. © 2026 GameZoney. Todos os direitos reservados.
// 2.14: Assistente do chat "Fale conosco" — SEM IA e sem custo por mensagem (pedido do dono).
//  - Banco próprio de perguntas e respostas (tabela bot_answers, semeada de bot/perguntas.js e editável no /admin › Assistente).
//  - Se nenhuma resposta do banco servir: busca no guia completo (bot/guia.md = cópia do GUIA-GAMEZONEY.md) e nas dúvidas frequentes.
//  - "falar com especialista/atendente/agente…" (ou nada encontrado) = pedido de especialista (community.js decide online/offline).
const fs = require('node:fs'), path = require('node:path');

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const STOP = new Set(('a o e de da do das dos em no na nos nas um uma uns umas para pra por com sem que se como qual quais quando onde porque por que ' +
  'meu minha meus minhas seu sua seus suas eu voce voces vcs vc ele ela eles isso esse essa este esta isto tem ter tenho ser estar sao foi vai pode posso consigo preciso quero ' +
  'gostaria saber mais muito ja nao sim ate ou the and for with how what can does is are to of in on el la los las y con es un una lo mi tu ' +
  'much does there have has do you your my it an this that gamezoney sistema software programa ola oi bom dia boa tarde noite obrigado favor fazer faco faz funciona usar uso').split(' '));
const stem = w => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w).slice(0, 6);
const tokens = s => norm(s).replace(/(\w)-(\w)/g, '$1$2').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 1 && !STOP.has(w)).map(stem);
const plain = s => String(s || '').replace(/\*\*/g, '').replace(/`/g, '').trim();
const money = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// pedido de pessoa: "falar com agente", "falar com especialista", "especialista", "atendente" (e en/es)
const HUMAN_RE = /(especialista|atendente|falar com (um |uma |o |a |alguem )?(agente|humano|pessoa|vendedor|consultor)|agente humano|^\s*(agente|humano)\s*[.!?]*\s*$|pessoa real|specialist|human agent|talk to (an? |a real )?(agent|human|person|someone)|real person|^\s*agent\s*[.!?]*\s*$|hablar con (un |una |alguien )?(agente|humano|persona|asesor)|asesor)/;
const wantsHuman = text => HUMAN_RE.test(norm(text));

const TEXTS = {
  pt: {
    hello: n => `Olá${n ? ', ' + n : ''}! Sou o assistente virtual da GameZoney.`,
    ask: 'Como posso ajudar a sua arena?',
    online: 'Certo! Já chamei um especialista da GameZoney. Ele continua o atendimento por aqui em instantes.',
    offline: e => `No momento não temos um especialista online, mas registramos o seu assunto e vamos dar a devolutiva pelo e-mail ${e} o quanto antes. Se quiser, escreva aqui mais detalhes.`,
    unknownOnline: 'Não encontrei essa resposta na minha base. Chamei um especialista da GameZoney, que está online e vai continuar por aqui.',
    unknownOffline: e => `Não encontrei essa resposta na minha base. No momento não temos um especialista online, mas registramos a sua pergunta e vamos dar a devolutiva pelo e-mail ${e} o quanto antes. Enquanto isso, posso ajudar com outras dúvidas.`,
    thanks: 'Por nada! Se tiver mais alguma dúvida, é só escrever. Quando terminar, use "Encerrar e avaliar".',
    more: 'Passo a passo completo com imagens: gamezoney.com/guia (entre na sua conta).',
    also: 'Também pode ajudar:'
  },
  en: {
    hello: n => `Hi${n ? ' ' + n : ''}! I'm GameZoney's virtual assistant.`,
    ask: 'How can I help your arena?',
    online: "Sure! I've called a GameZoney specialist. They'll continue the conversation here in a moment.",
    offline: e => `There's no specialist online right now, but we've recorded your request and will get back to you at ${e} as soon as possible. Feel free to add more details here.`,
    unknownOnline: "I couldn't find that answer in my knowledge base. I've called a GameZoney specialist who is online and will continue here.",
    unknownOffline: e => `I couldn't find that answer in my knowledge base. There's no specialist online right now, but we've recorded your question and will reply to ${e} as soon as possible. Meanwhile, I can help with other questions.`,
    thanks: "You're welcome! If you have any other question, just type it. When you're done, use \"End and rate\".",
    more: 'Full step-by-step guide with pictures: gamezoney.com/guia (sign in to your account).',
    also: 'This may also help:'
  },
  es: {
    hello: n => `¡Hola${n ? ', ' + n : ''}! Soy el asistente virtual de GameZoney.`,
    ask: '¿En qué puedo ayudar a tu arena?',
    online: '¡Listo! Ya llamé a un especialista de GameZoney. Seguirá la atención por aquí en un momento.',
    offline: e => `En este momento no hay un especialista en línea, pero registramos tu consulta y te responderemos al correo ${e} lo antes posible. Si quieres, escribe aquí más detalles.`,
    unknownOnline: 'No encontré esa respuesta en mi base. Llamé a un especialista de GameZoney que está en línea y seguirá por aquí.',
    unknownOffline: e => `No encontré esa respuesta en mi base. En este momento no hay un especialista en línea, pero registramos tu pregunta y te responderemos al correo ${e} lo antes posible. Mientras tanto, puedo ayudarte con otras dudas.`,
    thanks: '¡De nada! Si tienes otra duda, solo escríbela. Cuando termines, usa "Finalizar y evaluar".',
    more: 'Paso a paso completo con imágenes: gamezoney.com/guia (inicia sesión en tu cuenta).',
    also: 'También puede ayudar:'
  }
};
const langOf = l => (TEXTS[l] ? l : 'pt');

module.exports = function createBot({plansInfo = () => [], answers = () => [], root = __dirname} = {}) {
  const read = f => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return ''; } };
  const guide = read('bot/guia.md');
  const faq = [...read('public/index.html').matchAll(/<details><summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)]
    .map(m => ({q: m[1].replace(/<[^>]+>/g, '').trim(), a: m[2].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()}));

  const plansText = () => (plansInfo() || []).filter(Boolean).map(p => p.free
    ? `• ${p.name}: teste grátis de 30 dias, sem cartão.`
    : `• ${p.name}: ${money(p.monthly)}/mês ou ${money(p.annual)}/ano${p.popular ? ' (mais popular)' : ''}. Inclui: ${p.features.join(', ')}.`).join('\n') || '• Consulte gamezoney.com/#precos.';
  const fill = t => String(t).replace(/\{planos\}/g, () => plansText());

  // ---------- índice ----------
  // banco: pergunta/variações/palavras-chave valem mais que o texto da resposta
  let indexKey = '', index = [], idf = () => 1;
  function build(list) {
    const docs = [];
    for (const r of list) {
      const f = new Map(), put = (txt, w) => { for (const t of tokens(txt)) f.set(t, Math.max(f.get(t) || 0, w)); };
      put(r.a, 0.6); put([r.q, ...(r.alt || [])].join(' '), 3); put((r.kw || []).join(' '), 4);
      docs.push({kind: 'qa', r, f});
    }
    for (const x of faq) { const f = new Map(); for (const t of tokens(x.a)) f.set(t, 0.6); for (const t of tokens(x.q)) f.set(t, 3); docs.push({kind: 'faq', r: {q: x.q, a: x.a}, f}); }
    let head = '';
    for (const block of guide.split(/\n(?=- |#{1,3} )/)) {
      if (/^#{1,3} /.test(block)) { head = block.split('\n')[0].replace(/^#+ /, ''); continue; }
      const text = plain(block.replace(/^- /, '')); if (text.length < 40) continue;
      const f = new Map(); for (const t of tokens(text)) f.set(t, 0.8); for (const t of tokens(head)) f.set(t, Math.max(f.get(t) || 0, 1.2));
      docs.push({kind: 'guide', r: {q: head, a: text}, f});
    }
    const df = new Map(); for (const d of docs) for (const t of d.f.keys()) df.set(t, (df.get(t) || 0) + 1);
    idf = t => Math.log(1 + docs.length / (1 + (df.get(t) || 0)));
    return docs;
  }
  function rank(text) {
    const list = answers(), key = list.map(r => r.id + ':' + (r.v || '')).join('|');
    if (key !== indexKey) { index = build(list); indexKey = key; }
    const q = [...new Set(tokens(text))]; if (!q.length) return [];
    const max = q.reduce((a, t) => a + idf(t) * 4, 0);
    return index.map(d => { let s = 0, hit = 0; for (const t of q) { const w = d.f.get(t); if (w) { s += w * idf(t); hit++; } }
      return {d, s: s * (d.kind === 'guide' ? 0.8 : d.kind === 'faq' ? 0.95 : 1), hit, cover: hit / q.length, rel: s / max}; })
      .filter(x => x.hit).sort((a, b) => b.s - a.s);
  }
  const short = (t, n = 750) => t.length <= n ? t : t.slice(0, t.lastIndexOf(' ', n)) + '…';

  // {text, handoff:true (chamar especialista), unknown:true (sem resposta), id (resposta usada)}
  function reply(text, {lang, name, first} = {}) {
    const T = TEXTS[langOf(lang)], n = norm(text).trim(), pre = first ? T.hello(name) + '\n' : '';
    if (wantsHuman(text)) return {handoff: true, text: ''};
    if (/^(muito )?(obrigad[oa]s?|valeu|vlw|thanks|thank you|gracias|perfeito|otimo|show|blz|beleza|ok|entendi)\b/.test(n) && n.length < 40) return {text: T.thanks, id: 'obrigado'};
    if (/^(oi|ola|opa|bom dia|boa tarde|boa noite|hello|hi|hey|hola|buenas|e ai|eai)\b[\s!.?,]*$/.test(n)) return {text: (first ? T.hello(name) + ' ' : '') + T.ask, id: 'saudacao'};
    const list = rank(text), best = list[0];
    // aceita: pergunta do banco com boa parte das palavras; guia/dúvida só com força maior
    const ok = best && (best.d.kind === 'qa' ? best.s >= 5 && (best.cover >= 0.5 || best.rel >= 0.35) : best.s >= 7 && best.cover >= 0.5);
    if (!ok) return {unknown: true, handoff: true, text: pre.trim()};
    const r = best.d.r;
    let body = best.d.kind === 'guide' ? short(r.a) + '\n' + T.more : fill(r.a);
    // segunda sugestão do banco, se também for forte e diferente
    const second = list.find(x => x !== best && x.d.kind === 'qa' && x.s >= Math.max(6, best.s * 0.85) && x.cover >= 0.6);
    if (second && best.d.kind === 'qa') body += `\n\n${T.also} ${second.d.r.q}`;
    return {text: pre + body, id: best.d.kind === 'qa' ? r.id : best.d.kind, handoff: !!r.human};
  }

  return {reply, wantsHuman, texts: l => TEXTS[langOf(l)], langOf, rank, plansText};
};
module.exports.wantsHuman = wantsHuman;
module.exports.tokens = tokens;
