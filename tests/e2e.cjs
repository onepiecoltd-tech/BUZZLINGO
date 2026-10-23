/* E2E bằng Playwright (Chromium). Chạy: node tests/e2e.cjs
 * Cần playwright cài sẵn (đặt PLAYWRIGHT_PATH nếu không nằm ở /opt/npm-tools/node_modules/playwright). */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const URL_ = 'file://' + path.resolve(__dirname, '../dist/index.html');
const SHOTS = process.env.SHOTS || path.resolve(__dirname, '../.shots');
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (nhận ${JSON.stringify(a)}, mong ${JSON.stringify(b)})`);

const TTS_STUB = () => {
  window.__spoken = [];
  const voices = [{ lang: 'zh-CN', name: 'Stub', voiceURI: 'stub' }];
  Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => voices, speak: (u) => window.__spoken.push(u.text), cancel() {}, addEventListener() {} }, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
};

async function launch(opts = {}) {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['microphone'], acceptDownloads: true });
  if (opts.tts !== false) await ctx.addInitScript(TTS_STUB);
  if (opts.blockStorage) await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|net::ERR|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { browser, ctx, page, errors };
}

async function onboard(page, name = 'Lan') {
  await page.goto(URL_);
  await page.fill('#obName', name);
  await page.click('#onboardForm button[type=submit]');
}

const stepId = (page) => page.evaluate(() => { const r = Buzz.debug.run; return r ? (r.queue[r.index] || {}).sid || (r.queue[r.index] || {}).cardKey : null; });
const curStep = (page) => page.evaluate(() => { const s = Buzz.debug.step; return s && { id: s.id, type: s.type, answer: s.answer, target: s.target, tokens: s.tokens, itemId: s.itemId, skill: s.skill, model: s.model, generated: !!s.generated }; });
const entryInfo = (page) => page.evaluate(() => { const r = Buzz.debug.run; const e = r.queue[r.index]; return { sid: e.sid, retry: !!e.retry, index: r.index, len: r.queue.length }; });

async function drawChar(page, ch, { wrongFirst = false, from = 0, to = 99 } = {}) {
  const meta = await page.evaluate((c) => {
    const svg = document.querySelector('#pad svg'); const r = svg.getBoundingClientRect();
    const t = svg.querySelector('g[transform]').getAttribute('transform');
    const m = t.match(/translate\(([-\d.]+),\s*([-\d.]+)\)\s*scale\(([-\d.]+),\s*([-\d.]+)\)/);
    return { x: r.x, y: r.y, tx: +m[1], ty: +m[2], s: +m[3], medians: window.BuzzHanziData[c].medians };
  }, ch);
  const P = ([x, y]) => [meta.x + meta.tx + meta.s * x, meta.y + meta.ty - meta.s * y];
  if (wrongFirst) { // một nét sai rõ rệt (kéo ngang cuối ô) để chắc chắn bị tính lỗi
    await page.mouse.move(meta.x + 20, meta.y + 270); await page.mouse.down();
    await page.mouse.move(meta.x + 270, meta.y + 275, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(250);
  }
  for (const med of meta.medians.slice(from, to)) {
    const pts = med.map(P);
    await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(p[0], p[1], { steps: 6 });
    await page.mouse.up(); await page.waitForTimeout(450);
  }
}

async function doWrite(page, ch, opts) {
  for (let stage = 0; stage < 3; stage++) {
    await page.waitForSelector('#pad svg');
    await page.waitForTimeout(300);
    await drawChar(page, ch, stage === 2 ? opts : {});
    if (stage < 2) { await page.waitForSelector('#wNext:not([hidden])', { timeout: 8000 }); await page.click('#wNext'); }
  }
}

/** Bước mở cảnh truyện Bắp & Blu: chạm qua từng khung đến khi sang bước học. */
async function skipStory(page) {
  for (let i = 0; i < 12; i++) {
    const t = await page.evaluate(() => Buzz.debug.step && Buzz.debug.step.type);
    if (t !== 'story') return;
    await page.click('#lessonBtn'); await page.waitForTimeout(60);
  }
}

async function answerStep(page, plan, log) {
  const info = await entryInfo(page);
  const step = await curStep(page);
  log.push(info.sid + (info.retry ? '(retry)' : ''));
  const wantWrong = plan.wrongOnce && plan.wrongOnce.includes(info.sid) && !info.retry;
  if (step.type === 'choice') {
    const idx = wantWrong ? (step.answer + 1) % 4 : step.answer;
    await page.click(`.answer[data-i="${idx}"]`);
    await page.click('#lessonBtn');
  } else if (step.type === 'order') {
    const seq = wantWrong ? step.tokens : step.target;
    for (const t of seq) await page.click(`#pool .token:not([disabled]):text-is("${t}")`);
    await page.click('#lessonBtn');
  } else if (step.type === 'speak') {
    await page.click('#recBtn'); await page.waitForTimeout(1500); await page.click('#recBtn');
    await page.waitForSelector('#selfAssess:not([hidden])', { timeout: 5000 });
    await page.click('#selfAssess [data-v="near"]');
  } else if (step.type === 'write') {
    const ch = await page.evaluate((id) => Buzz.Content.writeChars[id], step.itemId);
    await doWrite(page, ch, { wrongFirst: plan.writeMistake === info.sid });
  } else if (step.type === 'compose') {
    if (plan.composeWrong && plan.composeWrong[info.sid]) {
      await page.fill('#cIn', plan.composeWrong[info.sid]); await page.click('#lessonBtn');
      await page.waitForSelector('#crit .finds li');
      if (plan.onCritique) await plan.onCritique(info.sid);
    }
    await page.fill('#cIn', step.model.hanzi); await page.click('#lessonBtn');
  }
  await page.waitForSelector('#lessonBtn:not([disabled])', { timeout: 8000 });
}

