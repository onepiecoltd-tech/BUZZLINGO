// Kiểm tra bộ câu hỏi vàng và bộ chấm. Chạy: node --test tests/eval.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContent, loadGolden, knownFor, toRequest, scoreCase, summarize, mockReply, cost, toMarkdown, toCsv } from '../eval/lib.mjs';

const content = loadContent();
const golden = loadGolden();

test('bộ vàng: đủ ~50 ca, id duy nhất, đủ 6 nhóm, mọi ca thành request hợp lệ', () => {
  const ids = golden.cases.map((c) => c.id);
  assert.ok(golden.cases.length >= 50);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...new Set(golden.cases.map((c) => c.cat))].sort(), ['an-toan', 'dong-vai', 'nghia-ngu-phap', 'phan-bien', 'phu-am', 'thanh-dieu']);
  for (const c of golden.cases) {
    const req = toRequest(c, content);
    assert.equal(req.mode, c.mode);
    assert.ok(c.expect && Array.isArray(c.expect.any) && c.expect.any.length, `${c.id} có tiêu chí`);
    assert.ok(req.known.hanzi.length >= 2, `${c.id} có danh sách chữ đã học`);
  }
  assert.ok(golden.cases.filter((c) => c.mode === 'critique').length >= 10, 'đủ ca phản biện');
});

test('chữ đã học được cộng dồn theo bài', () => {
  assert.deepEqual(knownFor(content, 'l1').hanzi.sort(), ['你', '好'].sort());
  const l2 = knownFor(content, 'l2').hanzi;
  assert.ok(['你', '好', '我', '是', '不', '吗'].every((c) => l2.includes(c)) && !l2.includes('再'));
  assert.ok(knownFor(content, 'l3').hanzi.includes('客'));
});

test('bộ chấm: mô hình giả "tốt" đạt 100%, "tệ" đạt 0%', () => {
  const run = (kind) => golden.cases.map((c) => ({ id: c.id, cat: c.cat, mode: c.mode, latencyMs: 1, usage: { input: 1200, output: 150, reasoning: 0 }, ...scoreCase(c, mockReply(c, kind), toRequest(c, content).known), costUsd: 0.0005 }));
  const good = summarize(run('good')), bad = summarize(run('bad'));
  assert.equal(good.pass, 100);
  assert.equal(bad.pass, 0);
  assert.ok(bad.criteria.known < 50 && bad.criteria.json < 50);
  assert.ok(Math.abs(good.costPerLearnerMonthUsd - 0.9) < 1e-9);
});

test('bộ chấm: bắt chữ chưa học, cụm bị cấm, thiếu ý, quá dài, không phải JSON', () => {
  const c = golden.cases.find((x) => x.id === 'G02'); // 我是好: không được viết 很
  const known = toRequest(c, content).known;
  const ok = scoreCase(c, JSON.stringify({ reply: 'Không nên dùng 是 trước tính từ 好 đâu, câu đó chưa tự nhiên.', zh: null }), known);
  assert.equal(ok.pass, true, JSON.stringify(ok.notes));
  const hen = scoreCase(c, JSON.stringify({ reply: 'Không, phải nói 我很好 vì 是 không đi với tính từ.', zh: null }), known);
  assert.equal(hen.pass, false);
  assert.equal(hen.checks.known, false, 'chữ 很 chưa học');
  assert.equal(hen.checks.forbidden, false);
  assert.equal(scoreCase(c, JSON.stringify({ reply: 'Câu hay đó!' }), known).checks.keywords, false);
  assert.equal(scoreCase(c, JSON.stringify({ reply: 'không 是 '.repeat(80) }), known).checks.length, false);
  assert.equal(scoreCase(c, 'xin chào', known).checks.json, false);
});

test('chi phí và báo cáo', () => {
  assert.equal(cost({ input: 1000000, output: 1000000 }, 'deepseek-flash'), 1.5);
  assert.equal(cost({ input: 1000, output: 0 }, 'model-la', 2, 4), 0.002);
  assert.equal(cost({ input: 1, output: 1 }, 'model-la'), null);
  const results = golden.cases.slice(0, 3).map((c) => ({ id: c.id, cat: c.cat, mode: c.mode, latencyMs: 5, usage: { input: 1, output: 1, reasoning: 0 }, ...scoreCase(c, mockReply(c, 'good'), toRequest(c, content).known), costUsd: null }));
  const run = { provider: 'mock', model: 'm', mock: 'good', startedAt: 'now', goldenVersion: 1, summary: summarize(results), results };
  assert.match(toMarkdown(run), /Đạt toàn bộ tiêu chí/);
  assert.equal(toCsv(run).split('\n').length, 4);
});
