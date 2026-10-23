/* BuzzLingo · nghe người học nói (nhận dạng giọng nói) và so với câu mẫu.
 * - Nhận dạng dùng Web Speech API của trình duyệt (zh-CN). Chrome gửi âm thanh tới máy chủ Google, Safari tới Apple:
 *   giao diện phải nói rõ điều này. App Windows (Electron) không có dịch vụ này → dùng đường "gửi bản ghi cho AI".
 * - compare() so chữ Hán đã nghe với câu mẫu (không cần mạng), chỉ để gợi ý; không chấm điểm. */
(function () {
  'use strict';
  const B = (window.Buzz = window.Buzz || {});
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const isElectron = typeof navigator !== 'undefined' && /Electron\//.test(navigator.userAgent || '');
  let broken = false; // dịch vụ báo lỗi mạng/không cho phép → không đề nghị nữa trong phiên này
  const canRecognize = () => !!SR && !isElectron && !broken;

  const MSG = {
    'no-speech': 'Mình chưa nghe thấy gì. Bạn nói to hơn một chút nhé.',
    'audio-capture': 'Không tìm thấy micro.',
    'not-allowed': 'Bạn chưa cho phép dùng micro.',
    'service-not-allowed': 'Thiết bị không cho phép nhận dạng giọng nói.',
    network: 'Dịch vụ nhận dạng giọng nói cần mạng và đang không kết nối được.',
    aborted: 'Đã dừng nghe.',
  };

  /** Nghe một câu. Trả Promise<{ ok, text?, error?, code? }>. handle.stop() để dừng sớm. */
  function recognize({ maxMs = 8000, onStart } = {}) {
    let rec = null;
    const p = new Promise((resolve) => {
      if (!canRecognize()) return resolve({ ok: false, code: 'unsupported', error: 'Trình duyệt này chưa hỗ trợ nhận dạng giọng nói.' });
      let done = false, text = '';
      const finish = (r) => { if (done) return; done = true; clearTimeout(t); resolve(r); };
      try {
        rec = new SR();
        rec.lang = 'zh-CN'; rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
        rec.onstart = () => onStart && onStart();
        rec.onresult = (e) => { text = Array.from(e.results).map((r) => r[0] && r[0].transcript).join('').trim(); };
        rec.onerror = (e) => {
          const code = e.error || 'error';
          if (code === 'network' || code === 'service-not-allowed') broken = true;
          finish({ ok: false, code, error: MSG[code] || 'Không nhận dạng được giọng nói.' });
        };
        rec.onend = () => finish(text ? { ok: true, text } : { ok: false, code: 'no-speech', error: MSG['no-speech'] });
        rec.start();
      } catch (err) { finish({ ok: false, code: 'error', error: 'Không bật được nhận dạng giọng nói.' }); }
      const t = setTimeout(() => { try { rec && rec.stop(); } catch (e) { /* bỏ qua */ } }, maxMs);
    });
    return { promise: p, stop: () => { try { rec && rec.stop(); } catch (e) { /* bỏ qua */ } } };
  }

  const HAN = /\p{Script=Han}/u;
  const hanOnly = (s) => [...String(s || '')].filter((c) => HAN.test(c));
  // chuẩn hoá vài chữ hay bị nhận dạng ra dạng khác nhưng cùng nghĩa/âm trong ngữ cảnh luyện nói
  const NORM = { '妳': '你', '祂': '他', '牠': '它', '裡': '里', '麼': '么', '們': '们', '這': '这', '個': '个', '說': '说', '謝': '谢', '學': '学', '時': '时', '會': '会', '來': '来', '見': '见', '嗎': '吗', '對': '对' };
  const norm = (c) => NORM[c] || c;

  /** So chữ Hán đã nghe với câu mẫu bằng LCS. Trả { tokens:[{ch, ok}], extra:[], ratio } (ratio = tỉ lệ chữ mẫu khớp). */
  function compare(target, heard) {
    const a = hanOnly(target), b = hanOnly(heard).map(norm);
    const n = a.length, m = b.length;
    const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = norm(a[i]) === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const tokens = [], extra = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (norm(a[i]) === b[j]) { tokens.push({ ch: a[i], ok: true }); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { tokens.push({ ch: a[i], ok: false }); i++; }
      else { extra.push(b[j]); j++; }
    }
    while (i < n) tokens.push({ ch: a[i++], ok: false });
    while (j < m) extra.push(b[j++]);
    const ratio = n ? tokens.filter((t) => t.ok).length / n : 0;
    return { tokens, extra, ratio };
  }

  /** Đọc Blob thành base64 (không có tiền tố data:). */
  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

  B.Speech = { canRecognize, recognize, compare, blobToBase64, isElectron };
})();
