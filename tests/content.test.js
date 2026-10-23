// Kiểm tra nội dung + ngân hàng câu hỏi + bộ phản biện. Chạy: node --test tests/content.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const Q = require('../dist/js/qbank.js');
const Critique = require('../dist/js/critique.js');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/js/content.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/vendor/hanzi-data.js'), 'utf8'), ctx);
const C = ctx.window.Buzz.Content;
const HZ = ctx.window.BuzzHanziData;
const K = Critique.create(C);

test('nội dung: mọi bước trong bài tồn tại, trỏ tới mục có thật, đáp án hợp lệ', () => {
  assert.deepEqual(Object.keys(C.lessons), [...C.lessonOrder]);
  for (const l of Object.values(C.lessons)) {
    assert.ok(l.stepIds.length >= 10, `${l.id} đủ dài`);
    assert.equal(new Set(l.stepIds).size, l.stepIds.length, `${l.id} không lặp bước`);
    for (const sid of l.stepIds) {
      const s = C.stepById[sid];
      assert.ok(s, `bước ${sid} tồn tại`);
      assert.ok(C.items[s.itemId], `${sid} trỏ tới mục ${s.itemId}`);
      if (s.type === 'choice') {
        assert.ok(s.answer >= 0 && s.answer < s.options.length, `${sid} đáp án nằm trong phương án`);
        const labels = s.options.map((o) => o[0]);
        assert.equal(new Set(labels).size, labels.length, `${sid} phương án không trùng`);
        assert.ok(s.explain && s.prompt && s.title, `${sid} có đề, giải thích`);
      }
      if (s.type === 'order') assert.equal([...s.tokens].sort().join('|'), [...s.target].sort().join('|'), `${sid} token khớp đáp án`);
    }
    // mỗi bài có đủ 4 kỹ năng + tự đặt câu + vé ra cửa
    const types = l.stepIds.map((id) => C.stepById[id]);
    for (const t of ['speak', 'write', 'compose']) assert.ok(types.some((s) => s.type === t), `${l.id} có bước ${t}`);
    assert.ok(types.some((s) => s.exit), `${l.id} có vé ra cửa`);
    assert.ok(C.stepById[l.stepIds.at(-1)].exit, `${l.id} kết thúc bằng vé ra cửa`);
  }
});

test('nội dung: chữ luyện viết có dữ liệu nét và số nét khớp', () => {
  for (const [id, ch] of Object.entries(C.writeChars)) {
    assert.ok(HZ[ch], `có dữ liệu nét cho ${ch}`);
    assert.equal(HZ[ch].strokes.length, C.items[id].strokes, `số nét ${ch}`);
    assert.equal(C.items[id].hanzi, ch);
  }
  for (const s of C.steps.filter((x) => x.type === 'write')) assert.ok(C.writeChars[s.itemId], `${s.id} có chữ viết`);
});

test('nội dung: Pinyin mọi mục tách được âm tiết, số âm tiết khớp số chữ', () => {
  for (const it of Object.values(C.items)) {
    const syl = Q.splitSyllables(it.pinyin);
    assert.ok(syl, `tách được ${it.pinyin}`);
    assert.equal(syl.length, [...it.hanzi.replace(/[？?！!。.，,]/g, '')].length, `${it.hanzi}: ${syl}`);
    if (it.kind === 'char' && it.tone != null) assert.equal(Q.toneOf(it.pinyin), it.tone, `thanh của ${it.hanzi}`);
  }
});

test('nội dung: câu mẫu của mọi bài tự viết đều qua được bộ phản biện', () => {
  for (const s of C.steps.filter((x) => x.type === 'compose')) {
    for (const t of [s.model.hanzi, s.model.pinyin]) {
      const r = K.check(t, s);
      assert.ok(r.pass, `${s.id}: "${t}" → ${JSON.stringify(r.findings)}`);
      assert.equal(r.findings.filter((f) => f.level === 'error').length, 0);
    }
  }
});

