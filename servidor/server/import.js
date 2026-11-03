'use strict';
// 3.0.20: importacao de clientes por planilha (Excel .xlsx ou .csv) com Nome, Usuario/Nick e Tempo.
// 3.0.33: coluna opcional Pontos fidelidade (saldo inicial de pontos, registrado no extrato).
// Cada linha vira um cadastro de cliente igual ao "Novo cliente" sem senha: o cliente cria a senha no
// primeiro acesso ao PC. O tempo entra como saldo disponivel (nao gera receita nem pontos). Todos os
// clientes importados participam automaticamente do programa de fidelidade, como qualquer cadastro novo.
const zlib = require('node:zlib');
const {id, fail} = require('./store');

const {NICK_PATTERN: NICK, normalizeNick} = require('./store');
const MAX_ROWS = 5000, MAX_SECONDS = 1000 * 3600;

// ---------- leitura de .xlsx (zip + xml) sem dependencias ----------
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) fail('Arquivo Excel inválido ou corrompido.');
  const count = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16); const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) fail('Arquivo Excel inválido.');
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28), data = buf.slice(start, start + size);
    files[name] = () => method === 0 ? data : zlib.inflateRawSync(data);
    p += 46 + nameLen + extra + comment;
  }
  return files;
}
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const textOf = xml => decode([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => m[1]).join(''));
function colIndex(ref) { let n = 0; for (const c of ref.replace(/\d+/g, '')) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; }

function readXlsx(buf) {
  const files = unzip(buf), read = name => files[name] ? files[name]().toString('utf8') : '';
  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textOf(m[1]));
  // estilos: descobrir quais celulas numericas estao formatadas como hora/data
  const styles = read('xl/styles.xml'), custom = {};
  for (const m of styles.matchAll(/<numFmt\s+numFmtId="(\d+)"\s+formatCode="([^"]*)"/g)) custom[m[1]] = decode(m[2]);
  const xfs = (styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/) || [, ''])[1];
  const timeStyle = [...xfs.matchAll(/<xf\b[^>]*?numFmtId="(\d+)"/g)].map(m => {
    const fid = +m[1]; if ((fid >= 18 && fid <= 22) || (fid >= 45 && fid <= 47)) return true;
    const code = (custom[fid] || '').replace(/"[^"]*"|\[(?!h\]|m\]|s\])[^\]]*\]/gi, '').toLowerCase();
    return /h|s/.test(code) || /\[m\]/.test(code);
  });
  // primeira planilha do arquivo
  const wb = read('xl/workbook.xml'), rels = read('xl/_rels/workbook.xml.rels');
  const first = (wb.match(/<sheet\b[^>]*r:id="([^"]+)"/) || [])[1];
  let target = first && (rels.match(new RegExp('<Relationship\\b[^>]*Id="' + first + '"[^>]*Target="([^"]+)"')) || rels.match(new RegExp('<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="' + first + '"')) || [])[1];
  if (!target) target = 'worksheets/sheet1.xml';
  const sheetPath = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  const sheet = read(sheetPath); if (!sheet) fail('Não foi encontrada nenhuma planilha no arquivo.');
  const rows = [];
  for (const r of sheet.matchAll(/<row\b[^>]*?(?:r="(\d+)")?[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], body = c[2] || '', ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1];
      const type = (attrs.match(/\bt="(\w+)"/) || [])[1], style = +((attrs.match(/\bs="(\d+)"/) || [])[1] || 0);
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let value;
      if (type === 's') value = shared[+v] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (type === 'str' || type === 'e') value = decode(v ?? '');
      else if (type === 'b') value = v === '1' ? 'VERDADEIRO' : 'FALSO';
      else if (v !== undefined && v !== '') value = { number: Number(v), time: !!timeStyle[style] };
      else value = '';
      cells[ref ? colIndex(ref) : cells.length] = value;
    }
    rows.push({ line: +(r[1] || rows.length + 1), cells: Array.from(cells, x => x ?? '') });
  }
  return rows;
}

function readCsv(buf) {
  let text = buf.toString('utf8'); if (text.includes('�')) text = buf.toString('latin1');
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/)[0] || '', sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : (firstLine.includes('\t') ? '\t' : ',');
  const rows = []; let row = [], cell = '', quoted = false, line = 1;
  const push = () => { row.push(cell); cell = ''; }, end = () => { push(); rows.push({ line, cells: row }); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; continue; }
    if (c === '"') quoted = true; else if (c === sep) push(); else if (c === '\n') { end(); line++; } else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) end();
  return rows;
}

