#!/usr/bin/env node
/* Dựng gói nội dung HSK từ nguồn trong content/ → dist/content/hsk{1..6}.js, kèm kiểm tra chất lượng.
 *
 *   node tools/build-content.mjs                       # dựng + kiểm tra
 *   node tools/build-content.mjs --check               # chỉ kiểm tra, không ghi file
 *   node tools/build-content.mjs --strokes <hanzi-writer-data>   # chép thêm dữ liệu nét cho chữ luyện viết
 *
 * Nguồn: content/hsk/hsk30.json (danh sách chuẩn), content/vi/hsk*.tsv (nghĩa), content/extra.tsv (từ ngoài HSK),
 *        content/curriculum/hsk*.json (chương, bài, ngữ pháp, hội thoại). Chi tiết định dạng: content/README.md */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { applySandhi, sylOfWord, displayWordPinyin, joinSyl, capFirst, splitSyllables, toneOf } from './pinyin.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const strokesDir = args.includes('--strokes') ? args[args.indexOf('--strokes') + 1] : null;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

/* ---------- nạp nguồn ---------- */
export function loadSources() {
  const hsk = JSON.parse(read('content/hsk/hsk30.json'));
  const tsv = (p) => (exists(p) ? read(p).split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.split('\t')) : []);
  const vi = new Map([1, 2, 3, 4, 5, 6].flatMap((lv) => tsv(`content/vi/hsk${lv}.tsv`)).map(([id, v]) => [id, v]));
  const extra = new Map(tsv('content/extra.tsv').map(([id, py, v, kind]) => [id, { id, hanzi: id.split('~')[0], pinyin: py, vi: v, kind: kind || 'word', extra: true }]));
  const curricula = [1, 2, 3, 4, 5, 6].filter((lv) => exists(`content/curriculum/hsk${lv}.json`)).map((lv) => JSON.parse(read(`content/curriculum/hsk${lv}.json`)));
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(read('dist/js/content.js'), ctx);
  const legacy = ctx.window.Buzz.Content;
  const stories = [1, 2, 3, 4, 5, 6].filter((lv) => exists(`content/story/hsk${lv}.json`)).map((lv) => ({ level: lv, ...JSON.parse(read(`content/story/hsk${lv}.json`)) }));
  return { hsk, vi, extra, curricula, legacy, stories };
}

