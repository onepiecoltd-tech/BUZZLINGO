/* Kiểm thử đồng bộ Supabase: gộp dữ liệu (Store.mergeStates) và bộ đồng bộ (cloud.js) với Supabase giả. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Store = require('../dist/js/store.js');
const { createCloud, AUTH_KEY } = require('../dist/js/cloud.js');
const { createFakeSupabase } = require('./fake-supabase.cjs');

const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), _m: m }; };
const DAY = 86400000;
let clock = Date.parse('2026-10-20T03:00:00Z');
const now = () => clock;

/** Một "máy": kho dữ liệu + bộ đồng bộ, hẹn giờ bằng tay để kiểm soát được. */
function device(fake, storage = memStorage(), opts = {}) {
  const timers = [];
  const store = Store.createStore({ storage, now });
  const cloud = createCloud({ url: 'https://demo.supabase.co', anonKey: 'sb_publishable_demo', store, storage, fetchImpl: opts.fetchImpl || fake.fetchImpl, now, setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: () => { timers.length = 0; } });
  return { store, cloud, storage, timers, runTimers: async () => { const t = timers.splice(0); for (const x of t) await x.fn(); await new Promise((r) => setTimeout(r, 0)); } };
}
const learn = (store, itemId, correct = true, xp = 10) => { clock += 60000; store.recordAttempt({ itemId, skill: 'meaning', correct, xp }); };

test('mergeStates: hợp lượt làm bài, không trùng, không phụ thuộc thứ tự, gộp lại vẫn y nguyên', () => {
  const sa = Store.createStore({ storage: memStorage(), now }), sb = Store.createStore({ storage: memStorage(), now });
  sa.setProfile({ name: 'Lan', goal: 'talk' });
  learn(sa, '你'); learn(sa, '好', false);
  clock += 1000; sb.setProfile({ name: 'Lan B', placed: { 2: true } });
  learn(sb, '我'); learn(sb, '你');
  sa.completeLesson('h1-01', { score: 7, total: 10 });
  sb.completeLesson('h1-01', { score: 9, total: 10 }); sb.completeLesson('h1-02', { score: 5, total: 10 });
  const ab = Store.mergeStates(sa.state, sb.state), ba = Store.mergeStates(sb.state, sa.state);
  assert.equal(ab.attempts.length, 4);
  assert.deepEqual(ab, ba, 'gộp A+B và B+A ra cùng kết quả');
  assert.deepEqual(Store.mergeStates(ab, sa.state), ab, 'gộp lại lần nữa không thay đổi gì');
  assert.deepEqual(Store.mergeStates(ab, ab), ab);
  const day = Object.values(ab.days)[0];
  assert.equal(day.attempts, 4); assert.equal(day.correct, 3); assert.equal(day.xp, 40);
  assert.equal(ab.lessons['h1-01'].bestScore, 9); assert.equal(ab.lessons['h1-01'].runs, 1); assert.ok(ab.lessons['h1-02']);
  assert.equal(ab.profile.name, 'Lan B', 'hồ sơ lấy bản sửa sau cùng'); assert.deepEqual(ab.profile.placed, { 2: true });
});

test('mergeStates: thẻ SRS giữ bản ôn gần nhất; bài đang dở theo bên cập nhật sau (kể cả khi đã xoá)', () => {
  const sa = Store.createStore({ storage: memStorage(), now }), sb = Store.createStore({ storage: memStorage(), now });
  sa.gradeCard('你', 'meaning', 3); clock += DAY * 3; sb.gradeCard('你', 'meaning', 3); clock += DAY * 9; sb.gradeCard('你', 'meaning', 4);
  const m = Store.mergeStates(sa.state, sb.state);
  assert.equal(m.cards['你:meaning'].reps, sb.state.cards['你:meaning'].reps);
  sa.setSession({ kind: 'lesson', lessonId: 'h1-03', index: 2 }); clock += 1000; sb.setSession({ kind: 'lesson', lessonId: 'h1-04', index: 1 }); clock += 1000; sb.clearSession();
  assert.equal(Store.mergeStates(sa.state, sb.state).session, null, 'bài đã học xong ở máy B thì không hiện lại');
  clock += 1000; sa.setSession({ kind: 'lesson', lessonId: 'h1-05', index: 4 });
  assert.equal(Store.mergeStates(sa.state, sb.state).session.lessonId, 'h1-05');
});

test('mergeStates: ngày cũ đã bị cắt khỏi danh sách lượt làm vẫn giữ số liệu', () => {
  const a = Store.emptyState(), b = Store.emptyState();
  a.days['2026-01-01'] = { xp: 50, attempts: 5, correct: 4 };
  b.days['2026-01-01'] = { xp: 20, attempts: 2, correct: 2 };
  assert.deepEqual(Store.mergeStates(a, b).days['2026-01-01'], { xp: 50, attempts: 5, correct: 4 });
});

