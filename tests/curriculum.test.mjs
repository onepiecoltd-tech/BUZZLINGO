// Kiểm tra chương trình HSK 3.0 + máy sinh bài. Chạy: node --test tests/curriculum.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build, loadSources, segment, sentencePinyin } from '../tools/build-content.mjs';
import { displayWordPinyin } from '../tools/pinyin.mjs';
const require = createRequire(import.meta.url);
const LessonGen = require('../dist/js/lessongen.js');

const src = loadSources();
const res = build(src);

test('chương trình: 0 lỗi, đúng số từ chuẩn, mỗi từ dạy đúng một lần', () => {
  assert.deepEqual(res.errors, []);
  assert.deepEqual(src.hsk.counts.words, [500, 772, 973, 1000, 1071, 1140]);
  for (const cur of src.curricula.filter((c) => c.complete)) {
    const want = src.hsk.words.filter((w) => w.level === cur.level).map((w) => w.id);
    const taught = new Set(Object.values(res.lessons).filter((l) => l.level === cur.level).flatMap((l) => l.words));
    Object.values(src.legacy.items).forEach((i) => taught.add(i.id));
    assert.deepEqual(want.filter((id) => !taught.has(id)), [], `HSK ${cur.level}: từ chưa dạy`);
  }
});

test('chương trình: mọi từ HSK đã dạy có nghĩa tiếng Việt, mọi hội thoại có ≥3 câu và chỉ dùng từ đã học', () => {
  for (const it of res.items.values()) if (it.hsk && it.lesson) assert.ok(it.vi, `thiếu nghĩa ${it.id}`);
  for (const L of Object.values(res.lessons)) {
    assert.ok(L.dialogue.length >= 3, L.id);
    assert.ok(L.grammar && L.grammar.note, `${L.id} có ngữ pháp`);
    L.dialogue.forEach((d) => { assert.ok(d.py && d.vi, `${L.id}: ${d.zh}`); assert.doesNotMatch(d.py, /\?\?|undefined/); });
  }
});

test('Pinyin: biến thanh 不/一 kiểu sách giáo khoa, giữ yī khi là số, viết hoa đầu câu', () => {
  assert.equal(displayWordPinyin('不客气', 'bùkèqi'), 'búkèqi');
  assert.equal(displayWordPinyin('一起', 'yīqǐ'), 'yìqǐ');
  assert.equal(displayWordPinyin('一样', 'yīyàng'), 'yíyàng');
  const lex = new Map([...res.items.values()].map((it) => [it.hanzi.replace(/[？?！!。，]/g, ''), [it]]));
  const py = (t) => sentencePinyin(segment(t, lex, () => true).toks);
  assert.equal(py('我有一个弟弟，没有妹妹。'), 'Wǒ yǒu yí gè dìdi, méiyǒu mèimei.');
  assert.equal(py('不饿，我很渴。'), 'Bú è, wǒ hěn kě.');
  assert.equal(py('这是第一页。'), 'Zhè shì dì yī yè.');
  assert.match(py('十一'), /^Shí ?yī$/);
  assert.match(py('你好！我叫 Lan。'), /^Nǐ hǎo! Wǒ jiào Lan\.$/);
});

test('máy sinh bài: mỗi bài có đủ các dạng bước, mã bước ổn định và duy nhất', () => {
  const C = { items: {}, lessons: {} };
  for (const it of res.items.values()) C.items[it.id] = it;
  Object.values(res.sentences).forEach((s) => (C.items[s.id] = s));
  const LG = LessonGen.create(C);
  for (const L of Object.values(res.lessons)) {
    const a = LG.stepsFor(L), b = LG.stepsFor(L);
    assert.deepEqual(a.map((s) => s.id), b.map((s) => s.id), `${L.id} ổn định`);
    assert.equal(new Set(a.map((s) => s.id)).size, a.length, `${L.id} mã duy nhất`);
    const types = new Set(a.map((s) => s.type));
    for (const t of ['learn', 'note', 'dialogue', 'choice', 'speak', 'compose']) assert.ok(types.has(t), `${L.id} có bước ${t}`);
    assert.ok(a.length >= 10 && a.length <= 24, `${L.id}: ${a.length} bước`);
    a.filter((s) => s.type === 'choice').forEach((s) => { assert.equal(new Set(s.options.map((o) => o[0])).size, s.options.length, `${s.id} không trùng phương án`); assert.ok(s.answer >= 0); });
    a.filter((s) => s.type === 'write').forEach((s) => assert.ok(C.items[s.itemId], `${s.id} có mục chữ`));
  }
});

