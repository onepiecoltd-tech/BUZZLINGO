/* BuzzLingo · kho dữ liệu học tập local-first.
 * Mọi con số hiển thị (XP, streak, độ chính xác, SRS) được tính lại từ attempts và cards thật.
 * Storage được tiêm vào để test bằng Node; trên trình duyệt dùng localStorage. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./srs.js'));
  else (root.Buzz = root.Buzz || {}).Store = factory(root.Buzz.SRS);
})(typeof self !== 'undefined' ? self : this, function (SRS) {
  'use strict';

  const KEY = 'buzzlingo.v1';
  const MAX_ATTEMPTS = 3000;
  const SKILL_GROUPS = { listen: ['audio', 'tone'], speak: ['speak'], read: ['read', 'meaning'], write: ['write'] };

  const emptyState = () => ({ v: 1, profile: null, attempts: [], cards: {}, days: {}, lessons: {}, session: null, sessionAt: 0, updatedAt: 0, owner: null });

  /* Gộp hai bản dữ liệu (máy này + đám mây) mà không mất tiến độ bên nào.
   * Kết quả không phụ thuộc thứ tự và gộp lại lần nữa vẫn ra như cũ, nên các máy luôn hội tụ về cùng một bản. */
  function mergeStates(a, b) {
    a = Object.assign(emptyState(), a || {}); b = Object.assign(emptyState(), b || {});
    const out = emptyState();
    // lượt làm bài: hợp hai danh sách, bỏ trùng
    const seen = new Map();
    [...a.attempts, ...b.attempts].forEach((x) => { const k = `${x.id}|${x.createdAt}|${x.itemId}|${x.skill}`; if (!seen.has(k)) seen.set(k, x); });
    out.attempts = [...seen.values()].sort((x, y) => (x.createdAt - y.createdAt) || String(x.id).localeCompare(String(y.id))).slice(-MAX_ATTEMPTS);
    // thống kê ngày: tính lại từ lượt làm bài; ngày cũ đã bị cắt bớt thì lấy bản nhiều hơn
    const re = {};
    out.attempts.forEach((x) => { const k = dayKey(x.createdAt); const d = re[k] || (re[k] = { xp: 0, attempts: 0, correct: 0 }); d.xp += x.xp | 0; d.attempts += 1; d.correct += x.correct ? 1 : 0; });
    const bigger = (p, q) => (!p ? q : !q ? p : (q.attempts > p.attempts || (q.attempts === p.attempts && q.xp > p.xp)) ? q : p);
    new Set([...Object.keys(a.days), ...Object.keys(b.days), ...Object.keys(re)]).forEach((k) => { out.days[k] = { ...bigger(bigger(a.days[k], b.days[k]), re[k]) }; });
    // thẻ SRS: giữ bản được ôn gần nhất
    const newerCard = (p, q) => { if (!p) return q; if (!q) return p; const d = (q.lastReviewAt || 0) - (p.lastReviewAt || 0); return d > 0 || (d === 0 && ((q.reps || 0) > (p.reps || 0) || ((q.reps || 0) === (p.reps || 0) && (q.dueAt || 0) > (p.dueAt || 0)))) ? q : p; };
    new Set([...Object.keys(a.cards), ...Object.keys(b.cards)]).forEach((k) => { out.cards[k] = newerCard(a.cards[k], b.cards[k]); });
    // bài học: đã xong ở một nơi là xong; lấy điểm cao nhất
    new Set([...Object.keys(a.lessons), ...Object.keys(b.lessons)]).forEach((k) => {
      const p = a.lessons[k], q = b.lessons[k];
      if (!p || !q) { out.lessons[k] = { ...(p || q) }; return; }
      const d = (q.completedAt || 0) - (p.completedAt || 0); const last = d > 0 || (d === 0 && ((q.runs || 0) - (p.runs || 0) || (q.lastScore || 0) - (p.lastScore || 0)) > 0) ? q : p;
      out.lessons[k] = { ...last, status: p.status === 'done' || q.status === 'done' ? 'done' : last.status, runs: Math.max(p.runs || 0, q.runs || 0), bestScore: Math.max(p.bestScore || 0, q.bestScore || 0), completedAt: Math.max(p.completedAt || 0, q.completedAt || 0) };
    });
    // hồ sơ: lấy bản sửa sau cùng, giữ ngày tạo sớm nhất và các cấp đã thi vượt ở cả hai nơi
    if (!a.profile || !b.profile) out.profile = a.profile || b.profile ? { ...(a.profile || b.profile) } : null;
    else {
      const ta = a.profile.updatedAt || a.profile.createdAt || 0, tb = b.profile.updatedAt || b.profile.createdAt || 0;
      const bNewer = tb !== ta ? tb > ta : JSON.stringify(b.profile) > JSON.stringify(a.profile); // hoà thì chọn cố định để kết quả không phụ thuộc thứ tự
      const [old, neu] = bNewer ? [a.profile, b.profile] : [b.profile, a.profile];
      out.profile = { ...old, ...neu, createdAt: Math.min(a.profile.createdAt || Infinity, b.profile.createdAt || Infinity) || neu.createdAt };
      if (old.placed || neu.placed) out.profile.placed = Object.assign({}, old.placed, neu.placed);
    }
    // bài đang dở: bên nào cập nhật sau thì đúng (kể cả khi bên đó đã xoá vì học xong)
    const sb = (b.sessionAt || 0) > (a.sessionAt || 0);
    out.session = sb ? b.session : a.session; out.sessionAt = Math.max(a.sessionAt || 0, b.sessionAt || 0);
    out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
    out.owner = a.owner || b.owner || null;
    return out;
  }

  function dayKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function createStore({ storage = null, now = () => Date.now(), idMap = null } = {}) {
    let state = emptyState();
    let persistent = false;
    const listeners = new Set();

    function load() {
      try {
        if (!storage) throw new Error('no storage');
        storage.setItem('__buzz_probe', '1');
        storage.removeItem('__buzz_probe');
        persistent = true;
        const raw = storage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.v === 1) state = Object.assign(emptyState(), parsed);
        }
        if (idMap && migrate(state, idMap)) storage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        persistent = false;
      }
    }

    /** Đổi mã mục cũ sang mã mới (ví dụ 'ni' → '你') trong attempts và thẻ SRS. Trả true nếu có thay đổi. */
    function migrate(st, map) {
      let changed = false;
      st.attempts.forEach((a) => { if (map[a.itemId]) { a.itemId = map[a.itemId]; changed = true; } });
      for (const [key, card] of Object.entries(st.cards)) {
        const [id, skill] = key.split(':');
        if (!map[id]) continue;
        const nk = `${map[id]}:${skill}`;
        delete st.cards[key];
        if (!st.cards[nk]) st.cards[nk] = { ...card, key: nk, itemId: map[id] };
        changed = true;
      }
      return changed;
    }

    function save(meta = {}) {
      if (!meta.keepTime) state.updatedAt = now();
      listeners.forEach((fn) => { try { fn(meta); } catch (e) { /* bỏ qua lỗi UI */ } });
      if (!persistent) return false;
      try { storage.setItem(KEY, JSON.stringify(state)); return true; }
      catch (e) { persistent = false; return false; }
    }

    load();

    const api = {
      get state() { return state; },
      isPersistent: () => persistent,
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

      setProfile(profile) { state.profile = { ...(state.profile || {}), ...profile, createdAt: (state.profile && state.profile.createdAt) || now(), updatedAt: now() }; save(); },

      /** Ghi một lượt làm bài thật. xp chỉ được cộng ở đây. */
      recordAttempt(a) {
        const t = now();
        const attempt = {
          id: `${t}-${state.attempts.length}`,
          createdAt: t,
          itemId: a.itemId, skill: a.skill, stepId: a.stepId || null, lessonId: a.lessonId || null,
          mode: a.mode || 'lesson', correct: !!a.correct, grade: a.grade || null,
          hintLevel: a.hintLevel || 0, responseMs: a.responseMs || null, verified: a.verified !== false,
          retry: !!a.retry, degraded: !!a.degraded, stage: a.stage || null, xp: Math.max(0, a.xp | 0), answer: a.answer == null ? null : String(a.answer),
        };
        state.attempts.push(attempt);
        if (state.attempts.length > MAX_ATTEMPTS) state.attempts.splice(0, state.attempts.length - MAX_ATTEMPTS);
        const k = dayKey(t);
        const day = state.days[k] || { xp: 0, attempts: 0, correct: 0 };
        day.xp += attempt.xp; day.attempts += 1; day.correct += attempt.correct ? 1 : 0;
        state.days[k] = day;
        save();
        return attempt;
      },

      /** Cập nhật lịch SRS. Điểm tốt chỉ áp dụng khi thẻ mới hoặc đã đến hạn; điểm 'Lại' luôn áp dụng. */
      gradeCard(itemId, skill, grade, { deferToTomorrow = false } = {}) {
        const t = now();
        const key = `${itemId}:${skill}`;
        const card = state.cards[key] || SRS.newCard(itemId, skill, t);
        if (grade > 1 && !SRS.isDue(card, t)) return { applied: false, card };
        const next = SRS.review(card, grade, t);
        if (grade === 1 && deferToTomorrow) next.dueAt = Math.max(next.dueAt, SRS.startOfNextDay(t));
        state.cards[key] = next;
        save();
        return { applied: true, card: next };
      },

      getCard: (itemId, skill) => state.cards[`${itemId}:${skill}`] || null,
      allCards: () => Object.values(state.cards),
      dueCards(ts = now()) { return Object.values(state.cards).filter((c) => c.dueAt <= ts).sort((a, b) => a.dueAt - b.dueAt); },
      dueTomorrowCount(ts = now()) { const end = SRS.startOfNextDay(ts) + SRS.DAY; return Object.values(state.cards).filter((c) => c.dueAt > ts && c.dueAt < end).length; },

      setSession(session) { state.session = session; state.sessionAt = now(); save(); },
      clearSession() { state.session = null; state.sessionAt = now(); save(); },
      completeLesson(lessonId, summary) {
        const prev = state.lessons[lessonId] || {};
        state.lessons[lessonId] = {
          status: 'done', completedAt: now(), runs: (prev.runs || 0) + 1,
          bestScore: Math.max(prev.bestScore || 0, summary.score), lastScore: summary.score, total: summary.total,
        };
        save();
      },

      stats(ts = now()) {
        const attempts = state.attempts;
        const totalXp = attempts.reduce((s, a) => s + a.xp, 0);
        const today = state.days[dayKey(ts)] || { xp: 0, attempts: 0, correct: 0 };
        // streak: chuỗi ngày liên tiếp có ít nhất một attempt, tính tới hôm nay (hoặc hôm qua nếu hôm nay chưa học)
        let streak = 0;
        let cursor = ts;
        if (!state.days[dayKey(cursor)]) cursor -= SRS.DAY;
        while (state.days[dayKey(cursor)] && state.days[dayKey(cursor)].attempts > 0) { streak++; cursor -= SRS.DAY; }
        let weekDays = 0;
        for (let i = 0; i < 7; i++) if (state.days[dayKey(ts - i * SRS.DAY)]) weekDays++;
        // độ chính xác theo kỹ năng: 20 attempt hợp lệ gần nhất (bỏ qua tự đánh giá và thiết bị không phát được âm)
        const skills = {};
        for (const [group, keys] of Object.entries(SKILL_GROUPS)) {
          const own = attempts.filter((a) => keys.includes(a.skill) && a.verified && !a.degraded && (a.stage == null || a.stage === 'memory')).slice(-20);
          skills[group] = { n: own.length, accuracy: own.length >= 3 ? Math.round((own.filter((a) => a.correct).length / own.length) * 100) : null };
        }
        const selfAssessed = attempts.filter((a) => a.skill === 'speak' && !a.verified).length;
        const itemsSeen = new Set(attempts.map((a) => a.itemId)).size;
        const rs = Object.values(state.cards).map((c) => SRS.currentRetrievability(c, ts)).filter((r) => r != null);
        const retention = rs.length ? Math.round((rs.reduce((s, r) => s + r, 0) / rs.length) * 100) : null;
        return { totalXp, today, streak, weekDays, skills, selfAssessed, itemsSeen, retention, cards: Object.keys(state.cards).length, attempts: attempts.length };
      },

      /** Gộp dữ liệu từ đám mây vào máy này (meta.source = 'cloud' để bộ đồng bộ không tự kích hoạt lại). */
      mergeIn(remote, meta = { source: 'cloud' }) {
        const before = JSON.stringify(state);
        const merged = mergeStates(state, remote);
        merged.owner = state.owner || merged.owner;
        state = merged;
        const changed = JSON.stringify(state) !== before;
        if (changed) save({ ...meta, keepTime: true });
        return changed;
      },
      /** Thay toàn bộ dữ liệu (dùng khi dữ liệu trên máy là của tài khoản khác). */
      replaceState(next, meta = { source: 'cloud' }) { state = Object.assign(emptyState(), next || {}); save({ ...meta, keepTime: true }); },
      setOwner(uid) { state.owner = uid || null; save({ source: 'cloud', keepTime: true }); },

      exportJSON: () => JSON.stringify({ exportedAt: new Date(now()).toISOString(), app: 'BuzzLingo', data: state }, null, 2),
      reset() { state = emptyState(); if (persistent) { try { storage.removeItem(KEY); } catch (e) { /* bỏ qua */ } } listeners.forEach((fn) => fn()); },
    };
    return api;
  }

  return { createStore, mergeStates, emptyState, dayKey, SKILL_GROUPS, KEY };
});
