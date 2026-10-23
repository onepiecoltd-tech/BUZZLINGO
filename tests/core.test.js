// Chạy: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const SRS = require('../dist/js/srs.js');
const { createStore, dayKey } = require('../dist/js/store.js');

const T0 = new Date(2026, 9, 14, 10, 0, 0).getTime();
const DAY = SRS.DAY;
const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };

test('FSRS: thẻ mới, khoảng ôn Khó < Ổn < Dễ', () => {
  const c = SRS.newCard('ni', 'meaning', T0);
  const o = SRS.outcomes(c, T0);
  assert.equal(o[1].state, 'learning');
  assert.equal(o[1].dueAt, T0 + 10 * 60 * 1000);
  assert.ok(o[2].scheduledDays < o[3].scheduledDays && o[3].scheduledDays < o[4].scheduledDays);
  assert.equal(o[3].scheduledDays, 4); // S0(Ổn)=3.71 ngày ở retention 90%
  assert.equal(o[4].scheduledDays, 14);
});

test('FSRS: độ nhớ giảm theo thời gian và bằng 90% tại đúng S', () => {
  const s = 5;
  assert.ok(Math.abs(SRS.retrievability(s, s) - 0.9) < 1e-9);
  assert.ok(SRS.retrievability(1, s) > SRS.retrievability(10, s));
});

test('FSRS: ôn đúng hạn tăng stability, quên (Lại) làm giảm và tính lapse', () => {
  let c = SRS.review(SRS.newCard('hao', 'read', T0), 3, T0);
  const s1 = c.stability;
  const t1 = c.dueAt;
  const good = SRS.review(c, 3, t1);
  assert.ok(good.stability > s1, 'stability phải tăng');
  assert.ok(good.scheduledDays > c.scheduledDays, 'khoảng ôn phải dài hơn');
  const lapse = SRS.review(c, 1, t1);
  assert.ok(lapse.stability < s1);
  assert.equal(lapse.lapses, 1);
  assert.equal(lapse.state, 'relearning');
});

test('FSRS: Khó ít hơn Ổn ít hơn Dễ cả ở thẻ đã học', () => {
  let c = SRS.review(SRS.newCard('wo', 'audio', T0), 3, T0);
  const o = SRS.outcomes(c, c.dueAt);
  assert.ok(o[2].scheduledDays < o[3].scheduledDays && o[3].scheduledDays < o[4].scheduledDays);
  assert.ok(o[4].difficulty < o[2].difficulty, 'Dễ làm giảm độ khó');
});

test('Nhãn khoảng ôn tiếng Việt', () => {
  assert.equal(SRS.formatSpan(10 * 60 * 1000), '10 phút');
  assert.equal(SRS.formatSpan(5 * 3600000), '5 giờ');
  assert.equal(SRS.formatSpan(4 * DAY), '4 ngày');
  assert.equal(SRS.formatSpan(21 * DAY), '3 tuần');
  assert.equal(SRS.formatSpan(90 * DAY), '3 tháng');
});

test('Store: không có dữ liệu giả — trạng thái rỗng cho số liệu rỗng', () => {
  const s = createStore({ storage: memStorage(), now: () => T0 });
  const st = s.stats();
  assert.equal(st.totalXp, 0); assert.equal(st.streak, 0); assert.equal(st.retention, null);
  assert.equal(st.skills.listen.accuracy, null);
  assert.equal(s.dueCards().length, 0);
});

test('Store: XP chỉ đến từ attempt; sai thì 0 XP', () => {
  const s = createStore({ storage: memStorage(), now: () => T0 });
  s.recordAttempt({ itemId: 'ni', skill: 'tone', correct: false, xp: 0 });
  s.recordAttempt({ itemId: 'ni', skill: 'meaning', correct: true, xp: 10 });
  const st = s.stats();
  assert.equal(st.totalXp, 10);
  assert.equal(st.today.attempts, 2);
  assert.equal(st.today.correct, 1);
});