test('chương trình: đủ sáu cấp HSK 1–6 và cấp nào cũng đánh dấu hoàn chỉnh', () => {
  assert.deepEqual(src.curricula.map((c) => [c.level, c.complete]), [[1, true], [2, true], [3, true], [4, true], [5, true], [6, true]]);
  const n = (lv) => Object.values(res.lessons).filter((l) => l.level === lv).length;
  assert.ok(n(2) >= 80 && n(3) >= 95 && n(4) >= 95 && n(5) >= 100 && n(6) >= 100, `số bài: ${[2, 3, 4, 5, 6].map((lv) => `HSK${lv} ${n(lv)}`).join(', ')}`);
});

test('Pinyin HSK 3: luật đa âm và tách từ theo ngữ cảnh', () => {
  // dùng đúng tập "đã biết" của một bài cuối khoá để mọi cách đọc đều có mặt
  const lex = new Map();
  for (const it of res.items.values()) { const h = it.hanzi.replace(/[？?！!。，]/g, ''); if (!lex.has(h)) lex.set(h, []); lex.get(h)[it.kind === 'particle' ? 'unshift' : 'push'](it); }
  const py = (t) => sentencePinyin(segment(t, lex, () => true).toks);
  const toks = (t) => segment(t, lex, () => true).toks.map((x) => x.v).join(' ');
  assert.match(toks('每个人都来了'), /^每 个 人/);                 // không nhận 个人 (cá nhân) sau 每/一/这…
  assert.match(py('这个房子贵不贵？'), /guì bu guì/);              // hỏi chính phản: 不 đọc nhẹ
  assert.match(py('我保证不说。'), /bǎozhèng bù shuō/);           // động từ + 不 + động từ ≠ bổ ngữ khả năng
  assert.match(py('我一个人吃不了。'), /chī bu liǎo/);              // V不了 = liǎo
  assert.match(py('太好了！'), /hǎo le/);                           // 了 trợ từ vẫn là le
  assert.match(py('家里有一只猫。'), /yì zhī māo/);                 // 只 lượng từ
  assert.match(py('他得了金牌。'), /dé le/);                        // 得 + 了 = dé
  assert.match(py('给你一百块。'), /yì bǎi/);                       // 一 trước 百 vẫn biến thanh
  assert.match(py('你今天很精神{jīngshen}！'), /jīngshen!/);        // chú thích chọn cả từ
  assert.match(py('第三行{háng}有错字。'), /háng/);
  assert.match(py('他说“好”。'), /shuō "hǎo"/);                    // khoảng trắng trước ngoặc kép mở
  // HSK 4–6
  assert.match(py('得了，别说了。'), /^Déle,/);                     // 得了 (thôi được) chỉ khi đứng đầu vế câu
  assert.match(py('一共三十多个人。'), /duō gè rén/);              // không nhận 个人 sau 多
  assert.match(py('我要在家看{kān}孩子。'), /kān háizi/);
  assert.match(py('他把我的话当{dàng}真了。'), /dàng zhēn/);
  assert.match(py('我先拖地{dì}。'), /tuō dì/);
  assert.match(toks('比如|一座山'), /^比如 一/);                   // dấu | ngăn ghép 如一
});

test('truyện Bắp & Blu: đủ 14 bài thử nghiệm, nhân vật/biểu cảm hợp lệ, chữ Hán trong truyện đã học', () => {
  const st = src.stories.find((s) => s.level === 1);
  assert.ok(st, 'có content/story/hsk1.json');
  const ids = Object.keys(st.lessons);
  assert.equal(ids.length, 14);
  for (const id of ids) {
    const L = res.lessons[id] || res.legacyStories[id];
    assert.ok(L && (L.story || L.open), `${id} có truyện`);
  }
  assert.deepEqual(res.units.filter((u) => u.story).map((u) => u.story.ep), [1, 2, 3]);
  // dùng chữ chưa học trong truyện phải báo lỗi
  const fresh = loadSources(); // build() sửa dữ liệu tại chỗ nên dùng bản nạp mới
  const bad = { ...fresh, stories: JSON.parse(JSON.stringify(fresh.stories)) };
  bad.stories[0].lessons['l1-nihao'].open[0][2] = 'Blu nói 谢谢 ngay từ bài đầu.';
  assert.ok(build(bad).errors.some((e) => /truyện l1-nihao: "谢谢"/.test(e)));
});
