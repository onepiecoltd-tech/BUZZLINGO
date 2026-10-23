/* BuzzLingo · bộ "phản biện" câu tự viết, chạy hoàn toàn trên máy (không cần AI).
 * Người học gõ chữ Hán hoặc Pinyin (có dấu hoặc số thanh). Bộ kiểm tra:
 *   1) chuyển Pinyin về chữ Hán theo từ đã học, 2) kiểm tra yêu cầu của đề, 3) bắt lỗi hay gặp của người Việt,
 *   4) với mỗi lỗi: một câu HỎI NGƯỢC (ask) trước, gợi ý cụ thể (fix) chỉ hiện khi người học muốn.
 * Đây là kiểm tra theo luật nên có thể bỏ sót; UI ghi rõ điều đó. UMD: chạy trên trình duyệt và Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./qbank.js'));
  else (root.Buzz = root.Buzz || {}).Critique = factory(root.Buzz.QBank);
})(typeof self !== 'undefined' ? self : this, function (Q) {
  'use strict';

  const CJK = /[㐀-鿿]/;
  const VI_ONLY = /[ăâđêôơưạảãẹẻẽịỉĩọỏõụủũỳỷỹỵằắẳẵặầấẩẫậềếểễệồốổỗộờớởỡợừứửữự]/i;
  const PUNCT = { ',': '，', '.': '。', '?': '？', '!': '！' };
  const VI_WORDS = new Set(['xin', 'chào', 'cảm', 'ơn', 'tôi', 'là', 'bạn', 'không', 'tạm', 'biệt', 'của', 'và', 'có', 'gì', 'phải', 'mình', 'khoẻ', 'khỏe']);
  const isVi = (w) => VI_ONLY.test(w) || VI_WORDS.has(w.toLowerCase());

  function create(content) {
    const items = Object.values(content.items);

    /** Từ điển âm tiết → mục, sắp theo số âm tiết giảm dần để khớp dài nhất trước. */
    const lex = items.filter((it) => it.kind !== 'sentence' && it.kind !== 'name').map((it, order) => {
      const syl = Q.splitSyllables(it.dict || it.pinyin) || [];
      const alt = it.dict && it.dict !== it.pinyin ? Q.splitSyllables(it.pinyin) : null; // dạng biến thanh (bú, yí…)
      return { it, syl, alt, order, plain: syl.map((s) => Q.stripTones(s).toLowerCase()), hanzi: it.hanzi.replace(/[？?！!。.，,]/g, '') };
    }).filter((e) => e.syl.length).sort((a, b) => b.syl.length - a.syl.length || a.order - b.order);
    const byFirst = new Map();
    lex.forEach((e) => { const k = e.plain[0]; if (!byFirst.has(k)) byFirst.set(k, []); byFirst.get(k).push(e); });
    // thêm các chữ chỉ xuất hiện trong từ (谢 客 气) để Pinyin rời từng âm tiết vẫn nhận ra
    const extraChars = { xie: ['谢', 'xiè'], ke: ['客', 'kè'], qi: ['气', 'qì'] };

    function toTokens(text) {
      // tách: chữ Hán liền, từ Latin, dấu câu
      const out = []; const re = /([㐀-鿿]+)|([A-Za-zÀ-ỹüÜ:]+[0-5]?(?:[ '’-]?[A-Za-zÀ-ỹüÜ:]+[0-5]?)*)|([，。？！,.?!、])|(\s+)/g;
      let m;
      while ((m = re.exec(text))) {
        if (m[1]) out.push({ t: 'zh', v: m[1] });
        else if (m[2]) m[2].split(/\s+/).forEach((w) => w && out.push({ t: 'lat', v: w }));
        else if (m[3]) out.push({ t: 'p', v: PUNCT[m[3]] || m[3] });
      }
      return out;
    }

    /** Pinyin (một từ Latin có thể chứa nhiều âm tiết) → danh sách âm tiết có dấu, hoặc null. */
    function sylOf(word) {
      const parts = word.split(/['’-]/).flatMap((w) => {
        const withNum = w.match(/[a-zü:v]+[0-5]/gi);
        if (withNum && withNum.join('') === w) return withNum.map(Q.numberToMark);
        return Q.splitSyllables(w) || [null];
      });
      return parts.includes(null) ? null : parts;
    }

    function check(text, step = {}, { known = null } = {}) {
      const raw = String(text || '').trim().slice(0, 200);
      const context = new Set([...(step.need || []).flatMap((n) => n.any), ...((step.model && step.model.hanzi) ? lex.filter((e) => step.model.hanzi.includes(e.hanzi)).map((e) => e.hanzi) : [])]);
      const knownWords = new Set((known || []).map((it) => it.hanzi));
      const userPlain = []; // âm tiết không dấu người học gõ (để so yêu cầu theo âm khi gõ Pinyin)
      const findings = []; const add = (level, code, ask, fix) => findings.push({ level, code, ask, fix });
      if (!raw) return { pass: false, hanzi: '', findings: [{ level: 'error', code: 'empty', ask: 'Bạn chưa viết gì. Thử viết một câu ngắn nhé?', fix: '' }], met: [], script: 'empty' };

      const tokens = toTokens(raw);
      const hasZh = tokens.some((t) => t.t === 'zh');
      // phân biệt cả câu tiếng Việt với tên riêng (Bắp, Minh) chen trong câu tiếng Trung
      const viCount = tokens.filter((t) => t.t === 'lat' && isVi(t.v)).length;
      if (!hasZh && viCount >= 2) {
        add('error', 'vietnamese', 'Câu này đang là tiếng Việt. Bạn thử nói ý đó bằng tiếng Trung xem — dùng chữ Hán hoặc Pinyin?', step.model ? `Ví dụ: ${step.model.hanzi} (${step.model.pinyin})` : '');
        return { pass: false, hanzi: '', findings, met: [], script: 'vietnamese' };
      }

      // 1) dựng câu chữ Hán + ghi lỗi Pinyin
      let hanzi = ''; const unknownWords = []; const pinyinUsed = [];
      const latinRun = [];
      const flushLatin = () => {
        if (!latinRun.length) return;
        const syl = []; const owner = [];
        latinRun.forEach((w, wi) => { const s = sylOf(w.v); if (s) s.forEach((x) => { syl.push(x); owner.push(wi); }); else { syl.push(null); owner.push(wi); } });
        let i = 0;
        while (i < syl.length) {
          if (syl[i] == null) { const w = latinRun[owner[i]].v; hanzi += ` ${w} `; if (!/^[A-ZÀ-Ỹ]/.test(w)) unknownWords.push(w); i++; continue; }
          // từ viết hoa giữa câu, không dấu thanh/số → tên riêng (Lan, Minh), không dò thành 蓝, 明
          { const wt = latinRun[owner[i]]; if (/^[A-ZÀ-Ỹ]/.test(wt.v) && !wt.first && !/[\u0300-\u036f\d]/.test(wt.v.normalize('NFD'))) { hanzi += ` ${wt.v} `; i = owner.lastIndexOf(owner[i]) + 1; continue; } }
          // ứng viên khớp âm (không xét thanh), dài nhất trước; cùng độ dài thì chấm điểm: đúng thanh, có trong đề, đã học
          let matched = null, best = -1, bestLen = 0;
          for (const e of byFirst.get(Q.stripTones(syl[i]).toLowerCase()) || []) {
            const n = e.syl.length;
            if (n < bestLen) break;
            if (i + n > syl.length || syl.slice(i, i + n).some((x) => x == null)) continue;
            if (!syl.slice(i, i + n).every((x, k) => Q.stripTones(x).toLowerCase() === e.plain[k])) continue;
            const tones = syl.slice(i, i + n).filter((x, k) => Q.toneOf(x) === Q.toneOf(e.syl[k]) || (e.alt && e.alt[k] && Q.toneOf(x) === Q.toneOf(e.alt[k]))).length;
            const score = tones * 3 + (context.has(e.hanzi) ? 5 : 0) + (knownWords.has(e.hanzi) ? 2 : 0);
            if (n > bestLen || score > best) { matched = e; best = score; bestLen = n; }
          }
          if (matched) {
            const got = syl.slice(i, i + matched.syl.length);
            pinyinUsed.push({ got, want: matched.syl, it: matched.it });
            hanzi += matched.hanzi; i += matched.syl.length; continue;
          }
          const p = Q.stripTones(syl[i]).toLowerCase();
          if (extraChars[p]) { pinyinUsed.push({ got: [syl[i]], want: [extraChars[p][1]], it: { hanzi: extraChars[p][0] } }); hanzi += extraChars[p][0]; i++; continue; }
          // không khớp từ đã học: nếu cả từ Latin này viết hoa → coi là tên riêng
          const w = latinRun[owner[i]].v;
          const end = owner.lastIndexOf(owner[i]);
          if (!/^[A-ZÀ-Ỹ]/.test(w)) unknownWords.push(w);
          hanzi += ` ${w} `; i = end + 1;
        }
        latinRun.length = 0;
      };
      tokens.forEach((t, k) => { if (t.t === 'lat') t.first = k === 0 || /[。！？.!?]\s*$/.test(tokens[k - 1].v); });
      for (const t of tokens) {
        if (t.t === 'lat') { latinRun.push(t); continue; }
        flushLatin();
        hanzi += t.v;
      }
      flushLatin();
      hanzi = hanzi.replace(/\s+/g, ' ').replace(/ ?([，。？！]) ?/g, '$1').trim();
      const compact = hanzi.replace(/\s+/g, '');
      const script = hasZh && pinyinUsed.length ? 'mixed' : hasZh ? 'hanzi' : 'pinyin';

      // 2) lỗi Pinyin: thiếu dấu, sai thanh, biến thanh
      pinyinUsed.forEach((u) => u.got.forEach((g) => userPlain.push(Q.stripTones(g).toLowerCase())));
      const plainStr = ` ${userPlain.join(' ')} `;
      const sylPlain = (w) => { const e = lex.find((x) => x.hanzi === w); return e ? ` ${e.plain.join(' ')} ` : null; };
      for (const u of pinyinUsed) {
        u.got.forEach((g, k) => {
          const want = u.want[k]; const tg = Q.toneOf(g), tw = Q.toneOf(want);
          if (tg === tw) return;
          const ch = [...u.it.hanzi.replace(/[？?！!。.，,]/g, '')][k] || u.it.hanzi;
          const plain = Q.stripTones(g);
          if (tg === 0 && tw !== 0) add('tip', 'no_tone', `Âm “${plain}” (${ch}) mang thanh mấy? Thử thêm dấu thanh (hoặc số 1–4, ví dụ ${plain}${tw}).`, `${ch} viết là ${want}.`);
          else if (ch === '不' && tg === 4 && tw === 2) add('tip', 'bu_sandhi', `Bạn viết “${g}”. Chữ đứng ngay sau 不 mang thanh mấy? Khi đó 不 được đọc thế nào?`, '不 trước thanh 4 đọc là bú (viết bù vẫn được hiểu, nhưng đọc là bú).');
          else if (tg === 2 && tw === 3 && u.want[k + 1] && Q.toneOf(u.want[k + 1]) === 3) add('tip', 'third_sandhi', `“${g}” là cách ĐỌC khi hai thanh 3 đi liền. Khi VIẾT Pinyin, chữ ${ch} mang thanh mấy?`, `Vẫn viết ${want}, chỉ đọc gần như ${g}.`);
          else if (tw === 0) add('tip', 'neutral', `Âm “${g}” ở đây có cần dấu không? Chữ này đọc nhẹ hay có thanh rõ ràng?`, `Ở đây ${ch} đọc thanh nhẹ, viết không dấu: ${want}.`);
          else add('error', 'wrong_tone', `Bạn viết “${g}” (thanh ${tg || 'nhẹ'}). Chữ ${ch} mang thanh mấy nhỉ? Nghe lại bài để kiểm tra.`, `${ch} là ${want} (thanh ${tw}).`);
        });
      }
      unknownWords.forEach((w) => add('tip', 'unknown_word', `Mình chưa nhận ra “${w}”. Đây là từ đã học, hay là tên riêng? Nếu là tên, hãy viết hoa chữ cái đầu.`, 'Chỉ dùng từ trong các bài đã học để mình kiểm tra được.'));

      // chữ Hán chưa học
      const knownChars = new Set((known || items).flatMap((it) => [...it.hanzi]));
      const unknownChars = [...new Set([...compact].filter((c) => CJK.test(c) && !knownChars.has(c)))];
      if (unknownChars.length) add('tip', 'unknown_char', `Chữ ${unknownChars.join(' ')} chưa có trong các bài bạn đã học nên mình chưa kiểm tra được. Có cách nói nào chỉ dùng chữ đã học không?`, '');

      // 3) lỗi ngữ pháp hay gặp
      if (/吗[^，。？！\s]/.test(compact)) add('error', 'ma_position', 'Chữ 吗 biến câu thành câu hỏi. Theo bạn, nó nên đứng ở đầu, giữa hay cuối câu?', 'Đặt 吗 ở cuối câu: …吗？');
      else if (compact.includes('吗') && !/^[？]/.test(compact.slice(compact.lastIndexOf('吗') + 1))) add('tip', 'ma_mark', 'Câu có 吗 là câu hỏi. Cuối câu hỏi nên dùng dấu gì?', 'Kết thúc bằng dấu ？');
      if (/(^|[，。？！])(好你|见再|是我)/.test(compact)) add('error', 'word_order', 'Hình như hai chữ bị đảo chỗ. Đọc to câu của bạn: thứ tự có giống từ trong bài không?', 'Thứ tự đúng: 你好 · 我是 · 再见.');
      if (/(客不气|气客不|不气客|气不客|客气不)/.test(compact)) add('error', 'word_order', 'Ba chữ của “không có gì” đã đúng thứ tự chưa? Chữ “không” đứng ở đâu?', 'Thứ tự đúng: 不客气.');
      if (/[我你]是好/.test(compact)) add('error', 'shi_adj', 'Trong tiếng Trung, có cần 是 trước một tính từ như 好 không? Thử bỏ 是 xem câu còn đúng ý không.', 'Tính từ không đi với 是. “Tôi khoẻ” là 我很好 (chữ 很 sẽ học sau).');
      if (/不是是|是是/.test(compact)) add('error', 'double_shi', 'Có chữ 是 nào bị lặp không?', 'Chỉ cần một chữ 是.');

      // 4) yêu cầu của đề
      const met = [];
      (step.need || []).forEach((n) => {
        if (n.any.some((w) => compact.includes(w) || (pinyinUsed.length && sylPlain(w) && plainStr.includes(sylPlain(w))))) met.push(n);
        else add('error', 'need', n.ask, n.fix);
      });
      if (!met.length && !(step.need || []).length && !CJK.test(compact)) add('error', 'nozh', 'Mình chưa thấy từ tiếng Trung nào đã học. Bạn thử lại nhé?', '');

      const pass = !findings.some((f) => f.level === 'error');
      return { pass, hanzi, findings, met, script };
    }

    return { check, size: items.length };
  }

  return { create };
});