// ---------- interpretacao ----------
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function detectColumns(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const h = rows[i].cells.map(c => typeof c === 'object' ? '' : norm(c)); const col = {};
    h.forEach((t, j) => {
      // 3.0.33: coluna de pontos fidelidade (verificada antes de "tempo/saldo" para "saldo de pontos")
      if (col.points === undefined && /(ponto|fidelidade|points)/.test(t)) col.points = j;
      else if (col.nick === undefined && /(nick|usuario|login|apelido|user)/.test(t)) col.nick = j;
      else if (col.name === undefined && /(nome|cliente|name)/.test(t)) col.name = j;
      else if (col.time === undefined && /(tempo|saldo|hora|minuto|credito|segundo)/.test(t)) { col.time = j; col.unit = /segundo/.test(t) ? 'seconds' : /hora/.test(t) && !/minuto/.test(t) ? 'hours' : 'minutes'; }
    });
    if (col.nick !== undefined && (col.name !== undefined || col.time !== undefined)) return { header: i, ...col };
  }
  return { header: -1, name: 0, nick: 1, time: 2, points: 3, unit: 'minutes' };   // sem cabecalho: Nome | Nick | Tempo | Pontos fidelidade
}
const UNIT = { seconds: 1, minutes: 60, hours: 3600 };
function parseTime(value, unit) {
  if (value === '' || value === null || value === undefined) return 0;
  if (typeof value === 'object') { const n = value.number; if (!Number.isFinite(n) || n < 0) return null; return Math.round(value.time ? n * 86400 : n * UNIT[unit]); }
  const t = norm(value).replace(/\s+/g, ' ');
  if (!t || t === '-') return 0;
  let m = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] || 0));
  m = t.match(/^(\d+)\s*h\s*(\d{1,2})$/);   // 1h30, 2h15
  if (m) return (+m[1]) * 3600 + (+m[2]) * 60;
  m = t.match(/^(?:(\d+(?:[.,]\d+)?)\s*h(?:oras?|rs?)?)?\s*(?:(\d+)\s*(?:m|min|mins|minutos?))?\s*(?:(\d+)\s*(?:s|seg|segundos?))?$/);
  if (m && (m[1] || m[2] || m[3])) return Math.round(Number((m[1] || '0').replace(',', '.')) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)));
  m = t.match(/^\d+(?:[.,]\d+)?$/);
  if (m) return Math.round(Number(t.replace(',', '.')) * UNIT[unit]);
  return null;
}

// Pontos fidelidade: inteiro ou com ate 3 casas decimais (12, 12,5, 1.250). Vazio = 0. Retorna milesimos.
const MAX_POINTS = 1000000;
function parsePoints(value) {
  if (value === '' || value === null || value === undefined) return 0;
  if (typeof value === 'object') { const n = value.number; return Number.isFinite(n) && n >= 0 && !value.time ? Math.round(n * 1000) : null; }
  let t = String(value).trim().replace(/\s+/g, '').replace(/pts?|pontos?/i, '');
  if (!t || t === '-') return 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');   // 1.250 ou 1.250,5
  t = t.replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  return Math.round(Number(t) * 1000);
}

function parse(fileName, data) {
  const buf = Buffer.from(String(data || ''), 'base64');
  if (!buf.length) fail('Arquivo vazio.');
  if (buf.length > 2 * 1024 * 1024) fail('Arquivo muito grande (máximo 2 MB).');
  const isZip = buf.readUInt32LE(0) === 0x04034b50;
  if (/\.xls$/i.test(fileName) && !isZip) fail('Formato .xls antigo não é suportado. No Excel, use Salvar como > Pasta de Trabalho do Excel (.xlsx) ou CSV.');
  const rows = isZip ? readXlsx(buf) : readCsv(buf);
  const col = detectColumns(rows);
  const out = [];
  for (const r of rows.slice(col.header + 1)) {
    const get = i => i === undefined ? '' : r.cells[i];
    const raw = [get(col.name), get(col.nick), get(col.time), get(col.points)];
    if (raw.every(v => v === '' || v === undefined)) continue;
    const str = v => typeof v === 'object' ? String(v.number) : String(v ?? '').trim();
    const timeRaw = get(col.time), seconds = parseTime(timeRaw, col.unit);
    const pointsRaw = get(col.points), pointsMilli = parsePoints(pointsRaw);
    out.push({ line: r.line, name: str(get(col.name)), username: str(get(col.nick)), seconds, timeText: typeof timeRaw === 'object' ? (timeRaw.time ? 'hora do Excel' : String(timeRaw.number)) : String(timeRaw ?? '').trim(), pointsMilli, pointsText: str(pointsRaw) });
    if (out.length > MAX_ROWS) fail('A planilha tem mais de ' + MAX_ROWS + ' linhas.');
  }
  return { columns: { header: col.header + 1, unit: col.unit, points: col.points !== undefined }, rows: out };
}

