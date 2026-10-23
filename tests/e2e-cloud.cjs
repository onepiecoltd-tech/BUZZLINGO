/* E2E đồng bộ Supabase với máy chủ giả (chặn mạng bằng Playwright). Chạy: node tests/e2e-cloud.cjs */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const path = require('path');
const { createFakeSupabase } = require('./fake-supabase.cjs');
const URL_ = 'file://' + path.resolve(__dirname, '../dist/index.html');
const SB = 'https://demo.supabase.co';
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (nhận ${JSON.stringify(a)}, mong ${JSON.stringify(b)})`);
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'apikey, authorization, content-type, prefer', 'access-control-allow-methods': 'GET, POST, OPTIONS' };

async function launch(browser, fake, { configured = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(([url, on]) => {
    window.BuzzConfig = on ? { supabaseUrl: url, supabaseAnonKey: 'sb_publishable_demo', coachEndpoint: '' } : { coachEndpoint: '' };
    Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [{ lang: 'zh-CN' }], speak() {}, cancel() {}, addEventListener() {} } });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  }, [SB, configured]);
  const calls = [];
  await ctx.route(SB + '/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    calls.push(req.method() + ' ' + new URL(req.url()).pathname);
    const r = fake.handle(req.method(), req.url(), req.headers(), req.postData());
    return route.fulfill({ status: r.status, headers: CORS, contentType: 'application/json', body: r.body });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, calls, errors };
}
const toastText = (page) => page.textContent('#toast');

(async () => {
  const browser = await chromium.launch();

  console.log('1. Chưa cấu hình Supabase → không có mục tài khoản, không gọi mạng');
  { const fake = createFakeSupabase(); const { ctx, page, calls, errors } = await launch(browser, fake, { configured: false });
    await page.goto(URL_);
    ok(await page.isHidden('#obLoginBtn'), 'Onboarding không có nút đăng nhập');
    await page.fill('#obName', 'Lan'); await page.click('#onboardForm button[type=submit]');
    await page.click('.bottom-nav [data-screen=me]');
    ok(await page.isHidden('#cloudCard'), 'Ẩn thẻ Tài khoản & đồng bộ');
    eq(calls.length, 0, 'Không có request tới Supabase');
    ok(errors.length === 0, 'Không lỗi JS: ' + errors.join('|')); await ctx.close(); }

  const fake = createFakeSupabase();
  console.log('2. Tạo tài khoản trong mục Cá nhân → tiến độ có sẵn được đẩy lên');
  { const { ctx, page, errors } = await launch(browser, fake);
    await page.goto(URL_);
    ok(await page.isVisible('#obLoginBtn'), 'Onboarding có nút "Đã có tài khoản?"');
    await page.fill('#obName', 'Lan'); await page.click('#onboardForm button[type=submit]');
    await page.evaluate(() => { Buzz.store.recordAttempt({ itemId: '你', skill: 'meaning', correct: true, xp: 10 }); Buzz.store.completeLesson('h1-01', { score: 8, total: 10 }); });
    await page.click('.bottom-nav [data-screen=me]');
    ok(await page.isVisible('#cloudCard'), 'Hiện thẻ Tài khoản & đồng bộ');
    ok(/7 ngày/.test(await page.textContent('#storageState')), 'Nhắc Safari có thể xoá dữ liệu khi chưa đăng nhập');
    const f = '#cloudOut form';
    await page.fill(`${f} input[name=email]`, 'sai'); await page.fill(`${f} input[name=password]`, 'abcdef');
    await page.click(`${f} button[data-mode=up]`);
    ok(/email hợp lệ/.test(await page.textContent(`${f} .cloud-msg`)), 'Kiểm tra email ngay trên máy');
    await page.fill(`${f} input[name=email]`, 'lan@example.com'); await page.fill(`${f} input[name=password]`, 'matkhau1');
    await page.click(`${f} button[data-mode=up]`);
    await page.waitForSelector('#cloudIn:not([hidden])');
    eq(await page.textContent('#cloudEmail'), 'lan@example.com', 'Hiện email đã đăng nhập');
    await page.waitForFunction(() => /Đã đồng bộ/.test(document.querySelector('#cloudStatus').textContent));
    ok(/lan@example\.com/.test(await page.textContent('#storageState')), 'Mục dữ liệu nói rõ đang lưu trong tài khoản');
    const row = [...fake.rows.values()][0];
    ok(row && row.data.profile.name === 'Lan' && row.data.attempts.length === 1 && row.data.lessons['h1-01'], 'Đám mây có hồ sơ, lượt làm và bài đã xong');
    // học thêm → tự gửi sau khi xong bài (syncSoon)
    await page.evaluate(() => { Buzz.store.recordAttempt({ itemId: '好', skill: 'meaning', correct: true, xp: 10 }); Buzz.cloud.syncSoon(20); });
    await page.waitForFunction(() => !Buzz.cloud.status().dirty && Buzz.cloud.status().state === 'ok');
    eq([...fake.rows.values()][0].data.attempts.length, 2, 'Lượt học mới đã lên đám mây');
    ok(errors.length === 0, 'Không lỗi JS: ' + errors.join('|')); await ctx.close(); }

  console.log('3. Safari xoá dữ liệu (máy trắng) → "Đã có tài khoản?" → lấy lại đủ tiến độ');
  { const { ctx, page, errors } = await launch(browser, fake);
    await page.goto(URL_);
    ok(await page.isVisible('#onboard'), 'Máy trắng thì hiện onboarding');
    await page.click('#obLoginBtn');
    ok(await page.isVisible('#obCloud') && await page.isHidden('#onboardForm'), 'Chuyển sang khung đăng nhập');
    const f = '#obCloud form';
    eq(await page.locator(`${f} button[data-mode=up]`).count(), 0, 'Khung trong onboarding chỉ có Đăng nhập');
    await page.fill(`${f} input[name=email]`, 'lan@example.com'); await page.fill(`${f} input[name=password]`, 'sai-mat-khau');
    await page.click(`${f} button[data-mode=in]`);
    await page.waitForFunction(() => /Sai email/.test(document.querySelector('#obCloud .cloud-msg').textContent));
    ok(true, 'Sai mật khẩu báo bằng tiếng Việt');
    await page.fill(`${f} input[name=password]`, 'matkhau1');
    await page.click(`${f} button[data-mode=in]`);
    await page.waitForSelector('#onboard', { state: 'hidden' });
    const st = await page.evaluate(() => ({ name: Buzz.store.state.profile.name, a: Buzz.store.state.attempts.length, done: Buzz.store.state.lessons['h1-01'] && Buzz.store.state.lessons['h1-01'].status, saved: !!localStorage.getItem('buzzlingo.v1') }));
    eq(st, { name: 'Lan', a: 2, done: 'done', saved: true }, 'Tiến độ được tải về và lưu lại trên máy');
    ok(/đồng bộ/.test(await toastText(page)), 'Báo đã đồng bộ');
    // tải lại trang: vẫn đăng nhập, không phải nhập lại
    await page.reload();
    ok(await page.isHidden('#onboard'), 'Tải lại trang không hỏi lại');
    eq(await page.evaluate(() => Buzz.cloud.status().signedIn), true, 'Vẫn giữ phiên đăng nhập');

    console.log('4. Đăng xuất → xác nhận → dữ liệu trên máy được xoá, trên đám mây còn nguyên');
    await page.click('.bottom-nav [data-screen=me]');
    await page.click('#cloudOutBtn');
    ok(await page.isVisible('#cloudOutBox'), 'Hỏi xác nhận trước khi đăng xuất');
    await page.click('#cloudOutYes');
    await page.waitForSelector('#onboard:not([hidden])');
    eq(await page.evaluate(() => [Buzz.store.state.attempts.length, localStorage.getItem('buzzlingo.auth')]), [0, null], 'Máy đã sạch, không còn phiên');
    eq([...fake.rows.values()][0].data.attempts.length, 2, 'Đám mây vẫn giữ tiến độ');
    ok(errors.length === 0, 'Không lỗi JS: ' + errors.join('|')); await ctx.close(); }

  console.log('5. Tài khoản mới chưa có tiến độ, đăng nhập từ onboarding → quay về 3 câu hỏi');
  { const f2 = createFakeSupabase();
    await f2.fetchImpl(SB + '/auth/v1/signup', { method: 'POST', headers: { apikey: 'k' }, body: JSON.stringify({ email: 'moi@example.com', password: 'abcdef' }) });
    const { ctx, page, errors } = await launch(browser, f2);
    await page.goto(URL_);
    await page.click('#obLoginBtn');
    await page.fill('#obCloud input[name=email]', 'moi@example.com'); await page.fill('#obCloud input[name=password]', 'abcdef');
    await page.click('#obCloud button[data-mode=in]');
    await page.waitForSelector('#onboardForm:not([hidden])');
    ok(await page.isVisible('#onboard'), 'Vẫn ở onboarding để trả lời 3 câu');
    await page.fill('#obName', 'Moi'); await page.click('#onboardForm button[type=submit]');
    await page.evaluate(() => Buzz.cloud.syncSoon(20));
    await page.waitForFunction(() => !Buzz.cloud.status().dirty && Buzz.cloud.status().state === 'ok');
    eq([...f2.rows.values()][0].data.profile.name, 'Moi', 'Hồ sơ mới được lưu lên tài khoản');
    ok(errors.length === 0, 'Không lỗi JS: ' + errors.join('|')); await ctx.close(); }

  await browser.close();
  console.log(`\n${pass} kiểm tra đạt, ${fails.length} lỗi`);
  if (fails.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
