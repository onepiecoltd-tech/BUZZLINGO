/* BuzzLingo · thư viện chấm bộ câu hỏi vàng (dùng chung cho run-eval, compare và test). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRequest, sanitizeReply, parseModelJson } from '../server/coach-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Giá USD / 1M token (tra ngày 15/10/2026). Kiểm tra lại trước khi dùng; ghi đè bằng --price-in/--price-out. */
export const PRICES = {
  'deepseek-flash': [0.30, 1.20], 'gpt-5-nano': [0.05, 0.40], 'gpt-5.4-nano': [0.20, 1.25], 'gpt-5.4-mini': [0.75, 4.50],
  'gemini-2.5-flash-lite': [0.10, 0.40], 'gemini-3.1-flash-lite': [0.25, 1.50], 'gemini-3-flash': [0.50, 3.00],
  'muse-spark-1.3': [1.25, 4.25], 'muse-spark-1.3-contributor': [0.10, 0.20],
};

export function loadContent() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'dist/js/content.js'), 'utf8'), ctx);
  return ctx.window.Buzz.Content;
}

export function loadGolden(file = path.join(ROOT, 'eval/golden.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Danh sách chữ/từ đã học khi học tới bài "l2" (cộng dồn l1 + l2), đúng định dạng app gửi cho proxy. */
export function knownFor(content, lesson) {
  const upto = content.lessonOrder.findIndex((id) => id.startsWith(lesson + '-'));
  const ids = content.lessonOrder.slice(0, upto < 0 ? 1 : upto + 1);
  const items = Object.values(content.items).filter((it) => ids.includes(it.lesson));
  return { hanzi: [...new Set(items.flatMap((i) => [...i.hanzi.replace(/[？?！!。.，,]/g, '')]))], words: items.map((i) => ({ hanzi: i.hanzi, pinyin: i.pinyin, vi: i.vi })) };
}

/** Đổi một ca vàng thành request đã kiểm tra hợp lệ (như proxy thật nhận). */
export function toRequest(c, content) {
  const body = { mode: c.mode, persona: c.persona, uid: 'eval', known: knownFor(content, c.lesson), step: c.step, history: c.history || [], message: c.message || '' };
  const v = validateRequest(body);
  if (!v.ok) throw new Error(`${c.id}: ${v.error}`);
  return v.value;
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFC');
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

/** Chấm một câu trả lời thô của mô hình. Trả { pass, checks: {...}, reply, zh, notes[] }. */
export function scoreCase(c, rawText, known) {
  const notes = [];
  const parsed = parseModelJson(rawText);
  const clean = sanitizeReply(parsed, known.hanzi);
  const checks = { json: !!clean, known: false, keywords: false, forbidden: false, length: false };
  if (!clean) { notes.push('Không phải JSON hợp lệ có "reply"'); return { pass: false, checks, reply: String(rawText || '').slice(0, 400), zh: null, notes }; }
  const full = `${clean.reply} ${parsed.zh && typeof parsed.zh === 'object' ? `${parsed.zh.hanzi || ''} ${parsed.zh.pinyin || ''} ${parsed.zh.vi || ''}` : ''}`;
  checks.known = clean.flags.length === 0;
  if (!checks.known) notes.push(`Dùng chữ chưa học (${clean.flags.join(', ')})`);
  const groups = (c.expect && c.expect.any) || [];
  const missing = groups.filter((g) => !g.some((k) => norm(full).includes(norm(k))));
  checks.keywords = missing.length === 0;
  if (missing.length) notes.push(`Thiếu ý: ${missing.map((g) => g.join(' / ')).join(' ; ')}`);
  const bad = ((c.expect && c.expect.none) || []).filter((k) => norm(full).includes(norm(k)));
  checks.forbidden = bad.length === 0;
  if (bad.length) notes.push(`Có cụm bị cấm: ${bad.join(', ')}`);
  const max = (c.expect && c.expect.maxWords) || 120;
  checks.length = words(clean.reply) <= max;
  if (!checks.length) notes.push(`Dài ${words(clean.reply)} từ (> ${max})`);
  return { pass: Object.values(checks).every(Boolean), checks, reply: clean.reply, zh: clean.zh, notes };
}

export function cost(usage, model, priceIn, priceOut) {
  const [pi, po] = priceIn != null && priceOut != null ? [priceIn, priceOut] : PRICES[model] || [null, null];
  if (pi == null) return null;
  return (usage.input * pi + usage.output * po) / 1e6;
}

/** Tổng hợp kết quả: tỉ lệ đạt chung/theo nhóm/theo tiêu chí, độ trễ, token, chi phí. */
export function summarize(results, { callsPerDay = 60 } = {}) {
  const n = results.length || 1;
  const rate = (f) => Math.round((results.filter(f).length / n) * 1000) / 10;
  const cats = {};
  for (const r of results) { (cats[r.cat] = cats[r.cat] || []).push(r); }
  const byCat = Object.fromEntries(Object.entries(cats).map(([k, rs]) => [k, { n: rs.length, pass: Math.round((rs.filter((r) => r.pass).length / rs.length) * 1000) / 10 }]));
  const ok = results.filter((r) => !r.error);
  const avg = (f) => (ok.length ? ok.reduce((s, r) => s + f(r), 0) / ok.length : 0);
  const lat = ok.map((r) => r.latencyMs).sort((a, b) => a - b);
  const costs = ok.map((r) => r.costUsd).filter((x) => x != null);
  const perCall = costs.length ? costs.reduce((s, x) => s + x, 0) / costs.length : null;
  return {
    cases: results.length, pass: rate((r) => r.pass), errors: results.filter((r) => r.error).length, byCat,
    criteria: { json: rate((r) => r.checks && r.checks.json), known: rate((r) => r.checks && r.checks.known), keywords: rate((r) => r.checks && r.checks.keywords), forbidden: rate((r) => r.checks && r.checks.forbidden), length: rate((r) => r.checks && r.checks.length) },
    latencyMs: { avg: Math.round(avg((r) => r.latencyMs)), p90: lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.9))] : 0 },
    tokens: { input: Math.round(avg((r) => r.usage.input)), output: Math.round(avg((r) => r.usage.output)), reasoning: Math.round(avg((r) => r.usage.reasoning)) },
    costPerCallUsd: perCall, costPerLearnerMonthUsd: perCall == null ? null : perCall * callsPerDay * 30,
  };
}

