#!/usr/bin/env node
/* Ghép nhiều báo cáo JSON thành bảng so sánh: node eval/compare.mjs eval/reports/*.json > eval/reports/so-sanh.md */
import fs from 'node:fs';

const files = process.argv.slice(2).filter((f) => f.endsWith('.json'));
if (!files.length) { console.error('Dùng: node eval/compare.mjs eval/reports/*.json'); process.exit(1); }
const runs = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8'))).sort((a, b) => b.summary.pass - a.summary.pass);
const cats = [...new Set(runs.flatMap((r) => Object.keys(r.summary.byCat)))];
const money = (x) => (x == null ? '—' : `$${x < 0.01 ? x.toFixed(5) : x.toFixed(2)}`);
const head = ['Chỉ số', ...runs.map((r) => `${r.provider} · ${r.model}${r.mock ? ' (giả lập)' : ''}`)];
const row = (label, f) => `| ${label} | ${runs.map(f).join(' | ')} |`;
const out = [
  '# So sánh nhà cung cấp AI · bộ câu hỏi vàng', '',
  `Xếp theo tỉ lệ đạt. Tiêu chí quan trọng nhất với BuzzLingo: **chỉ dùng chữ đã học** và **đúng Pinyin/thanh** (đọc câu trả lời trong từng báo cáo), sau đó mới tới giá.`, '',
  `| ${head.join(' | ')} |`, `| ${head.map((_, i) => (i ? '---:' : '---')).join(' | ')} |`,
  row('**Đạt toàn bộ**', (r) => `**${r.summary.pass}%**`),
  row('Chỉ dùng chữ đã học', (r) => `${r.summary.criteria.known}%`),
  row('JSON hợp lệ', (r) => `${r.summary.criteria.json}%`),
  row('Có ý cần có', (r) => `${r.summary.criteria.keywords}%`),
  row('Không có cụm bị cấm', (r) => `${r.summary.criteria.forbidden}%`),
  ...cats.map((c) => row(`· ${c}`, (r) => (r.summary.byCat[c] ? `${r.summary.byCat[c].pass}%` : '—'))),
  row('Lỗi API', (r) => r.summary.errors),
  row('Độ trễ TB / p90', (r) => `${r.summary.latencyMs.avg} / ${r.summary.latencyMs.p90} ms`),
  row('Token TB vào / ra / suy nghĩ', (r) => `${r.summary.tokens.input} / ${r.summary.tokens.output} / ${r.summary.tokens.reasoning}`),
  row('Chi phí / lượt', (r) => money(r.summary.costPerCallUsd)),
  row('Chi phí / người học / tháng', (r) => money(r.summary.costPerLearnerMonthUsd)),
  '', `_Nguồn: ${files.join(', ')}_`,
];
console.log(out.join('\n'));
