#!/usr/bin/env node
/* Chạy bộ câu hỏi vàng với một nhà cung cấp AI và ghi báo cáo (markdown + CSV + JSON) vào eval/reports/.
 *
 *   API_KEY=... node eval/run-eval.mjs --provider deepseek --model deepseek-flash
 *   API_KEY=... node eval/run-eval.mjs --provider muse --model muse-spark-1.3 --reasoning minimal
 *   node eval/run-eval.mjs --mock good          # kiểm tra đường ống, không gọi API
 *
 * Tuỳ chọn: --only <nhóm|id,id>  --limit N  --concurrency 3  --price-in 0.3 --price-out 1.2  --base-url URL  --out DIR
 * Dùng đúng prompt, kiểm tra đầu vào và làm sạch đầu ra như proxy thật (server/coach-core.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProviderRequest, extractText, extractUsage } from '../server/coach-core.mjs';
import { loadContent, loadGolden, toRequest, scoreCase, summarize, toMarkdown, toCsv, cost, mockReply } from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => { if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
const mock = args.mock === true ? 'good' : args.mock || null;
const provider = (args.provider || (mock ? 'mock' : 'deepseek')).toLowerCase();
const model = args.model || (mock ? `mock-${mock}` : '');
const env = { PROVIDER: provider, API_KEY: process.env[args['key-env'] || 'API_KEY'], MODEL: model || undefined, BASE_URL: args['base-url'], REASONING_EFFORT: args.reasoning };
if (!mock && !env.API_KEY) { console.error('Thiếu API key: đặt biến môi trường API_KEY (hoặc --key-env TÊN_BIẾN), hoặc chạy --mock good.'); process.exit(1); }
if (!mock && !model) console.warn('Gợi ý: truyền --model để báo cáo ghi đúng tên model và tính được chi phí.');

const content = loadContent();
const golden = loadGolden(args.golden);
let cases = golden.cases;
if (args.only) { const f = String(args.only).split(','); cases = cases.filter((c) => f.includes(c.cat) || f.includes(c.id)); }
if (args.limit) cases = cases.slice(0, +args.limit);
const priceIn = args['price-in'] != null ? +args['price-in'] : null, priceOut = args['price-out'] != null ? +args['price-out'] : null;

async function callOnce(req) {
  const { url, init } = buildProviderRequest(env, req);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    const text = await res.text();
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { error: `HTTP ${res.status}: ${text.slice(0, 160)}`, status: res.status, latencyMs };
    const json = JSON.parse(text);
    return { raw: extractText(provider, json), usage: extractUsage(provider, json), latencyMs };
  } catch (e) { return { error: e.name === 'AbortError' ? 'timeout 45s' : e.message, latencyMs: Date.now() - t0 }; }
  finally { clearTimeout(t); }
}

async function runCase(c) {
  const req = toRequest(c, content);
  let out;
  if (mock) out = { raw: mockReply(c, mock), usage: { input: 1200, output: 120, reasoning: 0, cached: 0 }, latencyMs: 1 };
  else {
    out = await callOnce(req);
    if (out.error && (out.status === 429 || out.status >= 500)) { await new Promise((r) => setTimeout(r, 2500)); out = await callOnce(req); }
  }
  const base = { id: c.id, cat: c.cat, mode: c.mode, latencyMs: out.latencyMs, usage: out.usage || { input: 0, output: 0, reasoning: 0, cached: 0 } };
  if (out.error) return { ...base, pass: false, error: out.error, checks: null, notes: [], reply: '', zh: null, costUsd: null };
  const sc = scoreCase(c, out.raw, req.known);
  return { ...base, ...sc, costUsd: cost(base.usage, model, priceIn, priceOut) };
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); process.stdout.write(out[k].pass ? '.' : out[k].error ? 'E' : 'x'); } }));
  process.stdout.write('\n');
  return out;
}

const startedAt = new Date().toISOString();
console.log(`Bộ câu hỏi vàng v${golden.version}: ${cases.length} ca · ${provider}${model ? ` · ${model}` : ''}${mock ? ' (giả lập)' : ''}`);
const results = await pool(cases, +(args.concurrency || 3), runCase);
const run = { provider, model, mock, startedAt, goldenVersion: golden.version, summary: summarize(results), results };
const dir = path.resolve(args.out || path.join(path.dirname(fileURLToPath(import.meta.url)), 'reports'));
fs.mkdirSync(dir, { recursive: true });
const base = path.join(dir, `${startedAt.slice(0, 10)}-${provider}-${(model || 'default').replace(/[^\w.-]/g, '_')}`);
fs.writeFileSync(`${base}.json`, JSON.stringify(run, null, 2));
fs.writeFileSync(`${base}.md`, toMarkdown(run));
fs.writeFileSync(`${base}.csv`, toCsv(run));
const s = run.summary;
console.log(`Đạt ${s.pass}% · chữ đã học ${s.criteria.known}% · JSON ${s.criteria.json}% · lỗi API ${s.errors} · trễ TB ${s.latencyMs.avg} ms`);
if (s.costPerLearnerMonthUsd != null) console.log(`Chi phí ước tính: $${s.costPerCallUsd.toFixed(5)}/lượt · $${s.costPerLearnerMonthUsd.toFixed(2)}/người học/tháng (60 lượt/ngày)`);
console.log(`Báo cáo: ${base}.md (+ .csv, .json)`);