/** Bản tin markdown cho một lần chạy. */
export function toMarkdown(run) {
  const s = run.summary;
  const pct = (x) => `${x}%`;
  const money = (x) => (x == null ? '—' : `$${x < 0.01 ? x.toFixed(5) : x.toFixed(2)}`);
  const lines = [
    `# Đánh giá AI · ${run.provider} · ${run.model}`, '',
    `Chạy lúc ${run.startedAt}${run.mock ? ` · **giả lập (${run.mock})**, không gọi API thật` : ''}. Bộ câu hỏi vàng v${run.goldenVersion}, ${s.cases} ca.`, '',
    `| Chỉ số | Giá trị |`, `| --- | ---: |`,
    `| **Đạt toàn bộ tiêu chí** | **${pct(s.pass)}** |`, `| JSON hợp lệ | ${pct(s.criteria.json)} |`, `| Chỉ dùng chữ đã học | ${pct(s.criteria.known)} |`,
    `| Có ý cần có (từ khoá) | ${pct(s.criteria.keywords)} |`, `| Không có cụm bị cấm | ${pct(s.criteria.forbidden)} |`, `| Độ dài ≤ 120 từ | ${pct(s.criteria.length)} |`,
    `| Lỗi gọi API | ${s.errors} |`, `| Độ trễ TB / p90 | ${s.latencyMs.avg} ms / ${s.latencyMs.p90} ms |`,
    `| Token TB mỗi lượt (vào / ra / suy nghĩ) | ${s.tokens.input} / ${s.tokens.output} / ${s.tokens.reasoning} |`,
    `| Chi phí mỗi lượt | ${money(s.costPerCallUsd)} |`, `| Chi phí mỗi người học / tháng (60 lượt/ngày) | ${money(s.costPerLearnerMonthUsd)} |`, '',
    '## Theo nhóm', '', '| Nhóm | Số ca | Đạt |', '| --- | ---: | ---: |',
    ...Object.entries(s.byCat).map(([k, v]) => `| ${k} | ${v.n} | ${pct(v.pass)} |`), '',
    '## Từng ca (đọc câu trả lời — từ khoá chỉ là heuristic)', '', '| Ca | Đạt | Ghi chú | Câu trả lời |', '| --- | :---: | --- | --- |',
    ...run.results.map((r) => `| ${r.id} | ${r.pass ? '✓' : '✗'} | ${(r.error ? `Lỗi: ${r.error}` : r.notes.join('; ')).replace(/\|/g, '/')} | ${String(r.reply || '').replace(/\s+/g, ' ').replace(/\|/g, '/').slice(0, 220)}${r.zh ? ` [${r.zh.hanzi} ${r.zh.pinyin}]` : ''} |`),
    '', '_Chấm tay: thêm cột điểm 1–5 cho “đúng Pinyin/thanh”, “đúng nghĩa”, “tiếng Việt tự nhiên” trong file CSV đi kèm._',
  ];
  return lines.join('\n');
}

export function toCsv(run) {
  const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const head = ['id', 'cat', 'mode', 'pass', 'json', 'known', 'keywords', 'forbidden', 'length', 'latency_ms', 'tokens_in', 'tokens_out', 'tokens_reasoning', 'cost_usd', 'notes', 'reply', 'zh', 'diem_pinyin_1_5', 'diem_nghia_1_5', 'diem_tieng_viet_1_5'];
  const rows = run.results.map((r) => [r.id, r.cat, r.mode, r.pass, r.checks && r.checks.json, r.checks && r.checks.known, r.checks && r.checks.keywords, r.checks && r.checks.forbidden, r.checks && r.checks.length, r.latencyMs, r.usage.input, r.usage.output, r.usage.reasoning, r.costUsd, r.error || r.notes.join('; '), r.reply, r.zh ? `${r.zh.hanzi} ${r.zh.pinyin}` : '', '', '', '']);
  return '﻿' + [head, ...rows].map((row) => row.map(q).join(',')).join('\n');
}

/** Mô hình giả để kiểm tra đường ống: 'good' trả lời đạt yêu cầu, 'bad' cố tình vi phạm. */
export function mockReply(c, kind) {
  if (kind === 'bad') {
    const variants = ['đây không phải json', JSON.stringify({ reply: 'Hãy học chữ 爱 và 很 nhé! ' + ((c.expect.none || [])[0] || ''), zh: { hanzi: '我爱你', pinyin: 'wǒ ài nǐ', vi: 'anh yêu em' } }), JSON.stringify({ reply: 'ok '.repeat(150) })];
    return variants[c.id.charCodeAt(1) % variants.length];
  }
  const parts = ((c.expect && c.expect.any) || []).map((g) => g[0]);
  return JSON.stringify({ reply: `Mình giải thích ngắn nhé: ${parts.join(', ')}. Bạn thử lại xem?`, zh: null });
}