test('chưa điền cấu hình → tắt đồng bộ, không gọi mạng', async () => {
  const calls = [];
  const store = Store.createStore({ storage: memStorage(), now });
  const c = createCloud({ url: '', anonKey: '', store, storage: memStorage(), fetchImpl: async () => { calls.push(1); } });
  assert.equal(c.configured, false);
  assert.equal((await c.signIn('a@b.c', '123456')).ok, false);
  assert.equal(calls.length, 0);
});

test('tạo tài khoản ở máy A → đăng nhập ở máy B lấy đủ tiến độ → học tiếp ở B → A nhận được', async () => {
  const fake = createFakeSupabase();
  const A = device(fake);
  A.store.setProfile({ name: 'Minh' }); learn(A.store, '你'); learn(A.store, '好'); A.store.completeLesson('h1-01', { score: 8, total: 10 });
  const r = await A.cloud.signUp('minh@example.com', 'matkhau1');
  assert.equal(r.ok, true); assert.equal(r.synced, true);
  assert.equal(fake.rows.size, 1);
  const row = [...fake.rows.values()][0];
  assert.equal(row.data.attempts.length, 2, 'dữ liệu học trước khi đăng nhập được giữ và đẩy lên');
  // không gửi khoá dưới dạng Authorization khi chưa có token người dùng
  const signupCall = fake.log.find((x) => x.path.startsWith('/auth/v1/signup'));
  assert.ok(signupCall);

  const B = device(fake);
  assert.equal(B.cloud.status().signedIn, false);
  const rb = await B.cloud.signIn('minh@example.com', 'matkhau1');
  assert.equal(rb.ok, true);
  assert.equal(B.store.state.profile.name, 'Minh');
  assert.equal(B.store.state.attempts.length, 2);
  assert.equal(B.store.state.lessons['h1-01'].status, 'done');

  learn(B.store, '我'); learn(B.store, '是');
  assert.equal(B.cloud.status().dirty, true);
  assert.equal(B.timers.length, 1, 'thay đổi được gom lại, hẹn giờ gửi');
  await B.runTimers();
  assert.equal([...fake.rows.values()][0].data.attempts.length, 4);

  learn(A.store, '他'); // A học thêm trong lúc chưa biết B đã học
  await A.cloud.sync();
  assert.equal(A.store.state.attempts.length, 5, 'A gộp bài của B, không mất bài của mình');
  await B.cloud.sync();
  assert.equal(B.store.state.attempts.length, 5);
  assert.deepEqual(A.store.state.attempts.map((x) => x.itemId), B.store.state.attempts.map((x) => x.itemId));
});

test('Safari xoá dữ liệu: máy trắng trơn, đăng nhập lại là có đủ tiến độ', async () => {
  const fake = createFakeSupabase();
  const storage = memStorage();
  const A = device(fake, storage);
  A.store.setProfile({ name: 'Lan' }); learn(A.store, '你'); learn(A.store, '们');
  await A.cloud.signUp('lan@example.com', 'abcdef');
  storage.clear(); // ITP xoá localStorage (cả phiên đăng nhập)
  const A2 = device(fake, storage);
  assert.equal(A2.store.state.profile, null); assert.equal(A2.cloud.status().signedIn, false);
  await A2.cloud.signIn('lan@example.com', 'abcdef');
  assert.equal(A2.store.state.profile.name, 'Lan');
  assert.equal(A2.store.state.attempts.length, 2);
  assert.ok(storage.getItem(Store.KEY), 'đã ghi lại vào máy');
});

test('mở lại app khi vẫn còn phiên: tự đồng bộ, không cần đăng nhập lại', async () => {
  const fake = createFakeSupabase();
  const storage = memStorage();
  const A = device(fake, storage);
  await A.cloud.signUp('x@example.com', 'abcdef');
  const A2 = device(fake, storage);
  assert.equal(A2.cloud.status().signedIn, true);
  assert.equal(A2.cloud.status().email, 'x@example.com');
  const r = await A2.cloud.sync();
  assert.equal(r.ok, true);
  const gets = fake.log.filter((x) => x.path.includes('select=data'));
  assert.equal(gets.length, 0, 'không có gì mới trên đám mây thì không tải lại toàn bộ dữ liệu');
});

test('token hết hạn → tự làm mới; refresh token hỏng → đăng xuất kèm lời nhắn', async () => {
  const fake = createFakeSupabase({ tokenTtl: 3600 });
  const A = device(fake);
  await A.cloud.signUp('t@example.com', 'abcdef');
  fake.expireAll();
  learn(A.store, '你');
  assert.equal((await A.cloud.sync()).ok, true, 'token cũ bị từ chối → làm mới rồi gửi lại');
  clock += 2 * 3600 * 1000; // quá hạn theo đồng hồ → làm mới trước khi gọi
  assert.equal((await A.cloud.sync()).ok, true);
  const storage = A.storage;
  const auth = JSON.parse(storage.getItem(AUTH_KEY)); auth.refresh_token = 'hong'; auth.expires_at = 0; storage.setItem(AUTH_KEY, JSON.stringify(auth));
  const A2 = device(fake, storage);
  const r = await A2.cloud.sync();
  assert.equal(r.ok, false);
  const s = A2.cloud.status();
  assert.equal(s.signedIn, false); assert.match(s.error, /hết hạn/);
  assert.equal(storage.getItem(AUTH_KEY), null);
});