test('pinyin: đặt dấu đúng quy tắc, đổi số thanh, tách âm tiết', () => {
  assert.equal(Q.withTone('hao', 3), 'hǎo');
  assert.equal(Q.withTone('gou', 3), 'gǒu'); // ou → o
  assert.equal(Q.withTone('liu', 2), 'liú'); // nguyên âm cuối
  assert.equal(Q.withTone('gui', 4), 'guì');
  assert.equal(Q.withTone('Xie', 4), 'Xiè');
  assert.equal(Q.numberToMark('ni3'), 'nǐ');
  assert.equal(Q.numberToMark('lv4'), 'lǜ');
  assert.equal(Q.numberToMark('ma5'), 'ma');
  assert.deepEqual(Q.splitSyllables('zàijiàn'), ['zài', 'jiàn']);
  assert.deepEqual(Q.splitSyllables('nǐ hǎo ma?'), ['nǐ', 'hǎo', 'ma']);
  assert.equal(Q.splitSyllables('Minh'), null);
  assert.equal(Q.toneOf('xie'), 0);
});

test('đáp án nhiễu Pinyin: cùng âm khác thanh, không lấy cách đọc biến thanh làm đáp án sai', () => {
  const v = Q.toneVariants('nǐ hǎo');
  assert.equal(v.length, 3);
  assert.ok(!v.includes('ní hǎo'), 'ní hǎo là cách đọc thật, không phải lỗi');
  assert.ok(v.every((x) => Q.stripTones(x) === 'ni hao'));
  assert.ok(Q.toneVariants('bú shì').includes('bù shì'), 'bẫy biến thanh của 不');
  assert.deepEqual(Q.toneVariants('ma'), ['mā', 'má', 'mǎ']);
});

test('ngân hàng câu hỏi: mọi mục × kỹ năng sinh được câu có đáp án đúng duy nhất', () => {
  const qb = Q.create(C, { rng: Q.mulberry32(7) });
  const pool = Object.keys(C.items);
  for (let round = 0; round < 15; round++) {
    for (const id of pool) {
      for (const sk of ['tone', 'read', 'meaning', 'audio']) {
        const q = qb.generate(id, sk, { pool });
        assert.ok(q, `${id}:${sk} sinh được câu`);
        assert.equal(q.itemId, id);
        assert.ok(q.generated && q.id.startsWith('q:'));
        if (q.type === 'choice') {
          const labels = q.options.map((o) => o[0]);
          assert.equal(labels.length, 4, `${q.id} có 4 phương án`);
          assert.equal(new Set(labels).size, 4, `${q.id} không trùng: ${labels}`);
          const it = C.items[id];
          const want = { tone: it.pinyin, read: it.pinyin, audio: it.hanzi.replace(/[？?！!。.，,\s]/g, '') }[q.skill];
          if (want && q.skill !== 'meaning') assert.equal(labels[q.answer], want, `${q.id} đáp án đúng nằm ở vị trí answer`);
          if (q.skill === 'meaning') assert.ok([it.vi, it.hanzi.replace(/[？?！!。.，,\s]/g, '')].includes(labels[q.answer]));
          assert.ok(q.explain.includes(it.hanzi.replace(/[？?！!。.，,]/g, '')) || q.explain.includes(it.hanzi));
        } else {
          assert.equal(q.type, 'order');
          assert.notEqual(q.tokens.join(''), q.target.join(''), 'đã xáo trộn');
        }
      }
    }
  }
});

