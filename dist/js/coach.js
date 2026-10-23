/* BuzzLingo · trợ lý AI Bắp/Blu (tùy chọn, mặc định tắt).
 * AI chỉ giải thích và đồng hành; không chấm điểm, không ảnh hưởng XP/SRS. Gọi qua proxy phía server.
 * Bật khi: có coachEndpoint trong config.js VÀ người học đồng ý trong mục Cá nhân. */
(function () {
  'use strict';
  const B = (window.Buzz = window.Buzz || {});
  const C = B.Content, { esc, $ } = B.U;
  const QUOTA_KEY = 'buzzlingo.coach.v1', CLIENT_LIMIT = 25;
  const CJK = /[㐀-鿿]/g;

  const endpoint = () => (window.BuzzConfig && window.BuzzConfig.coachEndpoint) || '';
  const consented = () => !!(B.store && B.store.state.profile && B.store.state.profile.coachConsent);
  const enabled = () => !!endpoint() && consented();

  function quota() {
    const today = new Date().toISOString().slice(0, 10);
    let q = { day: today, n: 0, uid: null };
    try { q = Object.assign(q, JSON.parse(localStorage.getItem(QUOTA_KEY) || '{}')); } catch (e) { /* bỏ qua */ }
    if (q.day !== today) { q.day = today; q.n = 0; }
    if (!q.uid) q.uid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    return q;
  }
  const saveQuota = (q) => { try { localStorage.setItem(QUOTA_KEY, JSON.stringify(q)); } catch (e) { /* bỏ qua */ } };
  const remaining = () => Math.max(0, CLIENT_LIMIT - quota().n);

  /** Chữ đã học (gửi dạng chuỗi gọn), cấp HSK cao nhất đã gặp, và tối đa 40 từ gần đây nhất. */
  function known() {
    const items = B.knownItems ? B.knownItems() : Object.values(C.items);
    const chars = [...new Set(items.flatMap((i) => i.hanzi.match(CJK) || []))];
    const words = items.filter((i) => i.kind !== 'sentence' && i.kind !== 'name').slice(-40).map((i) => ({ hanzi: i.hanzi, pinyin: i.pinyin, vi: i.vi }));
    const level = Math.max(1, ...items.map((i) => i.level || 1));
    return { hanzi: chars.length <= 40 ? chars : [], chars: chars.join(''), level, words, set: chars };
  }

  /** payload: { mode, persona, step?, history?, message? }. Không gửi tên, hồ sơ hay âm thanh. */
  async function request(payload) {
    if (!enabled()) return { ok: false, error: 'Trợ lý AI chưa được bật.' };
    const q = quota();
    if (q.n >= CLIENT_LIMIT) return { ok: false, error: 'Bạn đã dùng hết lượt hỏi AI hôm nay. Mai quay lại nhé!' };
    q.n++; saveQuota(q);
    const k = known();
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
    try {
      const { set: knownSet, ...sendKnown } = k;
      const res = await fetch(endpoint(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, known: sendKnown, uid: q.uid }), signal: ctl.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || 'Trợ lý đang bận, bạn thử lại sau nhé.' };
      // luyện nói: chữ trong câu mẫu và chữ người học đã nói được phép xuất hiện trong lời nhận xét
      const extra = payload.mode === 'speak' ? `${(payload.step && payload.step.correct) || ''}${payload.message || ''}${data.heard || ''}` : '';
      const set = new Set([...k.set, ...(extra.match(CJK) || [])]);
      const bad = (payload.mode !== 'speak' && (data.flags || []).includes('unknown_hanzi_in_reply')) || ((String(data.reply || '').match(CJK) || []).some((c) => !set.has(c)));
      if (bad) return { ok: true, reply: 'Mình chưa trả lời được câu này bằng những chữ bạn đã học. Bạn đọc lại phần giải thích ở trên giúp mình nhé.', zh: null, guarded: true };
      return { ok: true, reply: String(data.reply || ''), zh: data.zh || null, heard: data.heard || null };
    } catch (e) {
      return { ok: false, error: 'Không kết nối được trợ lý. Bạn thử lại sau nhé.' };
    } finally { clearTimeout(t); }
  }

  const zhBlock = (zh) => (zh ? `<div class="ai-zh"><b lang="zh-Hans" class="zh-say" role="button" tabindex="0" data-zh="${esc(zh.hanzi)}">${esc(zh.hanzi)} 🔊</b> <span>${esc(zh.pinyin)}</span> · ${esc(zh.vi)}</div>` : '');
  const nameOf = (c) => (c === 'blu' ? 'Blu' : 'Bắp');

  /** Gắn nút "Hỏi vì sao" dưới phản hồi của bài trắc nghiệm/sắp xếp. */
  function attachExplain(ui, step, result) {
    if (!enabled()) return;
    const host = $('#fb', ui.stage);
    if (!host || $('.ai-wrap', ui.stage)) return;
    const name = nameOf(step.coach);
    const wrap = document.createElement('div');
    wrap.className = 'ai-wrap';
    wrap.innerHTML = `<button class="linkbtn" id="aiAsk" type="button">🐾 ${result.ok ? `Hỏi ${name} thêm về câu này` : `Hỏi ${name} vì sao`}</button><div class="ai-box" id="aiBox" role="status" aria-live="polite" hidden></div>`;
    host.after(wrap);
    const box = $('#aiBox', wrap), btn = $('#aiAsk', wrap);
    const history = [];
    const stepCtx = { title: step.title, prompt: step.prompt, correct: result.correct, userAnswer: result.answer, explain: step.explain };
    const show = (html) => { box.hidden = false; box.innerHTML = html; };
    const render = (res, first) => {
      if (!res.ok) return show(`<p class="ai-err">${esc(res.error)}</p>`);
      history.push({ role: 'assistant', text: res.reply });
      show(`<div class="ai-tag">${name} (AI) · do AI viết, có thể sai — hãy đối chiếu phần giải thích ở trên</div><p>${esc(res.reply)}</p>${zhBlock(res.zh)}
        <form class="ai-form"><label class="sr-only" for="aiQ">Hỏi thêm</label><input id="aiQ" type="text" maxlength="300" placeholder="Hỏi thêm bằng tiếng Việt…"><button class="secondary" type="submit">Gửi</button></form>
        <small class="hint">Còn ${remaining()} lượt hôm nay</small>`);
      $('.ai-form', box).onsubmit = async (e) => {
        e.preventDefault();
        const input = $('#aiQ', box), msg = input.value.trim();
        if (!msg) return;
        history.push({ role: 'user', text: msg });
        show('<p class="hint">Đang nghĩ…</p>');
        render(await request({ mode: 'ask', persona: step.coach, step: stepCtx, history: history.slice(0, -1), message: msg }));
      };
      if (!first) $('#aiQ', box).focus();
    };
    btn.onclick = async () => {
      btn.disabled = true; show('<p class="hint">Đang nghĩ…</p>');
      render(await request({ mode: 'explain', persona: step.coach, step: stepCtx }), true);
      btn.hidden = true;
    };
  }

  /** Phản biện bằng AI cho câu tự viết: hỏi ngược, chỉ ra một lỗi bằng gợi ý, không viết lại hộ. Không ảnh hưởng điểm. */
  function attachCritique(ui, step, text, result) {
    if (!enabled()) return;
    const old = $('.ai-wrap', ui.stage); if (old) old.remove();
    const name = nameOf(step.coach);
    const wrap = document.createElement('div');
    wrap.className = 'ai-wrap';
    wrap.innerHTML = `<button class="linkbtn" id="aiCrit" type="button">🐾 Nhờ ${name} phản biện câu này (AI)</button><div class="ai-box" id="aiBox" role="status" aria-live="polite" hidden></div>`;
    $('#crit', ui.stage).after(wrap);
    const box = $('#aiBox', wrap), btn = $('#aiCrit', wrap);
    const summary = result.findings.map((f) => `[${f.level}] ${f.ask}`).join(' | ') || 'Không phát hiện lỗi theo luật.';
    btn.onclick = async () => {
      btn.disabled = true; box.hidden = false; box.innerHTML = '<p class="hint">Đang đọc câu của bạn…</p>';
      const res = await request({ mode: 'critique', persona: step.coach, message: text, step: { title: step.title, prompt: step.task, correct: step.model.hanzi, userAnswer: text, explain: `Bộ kiểm tra tự động: ${result.pass ? 'đạt' : 'chưa đạt'}. ${summary}` } });
      btn.hidden = true;
      box.innerHTML = res.ok
        ? `<div class="ai-tag">${name} (AI) · do AI viết, có thể sai · không ảnh hưởng điểm</div><p>${esc(res.reply)}</p>${zhBlock(res.zh)}<small class="hint">Còn ${remaining()} lượt hôm nay</small>`
        : `<p class="ai-err">${esc(res.error)}</p>`;
    };
  }

  /** Bài trò chuyện đóng vai (không chấm điểm, không tạo attempt). */
  function chat(step, ui) {
    const name = nameOf(step.coach);
    ui.useFooter(false);
    ui.stage.innerHTML = `<div class="coach"><span class="coach-face"><img src="assets/${step.coach === 'blu' ? 'blu' : 'bap'}-avatar-128.webp" width="42" height="42" alt=""></span><span><b>${name}</b> · trò chuyện cùng AI</span></div>
      <h2 id="stepTitle" tabindex="-1">${esc(step.title)}</h2><p class="lead">${esc(step.prompt)}</p>
      <p class="hint">AI viết và có thể sai. Không chấm điểm, không tính XP. Bạn có thể gõ hoặc bấm 🎤 để nói: trình duyệt chuyển giọng thành chữ (Chrome dùng máy chủ Google, Safari dùng Apple), BuzzLingo chỉ gửi chữ đó cho AI.</p>
      <div class="chat-log" id="chatLog" role="log" aria-live="polite" aria-label="Cuộc trò chuyện"></div>
      <form class="ai-form" id="chatForm"><label class="sr-only" for="chatIn">Tin nhắn của bạn</label><input id="chatIn" type="text" maxlength="300" placeholder="Gõ hoặc bấm 🎤 để nói…" autocomplete="off">${B.Speech && B.Speech.canRecognize() ? '<button class="secondary mic-btn" id="chatMic" type="button" aria-label="Nói bằng giọng">🎤</button>' : ''}<button class="primary" type="submit">Gửi</button></form>
      <small class="hint" id="chatLeft"></small>
      <div class="skill-actions"><button class="secondary" id="chatEnd" type="button">Kết thúc trò chuyện</button></div>`;
    const log = $('#chatLog', ui.stage), input = $('#chatIn', ui.stage), form = $('#chatForm', ui.stage);
    const MAX_TURNS = 6; let turns = 0, busy = false, viaVoice = false; const history = [];
    const bubble = (who, html) => { const d = document.createElement('div'); d.className = `bubble-msg ${who}`; d.innerHTML = html; log.appendChild(d); d.scrollIntoView({ block: 'nearest' }); return d; };
    const o = step.opening;
    bubble('ai', `<b lang="zh-Hans">${esc(o.zh)}</b> <span class="pinyin">${esc(o.pinyin)}</span><br><small>${esc(o.vi)}</small>`);
    history.push({ role: 'assistant', text: `${o.zh} (${o.pinyin})` });
    const left = () => { $('#chatLeft', ui.stage).textContent = `Còn ${MAX_TURNS - turns} lượt trong cuộc này · ${remaining()} lượt AI hôm nay`; };
    left();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const msg = input.value.trim();
      if (!msg || busy || turns >= MAX_TURNS) return;
      busy = true; input.value = ''; turns++;
      bubble('me', esc(msg));
      const wait = bubble('ai', '<span class="hint">…</span>');
      const voice = viaVoice; viaVoice = false;
      const res = await request({ mode: 'roleplay', persona: step.coach, history: history.slice(-6), message: msg, voice });
      history.push({ role: 'user', text: msg });
      if (res.ok) {
        history.push({ role: 'assistant', text: res.reply }); wait.innerHTML = `${esc(res.reply)}${zhBlock(res.zh)}`;
        if (res.zh && B.Audio) B.Audio.play({ text: res.zh.hanzi }, 0.85); // Blu đọc câu tiếng Trung của mình
      }
      else { wait.innerHTML = `<span class="ai-err">${esc(res.error)}</span>`; turns--; }
      busy = false; left();
      if (turns >= MAX_TURNS) { input.disabled = true; form.querySelector('button').disabled = true; announceEnd(); } else input.focus();
    };
    const announceEnd = () => bubble('ai', '<small>Hết lượt luyện của cuộc này. Bấm “Kết thúc trò chuyện” nhé!</small>');
    const mic = $('#chatMic', ui.stage);
    if (mic) mic.onclick = async () => {
      if (busy || turns >= MAX_TURNS) return;
      mic.disabled = true; mic.classList.add('recording'); input.placeholder = 'Đang nghe… hãy nói tiếng Trung';
      const r = await B.Speech.recognize().promise;
      mic.disabled = false; mic.classList.remove('recording'); input.placeholder = 'Gõ hoặc bấm 🎤 để nói…';
      if (!r.ok) { bubble('ai', `<small class="ai-err">${esc(r.error)}</small>`); if (!B.Speech.canRecognize()) mic.remove(); return; }
      input.value = r.text; viaVoice = true;
      form.requestSubmit ? form.requestSubmit() : form.onsubmit(new Event('submit'));
    };
    $('#chatEnd', ui.stage).onclick = () => ui.finish({ neutral: true });
    input.focus();
  }

  B.Coach = { enabled, endpoint, consented, request, attachExplain, attachCritique, chat, remaining };
  if (B.Render) B.Render.chat = chat;
})();
