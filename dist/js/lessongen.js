/* BuzzLingo · máy sinh bài học từ gói nội dung HSK (dist/content/hsk*.js).
 * Một bài = từ mới + ghi chú ngữ pháp + hội thoại. Máy sinh ra chuỗi bước:
 *   học từ → ngữ pháp → câu hỏi từ mới → hội thoại → hiểu hội thoại → ghép câu → nói → viết → tự đặt câu → vé ra cửa.
 * Mã bước ổn định theo bài (seed từ id bài) để học dở rồi tải lại vẫn tiếp tục đúng chỗ. UMD: chạy được trên Node để test. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./qbank.js'));
  else (root.Buzz = root.Buzz || {}).LessonGen = factory(root.Buzz.QBank);
})(typeof self !== 'undefined' ? self : this, function (Q) {
  'use strict';

  const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const COACH = ['bap', 'blu'];

  function create(content) {
    const items = content.items;

    function withId(step, id) { if (!step) return null; return { ...step, id }; }

    /** Các bước của một bài sinh tự động. pool: id các mục người học đã gặp (để lấy đáp án nhiễu quen thuộc). */
    /** Bước mở cảnh truyện Bắp & Blu (không chấm điểm). */
    function storyStep(lesson) {
      return { id: `${lesson.id}:story`, type: 'story', unscored: true, coach: 'blu', itemId: (lesson.words || [])[0], skill: 'meaning', title: lesson.story.ep ? `Tập ${lesson.story.ep} · ${lesson.story.epTitle}` : 'Câu chuyện', lessonTitle: lesson.title, story: lesson.story };
    }
    function stepsFor(lesson, { pool = [] } = {}) {
      const rng = Q.mulberry32(hash(lesson.id));
      const qb = Q.create(content, { rng });
      const lid = lesson.id;
      const steps = [];
      const coach = (i) => COACH[(hash(lid) + i) % 2];
      const newIds = [...lesson.words, ...(lesson.extra || [])].filter((id) => items[id]);
      const sentIds = lesson.dialogue.map((_, i) => `${lid}.${i}`).filter((id) => items[id]);
      const fullPool = [...new Set([...pool, ...newIds, ...sentIds])];

      if (lesson.story) steps.push(storyStep(lesson));
      steps.push({ id: `${lid}:learn`, type: 'learn', unscored: true, coach: coach(0), itemId: newIds[0], skill: 'meaning', title: 'Từ mới của bài', itemIds: newIds });
      if (lesson.grammar) steps.push({ id: `${lid}:note`, type: 'note', unscored: true, coach: coach(1), itemId: newIds[0], skill: 'meaning', title: lesson.grammar.title, grammar: lesson.grammar });

      // câu hỏi từ mới: mỗi từ một câu (tối đa 8), xoay vòng kỹ năng
      const words = newIds.filter((id) => items[id].kind !== 'name').slice(0, 8);
      words.forEach((id, i) => {
        const it = items[id];
        const order = it.kind === 'char' && it.tone ? ['tone', 'meaning', 'audio', 'read'] : ['meaning', 'audio', 'read', 'meaning'];
        const q = qb.generate(id, order[i % order.length], { pool: fullPool }) || qb.generate(id, 'meaning', { pool: fullPool });
        if (q) steps.push(withId(q, `${lid}:w${i}`));
      });

      steps.push({ id: `${lid}:dialogue`, type: 'dialogue', unscored: true, coach: coach(2), itemId: sentIds[0], skill: 'audio', title: 'Hội thoại', lines: lesson.dialogue.map((d, i) => ({ ...d, itemId: `${lid}.${i}` })) });

      // hiểu hội thoại: 2 câu có nhiều từ mới nhất
      const scored = lesson.dialogue.map((d, i) => ({ i, n: d.tokens.filter((t) => newIds.some((id) => items[id].hanzi === t)).length, len: d.tokens.length }));
      const byNew = scored.slice().sort((a, b) => b.n - a.n || a.i - b.i);
      byNew.slice(0, 2).forEach(({ i }, k) => { const q = qb.generate(`${lid}.${i}`, 'meaning', { pool: sentIds }); if (q && q.type === 'choice') steps.push(withId({ ...q, title: 'Hiểu hội thoại', prompt: 'Câu này trong hội thoại nghĩa là gì?' }, `${lid}:c${k}`)); });

      // ghép câu: câu 3–7 từ, ưu tiên có từ mới
      const ord = scored.filter((s) => s.len >= 3 && s.len <= 7).sort((a, b) => b.n - a.n || a.len - b.len)[0];
      if (ord) { const q = qb.generate(`${lid}.${ord.i}`, 'read', { pool: sentIds }); const o = q && q.type === 'order' ? q : null; const it = items[`${lid}.${ord.i}`];
        const fallback = !o && it.parts.length >= 3 ? { id: '', type: 'order', coach: coach(3), itemId: it.id, skill: 'read', title: 'Ghép câu', prompt: `Chạm các từ theo đúng thứ tự: “${it.vi}”`, tokens: Q.shuffle(it.parts, rng), target: it.parts.slice(), hint: `Đọc là: ${it.pinyin}`, explain: `${it.hanzi} — ${it.pinyin}` } : null;
        const step = o ? { ...o, title: 'Ghép câu', prompt: `Chạm các từ theo đúng thứ tự: “${it.vi}”` } : fallback;
        if (step && step.tokens.join('') !== step.target.join('')) steps.push(withId(step, `${lid}:o`)); }

      // nói: câu ngắn nhất có từ mới
      const sp = scored.filter((s) => s.n > 0).sort((a, b) => a.len - b.len)[0] || scored[0];
      if (sp) { const d = lesson.dialogue[sp.i]; steps.push({ id: `${lid}:speak`, type: 'speak', coach: coach(4), itemId: `${lid}.${sp.i}`, skill: 'speak', title: 'Nói theo mẫu', prompt: 'Nghe mẫu, ghi âm, nghe lại rồi so với mẫu.', hanzi: d.zh, pinyin: d.py, audio: { text: d.zh }, tips: speakTips(d) }); }

      // viết
      (lesson.write || []).forEach((ch, k) => { const id = writeItemId(ch); if (id) steps.push({ id: `${lid}:write${k}`, type: 'write', coach: coach(5 + k), itemId: id, skill: 'write', title: `Viết chữ ${ch}`, char: ch }); });

      // tự đặt câu: dịch một câu có từ mới (khác câu đã nói nếu được)
      const cp = byNew.find((s) => s.i !== (sp && sp.i) && s.n > 0) || byNew[0];
      if (cp) {
        const d = lesson.dialogue[cp.i], prev = lesson.dialogue[cp.i - 1];
        const keys = newIds.filter((id) => d.tokens.includes(items[id].hanzi)).slice(0, 2);
        steps.push({
          id: `${lid}:compose`, type: 'compose', coach: coach(7), itemId: `${lid}.${cp.i}`, skill: 'produce', title: 'Tự viết câu',
          task: `${prev ? `${prev.sp}: “${prev.zh}”. ` : ''}Bạn muốn nói: “${d.vi}”. Hãy tự viết câu đó bằng tiếng Trung.`,
          accept: 'Gõ chữ Hán hoặc Pinyin có dấu (hoặc số thanh: ni3 hao3). Tên riêng viết chữ Latinh. Không cần giống hệt câu mẫu.',
          need: keys.map((id) => ({ any: [items[id].hanzi], ask: `Câu của bạn đã có từ nghĩa là “${items[id].vi}” chưa? Từ đó viết thế nào?`, fix: `Dùng ${items[id].hanzi} (${items[id].pinyin}).` })),
          model: { hanzi: d.zh, pinyin: d.py },
        });
      }

      // vé ra cửa: nghe một câu, chọn đúng câu
      const ex = scored.slice().sort((a, b) => b.n - a.n || b.len - a.len)[0];
      if (ex && sentIds.length >= 2) { const q = qb.generate(`${lid}.${ex.i}`, 'audio', { pool: sentIds }); if (q) steps.push(withId({ ...q, exit: true, title: 'Vé ra cửa: nghe và chọn câu', prompt: 'Nghe câu trong hội thoại, rồi chọn đúng câu bạn vừa nghe — không có Pinyin.' }, `${lid}:exit`)); }
      return steps.filter(Boolean);
    }

    function writeItemId(ch) {
      if (items[ch] && items[ch].kind === 'char') return ch;
      if (items[`c:${ch}`]) return `c:${ch}`;
      return null;
    }

    function speakTips(d) {
      const tips = [];
      if (/不/.test(d.zh) && /bú/i.test(d.py)) tips.push('不 đứng trước thanh 4 thì đọc thành bú.');
      if (/一/.test(d.zh) && /y[íì]/i.test(d.py)) tips.push('一 đổi thanh theo chữ sau: yí trước thanh 4, yì trước thanh 1–3.');
      if (/[zcs]h/.test(d.py)) tips.push('zh / ch / sh: uốn đầu lưỡi lên, đừng đọc thành “gi”, “ch”, “x” của tiếng Việt.');
      if (/(^|[^a-zü])(x|q|j)/i.test(d.py)) tips.push('j / q / x: đầu lưỡi đặt sau răng dưới, môi dẹt; q bật hơi mạnh.');
      if (/[ǎěǐǒǔǚ]/.test(d.py)) tips.push('Thanh 3 hạ thấp; hai thanh 3 liền nhau thì chữ đầu đọc gần như thanh 2.');
      tips.push('Nói chậm, rõ từng từ trước, rồi nói liền cả câu.');
      return tips.slice(0, 3);
    }

    /** Kiểm tra cuối chương: 12 câu trộn từ và câu của chương + 1 câu tự viết. */
    function checkpoint(unit, lessonsMap, { pool = [] } = {}) {
      const rng = Q.mulberry32(hash(unit.id + ':check:' + Date.now()));
      const qb = Q.create(content, { rng });
      const ls = unit.lessonIds.map((id) => lessonsMap[id]).filter(Boolean);
      const wordIds = [...new Set(ls.flatMap((l) => l.words || Object.values(items).filter((i) => i.lesson === l.id).map((i) => i.id)))].filter((id) => items[id] && items[id].kind !== 'sentence');
      const sentIds = Object.keys(items).filter((id) => items[id].kind === 'sentence' && unit.lessonIds.includes(items[id].lesson));
      const p = [...new Set([...pool, ...wordIds, ...sentIds])];
      const qs = [...qb.set(wordIds, ['meaning', 'audio', 'read', 'tone'], 8, { pool: p }), ...qb.set(sentIds, ['meaning', 'audio'], 4, { pool: sentIds })];
      return Q.shuffle(qs, rng).map((q, i) => ({ ...q, id: `${unit.id}:check:${i}:${hash(q.id)}` }));
    }

    /** Thi vượt cấp: 20 câu lấy mẫu từ toàn bộ từ của cấp. */
    function placement(level, { n = 20 } = {}) {
      const rng = Q.mulberry32(hash(`placement:${level}:${Date.now()}`));
      const qb = Q.create(content, { rng });
      const ids = Object.values(items).filter((i) => i.level === level && i.kind !== 'sentence' && i.kind !== 'name' && !i.legacy).map((i) => i.id);
      const sample = Q.shuffle(ids, rng).slice(0, n * 2);
      return qb.set(sample, ['meaning', 'audio', 'read'], n, { pool: ids }).map((q, i) => ({ ...q, id: `placement:${level}:${i}:${hash(q.id)}` }));
    }

    return { stepsFor, storyStep, checkpoint, placement, writeItemId };
  }

  return { create, hash };
});