test('ngân hàng câu hỏi: ưu tiên đáp án nhiễu từ mục đã học; bộ phòng luyện không lặp', () => {
  const qb = Q.create(C, { rng: Q.mulberry32(3) });
  const pool = ['你', '好', '你好', '我', '是', '不', '我是'];
  let fromPool = 0, total = 0;
  for (let i = 0; i < 40; i++) {
    const q = qb.generate('你', 'audio', { pool });
    q.options.forEach((o, j) => { if (j === q.answer) return; total++; if (pool.some((id) => C.items[id].hanzi === o[0])) fromPool++; });
  }
  assert.equal(fromPool, total, 'chữ nhiễu khi nghe đều là chữ đã học');
  const set = qb.set(pool, ['audio', 'tone', 'meaning', 'read'], 10);
  assert.equal(set.length, 10);
  assert.equal(new Set(set.map((q) => `${q.itemId}:${q.skill}:${q.type}`)).size, 10);
  assert.ok(set.every((q) => pool.includes(q.itemId)));
});

test('phản biện: chấp nhận chữ Hán, Pinyin có dấu, số thanh; tên riêng Latin', () => {
  const c1 = C.stepById['c1-greet'], c2 = C.stepById['c2-intro'], c3 = C.stepById['c3-thanks'];
  for (const t of ['你好！', 'nǐ hǎo', 'ni3 hao3', 'Nǐ hǎo!']) assert.ok(K.check(t, c1).pass, t);
  const r = K.check('bú shì, wǒ shì Minh.', c2);
  assert.ok(r.pass);
  assert.equal(r.hanzi, '不是，我是 Minh。');
  assert.ok(K.check('不是，我是 Bắp。', c2).pass, 'tên có dấu tiếng Việt');
  assert.ok(K.check('bu4 ke4 qi5, zai4 jian4!', c3).pass);
});

test('phản biện: bắt lỗi hay gặp và luôn hỏi ngược trước khi đưa gợi ý', () => {
  const c1 = C.stepById['c1-greet'], c2 = C.stepById['c2-intro'], c3 = C.stepById['c3-thanks'];
  const codes = (t, s) => K.check(t, s).findings.map((f) => f.code);
  assert.ok(codes('ni hao', c1).includes('no_tone'));
  assert.ok(K.check('ni hao', c1).pass, 'thiếu dấu chỉ là gợi ý');
  assert.ok(codes('nī hǎo', c1).includes('wrong_tone'));
  assert.equal(K.check('nī hǎo', c1).pass, false);
  assert.ok(codes('ní hǎo', c1).includes('third_sandhi'));
  assert.ok(K.check('ní hǎo', c1).pass, 'biến thanh thanh 3 không bị tính sai');
  assert.ok(codes('bù shì, wǒ shì Lan', c2).includes('bu_sandhi'));
  assert.ok(codes('好你', c1).includes('word_order'));
  assert.ok(codes('客不气，再见', c3).includes('word_order'));
  assert.ok(codes('吗你好？', c1).includes('ma_position'));
  assert.ok(codes('你好吗', c1).includes('ma_mark'));
  assert.ok(codes('我是好', c2).includes('shi_adj'));
  assert.ok(codes('xin chào bạn', c1).includes('vietnamese'));
  assert.ok(codes('不是，我是兰。', c2).includes('unknown_char'));
  assert.ok(K.check('不是，我是兰。', c2).pass, 'chữ chưa học chỉ là gợi ý');
  const miss = K.check('wǒ shì Lan', c2);
  assert.equal(miss.pass, false);
  const need = miss.findings.find((f) => f.code === 'need');
  assert.match(need.ask, /\?$/, 'câu hỏi ngược kết thúc bằng dấu hỏi');
  assert.ok(need.fix && !need.ask.includes(need.fix), 'gợi ý cụ thể tách khỏi câu hỏi');
  for (const t of ['nī hǎo', '好你', '吗你好？', '我是好']) for (const f of K.check(t, c2).findings) assert.ok(f.ask.includes('?'), `${f.code} là câu hỏi`);
});

test('phản biện: chỉ coi là chữ đã học những mục được truyền vào', () => {
  const c1 = C.stepById['c1-greet'];
  const l1 = Object.values(C.items).filter((i) => i.lesson === 'l1-nihao');
  const r = K.check('你好，再见！', c1, { known: l1 });
  assert.ok(r.findings.some((f) => f.code === 'unknown_char' && f.ask.includes('再')));
});