test('Store: dữ liệu còn nguyên sau khi tải lại (cùng storage)', () => {
  const storage = memStorage();
  const a = createStore({ storage, now: () => T0 });
  a.setProfile({ name: 'Lan' });
  a.recordAttempt({ itemId: 'ni', skill: 'meaning', correct: true, xp: 10 });
  a.gradeCard('ni', 'meaning', 3);
  const b = createStore({ storage, now: () => T0 });
  assert.equal(b.state.profile.name, 'Lan');
  assert.equal(b.stats().totalXp, 10);
  assert.ok(b.getCard('ni', 'meaning'));
  assert.equal(b.isPersistent(), true);
});

test('Store: storage bị chặn thì báo không bền vững (không giả vờ đã lưu)', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() {} };
  const s = createStore({ storage: broken, now: () => T0 });
  assert.equal(s.isPersistent(), false);
  s.recordAttempt({ itemId: 'ni', skill: 'meaning', correct: true, xp: 10 }); // vẫn chạy trong phiên
  assert.equal(s.stats().totalXp, 10);
});

test('Store: câu sai xếp ôn vào ngày hôm sau, câu đúng ở thẻ chưa đến hạn không đổi lịch', () => {
  const s = createStore({ storage: memStorage(), now: () => T0 });
  const wrong = s.gradeCard('ni', 'tone', 1, { deferToTomorrow: true });
  assert.ok(wrong.card.dueAt >= SRS.startOfNextDay(T0));
  assert.equal(s.dueCards().length, 0);
  const retry = s.gradeCard('ni', 'tone', 3); // làm lại đúng ngay trong buổi
  assert.equal(retry.applied, false);
  assert.equal(s.getCard('ni', 'tone').dueAt, wrong.card.dueAt);
});

test('Store: thẻ đến hạn xuất hiện trong hàng đợi và được chấm lại', () => {
  let t = T0;
  const s = createStore({ storage: memStorage(), now: () => t });
  s.gradeCard('hao', 'read', 3);
  assert.equal(s.dueCards().length, 0);
  t = T0 + 5 * DAY;
  assert.equal(s.dueCards().length, 1);
  const r = s.gradeCard('hao', 'read', 3);
  assert.equal(r.applied, true);
  assert.ok(r.card.scheduledDays > 4);
});

test('Store: streak và mục tiêu tuần tính từ ngày có học', () => {
  let t = T0;
  const s = createStore({ storage: memStorage(), now: () => t });
  for (let i = 3; i >= 0; i--) { t = T0 - i * DAY; s.recordAttempt({ itemId: 'ni', skill: 'meaning', correct: true, xp: 10 }); }
  t = T0;
  assert.equal(s.stats().streak, 4);
  assert.equal(s.stats().weekDays, 4);
  t = T0 + 2 * DAY; // bỏ lỡ hôm nay và hôm qua → mất chuỗi
  assert.equal(s.stats().streak, 0);
});

test('Store: độ chính xác kỹ năng bỏ qua tự đánh giá và cần tối thiểu 3 lượt', () => {
  const s = createStore({ storage: memStorage(), now: () => T0 });
  s.recordAttempt({ itemId: 'ni', skill: 'audio', correct: true, xp: 10 });
  s.recordAttempt({ itemId: 'ni', skill: 'audio', correct: false, xp: 0 });
  assert.equal(s.stats().skills.listen.accuracy, null);
  s.recordAttempt({ itemId: 'ni', skill: 'audio', correct: true, xp: 10 });
  assert.equal(s.stats().skills.listen.accuracy, 67);
  s.recordAttempt({ itemId: 'nihao', skill: 'speak', correct: true, verified: false, xp: 5 });
  assert.equal(s.stats().skills.speak.accuracy, null);
  assert.equal(s.stats().selfAssessed, 1);
});

test('Store: reset xoá sạch', () => {
  const storage = memStorage();
  const s = createStore({ storage, now: () => T0 });
  s.recordAttempt({ itemId: 'ni', skill: 'meaning', correct: true, xp: 10 });
  s.reset();
  assert.equal(s.stats().totalXp, 0);
  assert.equal(storage._m.size, 0);
  assert.ok(dayKey(T0).startsWith('2026-10-14'));
});