test('lỗi đăng nhập/đăng ký trả lời bằng tiếng Việt; bật xác nhận email thì báo kiểm tra hộp thư', async () => {
  const fake = createFakeSupabase({ confirmEmail: true });
  const A = device(fake);
  const up = await A.cloud.signUp('c@example.com', 'abcdef');
  assert.equal(up.ok, true); assert.equal(up.needConfirm, true); assert.equal(A.cloud.status().signedIn, false);
  assert.match((await A.cloud.signIn('c@example.com', 'abcdef')).error, /chưa được xác nhận/);
  assert.match((await A.cloud.signUp('c@example.com', 'abcdef')).error, /đã có tài khoản/);
  fake.confirmAll();
  assert.match((await A.cloud.signIn('c@example.com', 'sai-mat-khau')).error, /Sai email hoặc mật khẩu/);
  assert.equal((await A.cloud.signIn('c@example.com', 'abcdef')).ok, true);
  const B = device(createFakeSupabase());
  assert.match((await B.cloud.signUp('d@example.com', '123')).error, /ít nhất 6/);
});

test('mất mạng: vẫn lưu trên máy, báo ngoại tuyến, có mạng lại thì gửi', async () => {
  const fake = createFakeSupabase();
  let online = true;
  const A = device(fake, memStorage(), { fetchImpl: (u, o) => (online ? fake.fetchImpl(u, o) : Promise.reject(new TypeError('Failed to fetch'))) });
  await A.cloud.signUp('o@example.com', 'abcdef');
  online = false; learn(A.store, '你');
  const r = await A.cloud.sync();
  assert.equal(r.ok, false);
  assert.equal(A.cloud.status().state, 'offline'); assert.equal(A.cloud.status().signedIn, true, 'mất mạng không làm mất phiên');
  assert.equal(A.store.state.attempts.length, 1);
  online = true;
  assert.equal((await A.cloud.sync()).ok, true);
  assert.equal([...fake.rows.values()][0].data.attempts.length, 1);
});

test('đăng xuất: gửi nốt dữ liệu rồi xoá trên máy; đăng nhập tài khoản khác không bị trộn dữ liệu', async () => {
  const fake = createFakeSupabase();
  const storage = memStorage();
  const A = device(fake, storage);
  await A.cloud.signUp('a@example.com', 'abcdef');
  A.store.setProfile({ name: 'A' }); learn(A.store, '你');
  const out = await A.cloud.signOut();
  assert.equal(out.ok, true);
  assert.equal(fake.rows.get(fake.users.get('a@example.com').id).data.attempts.length, 1, 'dữ liệu cuối được gửi trước khi đăng xuất');
  assert.equal(A.store.state.attempts.length, 0); assert.equal(storage.getItem(AUTH_KEY), null);

  // trường hợp dữ liệu trên máy vẫn còn đánh dấu của tài khoản A (ví dụ phiên A hết hạn) rồi B đăng nhập
  const C = device(fake, memStorage());
  await C.cloud.signUp('b@example.com', 'abcdef');
  const D = device(fake, memStorage());
  await D.cloud.signIn('a@example.com', 'abcdef');
  assert.equal(D.store.state.attempts.length, 1);
  D.storage.removeItem(AUTH_KEY);
  const D2 = device(fake, D.storage);
  await D2.cloud.signIn('b@example.com', 'abcdef');
  assert.equal(D2.store.state.attempts.length, 0, 'không đem tiến độ của A sang tài khoản B');
  assert.equal(fake.rows.get(fake.users.get('b@example.com').id).data.attempts.length, 0);
});

test('đăng xuất khi chưa gửi được (mất mạng) thì từ chối, không làm mất dữ liệu', async () => {
  const fake = createFakeSupabase();
  let online = true;
  const A = device(fake, memStorage(), { fetchImpl: (u, o) => (online ? fake.fetchImpl(u, o) : Promise.reject(new TypeError('Failed to fetch'))) });
  await A.cloud.signUp('n@example.com', 'abcdef');
  online = false; learn(A.store, '你');
  const r = await A.cloud.signOut();
  assert.equal(r.ok, false); assert.match(r.error, /Chưa đẩy được/);
  assert.equal(A.store.state.attempts.length, 1); assert.equal(A.cloud.status().signedIn, true);
});
