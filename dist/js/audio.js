/* BuzzLingo · phát âm Mandarin.
 * Ưu tiên file audio đã thu (assets/audio/*.mp3 khai báo trong spec.src); nếu không có thì dùng giọng zh-* của thiết bị.
 * Nếu thiết bị không phát được tiếng Trung, play() trả false và UI phải nói thật (không giả vờ đã phát).
 *
 * Xử lý riêng cho Safari iOS:
 * - getVoices() có thể rỗng lúc mở trang và sự kiện voiceschanged không bắn → đọc lại danh sách mỗi lần cần,
 *   và khi chưa biết danh sách giọng thì vẫn thử đọc với lang zh-CN, chờ onstart để biết có phát thật không.
 * - Bộ đọc có thể kẹt ở trạng thái "đang nói"/"tạm dừng" (sau khi app vào nền, sau ghi âm) → cancel, resume,
 *   rồi mới speak; speak ngay sau cancel có thể bị nuốt nên lùi một nhịp ngắn.
 * - Utterance phải được giữ tham chiếu, nếu không Safari có thể thu hồi giữa chừng và các lần đọc sau im lặng. */
(function () {
  'use strict';
  const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let voices = [];
  let ready = false;
  let current = null; // giữ utterance đang đọc
  const waiters = [];

  function refresh() {
    if (!hasTTS) return;
    let v = [];
    try { v = speechSynthesis.getVoices() || []; } catch (e) { v = []; }
    if (v.length) voices = v;
    if (voices.length && !ready) { ready = true; waiters.splice(0).forEach((fn) => fn()); }
  }
  if (hasTTS) {
    refresh();
    if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', refresh);
    // quay lại từ nền: xoá hàng đợi có thể đang kẹt
    document.addEventListener('visibilitychange', () => { if (document.hidden) { try { speechSynthesis.cancel(); } catch (e) { /* bỏ qua */ } } });
  }

  const zhVoice = () => {
    if (!voices.length) refresh();
    return voices.find((v) => /^zh[-_]CN/i.test(v.lang)) || voices.find((v) => /^zh/i.test(v.lang)) || null;
  };
  /** 'yes' có giọng Mandarin · 'no' có danh sách giọng nhưng không có tiếng Trung · 'unknown' chưa đọc được danh sách. */
  function voiceState() {
    if (!hasTTS) return 'no';
    if (zhVoice()) return 'yes';
    return voices.length ? 'no' : 'unknown';
  }
  const canSpeak = () => voiceState() === 'yes';

  /** Resolve khi danh sách giọng đã tải, hoặc sau ms mili giây. */
  function whenReady(ms = 1200) {
    return new Promise((resolve) => {
      if (ready || !hasTTS) return resolve();
      waiters.push(resolve);
      const t0 = Date.now();
      const poll = () => { refresh(); if (ready) return; if (Date.now() - t0 >= ms) return resolve(); setTimeout(poll, 200); };
      setTimeout(poll, 200);
    });
  }

  /** Trả Promise<boolean>: có thực sự phát hay không. opts.wait = chờ đọc xong mới resolve (dùng cho "Nghe cả đoạn"). */
  function speak(text, rate, opts) {
    const wait = !!(opts && opts.wait);
    const state = voiceState();
    if (state === 'no') return Promise.resolve(false);
    const ss = speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    const v = zhVoice();
    if (v) u.voice = v;
    u.rate = rate || 0.85;
    current = u;
    const result = new Promise((resolve) => {
      if (state === 'yes' && wait) {
        // chờ onend; nếu trình duyệt không bắn sự kiện thì ước lượng theo độ dài câu
        const guard = setTimeout(() => resolve(true), 2500 + [...text].length * 450 / (u.rate || 1));
        u.onend = u.onerror = () => { clearTimeout(guard); if (current === u) current = null; resolve(true); };
        return;
      }
      if (state === 'yes') { u.onend = u.onerror = () => { if (current === u) current = null; }; return resolve(true); }
      // chưa biết danh sách giọng: chỉ báo đã phát khi bộ đọc thật sự bắt đầu
      const t = setTimeout(() => resolve(false), 2500);
      u.onstart = () => { clearTimeout(t); if (!wait) resolve(true); else setTimeout(() => resolve(true), 2500 + [...text].length * 450 / (u.rate || 1)); };
      u.onerror = () => { clearTimeout(t); if (current === u) current = null; resolve(false); };
      u.onend = () => { if (current === u) current = null; if (wait) resolve(true); };
    });
    let busy = false;
    try {
      busy = !!(ss.speaking || ss.pending);
      if (busy) ss.cancel();
      if (ss.paused && ss.resume) ss.resume();
    } catch (e) { /* bỏ qua */ }
    if (busy) setTimeout(() => ss.speak(u), 80); else ss.speak(u);
    return result;
  }

  /** spec: { text, src? }. Trả Promise<boolean> = có thực sự phát hay không. */
  function play(spec, rate, opts) {
    const wait = !!(opts && opts.wait);
    if (spec && spec.src) {
      return new Promise((resolve) => {
        const a = new Audio(spec.src);
        a.playbackRate = rate && rate < 0.8 ? 0.75 : 1;
        a.onerror = () => resolve(speak(spec.text, rate, opts));
        if (wait) a.onended = () => resolve(true);
        a.play().then(() => { if (!wait) resolve(true); }).catch(() => resolve(speak(spec.text, rate, opts)));
      });
    }
    return speak(spec.text, rate, opts);
  }

  window.Buzz = window.Buzz || {};
  window.Buzz.Audio = { canSpeak, voiceState, whenReady, speak, play, stop: () => { if (hasTTS) { try { speechSynthesis.cancel(); } catch (e) { /* bỏ qua */ } } } };
})();