// ---------- validacao e importacao ----------
function validate(store, rows) {
  const taken = new Map(store.state.members.map(m => [(m.username || '').toLowerCase(), m]));
  const seen = new Set();
  return rows.map(r => {
    const item = { line: r.line, name: String(r.name || '').trim().slice(0, 120), username: normalizeNick(r.username), seconds: r.seconds, timeText: r.timeText, pointsMilli: r.pointsMilli === undefined ? 0 : r.pointsMilli, pointsText: String(r.pointsText ?? '') };
    if (!item.name) item.name = item.username;
    const key = item.username.toLowerCase();
    if (!item.username) item.error = 'Usuário/Nick vazio.';
    else if (!NICK.test(item.username)) item.error = 'Nick inválido: use 3 a 32 caracteres entre letras sem acento, números, espaço, ponto, hífen ou sublinhado.';
    else if (seen.has(key)) item.error = 'Nick repetido na planilha.';
    else if (item.seconds === null || item.seconds === undefined || !Number.isSafeInteger(item.seconds) || item.seconds < 0) item.error = 'Tempo não reconhecido: "' + item.timeText + '". Use 01:30, 90 (minutos) ou 1h30.';
    else if (item.seconds > MAX_SECONDS) item.error = 'Tempo acima de 1000 horas.';
    else if (item.pointsMilli === null || !Number.isSafeInteger(item.pointsMilli) || item.pointsMilli < 0) item.error = 'Pontos fidelidade não reconhecidos: "' + item.pointsText + '". Use um número, ex.: 150 ou 12,5.';
    else if (item.pointsMilli > MAX_POINTS * 1000) item.error = 'Pontos fidelidade acima de ' + MAX_POINTS.toLocaleString('pt-BR') + '.';
    else if (taken.has(key)) { item.status = 'exists'; item.note = 'Já cadastrado (' + taken.get(key).name + '): não será alterado.'; }
    if (item.error) item.status = 'error'; else if (!item.status) item.status = 'new';
    if (item.username) seen.add(key);
    return item;
  });
}

function importMembers(store, rows, actor) {
  if (!Array.isArray(rows) || !rows.length) fail('Nenhuma linha para importar.');
  if (rows.length > MAX_ROWS) fail('Muitas linhas.');
  const checked = validate(store, rows.map(r => ({ line: Number(r.line) || 0, name: r.name, username: r.username, seconds: (r.seconds === null || r.seconds === undefined || r.seconds === '') ? null : Number(r.seconds), timeText: String(r.timeText ?? r.seconds), pointsMilli: (r.pointsMilli === undefined || r.pointsMilli === '') ? 0 : r.pointsMilli === null ? null : Number(r.pointsMilli), pointsText: String(r.pointsText ?? r.pointsMilli ?? '') })));
  const ok = checked.filter(r => r.status === 'new');
  if (!ok.length) fail('Nenhum cliente novo válido para importar.');
  const total = ok.reduce((a, r) => a + r.seconds, 0), points = ok.reduce((a, r) => a + r.pointsMilli, 0), now = Date.now(), stamp = new Date(now).toLocaleDateString('pt-BR');
  store.change(actor, 'membro', `Importação de planilha: ${ok.length} cliente(s) cadastrado(s), ${Math.round(total / 60)} minuto(s) de saldo inicial, ${(points / 1000).toLocaleString('pt-BR')} ponto(s) fidelidade. Senhas serão criadas no primeiro acesso.`, () => {
    for (const r of ok) {
      const m = { id: id(), creditSeconds: r.seconds, pointsMilli: r.pointsMilli, createdAt: now, name: r.name, username: r.username, cpf: '', phone: '', notes: 'Importado da planilha em ' + stamp + '.', active: true, importedAt: now, importedSeconds: r.seconds, importedPointsMilli: r.pointsMilli };
      store.state.members.push(m);
      // pontos importados aparecem no extrato de pontos (Fidelidade) como saldo inicial
      if (r.pointsMilli > 0) (store.state.loyaltyLedger ??= []).push({ id: id(), memberId: m.id, amount: r.pointsMilli, reason: 'Importação de planilha (saldo inicial de pontos)', reference: 'import', at: now });
    }
    return null;
  });
  return { imported: ok.length, seconds: total, pointsMilli: points, skipped: checked.filter(r => r.status === 'exists').length, errors: checked.filter(r => r.status === 'error').length, rows: checked };
}

module.exports = { parse, validate, importMembers, parseTime, parsePoints, readCsv, readXlsx };