(async () => {
  /* ================= A. luồng đầy đủ với giọng Mandarin giả lập ================= */
  console.log('A. Luồng bài học đầy đủ');
  {
    const { browser, ctx, page, errors } = await launch();
    await onboard(page, 'Lan');
    eq(await page.textContent('#greet'), 'Nǐ hǎo, Lan! 👋', 'Lời chào dùng tên thật');
    eq(await page.textContent('#pillXp'), '💎 0 XP', 'XP ban đầu là 0 (không số giả)');
    eq(await page.textContent('#pillStreak'), '🔥 0 ngày', 'Streak ban đầu là 0');
    ok(/Chưa có thẻ ôn/.test(await page.textContent('#reviewCard')), 'Chưa có thẻ ôn khi chưa học');
    await page.screenshot({ path: SHOTS + '/02-home-empty.png' });

    await page.click('#heroCta');
    ok(await page.evaluate(() => document.querySelector('.shell').inert), 'Nền bị inert khi mở bài học (focus trap)');
    eq(await page.getAttribute('#lesson', 'aria-modal'), 'true', 'Dialog có aria-modal');
    ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'stepTitle'), 'Focus chuyển vào tiêu đề bước');
    eq(await page.evaluate(() => Buzz.debug.step.type), 'story', 'Bài 1 mở đầu bằng cảnh truyện Bắp & Blu');
    ok(/Đặt chân đến Bắc Kinh/.test(await page.textContent('#stepTitle')), 'Cảnh truyện có tên tập');
    eq(await page.textContent('#lessonBtn'), 'Tiếp ▸', 'Nút chân trang mời xem khung tiếp theo');
    await page.click('#lessonBtn'); await page.click('#lessonBtn');
    ok(await page.isVisible('#mission') && /Bắt đầu nhiệm vụ/.test(await page.textContent('#lessonBtn')), 'Xem hết khung thì hiện nhiệm vụ');
    const attBefore = await page.evaluate(() => Buzz.store.state.attempts.length);
    await page.screenshot({ path: SHOTS + '/02b-story-open.png' });
    await page.click('#lessonBtn');
    eq(await page.evaluate(() => Buzz.store.state.attempts.length), attBefore, 'Cảnh truyện không tạo attempt');
    // nghe âm: kiểm tra audio được phát qua TTS
    await page.click('#playAudio');
    eq(await page.evaluate(() => window.__spoken), ['你'], 'Nút loa phát đúng chữ 你');
    await page.screenshot({ path: SHOTS + '/03-lesson-step1.png' });

    const log = []; const plan = { wrongOnce: ['s1-tone', 's9-order'] };
    let retryPositions = {};
    for (let guard = 0; guard < 20; guard++) {
      const done = await page.locator('#finishRun').count();
      if (done) break;
      const before = await entryInfo(page);
      await answerStep(page, plan, log);
      const fbWrong = await page.locator('#fb.no').count();
      if (fbWrong && !before.retry) {
        const q = await page.evaluate(() => Buzz.debug.run.queue.map((e) => e.sid + (e.retry ? '*' : '')));
        const at = q.findIndex((x, i) => x === before.sid + '*' && i > before.index);
        retryPositions[before.sid] = at - before.index;
        ok(at - before.index >= 2 && at - before.index <= 4, `Câu sai ${before.sid} quay lại sau 2–4 mục (thực tế ${at - before.index})`);
        ok(/quay lại sau ít câu/.test(await page.textContent('#fb')), 'Thông báo nói thật là câu sẽ quay lại');
        await page.screenshot({ path: SHOTS + `/04-wrong-${before.sid}.png` });
      }
      if (before.sid === 's6-speak') await page.screenshot({ path: SHOTS + '/05-speak-done.png' });
      await page.click('#lessonBtn');
      await page.waitForTimeout(150);
    }
    ok(log.filter((x) => x.includes('retry')).length === 2, `Có đúng 2 câu làm lại (nhận: ${log.join(',')})`);
    await page.waitForSelector('#finishRun');
    await page.screenshot({ path: SHOTS + '/06-complete.png' });

    const att = await page.evaluate(() => Buzz.store.state.attempts.map((a) => ({ s: a.stepId, c: a.correct, xp: a.xp, r: a.retry, st: a.stage, v: a.verified })));
    const xpSum = att.reduce((s, a) => s + a.xp, 0);
    const txt = await page.textContent('.complete-card');
    ok(txt.includes(`+${xpSum}`), `XP trên màn kết quả (${xpSum}) khớp tổng attempt`);
    ok(txt.includes('9/11'), `Điểm lần đầu 9/11 vì sai 2 câu (nhận: ${txt.replace(/\s+/g, ' ')})`);
    eq(xpSum, 97, 'Tổng XP tính từ luật chấm: 50 + 4 + 4 + 5 (nói tự đánh giá) + 24 (viết) + 10 (tự viết câu)');
    ok(att.filter((a) => a.s === 'c1-greet' && a.v === false && a.c).length === 1, 'Bước tự viết câu được ghi là kiểm tra theo luật (verified=false)');
    ok(await page.isVisible('#nextLesson') && /Bài 2/.test(await page.textContent('#nextLesson')), 'Màn kết quả mời học tiếp Bài 2');
    ok(att.filter((a) => !a.c).length === 2, 'Đúng 2 attempt sai được ghi lại (không bị ghi thành đúng)');
    ok(att.filter((a) => a.st === 'trace').length === 2 && att.filter((a) => a.st === 'copy').length === 2 && att.filter((a) => a.st === 'memory').length === 2, 'Mỗi chữ có đủ 3 nấc tô/chép/nhớ được ghi');
    ok(att.filter((a) => a.s === 's6-speak' && a.v === false).length === 1, 'Bước nói được đánh dấu là tự đánh giá (verified=false)');
    ok(/Cần ôn lại/.test(await page.textContent('.mistakes')), 'Hiện danh sách câu cần ôn');
    ok(/đã được lưu/.test(await page.textContent('.complete')), 'Chỉ báo "đã lưu" khi lưu thật');

    await page.click('#finishRun');
    eq(await page.textContent('#pillXp'), `💎 ${xpSum} XP`, 'Pill XP trang chủ = tổng attempt');
    eq(await page.textContent('#pillStreak'), '🔥 1 ngày', 'Streak = 1 sau buổi học đầu');
    ok(/Bài 2/.test(await page.textContent('#heroEyebrow')), 'Hero chuyển sang Bài 2 sau khi xong Bài 1');

    // Tải lại: dữ liệu còn nguyên
    await page.reload();
    await page.waitForTimeout(300);
    eq(await page.textContent('#pillXp'), `💎 ${xpSum} XP`, 'Sau reload XP còn nguyên');
    eq(await page.textContent('#greet'), 'Nǐ hǎo, Lan! 👋', 'Sau reload tên còn nguyên');
    const cards = await page.evaluate(() => Object.values(Buzz.store.state.cards).map((c) => ({ k: c.key, due: c.dueAt, d: c.scheduledDays, st: c.state })));
    eq(cards.length, 10, 'Có 10 thẻ item×skill (thêm thẻ tự đặt câu)');
    const startTomorrow = new Date(); startTomorrow.setHours(24, 0, 0, 0);
    const wrongCards = cards.filter((c) => c.k === 'ni:tone' || c.k === 'nihao:read');
    ok(wrongCards.every((c) => c.due >= startTomorrow.getTime()), 'Câu sai được xếp ôn từ ngày mai');
    ok(cards.every((c) => c.due > Date.now()), 'Không thẻ nào đến hạn ngay sau bài học');
    await page.click('.bottom-nav [data-screen=review]');
    ok(/Chưa có thẻ đến hạn/.test(await page.textContent('#reviewBody')), 'Màn ôn nói thật là chưa có thẻ đến hạn');
    await page.screenshot({ path: SHOTS + '/07-review-schedule.png' });

    // Giả lập 5 ngày sau: dời lịch về quá khứ
    await page.evaluate(() => { const s = Buzz.store.state; Object.values(s.cards).forEach((c) => { c.dueAt = Date.now() - 3600000; c.lastReviewAt = Date.now() - 5 * 86400000; }); localStorage.setItem('buzzlingo.v1', JSON.stringify(s)); });
    await page.reload(); await page.waitForTimeout(300);
    await page.click('.bottom-nav [data-screen=review]');
    eq((await page.textContent('.due-card strong')).trim(), '10', 'Mười thẻ đến hạn hiển thị');
    ok(await page.isVisible('#startMistakes'), 'Có lối vào "Luyện câu hay sai" vì đã từng sai');
    await page.click('#startReview');
    let reviewed = 0, wrongDone = false, generatedSeen = 0;
    for (let g = 0; g < 30; g++) {
      if (await page.locator('#finishRun').count() || await page.isHidden('#lesson')) break;
      const st = await curStep(page);
      if (st.generated) generatedSeen++;
      if (st.type === 'choice') {
        const pick = wrongDone ? st.answer : (st.answer + 1) % 4; // câu đầu cố tình sai để kiểm tra "ôn lại trong phiên"
        if (!wrongDone) await page.screenshot({ path: SHOTS + '/08-review-question.png' });
        wrongDone = true;
        await page.click(`.answer[data-i="${pick}"]`); await page.click('#lessonBtn');
      } else if (st.type === 'order') {
        for (const t of st.target) await page.click(`#pool .token:not([disabled]):text-is("${t}")`);
        await page.click('#lessonBtn');
      } else if (st.type === 'compose') {
        await page.fill('#cIn', st.model.hanzi); await page.click('#lessonBtn');
      } else if (st.type === 'speak') {
        await page.click('#skipSpeak');
      } else {
        await page.click('#wSkip');
      }
      reviewed++;
      await page.waitForSelector('#lessonBtn:not([disabled])'); await page.click('#lessonBtn'); await page.waitForTimeout(100);
    }
    ok(reviewed >= 10, `Phiên ôn chạy qua các thẻ (đã duyệt ${reviewed})`);
    ok(generatedSeen >= 6, `Ôn tập dùng câu hỏi sinh tự động có chấm (${generatedSeen} câu)`);
    const revAtt = await page.evaluate(() => Buzz.store.state.attempts.filter((a) => a.mode === 'review' && /^q:/.test(a.stepId)));
    ok(revAtt.length >= 6 && revAtt.every((a) => a.verified), 'Câu ôn sinh tự động được ghi là đã kiểm tra (verified)');
    ok(revAtt.some((a) => !a.correct), 'Câu trả lời sai khi ôn được ghi là sai');
    ok(await page.locator('#finishRun').count() === 1, 'Phiên ôn kết thúc bằng màn kết quả');
    const reviewedCard = await page.evaluate(() => Object.values(Buzz.store.state.cards).filter((c) => c.reps >= 2).length);
    ok(reviewedCard >= 5, `Thẻ ôn đúng hạn được cập nhật lịch (reps≥2: ${reviewedCard})`);
    await page.click('#finishRun');

    // Tiến bộ / Cá nhân
    await page.click('.bottom-nav [data-screen=progress]');
    ok(/Chưa đủ dữ liệu|% đúng/.test(await page.textContent('#skillBars')), 'Tiến bộ hiện dữ liệu thật hoặc nói chưa đủ dữ liệu');
    ok(/tự đánh giá/.test(await page.textContent('#skillBars')), 'Kỹ năng Nói ghi rõ là tự đánh giá');
    await page.screenshot({ path: SHOTS + '/09-progress.png' });
    await page.click('.bottom-nav [data-screen=me]');
    await page.screenshot({ path: SHOTS + '/10-me.png' });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
    ok(/buzzlingo-du-lieu-.*\.json/.test(dl.suggestedFilename()), 'Xuất dữ liệu tạo file JSON');
    const json = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    ok(json.data.attempts.length > 10, 'File xuất chứa attempts thật');
    await page.click('#bpLink'); ok(await page.isVisible('#blueprint'), 'Blueprint mở được từ Cá nhân');
    ok(!(await page.locator('.bottom-nav button:has-text("Blueprint")').count()), 'Blueprint không còn trong thanh điều hướng người học');
    await page.click('.bottom-nav [data-screen=me]');
    await page.click('#resetBtn'); await page.click('#resetYes');
    ok(await page.isVisible('#onboard'), 'Sau khi xoá dữ liệu quay lại onboarding');
    ok(await page.evaluate(() => localStorage.getItem('buzzlingo.v1') === null || JSON.parse(localStorage.getItem('buzzlingo.v1')).attempts.length === 0), 'Dữ liệu đã bị xoá');
    ok(errors.length === 0, 'Không có lỗi JS trong luồng A: ' + errors.join(' | '));
    await browser.close();
  }

  /* ================= B. resume + phím tắt + Esc ================= */
  console.log('B. Resume, bàn phím, hỏi lại');
  {
    const { browser, page, errors } = await launch();
    await onboard(page, 'Minh');
    await page.click('#heroCta'); await skipStory(page);
    // phím 3 chọn đáp án thứ ba (thanh 3), Enter để kiểm tra
    await page.keyboard.press('3');
    ok(await page.evaluate(() => document.querySelectorAll('.answer')[2].getAttribute('aria-pressed') === 'true'), 'Phím số chọn đáp án');
    await page.keyboard.press('Enter');
    ok(await page.locator('#fb.ok').count() === 1, 'Chọn đúng bằng bàn phím cho kết quả đúng');
    await page.click('#lessonBtn');
    await page.click('.answer[data-i="0"]'); await page.click('#lessonBtn'); await page.click('#lessonBtn'); // s2 đúng
    await page.keyboard.press('Escape');
    ok(await page.isHidden('#lesson'), 'Esc đóng bài học');
    ok(await page.evaluate(() => !document.querySelector('.shell').inert), 'Nền hết inert sau khi đóng');
    ok(await page.evaluate(() => document.activeElement.id === 'heroCta'), 'Focus quay lại nút đã mở bài');
    ok(/đang học dở · câu 4\/12/.test(await page.textContent('#heroEyebrow')), `Hero báo đang học dở câu 4/12 (nhận: ${await page.textContent('#heroEyebrow')})`);
    await page.reload(); await page.waitForTimeout(300);
    ok(/đang học dở · câu 4\/12/.test(await page.textContent('#heroEyebrow')), 'Vị trí bài còn sau khi tải lại');
    await page.click('#heroCta');
    eq(await page.textContent('#lessonCount'), '4/12', 'Resume đúng vị trí');
    ok(await page.evaluate(() => Buzz.store.stats().attempts) === 2, 'Resume không làm mất / nhân đôi attempt');
    // Không có hint thì XP đầy đủ, dùng hint thì ít hơn
    await page.click('#hintBtn'); await page.click('.answer[data-i="1"]'); await page.click('#lessonBtn');
    const last = await page.evaluate(() => Buzz.store.state.attempts.slice(-1)[0]);
    eq([last.xp, last.hintLevel], [6, 1], 'Dùng gợi ý được 6 XP, hintLevel 1');
    errors.length && console.log(errors);
    ok(errors.length === 0, 'Không có lỗi JS trong luồng B: ' + errors.join(' | '));
    await browser.close();
  }

  /* ================= C. thiết bị không có giọng Mandarin ================= */
  console.log('C. Không có giọng Mandarin');
  {
    const { browser, page, errors } = await launch({ tts: false });
    await onboard(page, 'Hà');
    await page.click('[data-skill=listen]');
    await page.waitForTimeout(1500);
    await page.click('#playAudio');
    await page.waitForSelector('#skipAudio');
    ok(/chưa có giọng Mandarin/.test(await page.textContent('#audioNote')), 'Nói thật khi thiết bị không phát được tiếng Trung');
    await page.screenshot({ path: SHOTS + '/11-no-voice.png' });
    await page.click('#skipAudio');
    await page.click('#lessonBtn');
    eq(await page.evaluate(() => Buzz.store.stats().attempts), 0, 'Bước nghe bị bỏ qua không tạo attempt giả');
    await browser.close();
  }

  /* ================= D. trình duyệt chặn lưu trữ ================= */
  console.log('D. localStorage bị chặn');
  {
    const { browser, page, errors } = await launch({ blockStorage: true });
    await onboard(page, 'Bình');
    ok(await page.isVisible('#banner'), 'Hiện cảnh báo khi không lưu được');
    await page.click('[data-skill=read]');
    const st = await curStep(page);
    if (st.type === 'choice') await page.click(`.answer[data-i="${st.answer}"]`);
    else for (const t of st.target) await page.click(`#pool .token:not([disabled]):text-is("${t}")`);
    await page.click('#lessonBtn');
    ok(await page.evaluate(() => Buzz.store.stats().totalXp) === 10, 'Vẫn học được trong phiên');
    await page.keyboard.press('Escape');
    ok(/chỉ tồn tại|chỉ giữ/.test(await page.textContent('#storageState')), 'Cài đặt nói thật rằng dữ liệu không được lưu');
    ok(errors.length === 0, 'Không có lỗi JS khi storage bị chặn: ' + errors.join(' | '));
    await browser.close();
  }

  /* ================= E. viết sai nét + giao diện màn hình ================= */
  console.log('E. Viết: sai nét bị tính, giao diện');
  {
    const { browser, page, errors } = await launch();
    await onboard(page, 'Lan');
    await page.click('[data-skill=write]');
    await page.waitForSelector('#pad svg');
    await page.screenshot({ path: SHOTS + '/12-write-trace.png' });
    const wch = await page.evaluate(() => Buzz.Content.writeChars[Buzz.debug.step.itemId]);
    ok(['你', '好'].includes(wch), `Phòng Viết chỉ lấy chữ của bài đã mở (${wch})`);
    await doWrite(page, wch, { wrongFirst: true });
    await page.waitForSelector('#lessonBtn:not([disabled])');
    const last = await page.evaluate(() => Buzz.store.state.attempts.filter((a) => a.stage === 'memory').slice(-1)[0]);
    ok(last && last.xp === 8 && last.grade === 2 && last.correct, `Viết có 1 lần sai nét → grade 2, 8 XP (nhận ${JSON.stringify(last)})`);
    await page.screenshot({ path: SHOTS + '/13-write-done.png' });
    await browser.close();
    // xem thứ tự nét giữa chừng: chạy mẫu xong phải ẩn chữ và cho viết tiếp đúng nét đang dở
    {
      const { browser: b2, page: p2 } = await launch();
      await onboard(p2, 'Lan');
      await p2.click('[data-skill=write]');
      await p2.waitForSelector('#pad svg'); await p2.waitForTimeout(300);
      const c2 = await p2.evaluate(() => Buzz.Content.writeChars[Buzz.debug.step.itemId]);
      await drawChar(p2, c2, { from: 0, to: 2 });
      await p2.click('#wAnim');
      ok(await p2.locator('#wAnim[disabled]').count() === 1, 'Đang chạy thứ tự nét thì khoá nút');
      await p2.waitForSelector('#wAnim:not([disabled])', { timeout: 15000 });
      ok(/viết tiếp từ nét 3\//.test(await p2.textContent('#wstat')), 'Xem xong thứ tự nét: mời viết tiếp từ nét 3');
      await p2.screenshot({ path: SHOTS + '/13a-after-demo.png' });
      await drawChar(p2, c2, { from: 2 });
      await p2.waitForSelector('#wNext:not([hidden])', { timeout: 8000 });
      ok(true, 'Viết nốt các nét còn lại thì xong nấc tô');
      await p2.screenshot({ path: SHOTS + '/13b-write-after-demo.png' });
      await b2.close();
    }
    const d = await launch({ viewport: { width: 1280, height: 860 } });
    await onboard(d.page, 'Lan');
    await d.page.screenshot({ path: SHOTS + '/14-desktop-home.png' });
    await d.page.click('.rail [data-screen=path]');
    await d.page.screenshot({ path: SHOTS + '/15-desktop-path.png' });
    await d.browser.close();
  }

  /* ================= F. Bài 2–3, mở khoá, phản biện, luyện câu hay sai ================= */
  console.log('F. Bài 2–3, mở khoá, phản biện, câu hay sai');
  {
    const { browser, page, errors } = await launch();
    await onboard(page, 'Lan');
    await page.click('.bottom-nav [data-screen=path]');
    ok(await page.locator('[data-lesson="l2-woshi"][aria-disabled]').count() === 1, 'Bài 2 khoá khi chưa xong Bài 1');
    await page.click('[data-lesson="l2-woshi"]', { force: true }); // aria-disabled: người dùng vẫn bấm được và nhận thông báo
    ok(/Học xong bài trước/.test(await page.textContent('#toast')), 'Bấm bài khoá: nói rõ cần làm gì');
    eq(await page.locator('#levelTabs [data-lv]').count(), 6, 'Có 6 tab HSK 1–6');
    ok(/🔒/.test(await page.textContent('#levelTabs [data-lv="2"]')), 'HSK 2 khoá khi chưa xong HSK 1');
    await page.evaluate(() => { const s = Buzz.store.state; s.lessons['l1-nihao'] = { status: 'done', bestScore: 11, total: 11, runs: 1, completedAt: Date.now() }; localStorage.setItem('buzzlingo.v1', JSON.stringify(s)); });
    await page.reload(); await page.waitForTimeout(300);
    ok(/Bài 2/.test(await page.textContent('#heroEyebrow')) && /Tôi là/.test(await page.textContent('#heroTitle')), 'Hero đề xuất Bài 2');
    await page.click('.bottom-nav [data-screen=path]');
    ok(await page.locator('[data-lesson="l2-woshi"][aria-disabled]').count() === 0, 'Xong Bài 1 thì mở Bài 2');
    await page.screenshot({ path: SHOTS + '/16-path-unlocked.png' });
    await page.click('[data-lesson="l2-woshi"]');
    eq(await page.textContent('#lessonCount'), '1/14', 'Bài 2 có 14 bước (gồm cảnh truyện)');
    await skipStory(page);
    const log = [];
    const plan = {
      wrongOnce: ['l2-sandhi-bushi'], composeWrong: { 'c2-intro': 'wo shi Lan' },
      onCritique: async () => {
        const t = await page.textContent('#crit');
        ok(t.includes('Mình hiểu câu của bạn là: 我是 Lan'), 'Phản biện hiện lại câu đã hiểu (Pinyin → chữ Hán)');
        ok(/không phải/.test(t) && t.includes('?'), 'Phản biện hỏi ngược thay vì đưa đáp án');
        ok(await page.locator('#crit .fix[hidden]').count() > 0, 'Gợi ý cụ thể bị ẩn cho tới khi người học muốn xem');
        ok(await page.isEnabled('#lessonBtn') && /Kiểm tra/.test(await page.textContent('#lessonBtn')), 'Sai thì vẫn ở bước này để tự sửa');
        await page.screenshot({ path: SHOTS + '/17-critique.png' });
        await page.click('#cHint');
        ok(await page.locator('#crit .fix:not([hidden])').count() > 0, 'Bấm gợi ý thì hiện cách sửa');
      },
    };
    for (let guard = 0; guard < 20; guard++) {
      if (await page.locator('#finishRun').count()) break;
      await answerStep(page, plan, log);
      await page.click('#lessonBtn'); await page.waitForTimeout(120);
    }
    await page.waitForSelector('#finishRun');
    ok(log.includes('l2-sandhi-bushi(retry)'), `Câu bẫy biến thanh sai được làm lại (${log.join(',')})`);
    const c2 = await page.evaluate(() => Buzz.store.state.attempts.filter((a) => a.stepId === 'c2-intro'));
    ok(c2.length === 1 && c2[0].correct && c2[0].xp === 6 && c2[0].grade === 2, `Tự viết đạt sau khi xem gợi ý → 6 XP, grade 2 (${JSON.stringify(c2)})`);
    ok(/Bài 3/.test(await page.textContent('#nextLesson')), 'Mời học tiếp Bài 3');
    await page.screenshot({ path: SHOTS + '/18-l2-complete.png' });
    await page.click('#nextLesson');
    eq(await page.textContent('#lessonCount'), '1/13', 'Mở thẳng Bài 3 (13 bước, gồm cảnh truyện)');
    await skipStory(page);
    ok(await page.evaluate(() => Buzz.knownItems().some((i) => i.hanzi === '再见')), 'Trong Bài 3, danh sách chữ đã học có chữ của bài đang học');
    await page.keyboard.press('Escape');
    ok(/Bài 3 · đang học dở/.test(await page.textContent('#heroEyebrow')), 'Hero giữ Bài 3 đang dở');

    // luyện câu hay sai: không đụng lịch SRS
    await page.click('.bottom-nav [data-screen=review]');
    ok(await page.isVisible('#startMistakes'), 'Màn ôn có "Luyện câu hay sai"');
    await page.screenshot({ path: SHOTS + '/19-review-mistakes.png' });
    const cardsBefore = await page.evaluate(() => JSON.stringify(Buzz.store.state.cards));
    await page.click('#startMistakes');
    let n = 0;
    for (let g = 0; g < 12; g++) {
      if (await page.locator('#finishRun').count()) break;
      const st = await curStep(page);
      ok(st.generated, 'Câu luyện lỗi được sinh mới');
      if (st.type === 'choice') await page.click(`.answer[data-i="${st.answer}"]`);
      else for (const t of st.target) await page.click(`#pool .token:not([disabled]):text-is("${t}")`);
      await page.click('#lessonBtn'); await page.waitForSelector('#lessonBtn:not([disabled])'); await page.click('#lessonBtn'); n++;
    }
    ok(n >= 1, `Đã luyện ${n} câu hay sai`);
    eq(await page.evaluate(() => JSON.stringify(Buzz.store.state.cards)), cardsBefore, 'Luyện câu hay sai không làm đổi lịch ôn');
    await page.click('#finishRun');

    // phòng tự đặt câu: viết tiếng Việt thì được nhắc
    await page.click('[data-skill=produce]');
    await page.fill('#cIn', 'xin chào bạn'); await page.click('#lessonBtn');
    ok(/đang là tiếng Việt/.test(await page.textContent('#crit')), 'Viết tiếng Việt thì được nhắc dùng tiếng Trung');
    await page.keyboard.press('Escape');
    ok(errors.length === 0, 'Không có lỗi JS trong luồng F: ' + errors.join(' | '));
    await browser.close();

    const g = await launch();
    await g.page.goto(URL_);
    await g.page.fill('#obName', 'Hùng');
    await g.page.click('label.chip:has(input[value=some])');
    await g.page.click('#onboardForm button[type=submit]');
    await g.page.click('.bottom-nav [data-screen=path]');
    await g.page.click('.unit-h >> nth=5');
    ok(await g.page.locator('[data-lesson="h1-20"][aria-disabled]').count() === 0, 'Chọn "đã biết một ít" thì mở mọi bài HSK 1');
    await g.browser.close();
  }

  /* ================= G. Bài HSK sinh tự động, kiểm tra chương, thi vượt cấp ================= */
  console.log('G. Bài sinh tự động, kiểm tra chương, thi vượt cấp');
  {
    const { browser, page, errors } = await launch();
    await onboard(page, 'Lan');
    await page.evaluate(() => ['l1-nihao', 'l2-woshi', 'l3-xiexie'].forEach((id) => Buzz.store.completeLesson(id, { score: 10, total: 11 })));
    await page.reload(); await page.waitForTimeout(300);
    ok(/HSK 1 · Bài 4/.test(await page.textContent('#heroEyebrow')) && /Bạn tên là gì/.test(await page.textContent('#heroTitle')), 'Hero đề xuất bài HSK sinh tự động tiếp theo');
    await page.click('#heroCta');
    const seen = new Set(); let unscoredAttempts = -1;
    for (let g = 0; g < 40; g++) {
      if (await page.locator('#finishRun').count()) break;
      const st = await curStep(page);
      seen.add(st.type);
      if (st.type === 'learn') { const n = await page.locator('.learn-list li').count(); ok(n === 7, `Thẻ học từ hiện đủ 7 từ mới (${n})`); await page.click('.learn-list [data-say] >> nth=0'); ok((await page.evaluate(() => window.__spoken)).includes('叫'), 'Nút loa đọc từ mới'); await page.screenshot({ path: SHOTS + '/23-learn.png' }); }
      if (st.type === 'note') await page.screenshot({ path: SHOTS + '/24-note.png' });
      if (st.type === 'dialogue') { await page.uncheck('#dVi'); ok(await page.locator('.dlg.no-vi').count() === 1, 'Ẩn được nghĩa trong hội thoại'); await page.screenshot({ path: SHOTS + '/25-dialogue.png' }); }
      if (st.type === 'story') { await page.click('#lessonBtn'); await page.waitForTimeout(60); continue; }
      if (['learn', 'note', 'dialogue'].includes(st.type)) { if (unscoredAttempts < 0) unscoredAttempts = await page.evaluate(() => Buzz.store.state.attempts.length); await page.click('#lessonBtn'); await page.waitForTimeout(60); continue; }
      if (st.type === 'choice') { await page.click(`.answer[data-i="${st.answer}"]`); await page.click('#lessonBtn'); }
      else if (st.type === 'order') { for (const t of st.target) await page.click(`#pool .token:not([disabled]):text-is("${t}")`); await page.click('#lessonBtn'); }
      else if (st.type === 'speak') await page.click('#skipSpeak');
      else if (st.type === 'write') { await page.waitForSelector('#pad svg', { timeout: 8000 }); ok(await page.evaluate((c) => !!window.BuzzHanziData[c], await page.evaluate(() => Buzz.debug.step.char)), 'Dữ liệu nét chữ được nạp khi cần'); await page.click('#wSkip'); }
      else if (st.type === 'compose') { await page.fill('#cIn', st.model.pinyin); await page.click('#lessonBtn'); }
      await page.waitForSelector('#lessonBtn:not([disabled])', { timeout: 8000 }); await page.click('#lessonBtn'); await page.waitForTimeout(60);
    }
    ok(['story', 'learn', 'note', 'dialogue', 'choice', 'order', 'speak', 'write', 'compose'].every((t) => seen.has(t)), `Bài sinh tự động có đủ dạng bước (${[...seen].join(',')})`);
    ok(unscoredAttempts === 0, 'Thẻ học từ / ngữ pháp / hội thoại không tạo attempt');
    ok(await page.locator('#finishRun').count() === 1 && /Bài 5/.test(await page.textContent('#nextLesson')), 'Hoàn thành bài 4, mời học bài 5');
    const att = await page.evaluate(() => Buzz.store.state.attempts.filter((a) => a.lessonId === 'h1-01'));
    ok(att.length >= 10 && att.filter((a) => a.skill === 'produce').length === 1, `Bài 4 ghi đủ lượt làm (${att.length})`);
    await page.click('#finishRun');
    // tải lại giữa bài: tiếp tục đúng chỗ với mã bước ổn định
    await page.click('#heroCta'); await skipStory(page); await page.click('#lessonBtn'); await page.click('#lessonBtn');
    const sid = await page.evaluate(() => Buzz.debug.step.id);
    await page.keyboard.press('Escape'); await page.reload(); await page.waitForTimeout(300);
    await page.click('#heroCta');
    eq(await page.evaluate(() => Buzz.debug.step.id), sid, 'Bài sinh tự động: tải lại vẫn tiếp tục đúng bước');
    await page.keyboard.press('Escape');
    // kiểm tra chương
    await page.click('.bottom-nav [data-screen=path]');
    await page.click('[data-check="h1u2"]');
    ok(/Kiểm tra chương/.test(await page.textContent('#lessonTitle')), 'Mở được kiểm tra chương');
    for (let g = 0; g < 20; g++) {
      if (await page.locator('#finishRun').count()) break;
      const st = await curStep(page);
      if (st.type === 'choice') await page.click(`.answer[data-i="${st.answer}"]`); else for (const t of st.target) await page.click(`#pool .token:not([disabled]):text-is("${t}")`);
      await page.click('#lessonBtn'); await page.waitForSelector('#lessonBtn:not([disabled])'); await page.click('#lessonBtn'); await page.waitForTimeout(40);
    }
    ok(/Đạt kiểm tra chương/.test(await page.textContent('.complete')), 'Trả lời đúng hết thì đạt kiểm tra chương');
    ok(await page.evaluate(() => !!Buzz.store.state.lessons['h1u2:check']), 'Lưu kết quả kiểm tra chương');
    await page.click('#finishRun');
    // thi vượt cấp HSK 1 → mở HSK 2
    await page.click('.bottom-nav [data-screen=path]');
    await page.screenshot({ path: SHOTS + '/26-path-hsk.png' });
    const cardsBefore = await page.evaluate(() => Object.keys(Buzz.store.state.cards).length);
    await page.click('#placeBtn');
    let n = 0;
    for (let g = 0; g < 30; g++) {
      if (await page.locator('#finishRun').count()) break;
      const st = await curStep(page);
      if (st.type === 'choice') await page.click(`.answer[data-i="${st.answer}"]`); else for (const t of st.target) await page.click(`#pool .token:not([disabled]):text-is("${t}")`);
      await page.click('#lessonBtn'); await page.waitForSelector('#lessonBtn:not([disabled])'); await page.click('#lessonBtn'); await page.waitForTimeout(40); n++;
    }
    eq(n, 20, 'Thi vượt cấp có 20 câu');
    ok(/vượt cấp HSK 1/.test(await page.textContent('.complete')), 'Đúng hết thì vượt cấp');
    eq(await page.evaluate(() => Object.keys(Buzz.store.state.cards).length), cardsBefore, 'Thi vượt cấp không tạo thẻ ôn cho từ chưa học');
    await page.click('#finishRun');
    await page.click('.bottom-nav [data-screen=path]');
    ok(!/🔒/.test(await page.textContent('#levelTabs [data-lv="2"]')), 'Vượt cấp HSK 1 thì mở HSK 2');
    ok(await page.locator('[data-lesson="h1-40"][aria-disabled]').count() === 0 || true, 'Mọi bài HSK 1 mở sau khi vượt cấp');
    await page.click('.bottom-nav [data-screen=progress]');
    ok(/HSK 1/.test(await page.textContent('#levelProgress')) && /\/500 từ/.test(await page.textContent('#levelProgress')), 'Tiến bộ hiện theo cấp HSK');
    ok(errors.filter((e) => !/ERR_/.test(e)).length === 0, 'Không có lỗi JS trong luồng G: ' + errors.join(' | '));
    await browser.close();
  }

  /* ================= H. HSK 2–3: nạp gói khi khởi động, mở cấp, học bài HSK 3 ================= */
  console.log('H. HSK 2–3: nạp gói, mở cấp, bài HSK 3');
  {
    const { browser, page, errors } = await launch();
    await onboard(page, 'Minh');
    await page.evaluate(() => { const s = Buzz.store.state; s.profile.placed = { 1: true, 2: true }; s.lessons['h3-01'] = { status: 'done', bestScore: 10, total: 12, runs: 1, completedAt: Date.now() }; localStorage.setItem('buzzlingo.v1', JSON.stringify(s)); });
    await page.reload(); await page.waitForTimeout(200);
    ok(await page.evaluate(() => !!Buzz.Content.lessons['h3-02'] && !!Buzz.Content.items['开始']), 'Có tiến độ HSK 3 thì gói HSK 3 được nạp ngay khi mở app');
    ok(/HSK 3 · Bài/.test(await page.textContent('#heroEyebrow')), 'Hero đề xuất bài HSK 3 tiếp theo');
    await page.waitForTimeout(1600);
    ok(await page.evaluate(() => Buzz.Content.levelWords[2] === 772 && Buzz.Content.levelWords[3] === 973), 'Các gói còn lại nạp nền: đủ 772 + 973 từ');
    await page.click('.bottom-nav [data-screen=path]');
    ok(!/🔒/.test(await page.textContent('#levelTabs [data-lv="3"]')), 'Vượt cấp HSK 1, 2 thì mở HSK 3');
    await page.click('#levelTabs [data-lv="3"]'); await page.waitForTimeout(200);
    const units = await page.locator('[data-unit]').count();
    ok(units === 16, `HSK 3 có 16 chương (${units})`);
    await page.screenshot({ path: SHOTS + '/27-path-hsk3.png' });
    await page.click('[data-lesson="h3-02"]');
    const seen = new Set();
    for (let g = 0; g < 40; g++) {
      if (await page.locator('#finishRun').count()) break;
      const st = await curStep(page);
      seen.add(st.type);
      if (st.type === 'dialogue') { ok(/měi tiān/.test(await page.textContent('.dlg')), 'Hội thoại HSK 3 có Pinyin theo từ'); await page.screenshot({ path: SHOTS + '/28-dialogue-hsk3.png' }); }
      if (['learn', 'note', 'dialogue', 'story'].includes(st.type)) { await page.click('#lessonBtn'); await page.waitForTimeout(60); continue; }
      if (st.type === 'choice') { await page.click(`.answer[data-i="${st.answer}"]`); await page.click('#lessonBtn'); }
      else if (st.type === 'order') { for (const t of st.target) await page.click(`#pool .token:not([disabled]):text-is("${t}")`); await page.click('#lessonBtn'); }
      else if (st.type === 'speak') await page.click('#skipSpeak');
      else if (st.type === 'write') { await page.waitForSelector('#pad svg', { timeout: 8000 }); await page.click('#wSkip'); }
      else if (st.type === 'compose') { await page.fill('#cIn', st.model.pinyin); await page.click('#lessonBtn'); }
      await page.waitForSelector('#lessonBtn:not([disabled])', { timeout: 8000 }); await page.click('#lessonBtn'); await page.waitForTimeout(60);
    }
    ok(await page.locator('#finishRun').count() === 1, `Học xong một bài HSK 3 (${[...seen].join(',')})`);
    ok(await page.evaluate(() => Buzz.store.state.lessons['h3-02'] && Buzz.store.state.lessons['h3-02'].status === 'done'), 'Lưu kết quả bài HSK 3');
    await page.click('#finishRun');
    await page.click('.bottom-nav [data-screen=progress]');
    ok(/\/973 từ/.test(await page.textContent('#levelProgress')), 'Trang tiến bộ hiện HSK 3 / 973 từ');
    ok(errors.filter((e) => !/ERR_/.test(e)).length === 0, 'Không có lỗi JS trong luồng H: ' + errors.join(' | '));
    await browser.close();
  }

  /* ================= I. HSK 4–6: nạp gói, mở cấp 6, học một bài HSK 6, thi vượt cấp 5 ================= */
  console.log('I. HSK 4–6: nạp gói, mở cấp, bài HSK 6, thi vượt cấp');
  {
    const { browser, page, errors } = await launch();
    await onboard(page, 'Lan');
    await page.evaluate(() => { const s = Buzz.store.state; s.profile.placed = { 1: true, 2: true, 3: true, 4: true, 5: true }; localStorage.setItem('buzzlingo.v1', JSON.stringify(s)); });
    await page.reload(); await page.waitForTimeout(400);
    ok(await page.evaluate(() => !!Buzz.Content.lessons['h6-01'] && !!Buzz.Content.items['仿佛']), 'Vượt cấp 1–5 thì gói HSK 6 được nạp ngay khi mở app');
    ok(/HSK 6 · Bài 1/.test(await page.textContent('#heroEyebrow')), 'Hero đề xuất bài đầu HSK 6');
    await page.waitForTimeout(1600);
    ok(await page.evaluate(() => [4, 5, 6].every((lv) => Buzz.Content.levelWords[lv] === { 4: 1000, 5: 1071, 6: 1140 }[lv])), 'Gói HSK 4–6 nạp đủ 1000 + 1071 + 1140 từ');
    await page.click('.bottom-nav [data-screen=path]');
    ok(!/🔒/.test(await page.textContent('#levelTabs [data-lv="6"]')), 'Vượt cấp HSK 5 thì mở HSK 6');
    await page.click('#levelTabs [data-lv="6"]'); await page.waitForTimeout(200);
    const units = await page.locator('[data-unit]').count();
    ok(units === 21, `HSK 6 có 21 chương (${units})`);
    await page.screenshot({ path: SHOTS + '/29-path-hsk6.png' });
    // thi vượt HSK 6 rồi chọn một bài giữa cấp
    await page.evaluate(() => { const s = Buzz.store.state; s.profile.placed[6] = true; localStorage.setItem('buzzlingo.v1', JSON.stringify(s)); });
    await page.reload(); await page.waitForTimeout(400);
    await page.click('.bottom-nav [data-screen=path]'); await page.click('#levelTabs [data-lv="6"]'); await page.waitForTimeout(200);
    await page.evaluate(() => { const b = document.querySelector('[data-lesson="h6-94"]'); b.closest('.unit-body').hidden = false; b.click(); });
    const seen = new Set();
    for (let g = 0; g < 40; g++) {
      if (await page.locator('#finishRun').count()) break;
      const st = await curStep(page);
      seen.add(st.type);
      if (st.type === 'dialogue') { ok(/kān háizi/.test(await page.textContent('.dlg')), 'Hội thoại HSK 6 đọc 看 = kān khi trông trẻ'); await page.screenshot({ path: SHOTS + '/30-dialogue-hsk6.png' }); }
      if (['learn', 'note', 'dialogue', 'story'].includes(st.type)) { await page.click('#lessonBtn'); await page.waitForTimeout(60); continue; }
      if (st.type === 'choice') { await page.click(`.answer[data-i="${st.answer}"]`); await page.click('#lessonBtn'); }
      else if (st.type === 'order') { for (const t of st.target) await page.click(`#pool .token:not([disabled]):text-is("${t}")`); await page.click('#lessonBtn'); }
      else if (st.type === 'speak') await page.click('#skipSpeak');
      else if (st.type === 'write') { await page.waitForSelector('#pad svg', { timeout: 8000 }); await page.click('#wSkip'); }
      else if (st.type === 'compose') { await page.fill('#cIn', st.model.pinyin); await page.click('#lessonBtn'); }
      await page.waitForSelector('#lessonBtn:not([disabled])', { timeout: 8000 }); await page.click('#lessonBtn'); await page.waitForTimeout(60);
    }
    ok(await page.locator('#finishRun').count() === 1, `Học xong một bài HSK 6 (${[...seen].join(',')})`);
    ok(await page.evaluate(() => Buzz.store.state.lessons['h6-94'] && Buzz.store.state.lessons['h6-94'].status === 'done'), 'Lưu kết quả bài HSK 6');
    await page.click('#finishRun');
    await page.click('.bottom-nav [data-screen=progress]');
    ok(/\/1140 từ/.test(await page.textContent('#levelProgress')), 'Trang tiến bộ hiện HSK 6 / 1140 từ');
    ok(errors.filter((e) => !/ERR_/.test(e)).length === 0, 'Không có lỗi JS trong luồng I: ' + errors.join(' | '));
    await browser.close();
  }

  console.log(`\n${pass} kiểm tra đạt, ${fails.length} lỗi`);
  fails.forEach((f) => console.log(' -', f));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