/* ---------- tách từ: quy hoạch động, ưu tiên từ đã học, ít từ nhất ---------- */
// từ ghép không được nhận khi đứng sau chữ nhất định: 一个人 = 一 个 人, không phải 一 个人 (cá nhân)
const BLOCK_AFTER = { 个人: /[一二三四五六七八九十百千万两几这那每哪某各半整多]/ };
// chỉ nhận là từ khi đứng đầu vế câu: 得了 (déle = thôi được) ≠ 得了金牌 (dé le)
const START_ONLY = new Set(['得了']);
// chữ mà cách đọc mặc định luôn thắng, kể cả trong bài dạy cách đọc khác (了 liǎo, 只 zhī, 得 děi do luật/chú thích quyết định)
const NO_PREFER = new Set(['了', '只', '得', '好', '啊', '哪', '打', '看', '当']);
const NUMERALS_RE = /^[零二三四五六七八九十百千万]+$/;
const PUNCT = /[，。？！、：；“”‘’（）《》…—,.?!:;"'()]/;
export function segment(text, lex, known, prefer = new Set()) {
  // chú thích đọc: 还{huán}
  const ann = []; let plain = '';
  text.replace(/([^{}]|\{[^}]*\})/gu, (m) => { if (m.startsWith('{')) ann[plain.length - 1] = m.slice(1, -1); else plain += m; return m; });
  const chars = [...plain];
  const n = chars.length;
  const best = new Array(n + 1).fill(null); best[0] = { cost: 0, toks: [] };
  for (let i = 0; i < n; i++) {
    if (!best[i]) continue;
    const ch = chars[i];
    const push = (j, tok, c) => { const cand = { cost: best[i].cost + c, toks: [...best[i].toks, tok] }; if (!best[j] || cand.cost < best[j].cost) best[j] = cand; };
    if (/\s/.test(ch) || ch === '|') { push(i + 1, null, 0); continue; }
    if (PUNCT.test(ch)) { push(i + 1, { t: 'p', v: ch }, 0); continue; }
    if (/[A-Za-zÀ-ỹ]/.test(ch)) { let j = i; while (j < n && /[A-Za-zÀ-ỹ'-]/.test(chars[j])) j++; push(j, { t: 'name', v: chars.slice(i, j).join('') }, 1); continue; }
    if (/[0-9]/.test(ch)) { let j = i; while (j < n && /[0-9:.]/.test(chars[j])) j++; push(j, { t: 'num', v: chars.slice(i, j).join('') }, 1); continue; }
    let any = false;
    for (let L = Math.min(8, n - i); L >= 1; L--) {
      const w = chars.slice(i, i + L).join('');
      const entries = lex.get(w);
      if (!entries) continue;
      if (BLOCK_AFTER[w] && i > 0 && BLOCK_AFTER[w].test(chars[i - 1])) continue;
      if (START_ONLY.has(w) && i > 0 && !(/\s|\|/.test(chars[i - 1]) || PUNCT.test(chars[i - 1]))) continue;
      any = true;
      const kn = (NO_PREFER.has(w) ? null : entries.find((e) => prefer.has(e.id))) || entries.find((e) => known(e.id));
      push(i + L, { t: 'w', v: w, e: kn || entries[0], known: !!kn, at: i }, kn ? 1 : 50);
    }
    if (!any) push(i + 1, { t: 'w', v: ch, e: null, known: false, at: i }, 100);
  }
  const toks = best[n].toks.filter(Boolean);
  toks.forEach((t, i) => {
    if (t.t !== 'w') return;
    // chú thích chọn cách đọc (và mục từ tương ứng nếu có): 为{wéi}, 精神{jīngshen}
    const a = ann[t.at + [...t.v].length - 1];
    if (a !== undefined) {
      const want = a.replace(/[\s']/g, '');
      const e = (lex.get(t.v) || []).find((x) => (x.dict || '').replace(/[\s']/g, '') === want);
      if (e) { t.e = e; t.known = known(e.id) || prefer.has(e.id); }
      if (t.v.length === 1 || e) { t.py = a; return; } // từ nhiều chữ: chỉ nhận chú thích khớp cả từ (精神{jīngshen})
    }
    if (t.v.length !== 1) return;
    const prev = toks[i - 1];
    // 只 sau số/这/那/几/两/每 = lượng từ (zhī: 一只猫)
    if (t.v === '只' && prev && (prev.t === 'num' || /^(一|二|三|四|五|六|七|八|九|十|两|几|这|那|每|哪)$/.test(prev.v))) {
      const zhi = (lex.get('只') || []).find((e) => e.dict === 'zhī');
      if (zhi && known(zhi.id)) { t.py = 'zhī'; t.e = zhi; t.known = true; }
      return;
    }
    // 了 trong bổ ngữ khả năng: 受不了, 去得了 → liǎo
    if (t.v === '了' && prev && (prev.v === '不' || (prev.v === '得' && prev.py !== 'dé')) && toks[i - 2] && toks[i - 2].t === 'w' && toks[i - 2].e && (toks[i - 2].e.pos || []).some((p) => /^v/.test(p))) {
      const liao = (lex.get('了') || []).find((e) => e.dict === 'liǎo');
      t.py = 'liǎo'; if (liao) { t.e = liao; t.known = known(liao.id); }
      return;
    }
    // bổ ngữ khả năng: động từ + 不 + bổ ngữ (找不到, 走不动) → 不 đọc nhẹ (bu)
    if (t.v === '不') {
      const next = toks[i + 1];
      const MODAL = /^(可以|能|会|要|想|应该|能够|愿意|得|必须|该|是|有|在|爱|喜欢|觉得|知道)$/;
      const COMP = /^(到|完|好|懂|动|开|了|住|见|着|起|下|上|出|进|回|过|来|去|掉|走|成|对|错|饱|惯|清楚|干净|明白|及)$/;
      const DIR = /^(起来|出来|出去|下去|上去|回来|回去|过来|过去|进来|进去|下来|上来)$/;
      if (prev && next && prev.t === 'w' && next.t === 'w' && (prev.v === next.v || (prev.v.length === 2 && next.v === prev.v[0]))) { t.py = 'bu'; return; } // hỏi chính phản: 贵不贵, 喜不喜欢
      if (prev && prev.t === 'w' && prev.e && !MODAL.test(prev.v) && /^v/.test((prev.e.pos || [])[0] || '') && next && next.t === 'w' && (COMP.test(next.v) || DIR.test(next.v)) && !/[吗呢吧]/.test(next.v) && !(next.v === '了' && !(lex.get('了') || []).some((e) => e.dict === 'liǎo' && known(e.id)))) t.py = 'bu';
      return;
    }
    // 得 + 了/到/数 = 得 (dé, đạt được): 得了金牌; sau động từ/tính từ là trợ từ de (mặc định)
    if (t.v === '得') {
      const next = toks[i + 1], de2 = (lex.get('得') || []).find((e) => e.dict === 'dé');
      if (de2 && known(de2.id) && next && (next.t === 'num' || /^(了|到|过|一|两|几)$/.test(next.v) || NUMERALS_RE.test(next.v))) { t.py = 'dé'; t.e = de2; return; }
      // đại từ + 得 + động từ = phải (děi): 我得走了
      const dei = (lex.get('得') || []).find((e) => e.dict === 'děi');
      if (dei && known(dei.id) && prev && prev.t === 'w' && /^(我|你|他|她|我们|你们|他们|她们|咱们|大家|自己|您)$/.test(prev.v) && next && next.t === 'w' && next.e && /^v/.test((next.e.pos || [])[0] || '')) { t.py = 'děi'; t.e = dei; }
      return;
    }
    // 过 sau động từ = trợ từ kinh nghiệm (guo); đứng làm động từ (过年, 过春节) = guò
    if (t.v === '过') {
      const guo = (lex.get('过') || []).find((e) => e.dict === 'guo');
      if (guo && known(guo.id) && prev && prev.t === 'w' && prev.e && (prev.e.pos || []).some((p) => /^v/.test(p))) { t.py = 'guo'; t.e = guo; }
      else { t.py = 'guò'; }
    }
  });
  return { plain: plain.replace(/\|/g, ''), toks };
}

/** Pinyin cho câu: ghép theo từ, áp biến thanh 不/一 xuyên từ, viết hoa đầu câu, dấu câu kiểu Latin. */
export function sentencePinyin(toks) {
  const syl = [];
  toks.forEach((t, ti) => {
    if (t.t === 'p') { syl.push({ punct: true, ch: t.v, ti }); return; }
    if (t.t !== 'w') { syl.push({ ch: t.v, py: t.v, name: true, ti }); return; }
    const py = t.py || (t.e ? t.e.dict || t.e.pinyin : '?');
    // cụm có khoảng trắng trong Pinyin (ví dụ 你好 nǐ hǎo) giữ nguyên cách viết rời
    let sub = 0;
    const parts = py.split(/\s+/);
    let charPos = 0;
    parts.forEach((part, pi) => {
      const n = (splitSyllables(part) || [part]).length;
      const chars = [...t.v].slice(charPos, charPos + n + (pi === parts.length - 1 ? 99 : 0)).join('');
      charPos += n;
      sylOfWord(chars, part).forEach((s) => syl.push({ ...s, ti: `${ti}.${sub}` }));
      sub++;
    });
  });
  const done = applySandhi(syl);
  const PM = { '，': ',', '。': '.', '？': '?', '！': '!', '、': ',', '：': ':', '；': ';', '“': '“', '”': '”', '…': '…', '（': '(', '）': ')' };
  let out = ''; let cur = []; let curTi = -1;
  const flush = () => { if (cur.length) { out += (out && !/[("“]$/.test(out) ? ' ' : '') + joinSyl(cur); cur = []; } };
  for (const s of done) {
    if (s.punct) { flush(); const m = PM[s.ch] || s.ch; out += (/[“(]/.test(m) && out && !/[\s(“]$/.test(out) ? ' ' : '') + m; curTi = -1; continue; }
    if (s.ti !== curTi) { flush(); curTi = s.ti; }
    cur.push(s.py);
  }
  flush();
  const tidy = out.replace(/[“”]/g, '"').replace(/\s+([,.?!:;…])/g, '$1').replace(/([,.?!:;])(?=[^\s"”)])/g, '$1 ').replace(/\s+/g, ' ').trim();
  return capFirst(tidy).replace(/([.?!…]\s+)(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
}

// chữ đa âm mà cách đọc mặc định chỉ an toàn khi người học mới biết một cách đọc (sang HSK 3 phải chú thích)
const WATCH = new Set(['重', '背', '调']);
// chữ đa âm mà cách đọc mặc định (mục HSK đầu tiên) gần như luôn đúng trong hội thoại sơ cấp
const RELIABLE = new Set(['看', '当', '啊', '着', '打', '种', '哪', '挑', '地', '了', '还', '好', '等', '多', '两', '白', '毛', '对', '分', '回', '会', '家', '老', '那', '下', '小', '站', '花', '把', '面', '省', '头', '为', '正', '初', '米', '怕', '排', '任', '生', '信', '叫', '行', '重', '得', '长', '只']);

/* ---------- dựng ---------- */
export function build(src) {
  const { hsk, vi, extra, curricula, legacy, stories = [] } = src;
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);

  // từ điển: từ HSK + từ ngoài HSK + mục của 3 bài viết tay
  const items = new Map();
  for (const w of hsk.words) {
    const v = vi.get(w.id);
    items.set(w.id, { id: w.id, hanzi: w.hanzi, dict: w.pinyin, pinyin: displayWordPinyin(w.hanzi, w.pinyin), vi: v || '', level: w.level, kind: [...w.hanzi].length === 1 ? 'char' : 'word', hsk: true, n: w.n, review: w.review || undefined, pos: w.pos });
  }
  for (const e of extra.values()) items.set(e.id, { ...e, dict: e.pinyin, pinyin: displayWordPinyin(e.hanzi, e.pinyin), level: 0, kind: ['name', 'particle'].includes(e.kind) ? e.kind : [...e.hanzi].length === 1 ? 'char' : 'word' });
  for (const it of Object.values(legacy.items)) {
    if (!items.has(it.id)) items.set(it.id, { id: it.id, hanzi: it.hanzi, dict: it.pinyin, pinyin: it.pinyin, vi: it.vi, level: 1, kind: it.kind, legacy: true });
    items.get(it.id).lesson = it.lesson;
  }
  const lex = new Map();
  for (const it of items.values()) { const h = it.hanzi.replace(/[？?！!。，]/g, ''); if (!lex.has(h)) lex.set(h, []); lex.get(h)[it.kind === 'particle' ? 'unshift' : 'push'](it); } // trợ từ (得 de) là cách đọc mặc định

  // thứ tự bài toàn khoá → tập từ đã biết tại mỗi bài
  const order = []; const lessons = {}; const units = [];
  const introducedAt = new Map(); // itemId → chỉ số bài
  legacy.lessonOrder.forEach((lid) => { order.push(lid); Object.values(legacy.items).filter((i) => i.lesson === lid).forEach((i) => introducedAt.set(i.id, order.length - 1)); });
  for (const e of extra.values()) if (e.kind === 'name') introducedAt.set(e.id, -1); // tên riêng: luôn dùng được
  const assigned = new Map();
  for (const cur of curricula) {
    for (const u of cur.units) {
      const unit = { id: u.id, level: cur.level, title: u.title, goal: u.goal, lessonIds: [] };
      units.push(unit);
      for (const l of u.lessons) {
        if (typeof l === 'string') { unit.lessonIds.push(l); if (!order.includes(l)) err(`${u.id}: bài viết tay ${l} không tồn tại`); continue; }
        if (lessons[l.id] || order.includes(l.id)) err(`Trùng id bài ${l.id}`);
        order.push(l.id); unit.lessonIds.push(l.id);
        const idx = order.length - 1;
        const words = (l.words || '').split(/\s+/).filter(Boolean);
        const extras = (l.extra || '').split(/\s+/).filter(Boolean);
        for (const id of words) {
          const it = items.get(id);
          if (!it || !it.hsk) { err(`${l.id}: "${id}" không phải từ HSK (dùng id như 还~huan2 cho từ trùng chữ)`); continue; }
          if (it.level !== cur.level) warn(`${l.id}: ${id} thuộc HSK ${it.level} nhưng dạy ở cấp ${cur.level}`);
          if (assigned.has(id)) err(`${l.id}: ${id} đã dạy ở ${assigned.get(id)}`);
          assigned.set(id, l.id);
          if (!introducedAt.has(id)) introducedAt.set(id, idx);
          it.lesson = it.lesson || l.id;
        }
        for (const id of extras) { if (!extra.has(id)) err(`${l.id}: từ ngoài HSK "${id}" chưa khai báo trong content/extra.tsv`); else if (!introducedAt.has(id)) { introducedAt.set(id, idx); items.get(id).lesson = l.id; } }
        lessons[l.id] = { id: l.id, level: cur.level, unit: u.id, title: l.title, words: words.filter((w) => items.has(w)), extra: extras, raw: l };
      }
    }
  }
  // từ của cấp chưa được dạy
  for (const cur of curricula) {
    const missing = hsk.words.filter((w) => w.level === cur.level && !assigned.has(w.id) && !introducedAt.has(w.id));
    if (missing.length) (cur.complete ? err : warn)(`HSK ${cur.level}: còn ${missing.length} từ chưa xếp vào bài: ${missing.slice(0, 40).map((w) => w.id).join(' ')}${missing.length > 40 ? ' …' : ''}`);
  }

  // hội thoại, ví dụ ngữ pháp: tách từ, Pinyin, kiểm tra từ chưa học
  const sentences = {};
  const process = (lid, idx, text, where) => {
    const { plain, toks } = segment(text, lex, (id) => introducedAt.has(id) && introducedAt.get(id) <= idx, new Set([...(lessons[lid] ? lessons[lid].words : []), ...(lessons[lid] ? lessons[lid].extra : [])]));
    toks.filter((t) => t.t === 'w' && !t.known).forEach((t) => err(`${lid} ${where}: "${t.v}" chưa học tới bài này${t.e ? ` (dạy ở ${t.e.lesson || 'chưa xếp'})` : ' (không có trong từ điển)'} · ${plain}`));
    const isKnown = (id) => introducedAt.has(id) && introducedAt.get(id) <= idx;
    const reliable = (ch) => RELIABLE.has(ch) && !(WATCH.has(ch) && new Set((lex.get(ch) || []).filter((e) => isKnown(e.id)).map((e) => e.dict)).size > 1);
    const lvCap = Math.max(3, lessons[lid] ? lessons[lid].level : 1); // chỉ tính cách đọc thuộc các cấp tới cấp của bài (tối thiểu 1–3)
    toks.filter((t) => t.t === 'w' && t.v.length === 1 && !t.py && !reliable(t.v) && new Set((lex.get(t.v) || []).filter((e) => !e.level || e.level <= lvCap).map((e) => (e.dict || '').toLowerCase())).size > 1).forEach((t) => warn(`${lid} ${where}: chữ đa âm "${t.v}" chưa chú thích, đang đọc ${t.e.dict} · ${plain}`));
    return { zh: plain, py: sentencePinyin(toks), tokens: toks.filter((t) => t.t !== 'p').map((t) => t.v), words: [...new Set(toks.filter((t) => t.t === 'w' && t.e).map((t) => t.e.id))] };
  };
  for (const [lid, L] of Object.entries(lessons)) {
    const idx = order.indexOf(lid), l = L.raw;
    const d = (l.d || []).map(([sp, zh, v], i) => ({ sp, ...process(lid, idx, zh, `câu ${i + 1}`), vi: v }));
    if (d.length < 3) err(`${lid}: hội thoại cần ít nhất 3 câu`);
    d.forEach((s, i) => { if (!s.vi) err(`${lid}: câu ${i + 1} thiếu nghĩa tiếng Việt`); });
    const unusedNew = L.words.filter((w) => !d.some((s) => s.words.includes(w)) && !(l.g && (l.g[2] || []).some(([zh]) => zh.includes(items.get(w).hanzi))));
    if (unusedNew.length > Math.max(2, L.words.length / 2)) warn(`${lid}: nhiều từ mới không xuất hiện trong hội thoại/ví dụ: ${unusedNew.join(' ')}`);
    const g = l.g ? { title: l.g[0], note: l.g[1], ex: (l.g[2] || []).map(([zh, v], i) => ({ ...process(lid, idx, zh, `ví dụ ${i + 1}`), vi: v })) } : null;
    if (!g) err(`${lid}: thiếu ghi chú ngữ pháp`);
    d.forEach((s, i) => { sentences[`${lid}.${i}`] = { id: `${lid}.${i}`, hanzi: s.zh, pinyin: s.py, vi: s.vi, kind: 'sentence', level: L.level, lesson: lid, parts: s.tokens }; });
    const write = [...(l.w || '')].filter((c) => /\p{Script=Han}/u.test(c));
    for (const ch of write) {
      if (items.has(ch) && items.get(ch).kind === 'char' && (items.get(ch).level || 0) <= Math.max(3, L.level)) continue; // chữ là từ của cấp sau: tạo mục c: riêng
      if (items.has(`c:${ch}`)) continue;
      const host = L.words.map((id) => items.get(id)).find((it) => it.hanzi.includes(ch)) || [...items.values()].find((it) => it.hsk && it.hanzi.includes(ch));
      if (!host) { err(`${lid}: chữ luyện viết ${ch} không thuộc từ nào`); continue; }
      const py = (sylOfWord(host.hanzi, host.dict).find((s) => s.ch === ch) || {}).py || '';
      items.set(`c:${ch}`, { id: `c:${ch}`, hanzi: ch, dict: py, pinyin: py, vi: `chữ trong ${host.hanzi} (${host.vi})`, level: L.level, kind: 'char', lesson: lid, tone: toneOf(py) });
    }
    Object.assign(L, { n: order.filter((id) => (lessons[id] ? lessons[id].level : 1) === L.level).indexOf(lid) + 1, minutes: Math.max(6, Math.round(4 + L.words.length * 0.8 + d.length * 0.5)), grammar: g, dialogue: d.map(({ sp, zh, py, vi: v, tokens }) => ({ sp, zh, py, vi: v, tokens })), write });
    delete L.raw;
  }
  for (const it of items.values()) {
    if (it.hsk && it.lesson && !it.vi) err(`Thiếu nghĩa tiếng Việt cho ${it.id}`);
    if (it.hsk && !splitSyllables(it.dict)) err(`Pinyin không tách được: ${it.id} ${it.dict}`);
  }
  // mạch truyện Bắp & Blu: mở cảnh, nhiệm vụ, kết cảnh, nhá tập sau. Chữ Hán trong truyện cũng chỉ được dùng từ đã học.
  const legacyStories = {};
  const WHO = new Set(['bap', 'blu', 'narr']), EXPR = new Set(['', 'vui', 'cuoi', 'ngac-nhien', 'boi-roi', 'lo', 'buon', 'tu-hao', 'suy-nghi']);
  for (const st of stories) {
    for (const [uid, info] of Object.entries(st.units || {})) {
      const u = units.find((x) => x.id === uid);
      if (!u) { err(`truyện: không có chương ${uid}`); continue; }
      u.story = { season: st.season, ep: info.ep, title: info.title, bg: info.bg };
    }
    for (const [lid, s] of Object.entries(st.lessons || {})) {
      const idx = order.indexOf(lid);
      if (idx < 0) { err(`truyện: không có bài ${lid}`); continue; }
      const unit = units.find((u) => u.lessonIds.includes(lid));
      const lines = [...(s.open || []), ...(s.close || [])];
      if (!(s.open || []).length || !s.mission) err(`truyện ${lid}: cần mở cảnh và nhiệm vụ`);
      lines.forEach(([who, expr]) => { if (!WHO.has(who)) err(`truyện ${lid}: nhân vật lạ "${who}"`); if (!EXPR.has(expr || '')) err(`truyện ${lid}: biểu cảm lạ "${expr}"`); });
      const texts = [...lines.map((l) => l[2]), s.mission, s.next].filter(Boolean);
      for (const t of texts) for (const run of t.match(/[\p{Script=Han}，。？！、…]+/gu) || []) {
        const { toks } = segment(run, lex, (id) => introducedAt.has(id) && introducedAt.get(id) <= idx);
        toks.filter((x) => x.t === 'w' && !x.known).forEach((x) => err(`truyện ${lid}: "${x.v}" chưa học tới bài này · ${t}`));
      }
      const story = { bg: s.bg || (unit && unit.story && unit.story.bg) || '', ep: unit && unit.story ? unit.story.ep : null, epTitle: unit && unit.story ? unit.story.title : '', open: s.open, mission: s.mission, close: s.close || [], next: s.next || '' };
      if (lessons[lid]) lessons[lid].story = story; else legacyStories[lid] = { level: st.level, ...story };
    }
  }
  return { items, lessons, units, order, sentences, errors, warnings, introducedAt, legacyStories };
}

/* ---------- ghi gói ---------- */
function writePacks(res) {
  const outDir = path.join(ROOT, 'dist/content');
  fs.mkdirSync(outDir, { recursive: true });
  const strokeDir = path.join(ROOT, 'dist/vendor/hanzi');
  fs.mkdirSync(strokeDir, { recursive: true });
  const levels = [...new Set(res.units.map((u) => u.level))];
  const writeChars = new Set();
  for (const lv of levels) {
    const lessonIds = res.units.filter((u) => u.level === lv).flatMap((u) => u.lessonIds).filter((id) => res.lessons[id]);
    const pick = (it) => { const o = { ...it }; for (const k of ['hsk', 'n', 'pos']) delete o[k]; if (o.dict === o.pinyin) delete o.dict; Object.keys(o).forEach((k) => o[k] === undefined && delete o[k]); return o; };
    const items = Object.fromEntries([...res.items.values()].filter((it) => it.lesson && res.lessons[it.lesson] && res.lessons[it.lesson].level === lv).map((it) => [it.id, pick(it)]));
    Object.values(res.sentences).filter((s) => s.level === lv).forEach((s) => (items[s.id] = s));
    const lessons = Object.fromEntries(lessonIds.map((id) => [id, res.lessons[id]]));
    lessonIds.forEach((id) => res.lessons[id].write.forEach((c) => writeChars.add(c)));
    const pack = { level: lv, units: res.units.filter((u) => u.level === lv), lessons, items, words: res.items.size ? [...res.items.values()].filter((it) => it.hsk && it.level === lv).length : 0 };
    const ls = Object.fromEntries(Object.entries(res.legacyStories || {}).filter(([, v]) => v.level === lv).map(([k, { level, ...v }]) => [k, v]));
    if (Object.keys(ls).length) pack.stories = ls;
    // ảnh truyện đã có (để app khỏi tải thử ảnh chưa vẽ): assets/story/*.webp
    const sdir = path.join(ROOT, 'dist/assets/story');
    if (fs.existsSync(sdir)) pack.storyAssets = fs.readdirSync(sdir).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, '')).sort();
    fs.writeFileSync(path.join(outDir, `hsk${lv}.js`), `/* BuzzLingo · gói nội dung HSK 3.0 cấp ${lv} — sinh tự động bởi tools/build-content.mjs, đừng sửa tay. */\n(window.BuzzPacks = window.BuzzPacks || []).push(${JSON.stringify(pack)});\n`);
  }
  // dữ liệu nét chữ: mỗi chữ một file script (nạp khi cần, chạy được cả file://)
  const missing = [];
  for (const c of writeChars) {
    const file = path.join(strokeDir, `${c.codePointAt(0).toString(16)}.js`);
    if (fs.existsSync(file)) continue;
    const srcFile = strokesDir && path.join(strokesDir, `${c}.json`);
    if (srcFile && fs.existsSync(srcFile)) {
      const d = JSON.parse(fs.readFileSync(srcFile, 'utf8'));
      fs.writeFileSync(file, `(window.BuzzHanziData = window.BuzzHanziData || {})[${JSON.stringify(c)}] = ${JSON.stringify({ strokes: d.strokes, medians: d.medians, radStrokes: d.radStrokes })};\n`);
    } else missing.push(c);
  }
  return { levels, missing };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const res = build(loadSources());
  res.warnings.forEach((w) => console.log('  ⚠', w));
  res.errors.forEach((e) => console.log('  ✗', e));
  console.log(`${Object.keys(res.lessons).length} bài sinh tự động · ${Object.keys(res.sentences).length} câu hội thoại · ${res.errors.length} lỗi · ${res.warnings.length} cảnh báo`);
  if (res.errors.length) process.exit(1);
  if (!CHECK_ONLY) {
    const { levels, missing } = writePacks(res);
    console.log(`Đã ghi dist/content/hsk{${levels.join(',')}}.js`);
    if (missing.length) { console.log(`  ✗ Thiếu dữ liệu nét cho ${missing.length} chữ: ${missing.join('')} (chạy lại với --strokes <hanzi-writer-data>)`); process.exit(1); }
  }
}
