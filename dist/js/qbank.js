/* BuzzLingo · ngân hàng câu hỏi: sinh câu hỏi có đáp án kiểm tra được từ items, cho ôn tập SRS và phòng luyện.
 * Nguyên tắc: mỗi câu kiểm tra đúng một kỹ năng của một mục; đáp án nhiễu "khó đúng chỗ"
 * (cùng âm khác thanh, nghĩa cùng loại), không bịa nội dung mới. UMD: chạy được trên trình duyệt và Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.Buzz = root.Buzz || {}).QBank = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Pinyin ---------- */
  const MARKS = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };
  const UNMARK = {};
  Object.entries(MARKS).forEach(([v, s]) => [...s].forEach((m, i) => (UNMARK[m] = [v, i + 1])));

  /** Thanh của một âm tiết (0 = thanh nhẹ). */
  function toneOf(syl) { for (const ch of syl) if (UNMARK[ch]) return UNMARK[ch][1]; return 0; }
  /** Bỏ dấu thanh, giữ nguyên độ dài chuỗi (mỗi ký tự có dấu ↔ một ký tự gốc). */
  function stripTones(s) { return [...String(s)].map((ch) => (UNMARK[ch] ? UNMARK[ch][0] : ch)).join(''); }

  /** Đặt dấu thanh đúng quy tắc: a/e nhận dấu; "ou" → o; còn lại là nguyên âm cuối. */
  function withTone(base, tone) {
    const s = stripTones(base);
    if (!tone) return s;
    const lower = s.toLowerCase();
    let idx = lower.search(/[ae]/);
    if (idx < 0) idx = lower.indexOf('ou');
    if (idx < 0) { for (let i = lower.length - 1; i >= 0; i--) if ('iouü'.includes(lower[i])) { idx = i; break; } }
    if (idx < 0) return s;
    const v = lower[idx], mark = MARKS[v][tone - 1];
    const out = s[idx] === v ? mark : mark.toUpperCase();
    return s.slice(0, idx) + out + s.slice(idx + 1);
  }

  /** Chuyển số thanh sang dấu: "ni3" → "nǐ", "lv4" → "lǜ", "ma5"/"ma0" → "ma". */
  function numberToMark(syl) {
    const m = /^([a-zü:v]+)([0-5])$/i.exec(syl);
    if (!m) return syl;
    const base = m[1].replace(/u:|v/gi, 'ü');
    const t = +m[2];
    return withTone(base, t === 5 ? 0 : t);
  }

  const INITIAL = '(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?';
  const SYL = new RegExp(`^${INITIAL}([aeiouü]+)(ng(?![aeiouü])|n(?![aeiouü]))?(r(?![aeiouü]))?`, 'i');
  /** Tách chuỗi Pinyin liền (có hoặc không dấu) thành âm tiết. Trả null nếu không tách được hết. */
  function splitSyllables(text) {
    const src = String(text).trim();
    const plain = stripTones(src);
    const out = [];
    let i = 0;
    while (i < plain.length) {
      if (/[\s'’\-?？!！,，.。]/.test(plain[i])) { i++; continue; }
      const m = SYL.exec(plain.slice(i));
      if (!m || !m[0]) return null;
      out.push(src.slice(i, i + m[0].length));
      i += m[0].length;
    }
    return out;
  }

  /** Các phương án Pinyin cùng âm, khác thanh. Với từ nhiều âm tiết: đổi thanh của từng âm tiết. */
  function toneVariants(pinyin, n = 3) {
    const syls = splitSyllables(pinyin);
    if (!syls || !syls.length) return [];
    const seen = new Set([pinyin.replace(/\s+/g, ' ')]), out = [];
    const tail = (/[?？!！.。]$/.exec(pinyin.trim()) || [''])[0];
    const join = (arr) => (pinyin.includes(' ') ? arr.join(' ') : arr.join('')) + tail;
    // ưu tiên đổi âm tiết đầu (lỗi người Việt hay gặp nhất), rồi tới các âm tiết sau
    for (let k = 0; k < syls.length && out.length < n * 2; k++) {
      for (let t = 1; t <= 4; t++) {
        if (t === toneOf(syls[k])) continue;
        // không dùng cách đọc biến thanh làm đáp án sai: nǐ hǎo đọc gần ní hǎo nên "ní hǎo" không phải lỗi rõ ràng
        if (t === 2 && toneOf(syls[k]) === 3 && syls[k + 1] && toneOf(syls[k + 1]) === 3) continue;
        const cand = join(syls.map((s, j) => (j === k ? withTone(s, t) : s)));
        if (!seen.has(cand)) { seen.add(cand); out.push(cand); }
      }
    }
    return out.slice(0, n);
  }

  /* ---------- ngẫu nhiên có seed (để test lặp lại được) ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  const TONE_NAMES = ['Thanh nhẹ · ngắn, không dấu', 'Thanh 1 · cao, phẳng', 'Thanh 2 · đi lên', 'Thanh 3 · hạ thấp rồi nhấc lên', 'Thanh 4 · đi xuống dứt khoát'];
  const bare = (h) => String(h).replace(/[，。？！、,.?!\s]/g, '');

  /**
   * create(content, { rng }) → { generate(itemId, skill, opts), forSkill, kinds, ... }
   * opts.pool: danh sách itemId người học đã gặp (để lấy đáp án nhiễu quen thuộc trước).
   */
  function create(content, { rng = Math.random } = {}) {
    const items = content.items;
    const viExtra = content.viDistractors || [];
    let counter = 0;

    function distractItems(item, pool, n, key) {
      const val = (it) => (key === 'vi' ? it.vi : bare(it.hanzi));
      const own = val(item);
      const rank = (it) => (pool.includes(it.id) ? 0 : 1) + (it.kind === item.kind ? 0 : 2);
      const cands = shuffle(Object.values(items).filter((it) => it.id !== item.id && val(it) !== own), rng).sort((a, b) => rank(a) - rank(b));
      const out = [], used = new Set([own]);
      for (const it of cands) { if (out.length >= n) break; const v = val(it); if (!used.has(v)) { used.add(v); out.push(it); } }
      return out;
    }

    function finalize(item, skill, variant, base, correct, wrongs, extra = {}) {
      if (item.note && base.explain && !base.explain.includes(item.note)) base.explain += ` ${item.note}`;
      const opts = shuffle([correct, ...wrongs], rng);
      const answer = opts.indexOf(correct);
      return {
        id: `q:${skill}:${item.id}:${variant}:${++counter}`, generated: true, type: 'choice', coach: rng() < 0.5 ? 'bap' : 'blu',
        itemId: item.id, skill, ...base, options: opts, answer, ...extra,
      };
    }

    const gens = {
      tone(item) {
        if (item.kind !== 'char' || !item.tone) return null;
        const base = stripTones(item.pinyin);
        const correct = [withTone(base, item.tone), TONE_NAMES[item.tone]];
        const wrongs = [1, 2, 3, 4].filter((t) => t !== item.tone).map((t) => [withTone(base, t), TONE_NAMES[t]]);
        const step = finalize(item, 'tone', 'tone', {
          title: 'Nghe và chọn thanh điệu', prompt: `Nghe chữ ${item.hanzi} (${item.vi}), rồi chọn thanh điệu bạn nghe được.`,
          audio: { text: bare(item.hanzi) }, hint: `Hãy để ý âm đi lên, đi xuống hay đi ngang.`,
          explain: `${item.hanzi} đọc là ${item.pinyin}: ${TONE_NAMES[item.tone].toLowerCase()}.`,
        }, correct, wrongs);
        // giữ thứ tự thanh 1→4 cho dễ nhìn, như bài học
        const order = [1, 2, 3, 4].map((t) => withTone(base, t));
        step.options = order.map((p, i) => [p, TONE_NAMES[i + 1]]);
        step.answer = item.tone - 1;
        return step;
      },
      read(item, pool) {
        if (item.kind !== 'char' && item.parts && item.parts.length > 1 && rng() < 0.4) { const o = gens.order(item); if (o) return o; }
        const variants = toneVariants(item.pinyin, 3);
        if (variants.length < 3) return null;
        return finalize(item, 'read', 'pinyin', {
          title: 'Đọc chữ: chọn Pinyin đúng', prompt: `Chữ này đọc thế nào? Chú ý dấu thanh.`,
          stimulus: { hanzi: item.hanzi, pinyin: '' }, hint: `Nghĩa của nó là “${item.vi}”. Nhớ lại thanh khi bạn học chữ này.`,
          explain: `${item.hanzi} đọc là ${item.pinyin} (“${item.vi}”).`,
        }, [item.pinyin, ''], variants.map((v) => [v, '']));
      },
      order(item) {
        const parts = item.parts;
        if (!parts || parts.length < 2) return null;
        let tokens = shuffle(parts, rng), guard = 0;
        while (tokens.join('') === parts.join('') && guard++ < 10) tokens = shuffle(parts, rng);
        if (tokens.join('') === parts.join('')) return null; // ví dụ 谢谢: đảo cũng như cũ
        return {
          id: `q:read:${item.id}:order:${++counter}`, generated: true, type: 'order', coach: rng() < 0.5 ? 'bap' : 'blu', itemId: item.id, skill: 'read',
          title: 'Ghép chữ theo thứ tự', prompt: `Chạm các chữ theo đúng thứ tự để thành “${item.vi}”.`,
          tokens, target: parts.slice(), hint: `Đọc là ${item.pinyin}.`, explain: `${item.hanzi} — ${item.pinyin} — “${item.vi}”.`,
        };
      },
      meaning(item, pool) {
        const toZh = rng() < 0.4;
        const others = distractItems(item, pool, 3, toZh ? 'hanzi' : 'vi');
        if (toZh) {
          if (others.length < 3) return null;
          return finalize(item, 'meaning', 'vi2zh', {
            title: 'Chọn chữ theo nghĩa', prompt: `Chữ nào nghĩa là “${item.vi}”?`, hint: `Đọc là ${item.pinyin}.`,
            explain: `“${item.vi}” là ${item.hanzi} (${item.pinyin}).`,
          }, [bare(item.hanzi), ''], others.map((o) => [bare(o.hanzi), '']));
        }
        const wrongVi = others.map((o) => o.vi);
        for (const v of shuffle(viExtra, rng)) { if (wrongVi.length >= 3) break; if (v !== item.vi && !wrongVi.includes(v)) wrongVi.push(v); }
        return finalize(item, 'meaning', 'zh2vi', {
          title: 'Nhớ nghĩa', prompt: `Đọc là ${item.pinyin}. Nghĩa là gì?`, stimulus: { hanzi: item.hanzi, pinyin: item.pinyin },
          hint: item.kind === 'sentence' ? 'Để ý chữ cuối câu.' : 'Nghĩ tới bài bạn đã học chữ này.',
          explain: `${item.hanzi} (${item.pinyin}) = “${item.vi}”.`,
        }, [item.vi, ''], wrongVi.slice(0, 3).map((v) => [v, '']));
      },
      audio(item, pool) {
        const others = distractItems(item, pool, 3, 'hanzi');
        if (others.length < 3) return null;
        return finalize(item, 'audio', 'listen', {
          title: 'Nghe và chọn chữ', prompt: 'Nghe, rồi chọn đúng chữ bạn vừa nghe. Không có Pinyin hỗ trợ.',
          audio: { text: bare(item.hanzi) }, revealSub: true, hint: `Nghĩa là “${item.vi}”.`,
          explain: `Bạn vừa nghe ${item.hanzi} (${item.pinyin}) — “${item.vi}”.`,
        }, [bare(item.hanzi), item.vi], others.map((o) => [bare(o.hanzi), o.vi]));
      },
    };

    /** Sinh một câu hỏi cho item × skill. Trả null nếu kỹ năng không áp dụng được cho mục này. */
    function generate(itemId, skill, { pool = [] } = {}) {
      const item = items[itemId];
      if (!item || !gens[skill]) return null;
      const s = gens[skill](item, pool);
      if (s) return s;
      if (skill === 'tone') return gens.read(item, pool); // 吗 (thanh nhẹ) hoặc từ: kiểm tra qua Pinyin
      if (skill === 'read') return gens.order(item) || gens.meaning(item, pool);
      return null;
    }

    /** Bộ câu cho phòng luyện: trộn kỹ năng trên các mục trong pool, không lặp item×skill. */
    function set(ids, skills, max = 6, { pool = ids } = {}) {
      const pairs = shuffle(ids.flatMap((id) => skills.map((sk) => [id, sk])), rng);
      const out = [], seen = new Set();
      for (const [id, sk] of pairs) {
        if (out.length >= max) break;
        const q = generate(id, sk, { pool });
        if (!q) continue;
        const key = `${q.itemId}:${q.skill}:${q.type}`;
        if (seen.has(key)) continue;
        seen.add(key); out.push(q);
      }
      return out;
    }

    return { generate, set, kinds: Object.keys(gens) };
  }

  return { create, toneOf, stripTones, withTone, numberToMark, splitSyllables, toneVariants, mulberry32, shuffle, TONE_NAMES };
});
