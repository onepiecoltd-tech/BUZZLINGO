/* BuzzLingo · renderer cho từng dạng bài: choice, order, speak, write, flip.
 * Contract: renderer(step, ui) dựng DOM vào ui.stage, gọi ui.finish(result) đúng một lần khi hoàn tất.
 * result: { correct, grade?, xp?, hintUsed?, answer?, verified?, skipped?, degraded? } */
(function () {
  'use strict';
  const B = (window.Buzz = window.Buzz || {});
  const C = B.Content, A = B.Audio, SRS = B.SRS;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const zhAttr = (t) => (/[一-鿿]/.test(t) ? ' lang="zh-Hans"' : '');
  const $ = (sel, root = document) => root.querySelector(sel);
  const coachName = { bap: 'Bắp', blu: 'Blu' };
  B.U = { esc, zhAttr, $, coachName };

  function coachFace(coach) {
    const n = coach === 'blu' ? 'blu' : 'bap';
    return `<span class="coach-face"><img src="assets/${n}-avatar-128.webp" srcset="assets/${n}-avatar-128.webp 1x, assets/${n}-avatar-256.webp 2x" width="42" height="42" alt=""></span>`;
  }
  const coachLine = (step, retry) =>
    `<div class="coach">${coachFace(step.coach)}<span><b>${coachName[step.coach] || 'Bắp'}</b> ${retry ? 'cho bạn thử lại câu này nhé' : 'đang đồng hành cùng bạn'}</span></div>`;

  /* ---------- khối audio dùng chung ---------- */
  function audioBlock(step, ui) {
    return `<div class="skill-card audio-card"><div class="audio-row"><button class="audio-btn" id="playAudio" aria-label="Phát âm thanh">🔊</button><button class="audio-btn slow" id="playSlow" aria-label="Phát chậm">🐢</button></div><p class="hint" id="audioNote">Có thể nghe lại nhiều lần.</p></div>`;
  }
  function bindAudio(step, ui) {
    const play = $('#playAudio', ui.stage), slow = $('#playSlow', ui.stage), note = $('#audioNote', ui.stage);
    let degraded = false;
    const noVoice = () => {
      const n = $('#audioNote', ui.stage);
      if (!n || ui.done) return; // đã chuyển sang bước khác
      degraded = true;
      n.innerHTML = 'Thiết bị này chưa có giọng Mandarin nên không phát được âm. Bạn có thể <button class="linkbtn" id="skipAudio">bỏ qua bước nghe này</button> — bước sẽ không tính vào kỹ năng Nghe.';
      $('#skipAudio', ui.stage).onclick = () => { ui.finish({ skipped: true }); };
    };
    const go = (rate) => () => A.play(step.audio, rate).then((ok) => { if (!ok) noVoice(); else ui.played = true; });
    play.onclick = go(0.85); slow.onclick = go(0.55);
    // chỉ báo trước khi chắc chắn máy không có giọng Trung; nếu chưa rõ (Safari iOS) thì để lần bấm phát quyết định
    A.whenReady().then(() => { if (A.voiceState() === 'no' && !step.audio.src) noVoice(); });
    return () => degraded;
  }

  /* ---------- trắc nghiệm ---------- */
  function choice(step, ui) {
    const stim = step.stimulus
      ? step.stimulus.bubble ? `<div class="bubble">${esc(step.stimulus.bubble)}</div>`
        : `<div class="skill-card"><div class="skill-hanzi" lang="zh-Hans">${esc(step.stimulus.hanzi)}</div>${step.stimulus.pinyin ? `<div class="pinyin">${esc(step.stimulus.pinyin)}</div>` : ''}</div>` : '';
    ui.stage.innerHTML = `${coachLine(step, ui.retry)}<h2 id="stepTitle" tabindex="-1">${esc(step.title)}</h2><p class="lead">${esc(step.prompt)}</p>${step.audio ? audioBlock(step, ui) : ''}${stim}
      <div class="tone-grid" role="group" aria-label="Các đáp án">${step.options.map((o, i) => `<button class="answer" data-i="${i}" aria-pressed="false"><span class="key">${i + 1}</span><b${zhAttr(o[0])}>${esc(o[0])}</b>${o[1] ? `<small${step.revealSub ? ' class="late" hidden' : ''}>${esc(o[1])}</small>` : ''}</button>`).join('')}</div>
      ${step.hint ? '<button class="linkbtn" id="hintBtn" type="button">💡 Gợi ý (được ít XP hơn)</button><p class="hint-box" id="hintBox" hidden></p>' : ''}
      <div class="feedback" id="fb" role="status"></div>`;
    const btns = [...ui.stage.querySelectorAll('.answer')];
    let selected = null, hintUsed = false, done = false;
    const degradedFn = step.audio ? bindAudio(step, ui) : () => false;
    const select = (i) => {
      if (done || !btns[i]) return;
      selected = i;
      btns.forEach((b, j) => { b.classList.toggle('selected', j === i); b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      ui.setReady(true);
    };
    btns.forEach((b, i) => (b.onclick = () => select(i)));
    ui.onKey = (e) => { if (/^[1-9]$/.test(e.key) && +e.key <= btns.length) select(+e.key - 1); };
    const hb = $('#hintBtn', ui.stage);
    if (hb) hb.onclick = () => { hintUsed = true; const box = $('#hintBox', ui.stage); box.hidden = false; box.textContent = step.hint; hb.hidden = true; };
    ui.onCheck = () => {
      if (selected == null || done) return;
      done = true;
      const ok = selected === step.answer;
      btns.forEach((b, j) => { b.disabled = true; if (j === step.answer) b.classList.add('correct'); else if (j === selected) b.classList.add('wrong'); });
      ui.stage.querySelectorAll('.late').forEach((n) => (n.hidden = false));
      const fb = $('#fb', ui.stage);
      const info = ui.finish({ correct: ok, hintUsed, degraded: degradedFn(), answer: step.options[selected][0] });
      fb.className = `feedback show ${ok ? 'ok' : 'no'}`;
      fb.innerHTML = ok ? `<b>✓ Đúng rồi.</b> ${esc(step.explain)}` : `<b>Chưa đúng.</b> Đáp án là <b${zhAttr(step.options[step.answer][0])}>${esc(step.options[step.answer][0])}</b>. ${esc(step.explain)}${info && info.willRetry ? ' <br>Câu này sẽ quay lại sau ít câu, và thẻ ôn được xếp cho ngày mai.' : ''}`;
      if (B.Coach) B.Coach.attachExplain(ui, step, { ok, correct: step.options[step.answer][0], answer: step.options[selected][0] });
    };
  }

  /* ---------- sắp xếp chữ ---------- */
  function order(step, ui) {
    ui.stage.innerHTML = `${coachLine(step, ui.retry)}<h2 id="stepTitle" tabindex="-1">${esc(step.title)}</h2><p class="lead">${esc(step.prompt)}</p>
      <div class="order-line" id="line" aria-live="polite" aria-label="Câu của bạn"><span class="placeholder">Chạm chữ bên dưới</span></div>
      <div class="order-pool" id="pool" role="group" aria-label="Các chữ để ghép">${step.tokens.map((t, i) => `<button class="token" data-i="${i}" lang="zh-Hans">${esc(t)}</button>`).join('')}</div>
      <button class="linkbtn" id="resetOrder" type="button">↺ Làm lại</button>
      ${step.hint ? '<button class="linkbtn" id="hintBtn" type="button">💡 Gợi ý (được ít XP hơn)</button><p class="hint-box" id="hintBox" hidden></p>' : ''}
      <div class="feedback" id="fb" role="status"></div>`;
    let chosen = [], hintUsed = false, done = false;
    const line = $('#line', ui.stage), pool = [...ui.stage.querySelectorAll('.token')];
    const draw = () => {
      line.innerHTML = chosen.length ? chosen.map((i) => `<button class="token placed" data-i="${i}" lang="zh-Hans" aria-label="Bỏ chữ ${esc(step.tokens[i])}">${esc(step.tokens[i])}</button>`).join('') : '<span class="placeholder">Chạm chữ bên dưới</span>';
      pool.forEach((b) => (b.disabled = chosen.includes(+b.dataset.i)));
      line.querySelectorAll('.placed').forEach((b) => (b.onclick = () => { if (done) return; chosen = chosen.filter((i) => i !== +b.dataset.i); draw(); }));
      ui.setReady(chosen.length === step.tokens.length && !done);
    };
    pool.forEach((b) => (b.onclick = () => { if (done) return; chosen.push(+b.dataset.i); draw(); }));
    $('#resetOrder', ui.stage).onclick = () => { if (!done) { chosen = []; draw(); } };
    const hb = $('#hintBtn', ui.stage);
    if (hb) hb.onclick = () => { hintUsed = true; const box = $('#hintBox', ui.stage); box.hidden = false; box.textContent = step.hint; hb.hidden = true; };
    ui.onCheck = () => {
      if (chosen.length !== step.tokens.length || done) return;
      done = true;
      const got = chosen.map((i) => step.tokens[i]);
      const ok = got.join('') === step.target.join('');
      pool.forEach((b) => (b.disabled = true));
      line.querySelectorAll('.placed').forEach((b) => (b.disabled = true));
      const info = ui.finish({ correct: ok, hintUsed, answer: got.join('') });
      const fb = $('#fb', ui.stage);
      fb.className = `feedback show ${ok ? 'ok' : 'no'}`;
      fb.innerHTML = ok ? `<b>✓ Đúng rồi.</b> ${esc(step.explain)}` : `<b>Chưa đúng.</b> Thứ tự đúng là <b lang="zh-Hans">${esc(step.target.join(' '))}</b>. ${esc(step.explain)}${info && info.willRetry ? ' <br>Câu này sẽ quay lại sau ít câu.' : ''}`;
      if (B.Coach) B.Coach.attachExplain(ui, step, { ok, correct: step.target.join(''), answer: got.join('') });
    };
    draw();
  }

  /* ---------- nói: ghi âm → nghe lại → tự đánh giá (chưa chấm tự động) ---------- */
  function speak(step, ui) {
    const item = C.items[step.itemId];
    ui.useFooter(false);
    ui.stage.innerHTML = `${coachLine(step, ui.retry)}<h2 id="stepTitle" tabindex="-1">${esc(step.title)}</h2><p class="lead">${esc(step.prompt)}</p>
      <div class="skill-card"><div class="skill-hanzi" lang="zh-Hans">${esc(step.hanzi)}</div><div class="pinyin">${esc(step.pinyin)}</div>
        <div class="audio-row"><button class="audio-btn" id="playAudio" aria-label="Nghe mẫu">🔊</button><button class="audio-btn slow" id="playSlow" aria-label="Nghe mẫu chậm">🐢</button></div>
        <ul class="tips">${step.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
      <div class="skill-card"><p class="hint" id="micNote">Bản ghi chỉ nằm trong bộ nhớ trình duyệt và mất khi bạn đóng bài${B.Coach && B.Coach.enabled() ? ', trừ khi bạn bấm gửi cho AI nghe' : ', không tải lên máy chủ'}. BuzzLingo <b>chưa chấm phát âm tự động</b>: đây là bước tự nghe và tự đánh giá.</p>
        <button class="record-btn" id="recBtn" aria-label="Bắt đầu ghi âm">🎙️</button>
        <div class="meter" aria-hidden="true"><i id="meter"></i></div>
        <p class="hint" id="recStatus" role="status">Chạm micro, nói “${esc(step.pinyin)}”, chạm lần nữa để dừng (tối đa 5 giây).</p>
        <div id="playback" hidden><audio id="player" controls aria-label="Nghe lại bản ghi của bạn"></audio>${B.Coach && B.Coach.enabled() ? `<div class="ai-wrap"><button class="linkbtn" id="aiHear" type="button">🐾 Gửi bản ghi cho ${step.coach === 'blu' ? 'Blu' : 'Bắp'} nghe và sửa (AI)</button><div class="ai-box" id="aiHearBox" role="status" aria-live="polite" hidden></div></div>` : ''}</div></div>
      ${B.Speech && B.Speech.canRecognize() ? `<div class="skill-card sr-card" id="srCard"><p class="lead sm"><b>🗣️ Nói để máy nghe và chỉ chỗ sai</b></p>
        <button class="secondary" id="srBtn" type="button">🎤 Nói câu này</button>
        <p class="hint" id="srStatus" role="status"></p><div id="srResult" hidden></div>
        ${B.Coach && B.Coach.enabled() ? `<div class="ai-wrap" id="srAi" hidden><button class="linkbtn" id="srAsk" type="button">🐾 Nhờ ${step.coach === 'blu' ? 'Blu' : 'Bắp'} nhận xét (AI)</button><div class="ai-box" id="srBox" role="status" aria-live="polite" hidden></div></div>` : ''}
        <small class="hint">Trình duyệt chuyển giọng thành chữ (Chrome dùng máy chủ Google, Safari dùng Apple). Kết quả chỉ để gợi ý, không tính điểm: máy có thể nghe nhầm chữ đồng âm.</small></div>` : ''}
      <div id="selfAssess" hidden><p class="lead"><b>So với mẫu, bạn thấy mình nói…</b></p><div class="assess" role="group" aria-label="Tự đánh giá"><button class="answer" data-v="same"><b>Giống mẫu</b><small>Thanh và âm khá khớp</small></button><button class="answer" data-v="near"><b>Gần giống</b><small>Còn lệch một chút</small></button><button class="answer" data-v="no"><b>Chưa giống</b><small>Mình sẽ luyện thêm</small></button></div></div>
      <button class="linkbtn" id="skipSpeak" type="button">Học không dùng micro → bỏ qua bước nói</button>
      <div class="feedback" id="fb" role="status"></div>`;
    const rate = (r) => () => A.play(step.audio, r).then((ok) => { if (!ok) $('#recStatus', ui.stage).textContent = 'Thiết bị chưa có giọng Mandarin để phát mẫu. Bạn vẫn có thể ghi âm theo Pinyin hiển thị.'; });
    $('#playAudio', ui.stage).onclick = rate(0.85); $('#playSlow', ui.stage).onclick = rate(0.55);
    $('#skipSpeak', ui.stage).onclick = () => ui.finish({ skipped: true });

    const recBtn = $('#recBtn', ui.stage), status = $('#recStatus', ui.stage), meter = $('#meter', ui.stage);
    let stream = null, rec = null, ac = null, raf = 0, timer = 0, chunks = [], voicedFrames = 0, url = null, recording = false, lastBlob = null;
    const cleanupAudio = () => {
      cancelAnimationFrame(raf); clearTimeout(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (ac && ac.state !== 'closed') ac.close().catch(() => {});
      stream = null; ac = null;
    };
    ui.onDispose(() => { recording = false; cleanupAudio(); if (url) URL.revokeObjectURL(url); });

    let starting = false;
    async function start() {
      if (starting) return; // chạm hai lần khi micro đang mở: bỏ qua
      starting = true;
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        const fb = $('#fb', ui.stage);
        fb.className = 'feedback show no';
        fb.innerHTML = '<b>Chưa dùng được micro.</b> Hãy cho phép micro trong trình duyệt, hoặc chọn “Học không dùng micro” bên dưới.';
        starting = false;
        return;
      }
      chunks = []; voicedFrames = 0;
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = onStop;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        ac = new Ctx();
        const an = ac.createAnalyser(); an.fftSize = 1024;
        ac.createMediaStreamSource(stream).connect(an);
        const buf = new Float32Array(an.fftSize);
        const tick = () => {
          an.getFloatTimeDomainData(buf);
          let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
          const rms = Math.sqrt(s / buf.length);
          if (rms > 0.015) voicedFrames++;
          meter.style.width = `${Math.min(100, Math.round(rms * 400))}%`;
          raf = requestAnimationFrame(tick);
        };
        tick();
      } else voicedFrames = 999; // không đo được mức âm → không thể khẳng định im lặng
      rec.start();
      recording = true; starting = false;
      recBtn.classList.add('recording'); recBtn.textContent = '■'; recBtn.setAttribute('aria-label', 'Dừng ghi âm');
      status.textContent = 'Đang ghi… hãy nói rồi chạm để dừng.';
      timer = setTimeout(stop, 5000);
    }
    function stop() { if (rec && rec.state === 'recording') rec.stop(); }
    function onStop() {
      recording = false;
      const voiced = voicedFrames >= 8;
      cleanupAudio();
      recBtn.classList.remove('recording'); recBtn.textContent = '🎙️'; recBtn.setAttribute('aria-label', 'Ghi âm lại'); meter.style.width = '0';
      if (!voiced) {
        status.textContent = 'Mình chưa nghe thấy giọng bạn. Hãy ghi âm lại, nói to hơn hoặc đưa micro gần hơn.';
        return;
      }
      const blob = new Blob(chunks, { type: (rec && rec.mimeType) || 'audio/webm' });
      lastBlob = blob;
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      $('#player', ui.stage).src = url;
      $('#playback', ui.stage).hidden = false;
      $('#selfAssess', ui.stage).hidden = false;
      status.textContent = 'Đã ghi được giọng bạn. Nghe lại, rồi so với mẫu.';
    }
    recBtn.onclick = () => (recording ? stop() : start());

    /* --- nhận xét của AI (tuỳ chọn): gửi văn bản nhận dạng hoặc bản ghi --- */
    const coachName = step.coach === 'blu' ? 'Blu' : 'Bắp';
    const aiStep = { title: step.title, prompt: step.pinyin, correct: step.hanzi };
    const renderAi = (box, res) => {
      box.hidden = false;
      box.innerHTML = res.ok
        ? `<div class="ai-tag">${coachName} (AI) · do AI viết, có thể sai · không ảnh hưởng điểm</div>${res.heard ? `<p class="hint">AI nghe được: <b lang="zh-Hans">${esc(res.heard)}</b></p>` : ''}<p>${esc(res.reply)}</p>${res.zh ? `<div class="ai-zh"><b lang="zh-Hans" class="zh-say" role="button" tabindex="0" data-zh="${esc(res.zh.hanzi)}">${esc(res.zh.hanzi)} 🔊</b> <span>${esc(res.zh.pinyin || '')}</span></div>` : ''}<small class="hint">Còn ${B.Coach.remaining()} lượt AI hôm nay</small>`
        : `<p class="ai-err">${esc(res.error)}</p>`;
    };
    const hearBtn = $('#aiHear', ui.stage);
    if (hearBtn) hearBtn.onclick = async () => {
      if (!lastBlob) return;
      const box = $('#aiHearBox', ui.stage);
      hearBtn.disabled = true; box.hidden = false; box.innerHTML = `<p class="hint">${coachName} đang nghe…</p>`;
      let data = '';
      try { data = await B.Speech.blobToBase64(lastBlob); } catch (e) { /* bỏ qua */ }
      const res = data ? await B.Coach.request({ mode: 'speak', persona: step.coach, step: aiStep, audio: { mime: lastBlob.type || 'audio/webm', data } }) : { ok: false, error: 'Không đọc được bản ghi.' };
      renderAi(box, res); hearBtn.disabled = false; hearBtn.textContent = `🐾 Gửi lại bản ghi mới cho ${coachName}`;
    };

    /* --- nhận dạng giọng nói trên trình duyệt + so với câu mẫu --- */
    const srBtn = $('#srBtn', ui.stage);
    if (srBtn) {
      let heard = '';
      srBtn.onclick = async () => {
        const st = $('#srStatus', ui.stage), out = $('#srResult', ui.stage);
        srBtn.disabled = true; srBtn.classList.add('recording'); st.textContent = 'Đang nghe… hãy nói câu mẫu.';
        A.stop();
        const r = await B.Speech.recognize({ onStart: () => { st.textContent = 'Đang nghe… hãy nói câu mẫu.'; } }).promise;
        srBtn.disabled = false; srBtn.classList.remove('recording');
        if (!r.ok) { st.textContent = r.error; if (!B.Speech.canRecognize()) srBtn.hidden = true; return; }
        heard = r.text;
        const cmp = B.Speech.compare(step.hanzi, heard);
        const pct = Math.round(cmp.ratio * 100);
        st.textContent = '';
        out.hidden = false;
        out.innerHTML = `<p class="sr-target" lang="zh-Hans">${cmp.tokens.map((t) => `<span class="${t.ok ? 'ok' : 'miss'}">${esc(t.ch)}</span>`).join('')}</p>
          <p class="hint">Máy nghe được: <b lang="zh-Hans">${esc(heard)}</b></p>
          <p class="sr-verdict ${pct >= 90 ? 'ok' : pct >= 60 ? 'mid' : 'no'}">${pct >= 90 ? `Máy nghe ra gần đủ câu mẫu (${pct}%). Rất tốt!` : pct >= 60 ? `Máy nghe ra ${pct}% câu mẫu. Chữ tô đỏ là chỗ máy chưa nghe ra: luyện lại phần đó, chú ý thanh điệu.` : `Máy mới nghe ra ${pct}% câu mẫu. Nghe lại mẫu chậm 🐢 rồi nói từng cụm ngắn.`}${cmp.extra.length ? ` Thừa/nhầm: ${esc(cmp.extra.join(''))}.` : ''}</p>`;
        srBtn.textContent = '🎤 Nói lại';
        const ai = $('#srAi', ui.stage);
        if (ai) { ai.hidden = false; const ask = $('#srAsk', ui.stage); ask.disabled = false; $('#srBox', ui.stage).hidden = true; }
        $('#selfAssess', ui.stage).hidden = false;
      };
      const ask = $('#srAsk', ui.stage);
      if (ask) ask.onclick = async () => {
        const box = $('#srBox', ui.stage);
        ask.disabled = true; box.hidden = false; box.innerHTML = `<p class="hint">${coachName} đang đọc câu bạn nói…</p>`;
        renderAi(box, await B.Coach.request({ mode: 'speak', persona: step.coach, step: aiStep, message: heard }));
      };
    }

    const map = { same: { correct: true, grade: 3, xp: 8 }, near: { correct: true, grade: 2, xp: 5 }, no: { correct: false, grade: 1, xp: 2 } };
    ui.stage.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => {
      ui.stage.querySelectorAll('[data-v]').forEach((x) => (x.disabled = true));
      b.classList.add('selected');
      const m = map[b.dataset.v];
      const fb = $('#fb', ui.stage);
      fb.className = `feedback show ${m.correct ? 'ok' : 'no'}`;
      fb.innerHTML = m.correct ? '<b>Đã ghi nhận.</b> Đây là điểm tự đánh giá, chưa phải kết quả chấm tự động.' : '<b>Đã ghi nhận.</b> Chỗ này sẽ quay lại trong bộ ôn để bạn luyện thêm.';
      ui.finish({ ...m, answer: b.dataset.v, verified: false });
    }));
  }

  /* ---------- viết: tô → chép → viết từ nhớ (Hanzi Writer kiểm tra thứ tự, hướng nét) ---------- */
  /** Nạp dữ liệu nét của một chữ (vendor/hanzi/<mã>.js); chạy được cả khi mở bằng file://. */
  function loadStrokes(ch) {
    window.BuzzHanziData = window.BuzzHanziData || {};
    if (window.BuzzHanziData[ch]) return Promise.resolve(true);
    return new Promise((resolve) => {
      const sc = document.createElement('script');
      sc.src = `vendor/hanzi/${ch.codePointAt(0).toString(16)}.js`;
      sc.onload = () => resolve(!!window.BuzzHanziData[ch]);
      sc.onerror = () => resolve(false);
      document.head.appendChild(sc);
    });
  }
  B.loadStrokes = loadStrokes;

  function write(step, ui) {
    const ch0 = step.char || C.writeChars[step.itemId];
    if (!(window.BuzzHanziData && window.BuzzHanziData[ch0])) {
      ui.useFooter(false);
      ui.stage.innerHTML = `${coachLine(step, ui.retry)}<h2 id="stepTitle" tabindex="-1">${esc(step.title)}</h2><p class="hint">Đang tải nét chữ…</p>`;
      let alive = true; ui.onDispose(() => (alive = false));
      loadStrokes(ch0).then(() => { if (alive) writeReady(step, ui); });
      return;
    }
    writeReady(step, ui);
  }

  function writeReady(step, ui) {
    const ch = step.char || C.writeChars[step.itemId];
    const item = Object.assign({}, C.items[step.itemId] || { hanzi: ch });
    const HW = window.HanziWriter, data = window.BuzzHanziData && window.BuzzHanziData[ch];
    if (data) item.strokes = data.strokes.length;
    item.hanzi = ch;
    ui.useFooter(false);
    if (!HW || !data) return writeFallback(step, ui, item, ch);
    const stages = [
      { id: 'trace', name: 'Tô theo nét', desc: 'Chữ mờ hiện sẵn. Vẽ từng nét đúng thứ tự và đúng hướng.', hintLevel: 2 },
      { id: 'copy', name: 'Chép theo mẫu', desc: 'Xem mẫu viết, rồi viết lại trên ô trống. Sai nhiều lần mình sẽ gợi ý nét tiếp theo.', hintLevel: 1 },
      { id: 'memory', name: 'Viết từ trí nhớ', desc: `Ô trống hoàn toàn. Viết đủ ${item.strokes} nét theo đúng thứ tự.`, hintLevel: 0 },
    ];
    ui.stage.innerHTML = `${coachLine(step, ui.retry)}<h2 id="stepTitle" tabindex="-1">${esc(step.title)}</h2>
      <ol class="stagebar" aria-label="Các nấc luyện viết">${stages.map((s, i) => `<li data-s="${i}"><span>${i + 1}</span>${esc(s.name)}</li>`).join('')}</ol>
      <p class="lead" id="wdesc"></p>
      <div class="write-grid"><div class="ref-wrap" id="refWrap" hidden><div id="ref" aria-hidden="true"></div><small>Mẫu</small></div>
      <div class="write-wrap" id="pad" role="img" aria-label="Ô tập viết chữ ${esc(item.hanzi)}"></div></div>
      <p class="hint" id="wstat" role="status"></p>
      <div class="skill-actions"><button class="secondary" id="wAnim" type="button">▶ Xem thứ tự nét</button><button class="secondary" id="wHint" type="button" hidden>💡 Gợi ý</button><button class="secondary" id="wGive" type="button" hidden>Xem đáp án</button><button class="primary" id="wNext" type="button" hidden>Tiếp tục →</button></div>
      <p class="hint">Không kéo được trên màn hình? Bạn có thể <button class="linkbtn" id="wSkip" type="button">bỏ qua bước viết</button> (không tính vào kỹ năng Viết).</p>
      <div class="feedback" id="fb" role="status"></div>`;
    const pad = $('#pad', ui.stage), wstat = $('#wstat', ui.stage), nextBtn = $('#wNext', ui.stage), hintBtn = $('#wHint', ui.stage), giveBtn = $('#wGive', ui.stage), animBtn = $('#wAnim', ui.stage), refWrap = $('#refWrap', ui.stage);
    let idx = 0, writer = null, ref = null, mistakes = 0, hintUsed = false, strokesDone = 0, finished = false, stageStart = Date.now(), stageDone = false, demoing = false;
    ui.onDispose(() => { finished = true; try { writer && writer.cancelQuiz(); ref && ref.pauseAnimation(); } catch (e) { /* bỏ qua */ } });
    $('#wSkip', ui.stage).onclick = () => ui.finish({ skipped: true });

    const loader = (c, ok, err) => { const d = window.BuzzHanziData[c]; d ? ok(d) : err(new Error('missing')); };
    const size = () => Math.max(200, Math.min(300, pad.clientWidth || 280));
    const baseOpts = (w) => ({ width: w, height: w, padding: Math.round(w * 0.07), strokeColor: '#18333c', outlineColor: '#ddd8cb', highlightColor: '#159a91', drawingColor: '#18333c', drawingWidth: Math.round(w / 18), strokeAnimationSpeed: 1.3, delayBetweenStrokes: 220, charDataLoader: loader });

    function begin() {
      const st = stages[idx];
      ui.stage.querySelectorAll('.stagebar li').forEach((li, i) => { li.classList.toggle('on', i === idx); li.classList.toggle('done', i < idx); li.setAttribute('aria-current', i === idx ? 'step' : 'false'); });
      $('#wdesc', ui.stage).textContent = `${idx + 1}/3 · ${st.name}. ${st.desc}`;
      pad.innerHTML = ''; mistakes = 0; hintUsed = false; strokesDone = 0; stageStart = Date.now(); stageDone = false; demoing = false; animBtn.disabled = false;
      nextBtn.hidden = true; hintBtn.hidden = st.id !== 'memory'; giveBtn.hidden = st.id !== 'memory'; animBtn.hidden = false;
      $('#fb', ui.stage).className = 'feedback';
      refWrap.hidden = st.id !== 'copy';
      const w = size();
      writer = HW.create(pad, ch, { ...baseOpts(w), showOutline: st.id === 'trace', showCharacter: false });
      if (st.id === 'copy') { $('#ref', ui.stage).innerHTML = ''; ref = HW.create($('#ref', ui.stage), ch, { ...baseOpts(120), padding: 8, drawingWidth: 6, showOutline: true }); ref.loopCharacterAnimation(); }
      wstat.textContent = `Nét 1/${item.strokes}`;
      startQuiz(st, 0);
    }

    // chạy (hoặc chạy tiếp) phần viết; số lỗi đếm bằng biến riêng để không mất khi xem thứ tự nét giữa chừng
    function startQuiz(st, from) {
      writer.quiz({
        quizStartStrokeNum: from,
        showHintAfterMisses: st.id === 'trace' ? 2 : st.id === 'copy' ? 3 : false,
        highlightOnComplete: true,
        leniency: 1,
        onCorrectStroke: () => { strokesDone++; wstat.textContent = strokesDone >= item.strokes ? `Đủ ${item.strokes} nét` : `Nét ${strokesDone + 1}/${item.strokes} · ${mistakes} lần sai`; },
        onMistake: () => { mistakes++; wstat.textContent = `Nét ${strokesDone + 1}/${item.strokes} · ${mistakes} lần sai — hãy thử lại đúng hướng và vị trí`; },
        onComplete: () => complete(st, mistakes),
      });
    }

    function complete(st, total) {
      if (finished) return;
      stageDone = true;
      hintBtn.hidden = true; giveBtn.hidden = true;
      const fb = $('#fb', ui.stage);
      if (st.id !== 'memory') {
        ui.record({ correct: true, stage: st.id, hintLevel: st.hintLevel, xp: 0, answer: `${total} lỗi nét`, responseMs: Date.now() - stageStart });
        fb.className = 'feedback show ok'; fb.innerHTML = `<b>✓ Xong nấc ${idx + 1}.</b> ${total ? `Có ${total} lần sai nét — nấc sau mình sẽ bớt gợi ý dần.` : 'Không sai nét nào.'}`;
        nextBtn.hidden = false; nextBtn.focus();
        nextBtn.onclick = () => { idx++; begin(); };
        return;
      }
      finished = true;
      let m;
      if (total === 0 && !hintUsed) m = { correct: true, grade: 3, xp: 12 };
      else if (total <= 2) m = { correct: true, grade: 2, xp: 8 };
      else m = { correct: false, grade: 1, xp: 2 };
      fb.className = `feedback show ${m.correct ? 'ok' : 'no'}`;
      fb.innerHTML = m.correct ? `<b>✓ Bạn viết được ${esc(item.hanzi)} từ trí nhớ.</b> ${total} lần sai nét${hintUsed ? ', có dùng gợi ý' : ''}.` : `<b>Chưa vững.</b> Có ${total} lần sai nét. Chữ này sẽ quay lại bộ ôn ngày mai.`;
      ui.finish({ ...m, hintUsed, answer: `${total} lỗi nét`, hintLevel: hintUsed ? 2 : 0 });
    }

    // xem thứ tự nét: tạm dừng phần viết, chạy mẫu, rồi ẩn chữ và cho viết tiếp từ nét đang dở
    animBtn.onclick = () => {
      if (!writer || demoing || finished) return;
      const st = stages[idx], resume = strokesDone, w0 = writer;
      demoing = true; animBtn.disabled = true;
      if (st.id === 'memory' && !stageDone) hintUsed = true; // ở nấc viết từ trí nhớ, xem mẫu = dùng gợi ý
      try { w0.cancelQuiz(); } catch (e) { /* chưa có phần viết */ }
      wstat.textContent = 'Đang chạy thứ tự nét…';
      w0.animateCharacter({ onComplete: () => setTimeout(() => {
        if (w0 !== writer) return; // đã sang nấc khác
        demoing = false; animBtn.disabled = false;
        if (stageDone) { wstat.textContent = `Đủ ${item.strokes} nét`; return; }
        w0.hideCharacter();
        if (st.id === 'trace' || hintUsed) w0.showOutline(); else w0.hideOutline();
        startQuiz(st, resume);
        wstat.textContent = `Giờ đến lượt bạn: viết tiếp từ nét ${resume + 1}/${item.strokes}${st.id === 'memory' ? ' (đã tính là dùng gợi ý)' : ''}`;
      }, 700) });
    };
    hintBtn.onclick = () => { if (!hintUsed) { hintUsed = true; writer.showOutline(); wstat.textContent = 'Đã hiện nét mờ làm gợi ý (điểm sẽ thấp hơn).'; } hintBtn.hidden = true; };
    giveBtn.onclick = () => {
      if (finished) return; finished = true; hintBtn.hidden = true; giveBtn.hidden = true;
      try { writer.cancelQuiz(); writer.animateCharacter(); } catch (e) { /* bỏ qua */ }
      const fb = $('#fb', ui.stage);
      fb.className = 'feedback show no'; fb.innerHTML = `<b>Đây là thứ tự đúng của ${esc(item.hanzi)}.</b> Chữ này sẽ quay lại bộ ôn ngày mai.`;
      ui.finish({ correct: false, grade: 1, xp: 0, hintUsed: true, answer: 'xem đáp án' });
    };
    begin();
  }

  // Dự phòng khi thiếu dữ liệu nét: canvas + tự đánh giá, ghi rõ không được kiểm tra.
  function writeFallback(step, ui, item, ch) {
    ui.stage.innerHTML = `${coachLine(step, ui.retry)}<h2 id="stepTitle" tabindex="-1">${esc(step.title)}</h2><p class="lead">Chưa kiểm tra tự động được nét chữ này. Hãy tô theo chữ mờ rồi tự đánh giá.</p>
      <div class="write-wrap"><div class="write-guide" lang="zh-Hans" aria-hidden="true">${esc(item.hanzi)}</div><canvas id="cv" width="560" height="560" aria-label="Ô tập viết chữ ${esc(item.hanzi)}"></canvas></div>
      <div class="skill-actions"><button class="secondary" id="cvClear" type="button">Xoá nét</button></div>
      <p class="lead"><b>Bạn thấy mình viết…</b></p><div class="assess"><button class="answer" data-v="same"><b>Đúng thứ tự</b></button><button class="answer" data-v="near"><b>Còn chưa chắc</b></button><button class="answer" data-v="no"><b>Cần luyện thêm</b></button></div><div class="feedback" id="fb" role="status"></div>`;
    const cv = $('#cv', ui.stage), ctx = cv.getContext('2d'); let drawing = false;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#18333c'; ctx.lineWidth = 24;
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
    cv.onpointerdown = (e) => { drawing = true; cv.setPointerCapture(e.pointerId); const [x, y] = pt(e); ctx.beginPath(); ctx.moveTo(x, y); };
    cv.onpointermove = (e) => { if (!drawing) return; const [x, y] = pt(e); ctx.lineTo(x, y); ctx.stroke(); };
    cv.onpointerup = cv.onpointercancel = () => (drawing = false);
    $('#cvClear', ui.stage).onclick = () => ctx.clearRect(0, 0, cv.width, cv.height);
    const map = { same: { correct: true, grade: 3, xp: 4 }, near: { correct: true, grade: 2, xp: 3 }, no: { correct: false, grade: 1, xp: 1 } };
    ui.stage.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => {
      ui.stage.querySelectorAll('[data-v]').forEach((x) => (x.disabled = true));
      const fb = $('#fb', ui.stage); fb.className = 'feedback show ok'; fb.innerHTML = '<b>Đã ghi nhận.</b> Đây là tự đánh giá, chưa phải kiểm tra thứ tự nét.';
      ui.finish({ ...map[b.dataset.v], answer: b.dataset.v, verified: false });
    }));
  }

  /* ---------- thẻ ôn lật (tự chấm bằng 4 mức, hiện khoảng ôn dự đoán) ---------- */
  function flip(step, ui) {
    const item = C.items[step.itemId], card = step.card;
    ui.useFooter(false);
    const hasAudio = ['audio', 'tone', 'read'].includes(step.skill);
    const prompts = {
      meaning: ['Nghĩa của chữ này là gì?', `<div class="skill-hanzi" lang="zh-Hans">${esc(item.hanzi)}</div>`],
      read: ['Chữ này đọc thế nào?', `<div class="skill-hanzi" lang="zh-Hans">${esc(item.hanzi)}</div>`],
      audio: ['Bạn nghe thấy gì, nghĩa là gì?', '<div class="big-ico" aria-hidden="true">🔊</div>'],
      tone: ['Âm này thanh mấy?', '<div class="big-ico" aria-hidden="true">🔊</div>'],
    }[step.skill];
    const back = `<div class="skill-hanzi sm" lang="zh-Hans">${esc(item.hanzi)}</div><div class="pinyin">${esc(item.pinyin)}</div><div class="meaning">${esc(item.vi)}</div>${item.tone ? `<div class="hint">Thanh ${item.tone}</div>` : ''}`;
    const labels = SRS.previewLabels(card, Date.now());
    ui.stage.innerHTML = `<div class="coach"><span class="coach-face">${'<img src="assets/bap-avatar-128.webp" width="42" height="42" alt="">'}</span><span><b>Ôn tập</b> · ${esc(C.skillLabels[step.skill])}</span></div>
      <h2 id="stepTitle" tabindex="-1">${esc(prompts[0])}</h2>
      <button class="flashcard" id="flashcard" type="button" aria-expanded="false"><div id="face">${prompts[1]}<div class="hint">Chạm để lật thẻ</div></div></button>
      ${hasAudio ? '<div class="audio-row"><button class="audio-btn sm" id="playAudio" aria-label="Phát âm thanh">🔊</button><button class="audio-btn sm slow" id="playSlow" aria-label="Phát chậm">🐢</button></div>' : ''}
      <div class="rating" id="rating" hidden role="group" aria-label="Bạn nhớ tới đâu?">
        <button class="r1" data-g="1"><b>Quên</b><small>${labels[1]}</small></button><button class="r2" data-g="2"><b>Khó</b><small>${labels[2]}</small></button><button class="r3" data-g="3"><b>Ổn</b><small>${labels[3]}</small></button><button class="r4" data-g="4"><b>Dễ</b><small>${labels[4]}</small></button></div>
      <div class="feedback" id="fb" role="status"></div>`;
    const audioSpec = { text: item.hanzi };
    if (hasAudio) {
      const note = (ok) => { if (!ok) { const fb = $('#fb', ui.stage); fb.className = 'feedback show no'; fb.textContent = 'Thiết bị chưa có giọng Mandarin nên không phát được âm. Bạn vẫn có thể lật thẻ để xem đáp án.'; } };
      $('#playAudio', ui.stage).onclick = () => A.play(audioSpec, 0.85).then(note);
      $('#playSlow', ui.stage).onclick = () => A.play(audioSpec, 0.55).then(note);
    }
    const fc = $('#flashcard', ui.stage); let flipped = false;
    fc.onclick = () => {
      flipped = !flipped; fc.setAttribute('aria-expanded', flipped);
      $('#face', ui.stage).innerHTML = flipped ? back : `${prompts[1]}<div class="hint">Chạm để lật thẻ</div>`;
      $('#rating', ui.stage).hidden = !flipped;
      if (flipped) ui.announce(`Đáp án: ${item.pinyin}, ${item.vi}`);
    };
    ui.stage.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => {
      const g = +b.dataset.g;
      ui.stage.querySelectorAll('[data-g]').forEach((x) => (x.disabled = true));
      ui.finish({ correct: g >= 2, grade: g, xp: g === 1 ? 0 : g === 2 ? 3 : 5, verified: false, answer: `tự chấm ${g}` });
    }));
  }

  /* ---------- tự viết câu + phản biện: hỏi ngược trước, gợi ý cụ thể khi cần (kiểm tra theo luật, không cần AI) ---------- */
  function compose(step, ui) {
    if (!B.critique || B.critique.size !== Object.keys(C.items).length) B.critique = B.Critique.create(C); // từ điển lớn lên khi nạp thêm gói HSK
    const K = B.critique;
    ui.stage.innerHTML = `${coachLine(step, ui.retry)}<h2 id="stepTitle" tabindex="-1">${esc(step.title)}</h2>
      <div class="bubble task">${esc(step.task)}</div>
      <form class="compose-form" id="cForm" autocomplete="off"><label for="cIn"><b>Câu của bạn</b></label>
        <input id="cIn" type="text" maxlength="120" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Gõ chữ Hán hoặc Pinyin…">
        <small class="hint">${esc(step.accept || '')}</small></form>
      <div class="critique" id="crit" role="status" aria-live="polite"></div>
      <p class="hint">Bộ phản biện kiểm tra theo luật và chỉ hiểu các từ đã học, nên có thể bỏ sót. Phần này là tự luyện, không tính vào tỉ lệ đúng.</p>
      <button class="linkbtn" id="cModel" type="button">Xem câu mẫu (không được điểm)</button>
      <div class="feedback" id="fb" role="status"></div>`;
    const input = $('#cIn', ui.stage), crit = $('#crit', ui.stage);
    let tries = 0, hintUsed = false, done = false;
    input.oninput = () => ui.setReady(!done && input.value.trim().length > 0);
    $('#cForm', ui.stage).onsubmit = (e) => { e.preventDefault(); if (input.value.trim()) ui.onCheck(); };

    const known = () => (B.knownItems ? B.knownItems() : null);
    const listFindings = (fs, showFix) => fs.map((f) => `<li class="${f.level}"><span class="q">${f.level === 'error' ? '❓' : '💭'} ${esc(f.ask)}</span>${f.fix ? `<span class="fix"${showFix ? '' : ' hidden'}>→ ${esc(f.fix)}</span>` : ''}</li>`).join('');

    ui.onCheck = () => {
      if (done) return;
      const text = input.value.trim();
      if (!text) return;
      tries++;
      const r = K.check(text, step, { known: known() });
      const metHtml = r.met.length ? `<ul class="met">${r.met.map((n) => `<li>✓ Có <b lang="zh-Hans">${esc(n.any[0])}</b></li>`).join('')}</ul>` : '';
      const heard = r.hanzi ? `<p class="heard">Mình hiểu câu của bạn là: <b lang="zh-Hans">${esc(r.hanzi)}</b></p>` : '';
      if (r.pass) {
        done = true; input.disabled = true;
        const m = tries === 1 && !hintUsed ? { grade: 3, xp: 10 } : { grade: 2, xp: 6 };
        const tips = r.findings.filter((f) => f.level !== 'error');
        crit.innerHTML = `${heard}${metHtml}${tips.length ? `<p class="lead"><b>Gợi ý thêm (không bắt buộc)</b></p><ul class="finds">${listFindings(tips, true)}</ul>` : ''}`;
        const fb = $('#fb', ui.stage);
        fb.className = 'feedback show ok';
        fb.innerHTML = `<b>✓ Câu của bạn đạt yêu cầu${tries > 1 ? ` sau ${tries} lần sửa` : ''}.</b> Câu mẫu để đối chiếu: <b lang="zh-Hans">${esc(step.model.hanzi)}</b> (${esc(step.model.pinyin)}).`;
        $('#cModel', ui.stage).hidden = true;
        ui.finish({ correct: true, ...m, hintUsed, verified: false, answer: text });
        if (B.Coach) B.Coach.attachCritique(ui, step, text, r);
        return;
      }
      const errs = r.findings.filter((f) => f.level === 'error'), tips = r.findings.filter((f) => f.level !== 'error');
      crit.innerHTML = `${heard}${metHtml}<p class="lead"><b>${tries === 1 ? 'Mình hỏi lại bạn một chút nhé:' : 'Vẫn còn chỗ cần xem lại:'}</b></p>
        <ul class="finds">${listFindings(errs, hintUsed)}${listFindings(tips, hintUsed)}</ul>
        ${r.findings.some((f) => f.fix) && !hintUsed ? '<button class="linkbtn" id="cHint" type="button">💡 Xem gợi ý cụ thể (được ít XP hơn)</button>' : ''}
        <p class="hint">Sửa câu ở ô trên rồi bấm Kiểm tra lại.${tries >= 3 ? ' Nếu bí, bạn có thể xem câu mẫu.' : ''}</p>`;
      const hb = $('#cHint', crit);
      if (hb) hb.onclick = () => { hintUsed = true; crit.querySelectorAll('.fix').forEach((n) => (n.hidden = false)); hb.hidden = true; };
      ui.setReady(true);
      ui.announce(errs.length ? errs[0].ask : 'Câu chưa đạt yêu cầu');
      if (B.Coach) B.Coach.attachCritique(ui, step, text, r);
      input.focus();
    };

    $('#cModel', ui.stage).onclick = () => {
      if (done) return;
      done = true; input.disabled = true;
      const fb = $('#fb', ui.stage);
      fb.className = 'feedback show no';
      fb.innerHTML = `<b>Câu mẫu:</b> <b lang="zh-Hans">${esc(step.model.hanzi)}</b> (${esc(step.model.pinyin)}). Phần này sẽ quay lại trong bộ ôn để bạn tự viết lại.`;
      $('#cModel', ui.stage).hidden = true;
      ui.finish({ correct: false, grade: 1, xp: 0, hintUsed: true, verified: false, answer: input.value.trim() || 'xem câu mẫu' });
    };
  }

  /* ---------- thẻ học từ mới (không chấm điểm) ---------- */
  const playBtn = (text, label) => `<button class="mini-play" type="button" data-say="${esc(text)}" aria-label="${esc(label || 'Nghe')}">🔊</button>`;
  function bindSay(root) {
    root.querySelectorAll('[data-say]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); A.play({ text: b.dataset.say }, 0.8); }));
  }
  function learn(step, ui) {
    const list = step.itemIds.map((id) => C.items[id]).filter(Boolean);
    ui.stage.innerHTML = `${coachLine(step, ui.retry)}<h2 id="stepTitle" tabindex="-1">${esc(step.title)}</h2>
      <p class="lead">Chạm loa để nghe từng từ. Đọc to theo, rồi bấm Tiếp tục để luyện.</p>
      <ul class="learn-list">${list.map((it) => `<li><span class="lz" lang="zh-Hans">${esc(it.hanzi)}</span><span class="lp">${esc(it.pinyin)}</span><span class="lv">${esc(it.vi)}${it.kind === 'name' || it.extra ? ' <small class="tag-extra">ngoài HSK</small>' : ''}</span>${playBtn(it.hanzi.replace(/[？?！!。，,]/g, ''), `Nghe ${it.pinyin}`)}</li>`).join('')}</ul>`;
    bindSay(ui.stage);
    ui.setReady(true);
    ui.onCheck = () => ui.finish({ unscored: true });
  }

  /* ---------- ghi chú ngữ pháp ---------- */
  function note(step, ui) {
    const g = step.grammar;
    ui.stage.innerHTML = `${coachLine(step, ui.retry)}<span class="eyebrow note-eye">Ngữ pháp</span><h2 id="stepTitle" tabindex="-1">${esc(g.title)}</h2>
      <div class="note-card"><p>${esc(g.note)}</p>
      ${g.ex && g.ex.length ? `<ul class="ex-list">${g.ex.map((e) => `<li><div><b lang="zh-Hans">${esc(e.zh)}</b>${playBtn(e.zh)}</div><div class="pinyin">${esc(e.py)}</div><div class="hint">${esc(e.vi)}</div></li>`).join('')}</ul>` : ''}</div>`;
    bindSay(ui.stage);
    ui.setReady(true);
    ui.onCheck = () => ui.finish({ unscored: true });
  }

  /* ---------- hội thoại: nghe từng câu, bật/tắt Pinyin và nghĩa ---------- */
  const SPEAKER_WHO_D = { 'Bắp': 'bap', 'Blu': 'blu' };
  const storyFaceD = (who, expr) => { const art = B.storyAssets && B.storyAssets.has(`${who}-${expr}`); return `<span class="sface mini ${who}${art ? '' : ' fallback'}" data-who="${who}"><img src="${art ? `assets/story/${who}-${expr}.webp` : `assets/${who}-avatar-128.webp`}" alt="" decoding="async"></span>`; };
  function dialogue(step, ui) {
    const speakers = [...new Set(step.lines.map((l) => l.sp))];
    ui.stage.innerHTML = `${coachLine(step, ui.retry)}<h2 id="stepTitle" tabindex="-1">${esc(step.title)}</h2>
      <p class="lead">Nghe cả đoạn, rồi chạm từng câu để nghe lại. Thử che nghĩa và tự hiểu trước.</p>
      <div class="dlg-tools"><button class="secondary" id="dPlayAll" type="button">▶ Nghe cả đoạn</button>
        <label class="check sm"><input type="checkbox" id="dPy" checked><span>Pinyin</span></label>
        <label class="check sm"><input type="checkbox" id="dVi" checked><span>Nghĩa</span></label></div>
      <ol class="dlg" id="dlg">${step.lines.map((l, i) => `<li class="${speakers.indexOf(l.sp) % 2 ? 'r' : 'l'}${SPEAKER_WHO_D[l.sp] ? ' has-face' : ''}"><span class="sp">${SPEAKER_WHO_D[l.sp] ? storyFaceD(SPEAKER_WHO_D[l.sp], 'vui') : ''}${esc(l.sp)}</span><button class="dline" type="button" data-i="${i}"><b lang="zh-Hans">${esc(l.zh)}</b><span class="pinyin">${esc(l.py)}</span><span class="dvi">${esc(l.vi)}</span></button></li>`).join('')}</ol>`;
    const dlg = $('#dlg', ui.stage);
    let playing = 0;
    const playLine = (i) => A.play({ text: step.lines[i].zh }, 0.8);
    dlg.querySelectorAll('.dline').forEach((b) => (b.onclick = () => { dlg.querySelectorAll('.dline').forEach((x) => x.classList.remove('on')); b.classList.add('on'); playLine(+b.dataset.i); }));
    $('#dPlayAll', ui.stage).onclick = async () => {
      const token = ++playing;
      for (let i = 0; i < step.lines.length && token === playing; i++) {
        dlg.querySelectorAll('.dline').forEach((x, j) => x.classList.toggle('on', j === i));
        const ok = await A.play({ text: step.lines[i].zh }, 0.8, { wait: true });
        if (!ok) { ui.announce('Thiết bị chưa có giọng Mandarin.'); break; }
        await new Promise((r) => setTimeout(r, 450));
      }
    };
    ui.onDispose(() => { playing++; });
    $('#dPy', ui.stage).onchange = (e) => dlg.classList.toggle('no-py', !e.target.checked);
    $('#dVi', ui.stage).onchange = (e) => dlg.classList.toggle('no-vi', !e.target.checked);
    ui.setReady(true);
    ui.onCheck = () => ui.finish({ unscored: true });
  }

  /* ---------- truyện Bắp & Blu ---------- */
  // ảnh biểu cảm: assets/story/{bap|blu}-{bieu-cam}.webp; nền: assets/story/bg-{khoa}.webp.
  // Chưa có ảnh thì dùng avatar hiện tại + biểu tượng cảm xúc, nền là dải màu theo chương.
  const EXPR_EMOJI = { vui: '😊', cuoi: '😄', 'ngac-nhien': '😮', 'boi-roi': '😵‍💫', lo: '😟', buon: '🥺', 'tu-hao': '😎', 'suy-nghi': '🤔' };
  const WHO_NAME = { bap: 'Chị Bắp', blu: 'Blu' };
  const SPEAKER_WHO = { 'Bắp': 'bap', 'Blu': 'blu' };
  // chữ Hán trong truyện: chạm để nghe (nghe qua bộ lắng nghe chung bên dưới)
  const storyText = (t) => esc(t).replace(/(\p{Script=Han}[\p{Script=Han}，。？！、…]*)/gu, (m) => `<b lang="zh-Hans" class="zh-say" role="button" tabindex="0" data-zh="${m.replace(/[，。？！、…]/g, '')}">${m}</b>`);
  if (typeof document !== 'undefined' && !window.__zhSayBound) {
    window.__zhSayBound = true;
    const sayFrom = (e) => { const el = e.target.closest && e.target.closest('.zh-say'); if (!el) return false; e.stopPropagation(); A.play({ text: el.dataset.zh }, 0.8); return true; };
    document.addEventListener('click', (e) => { sayFrom(e); }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { if (sayFrom(e)) e.preventDefault(); } });
  }
  const hasArt = (name) => !!(B.storyAssets && B.storyAssets.has(name));
  function storyFace(who, expr) {
    const e = EXPR_EMOJI[expr] ? expr : 'vui', art = hasArt(`${who}-${e}`);
    return `<span class="sface ${who} ex-${e}${art ? '' : ' fallback'}" data-who="${who}"><img src="${art ? `assets/story/${who}-${e}.webp` : `assets/${who}-avatar-256.webp`}" alt="" decoding="async"><i class="ex-badge" aria-hidden="true">${EXPR_EMOJI[e]}</i></span>`;
  }
  // ảnh lỗi (chưa có file) → về avatar gốc / bỏ ảnh nền; bắt ở pha capture vì sự kiện error không nổi bọt
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    if (img.closest('.sface') && !img.dataset.fb) { const f = img.closest('.sface'); img.dataset.fb = '1'; f.classList.add('fallback'); img.src = `assets/${f.dataset.who}-avatar-256.webp`; }
    else if (img.classList.contains('scene-bg')) img.remove();
  }, true);
  const panelHtml = ([who, expr, text], i, shown) => who === 'narr'
    ? `<li class="panel narr${shown ? ' show' : ''}" data-i="${i}"><p>${storyText(text)}</p></li>`
    : `<li class="panel ${who}${shown ? ' show' : ''}" data-i="${i}">${storyFace(who, expr)}<div class="sbubble"><span class="sname">${WHO_NAME[who]}</span><p>${storyText(text)}</p></div></li>`;
  const sceneHtml = (story, lines, shownAll, extra = '') => `<div class="story-scene bg-${esc(story.bg || 'plain')}${extra}">${hasArt(`bg-${story.bg}`) ? `<img class="scene-bg" src="assets/story/bg-${esc(story.bg)}.webp" alt="" decoding="async">` : ''}<ol class="panels">${lines.map((l, i) => panelHtml(l, i, shownAll)).join('')}</ol></div>`;

  function story(step, ui) {
    const st = step.story, lines = st.open || [];
    ui.stage.innerHTML = `<span class="eyebrow ep-eye">🎬 Mùa 1${st.ep ? ` · Tập ${st.ep}` : ''}</span><h2 id="stepTitle" tabindex="-1">${esc(st.epTitle || step.lessonTitle || 'Câu chuyện')}</h2>
      <p class="hint story-sub">Bài: ${esc(step.lessonTitle || '')} · chạm để xem tiếp</p>
      ${sceneHtml(st, lines, false)}
      <div class="mission" id="mission" hidden><span aria-hidden="true">🎯</span><div><b>Nhiệm vụ</b><p>${storyText(st.mission || '')}</p></div></div>`;
    const panels = [...ui.stage.querySelectorAll('.panel')];
    const mission = $('#mission', ui.stage);
    let shown = 0;
    const reveal = () => {
      if (shown < panels.length) { panels[shown].classList.add('show'); ui.announce(panels[shown].textContent.trim()); shown++; }
      if (shown >= panels.length) { mission.hidden = false; ui.setLabel('Bắt đầu nhiệm vụ →'); } else ui.setLabel('Tiếp ▸');
      const last = shown >= panels.length ? mission : panels[shown - 1];
      if (last && last.scrollIntoView) last.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    reveal();
    ui.setReady(true);
    $('.story-scene', ui.stage).onclick = (e) => { if (e.target.closest('.zh-say')) return; if (shown < panels.length) reveal(); };
    ui.onCheck = () => { if (shown < panels.length) reveal(); else ui.finish({ unscored: true }); };
  }

  /** Kết cảnh + nhá tập sau, chèn vào màn hình hoàn thành bài. */
  function storyEnd(st) {
    if (!st || !(st.close || []).length) return '';
    return `<div class="story-end">${sceneHtml(st, st.close, true, ' mini')}${st.next ? `<p class="next-ep"><span aria-hidden="true">📺</span> <span><b>Tập sau:</b> ${storyText(st.next)}</span></p>` : ''}</div>`;
  }

  B.Render = { choice, order, speak, write, flip, compose, learn, note, dialogue, story, storyEnd };
  B.Story = { storyFace, SPEAKER_WHO };
})();
