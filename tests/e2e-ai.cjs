/* E2E trợ lý AI với endpoint giả. Chạy: node tests/e2e-ai.cjs */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const path = require('path');
const URL_ = 'file://' + path.resolve(__dirname, '../dist/index.html');
const EP = 'https://coach.test/api/coach';
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (nhận ${JSON.stringify(a)}, mong ${JSON.stringify(b)})`);
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };

async function launch({ endpoint = EP, reply, media = false, srText = null } = {}) {
  const browser = await chromium.launch(media ? { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: media ? ['microphone'] : [] });
  if (srText !== null) await ctx.addInitScript((t) => { // nhận dạng giọng nói giả: trả về câu đặt sẵn
    window.__srText = t;
    window.SpeechRecognition = function () { this.start = () => { setTimeout(() => { this.onstart && this.onstart(); this.onresult && this.onresult({ results: [[{ transcript: window.__srText }]] }); this.onend && this.onend(); }, 30); }; this.stop = () => {}; };
  }, srText);
  await ctx.addInitScript((ep) => { window.BuzzConfig = { coachEndpoint: ep }; const v = [{ lang: 'zh-CN' }]; Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => v, speak() {}, cancel() {}, addEventListener() {} } }); window.SpeechSynthesisUtterance = function (t) { this.text = t; }; }, endpoint);
  const calls = [];
  await ctx.route('https://coach.test/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData());
    calls.push(body);
    const r = reply ? reply(body, calls.length) : { status: 200, json: { reply: 'Thanh 3 hạ thấp rồi nhấc lên. Mẹo: cứ nghĩ tới chữ 你 nhé!', zh: { hanzi: '你好', pinyin: 'nǐ hǎo', vi: 'xin chào' }, flags: [] } };
    return route.fulfill({ status: r.status, headers: CORS, contentType: 'application/json', body: JSON.stringify(r.json) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { browser, ctx, page, calls, errors };
}
async function onboard(page) { await page.goto(URL_); await page.fill('#obName', 'Lan'); await page.click('#onboardForm button[type=submit]'); }
async function enableAi(page) {
  await page.click('.bottom-nav [data-screen=me]');
  await page.check('#profileForm input[name=coach]');
  await page.click('#profileForm button[type=submit]');
  await page.click('.bottom-nav [data-screen=home]');
}
const skipStory = async (page) => { for (let i = 0; i < 12; i++) { if (await page.evaluate(() => Buzz.debug.step && Buzz.debug.step.type) !== 'story') return; await page.click('#lessonBtn'); await page.waitForTimeout(60); } };
const wrongFirst = async (page) => { await page.click('#heroCta'); await skipStory(page); await page.click('.answer[data-i="0"]'); await page.click('#lessonBtn'); };

(async () => {
  console.log('1. Không cấu hình endpoint → AI tắt hoàn toàn');
  { const { browser, page, calls, errors } = await launch({ endpoint: '' });
    await onboard(page);
    ok(await page.isHidden('#chatBtn'), 'Nút trò chuyện AI ẩn khi chưa cấu hình');
    await page.click('.bottom-nav [data-screen=me]');
    ok(await page.isDisabled('#profileForm input[name=coach]'), 'Ô bật AI bị khoá khi chưa có endpoint');
    ok(/chưa được cấu hình/.test(await page.textContent('#coachState')), 'Nói rõ là chưa cấu hình');
    await page.click('.bottom-nav [data-screen=home]'); await wrongFirst(page);
    eq(await page.locator('#aiAsk').count(), 0, 'Không có nút hỏi AI');
    eq(calls.length, 0, 'Không có request mạng nào');
    ok(errors.length === 0, 'Không lỗi JS: ' + errors.join('|')); await browser.close(); }

  console.log('2. Có endpoint nhưng chưa đồng ý → vẫn tắt, không gửi gì');
  { const { browser, page, calls } = await launch();
    await onboard(page);
    ok(await page.isHidden('#chatBtn'), 'Chưa đồng ý thì ẩn nút trò chuyện');
    await wrongFirst(page);
    eq(await page.locator('#aiAsk').count(), 0, 'Chưa đồng ý thì không có nút hỏi AI');
    eq(calls.length, 0, 'Không gửi request khi chưa đồng ý'); await browser.close(); }

  console.log('3. Đồng ý → hỏi vì sao, hỏi thêm, quyền riêng tư, không ảnh hưởng điểm');
  { const { browser, page, calls, errors } = await launch();
    await onboard(page); await enableAi(page);
    ok(await page.isVisible('#chatBtn'), 'Đã đồng ý thì hiện nút trò chuyện');
    await wrongFirst(page);
    ok(/Hỏi Bắp vì sao/.test(await page.textContent('#aiAsk')), 'Có nút "Hỏi Bắp vì sao" sau câu sai');
    const before = await page.evaluate(() => ({ a: Buzz.store.state.attempts.length, xp: Buzz.store.stats().totalXp, c: JSON.stringify(Buzz.store.state.cards) }));
    await page.click('#aiAsk');
    await page.waitForSelector('#aiBox .ai-tag');
    const box = await page.textContent('#aiBox');
    ok(/do AI viết, có thể sai/.test(box), 'Có nhãn "do AI viết, có thể sai"');
    ok(box.includes('你好') && box.includes('nǐ hǎo'), 'Hiện khối tiếng Trung từ AI');
    eq(calls.length, 1, 'Đúng một request');
    const c = calls[0];
    eq([c.mode, c.persona], ['explain', 'bap'], 'Gửi đúng chế độ và nhân vật');
    ok(c.known.hanzi.includes('你') && c.known.hanzi.includes('好'), 'Gửi danh sách chữ đã học');
    ok(!JSON.stringify(c).includes('Lan'), 'Không gửi tên người học');
    eq([c.step.correct, c.step.userAnswer], ['nǐ', 'nī'], 'Gửi đáp án đúng và đáp án người học chọn');
    await page.fill('#aiQ', 'Thanh 3 khác dấu hỏi tiếng Việt thế nào?');
    await page.click('.ai-form button');
    await page.waitForFunction(() => document.querySelectorAll('#aiBox .ai-tag').length === 1 && !document.querySelector('#aiBox').textContent.includes('Đang nghĩ'));
    eq(calls.length, 2, 'Hỏi thêm gửi request thứ hai');
    eq(calls[1].mode, 'ask', 'Hỏi thêm dùng chế độ ask');
    ok(calls[1].history.length >= 1, 'Hỏi thêm kèm lịch sử hội thoại');
    const after = await page.evaluate(() => ({ a: Buzz.store.state.attempts.length, xp: Buzz.store.stats().totalXp, c: JSON.stringify(Buzz.store.state.cards) }));
    eq(after, before, 'Dùng AI không đổi attempts, XP hay lịch SRS');
    await page.screenshot({ path: (process.env.SHOTS || '.') + '/20-ai-explain.png' });
    ok(errors.length === 0, 'Không lỗi JS: ' + errors.join('|')); await browser.close(); }

  console.log('4. Guard từ vựng, lỗi server, hạn mức');
  { const { browser, page, calls } = await launch({ reply: (b, n) => n === 1 ? { status: 200, json: { reply: 'Hãy thử nói 谢谢 nhé', zh: null, flags: [] } } : { status: 429, json: { error: 'Bạn đã dùng hết lượt hỏi AI hôm nay. Mai quay lại nhé!' } } });
    await onboard(page); await enableAi(page); await wrongFirst(page);
    await page.click('#aiAsk'); await page.waitForSelector('#aiBox .ai-tag');
    ok(/chưa trả lời được câu này bằng những chữ bạn đã học/.test(await page.textContent('#aiBox')), 'Chữ chưa học trong câu trả lời bị chặn, hiện thông báo an toàn');
    ok(!(await page.textContent('#aiBox')).includes('谢'), 'Không hiển thị chữ chưa học');
    await page.fill('#aiQ', 'hỏi tiếp'); await page.click('.ai-form button');
    await page.waitForSelector('.ai-err');
    ok(/hết lượt/.test(await page.textContent('.ai-err')), 'Hiện lỗi 429 thân thiện');
    await page.evaluate(() => localStorage.setItem('buzzlingo.coach.v1', JSON.stringify({ day: new Date().toISOString().slice(0, 10), n: 25, uid: 'x' })));
    const n0 = calls.length;
    await page.click('#lessonBtn'); await page.click('.answer[data-i="0"]'); await page.click('#lessonBtn');
    await page.click('#aiAsk'); await page.waitForSelector('#aiBox .ai-err');
    eq(calls.length, n0, 'Hết hạn mức phía client thì không gọi mạng'); await browser.close(); }

  console.log('5. Phòng trò chuyện với Blu');
  { const { browser, page, calls, errors } = await launch({ reply: () => ({ status: 200, json: { reply: 'Blu chào bạn! Bạn nói rất tự nhiên.', zh: { hanzi: '你好', pinyin: 'nǐ hǎo', vi: 'xin chào' }, flags: [] } }) });
    await onboard(page); await enableAi(page);
    await page.click('#chatBtn');
    ok(await page.isVisible('#chatLog'), 'Mở phòng trò chuyện');
    ok((await page.textContent('#chatLog')).includes('你好'), 'Blu mở đầu bằng 你好 (không gọi AI)');
    eq(calls.length, 0, 'Lời mở đầu không tốn lượt AI');
    await page.fill('#chatIn', 'ni hao'); await page.press('#chatIn', 'Enter');
    await page.waitForFunction(() => document.querySelectorAll('.bubble-msg.ai').length === 2 && !document.querySelector('#chatLog').textContent.includes('…'));
    eq(calls[0].mode, 'roleplay', 'Gửi chế độ roleplay');
    eq(calls[0].persona, 'blu', 'Nhân vật Blu');
    await page.screenshot({ path: (process.env.SHOTS || '.') + '/21-ai-chat.png' });
    await page.click('#chatEnd');
    ok(await page.isHidden('#lesson'), 'Kết thúc trò chuyện đóng phiên (không hiện màn kết quả điểm)');
    eq(await page.evaluate(() => Buzz.store.stats().attempts), 0, 'Trò chuyện AI không tạo attempt');
    eq(await page.textContent('#pillXp'), '💎 0 XP', 'Không cộng XP');
    ok(errors.length === 0, 'Không lỗi JS: ' + errors.join('|')); await browser.close(); }

  console.log('6. AI phản biện câu tự viết');
  { const { browser, page, calls, errors } = await launch({ reply: () => ({ status: 200, json: { reply: 'Bạn đã chào rất tự nhiên! Thử nghĩ xem: hai chữ trong lời chào, chữ nào là “bạn”?', zh: null, flags: [] } }) });
    await onboard(page); await enableAi(page);
    await page.click('[data-skill=produce]');
    await page.fill('#cIn', '好你'); await page.click('#lessonBtn');
    await page.waitForSelector('#aiCrit');
    eq(calls.length, 0, 'Bộ phản biện theo luật chạy trên máy, không gọi AI');
    const before = await page.evaluate(() => ({ a: Buzz.store.state.attempts.length, c: JSON.stringify(Buzz.store.state.cards) }));
    await page.click('#aiCrit'); await page.waitForSelector('#aiBox .ai-tag');
    eq(calls[0].mode, 'critique', 'Gửi chế độ critique');
    eq(calls[0].message, '好你', 'Gửi đúng câu người học viết');
    ok(/chưa đạt/.test(calls[0].step.explain) && /đảo chỗ/.test(calls[0].step.explain), 'Kèm kết quả bộ kiểm tra theo luật để AI không nói ngược');
    ok(/không ảnh hưởng điểm/.test(await page.textContent('#aiBox')), 'Ghi rõ AI không ảnh hưởng điểm');
    eq(await page.evaluate(() => ({ a: Buzz.store.state.attempts.length, c: JSON.stringify(Buzz.store.state.cards) })), before, 'Phản biện AI không tạo attempt, không đổi lịch');
    await page.screenshot({ path: (process.env.SHOTS || '.') + '/22-ai-critique.png' });
    ok(errors.length === 0, 'Không lỗi JS: ' + errors.join('|')); await browser.close(); }

  console.log('7. Luyện nói: máy nghe chỉ chỗ sai, AI nhận xét theo văn bản và theo bản ghi');
  { const speakReply = (body) => ({ status: 200, json: { heard: body.audio ? '你号' : body.message, reply: 'Bạn nói gần đúng rồi! Chữ thứ hai nên là hǎo (thanh 3).', zh: { hanzi: body.step.correct, pinyin: body.step.prompt, vi: '' }, flags: [] } });
    const { browser, page, calls, errors } = await launch({ media: true, srText: '你号', reply: speakReply });
    await onboard(page);
    // chưa bật AI: vẫn có "máy nghe", không gọi mạng
    await page.click('[data-skill=speak]'); await page.waitForSelector('#srBtn');
    const target = await page.evaluate(() => Buzz.debug.step.hanzi);
    await page.evaluate((t) => { window.__srText = t.replace(/[一-鿿]$/, '号'); }, target.replace(/[？?！!。，]/g, ''));
    await page.click('#srBtn'); await page.waitForSelector('#srResult:not([hidden])');
    ok(await page.locator('.sr-target .miss').count() >= 1, 'Tô đỏ chữ máy chưa nghe ra');
    ok(/Máy nghe được/.test(await page.textContent('#srResult')), 'Hiện câu máy nghe được');
    eq(await page.locator('#srAsk').count(), 0, 'Chưa bật AI thì không có nút nhờ AI');
    eq(calls.length, 0, 'Máy nghe chạy không cần AI');
    ok(await page.isVisible('#selfAssess'), 'Sau khi nói vẫn tự đánh giá như cũ');
    await page.click('#lessonClose').catch(() => {}); await page.goto(URL_); await page.waitForTimeout(200);
    await enableAi(page);
    await page.click('[data-skill=speak]'); await page.waitForSelector('#srBtn');
    const t2 = (await page.evaluate(() => Buzz.debug.step.hanzi)).replace(/[？?！!。，]/g, '');
    await page.evaluate((t) => { window.__srText = t; }, t2);
    await page.click('#srBtn'); await page.waitForSelector('#srAi:not([hidden])');
    ok(/9\d%|100%/.test(await page.textContent('.sr-verdict')), 'Nói đúng câu mẫu → máy nghe ra gần đủ');
    await page.click('#srAsk'); await page.waitForSelector('#srBox .ai-tag');
    eq(calls.at(-1).mode, 'speak', 'Gửi chế độ speak');
    eq(calls.at(-1).message, t2, 'Gửi văn bản máy nghe được');
    ok(!calls.at(-1).audio, 'Đường văn bản không gửi âm thanh');
    ok(/không ảnh hưởng điểm/.test(await page.textContent('#srBox')) && /AI nghe được/.test(await page.textContent('#srBox')), 'Hiện nhận xét AI, ghi rõ không ảnh hưởng điểm');
    // đường bản ghi: ghi âm thật (micro giả) rồi gửi cho AI nghe
    await page.click('#recBtn'); await page.waitForTimeout(1600); await page.click('#recBtn', { force: true }); // nút nhấp nháy khi ghi: force để Playwright không chờ hết hiệu ứng
    await page.waitForSelector('#aiHear', { timeout: 8000 });
    await page.click('#aiHear'); await page.waitForSelector('#aiHearBox .ai-tag', { timeout: 8000 });
    const last = calls.at(-1);
    ok(last.mode === 'speak' && last.audio && /^audio\//.test(last.audio.mime) && last.audio.data.length > 100, 'Gửi bản ghi (base64) kèm định dạng audio');
    ok(/你号/.test(await page.textContent('#aiHearBox')), 'Hiện điều AI nghe được từ bản ghi');
    ok(/Đã ghi được/.test(await page.textContent('#recStatus')), 'Micro đã tắt sau khi dừng ghi (' + (await page.textContent('#recStatus')) + ')');
    const att = await page.evaluate(() => Buzz.store.state.attempts.length);
    eq(att, 0, 'Nhận xét AI không tạo attempt');
    await page.screenshot({ path: (process.env.SHOTS || '.') + '/23-ai-speak.png' });
    ok(errors.length === 0, 'Không lỗi JS: ' + errors.join('|')); await browser.close(); }

  console.log('8. Trò chuyện bằng giọng với Blu');
  { const { browser, page, calls, errors } = await launch({ srText: '你好！', reply: () => ({ status: 200, json: { reply: 'Chào bạn! Bạn nói rất rõ.', zh: { hanzi: '你好', pinyin: 'nǐ hǎo', vi: 'xin chào' }, flags: [] } }) });
    await page.addInitScript(() => { window.__said = []; const v = [{ lang: 'zh-CN' }]; Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => v, speak(u) { window.__said.push(u.text); }, cancel() {}, addEventListener() {} }, configurable: true }); });
    await onboard(page); await enableAi(page);
    await page.click('#chatBtn'); await page.waitForSelector('#chatMic');
    await page.click('#chatMic'); await page.waitForSelector('.bubble-msg.ai .ai-zh');
    eq(calls.at(-1).mode, 'roleplay', 'Giọng nói đi qua chế độ trò chuyện');
    eq(calls.at(-1).message, '你好！', 'Gửi câu đã nhận dạng');
    eq(calls.at(-1).voice, true, 'Đánh dấu tin nhắn đến từ giọng nói (AI bỏ qua lỗi nhận dạng)');
    ok((await page.evaluate(() => window.__said)).includes('你好'), 'Blu đọc to câu tiếng Trung của mình');
    ok(errors.length === 0, 'Không lỗi JS: ' + errors.join('|')); await browser.close(); }

  console.log(`\n${pass} kiểm tra đạt, ${fails.length} lỗi`); fails.forEach((f) => console.log(' -', f));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
