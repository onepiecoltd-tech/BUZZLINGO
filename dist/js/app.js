/* BuzzLingo · điều phối ứng dụng: điều hướng, màn hình, runner bài học/luyện/ôn tập, onboarding. */
(function () {
  'use strict';
  const B = window.Buzz, C = B.Content, SRS = B.SRS, R = B.Render, { esc, zhAttr, $ } = B.U;
  const store = B.Store.createStore({ storage: (() => { try { return window.localStorage; } catch (e) { return null; } })(), idMap: C.legacyIds });
  /* ---------- gói nội dung HSK: gộp vào C, dựng thứ tự bài toàn khoá ---------- */
  const LEVELS = [1, 2, 3, 4, 5, 6], MAX_LEVEL = LEVELS[LEVELS.length - 1];
  // số từ chuẩn HSK 3.0 mỗi cấp: hiện đúng tổng ngay cả khi gói cấp đó chưa tải
  const LEVEL_WORDS = { 1: 500, 2: 772, 3: 973, 4: 1000, 5: 1071, 6: 1140 };
  const loadedLevels = new Set();
  function mergePack(pack) {
    if (loadedLevels.has(pack.level)) return;
    loadedLevels.add(pack.level);
    for (const [id, it] of Object.entries(pack.items)) C.items[id] = Object.assign({}, it, C.items[id] || {});
    for (const [id, l] of Object.entries(pack.lessons)) C.lessons[id] = Object.assign({ generated: true }, l);
    C.hskUnits = (C.hskUnits || []).filter((u) => u.level !== pack.level).concat(pack.units).sort((a, b) => a.level - b.level);
    C.levelWords = Object.assign(C.levelWords || {}, { [pack.level]: pack.words });
    const order = C.hskUnits.flatMap((u) => u.lessonIds);
    C.lessonOrder = order.filter((id, i) => C.lessons[id] && order.indexOf(id) === i);
    Object.values(C.lessons).forEach((l) => { if (!l.level) l.level = 1; });
    if (pack.storyAssets) B.storyAssets = new Set([...(B.storyAssets || []), ...pack.storyAssets]);
    // truyện cho các bài viết tay (bài 1–3): gắn vào bài và chèn bước mở cảnh lên đầu
    for (const [id, story] of Object.entries(pack.stories || {})) {
      const L = C.lessons[id]; if (!L || L.generated) continue;
      L.story = story;
      const st = B.LessonGen.create(C).storyStep(L);
      C.stepById[st.id] = st;
      if (!L.stepIds.includes(st.id)) L.stepIds = [st.id, ...L.stepIds];
    }
  }
  (window.BuzzPacks || []).forEach(mergePack);
  window.BuzzPacks = { push: (p) => mergePack(p) }; // gói nạp sau cũng được gộp ngay
  const pending = {};
  function ensurePack(level) {
    if (loadedLevels.has(level)) return Promise.resolve(true);
    if (pending[level]) return pending[level];
    return (pending[level] = new Promise((resolve) => {
      const sc = document.createElement('script');
      sc.src = `content/hsk${level}.js`;
      sc.onload = () => resolve(loadedLevels.has(level));
      sc.onerror = () => { delete pending[level]; resolve(false); };
      document.head.appendChild(sc);
    }));
  }
  // cấp cần có ngay khi mở app: đã học bài của cấp đó, có thẻ ôn tập thuộc cấp đó, hoặc vừa thi vượt cấp trước
  function neededLevels() {
    const s = store.state, need = new Set();
    Object.keys(s.lessons || {}).forEach((id) => { const m = /^h(\d)-/.exec(id); if (m) need.add(+m[1]); });
    Object.values(s.cards || {}).forEach((c) => { if (c && c.itemId && !C.items[c.itemId]) LEVELS.forEach((lv) => need.add(lv)); });
    Object.keys((s.profile && s.profile.placed) || {}).forEach((lv) => need.add(Math.min(MAX_LEVEL, +lv + 1)));
    return [...need].filter((lv) => LEVELS.includes(lv) && !loadedLevels.has(lv));
  }
  const QB = B.QBank.create(C);
  const LG = B.LessonGen.create(C);
  B.store = store;
  /* đồng bộ đám mây (Supabase) — chỉ bật khi config.js có supabaseUrl + khoá công khai */
  const CFG = window.BuzzConfig || {};
  const cloud = B.Cloud ? B.Cloud.createCloud({ url: CFG.supabaseUrl, anonKey: CFG.supabaseAnonKey, store, storage: (() => { try { return window.localStorage; } catch (e) { return null; } })() }) : null;
  const cloudOn = !!(cloud && cloud.configured);
  B.cloud = cloud;
  // xin trình duyệt giữ dữ liệu lâu dài (Safari/Chrome có thể đồng ý với app đã thêm ra Màn hình chính)
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* bỏ qua */ }
  B.debug = { get run() { return run; }, get step() { return curStep; } }; // chỉ để kiểm thử tự động

  const GOALS = { 5: 8, 10: 16, 15: 24 }; // số lượt làm bài mỗi ngày theo thời lượng chọn
  const shell = $('.shell'), bottomNav = $('.bottom-nav');
  const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const CHOICE_SKILLS = ['audio', 'tone', 'meaning', 'read'];
  const stepLesson = {};
  Object.values(C.lessons).forEach((l) => (l.stepIds || []).forEach((sid) => (stepLesson[sid] = l.id)));
  const generated = new Map(); // câu hỏi sinh tự động trong phiên: id → step

  /* ---------- tiện ích ---------- */
  let toastTimer;
  function toast(t) {
    const el = $('#toast'); el.textContent = t; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }
  const announce = (t) => { const el = $('#live'); el.textContent = ''; setTimeout(() => (el.textContent = t), 30); };
  const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
  const profile = () => store.state.profile || {};
  const goalAttempts = () => GOALS[profile().minutes] || GOALS[10];
  const itemLabel = (c) => { const it = C.items[c.itemId]; return `<span lang="zh-Hans">${esc(it.hanzi)}</span> · ${esc(C.skillLabels[c.skill] || c.skill)}`; };
  const shuffle = (a) => B.QBank.shuffle(a, Math.random);

  /* ---------- tiến trình bài học ---------- */
  const lessonDone = (id) => !!(store.state.lessons[id] && store.state.lessons[id].status === 'done');
  const levelOf = (lessonId) => (C.lessons[lessonId] && C.lessons[lessonId].level) || 1;
  const levelLessons = (lv) => C.lessonOrder.filter((id) => levelOf(id) === lv);
  const placed = (lv) => !!(profile().placed && profile().placed[lv]);
  const levelDone = (lv) => { const ls = levelLessons(lv); return ls.length > 0 && ls.every(lessonDone); };
  /** Cấp mở khi: cấp 1, hoặc xong / thi vượt cấp trước đó. */
  const levelOpen = (lv) => lv <= 1 || placed(lv - 1) || levelDone(lv - 1) || placed(lv);
  function isUnlocked(id) {
    const lv = levelOf(id);
    if (!levelOpen(lv)) return false;
    if (placed(lv)) return true;
    if (lv === 1 && profile().level === 'some') return true; // người đã biết một ít: mở hết HSK 1 để tự chọn
    const i = C.lessonOrder.indexOf(id);
    if (i <= 0) return true;
    const prev = C.lessonOrder[i - 1];
    return lessonDone(prev) || levelOf(prev) !== lv;
  }
  /** Bài nên học tiếp: bài đang dở, rồi bài đầu tiên chưa xong đã mở khoá. null nếu đã xong hết. */
  function nextLessonId() {
    const sess = store.state.session;
    if (sess && C.lessons[sess.lessonId]) return sess.lessonId;
    const open = (id) => !lessonDone(id) && isUnlocked(id);
    // đã thi vượt cấp thì đề xuất bài của cấp chưa vượt trước (vẫn mở lại được bài cũ ở Lộ trình)
    return C.lessonOrder.find((id) => open(id) && !placed(levelOf(id))) || C.lessonOrder.find(open) || null;
  }
  const lessonIntro = (l) => l.intro || `Từ mới: <b lang="zh-Hans">${l.words.slice(0, 6).map((id) => esc(C.items[id] ? C.items[id].hanzi : id)).join(' · ')}</b>${l.words.length > 6 ? ' …' : ''}${l.grammar ? `<br>Ngữ pháp: ${esc(l.grammar.title)}` : ''}`;
  /** Các mục người học đã gặp: thuộc bài đã xong, bài đang học, hoặc đã có lượt làm. Rỗng → mục của bài 1. */
  function learnedPool() {
    const active = new Set(C.lessonOrder.filter(lessonDone));
    if (run && run.lessonId) active.add(run.lessonId);
    if (store.state.session) active.add(store.state.session.lessonId);
    const seen = new Set(store.state.attempts.map((a) => a.itemId));
    const ids = Object.values(C.items).filter((it) => (active.has(it.lesson) || seen.has(it.id)) && it.kind !== 'name').map((it) => it.id);
    return ids.length ? ids : Object.values(C.items).filter((it) => it.lesson === C.lessonOrder[0]).map((it) => it.id);
  }
  B.knownItems = () => learnedPool().map((id) => C.items[id]);

  /* ---------- điều hướng ---------- */
  const screens = [...document.querySelectorAll('.screen')];
  const navBtns = [...document.querySelectorAll('[data-screen]')];
  function show(id, { focus = true, push = true } = {}) {
    if (!document.getElementById(id)) id = 'home';
    screens.forEach((s) => s.classList.toggle('active', s.id === id));
    const navId = id === 'blueprint' ? 'me' : id;
    navBtns.forEach((n) => { const on = n.dataset.screen === navId; n.classList.toggle('active', on); if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current'); });
    if (push) history.replaceState(null, '', `#${id}`);
    refresh();
    if (focus) { window.scrollTo({ top: 0 }); const h = $(`#${id} h1, #${id} h2`); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
  }
  navBtns.forEach((n) => (n.onclick = () => show(n.dataset.screen)));
  document.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) show(g.dataset.go); });

  /* ---------- các màn hình ---------- */
  function renderChrome() {
    const st = store.stats(), now = new Date();
    $('#today').textContent = `${WEEKDAYS[now.getDay()]} · ${now.getDate()} tháng ${now.getMonth() + 1}`;
    $('#greet').textContent = `Nǐ hǎo, ${profile().name || 'bạn'}! 👋`;
    $('#pillStreak').textContent = `🔥 ${st.streak} ngày`;
    $('#pillXp').textContent = `💎 ${st.totalXp} XP`;
    $('#weekText').textContent = `${Math.min(st.weekDays, 5)} / 5 ngày`;
    $('#weekBar').style.width = `${pct(st.weekDays, 5)}%`;
    $('#banner').hidden = store.isPersistent();
  }

  function renderHome() {
    $('#chatBtn').hidden = !(B.Coach && B.Coach.enabled());
    const st = store.stats(), sess = store.state.session;
    const nextId = nextLessonId(), lesson = nextId && C.lessons[nextId];
    const doneCount = C.lessonOrder.filter(lessonDone).length;
    let eyebrow, h2, p, cta;
    if (sess && lesson && sess.lessonId === nextId) {
      eyebrow = `Bài ${lesson.n} · đang học dở · câu ${Math.min(sess.index + 1, sess.queue.length)}/${sess.queue.length}`; h2 = lesson.title; p = 'Bạn đã dừng giữa chừng. Mình giữ nguyên vị trí và kết quả các câu đã làm.'; cta = 'Tiếp tục bài →';
    } else if (lesson) {
      eyebrow = `HSK ${levelOf(nextId)} · Bài ${lesson.n} · ${lesson.minutes} phút${doneCount ? ` · đã xong ${doneCount}/${C.lessonOrder.length}` : ''}`; h2 = lesson.title; p = lessonIntro(lesson); cta = st.attempts ? `Bắt đầu bài ${lesson.n} →` : 'Học ngay →';
    } else {
      eyebrow = `Đã hoàn thành ${doneCount}/${C.lessonOrder.length} bài`; h2 = 'Luyện tổng hợp'; p = 'Các bài tiếp theo đang được soạn. Trong lúc chờ, luyện trộn mọi kỹ năng — câu hỏi được sinh mới mỗi lần.'; cta = 'Luyện tổng hợp →';
    }
    $('#heroEyebrow').textContent = eyebrow; $('#heroTitle').textContent = h2; $('#heroText').innerHTML = p; $('#heroCta').textContent = cta;
    const goal = goalAttempts(), td = st.today.attempts;
    $('#goalText').textContent = `${Math.min(td, goal)} / ${goal} câu`;
    $('#goalBar').style.width = `${pct(td, goal)}%`;
    $('#goalBar').parentElement.setAttribute('aria-valuenow', pct(td, goal));
    const due = store.dueCards(), cards = store.allCards().length, rc = $('#reviewCard');
    if (!cards) {
      rc.innerHTML = '<div class="ring" style="--p:0"><span>—</span></div><div class="grow"><b>Chưa có thẻ ôn</b><small>Hoàn thành bài 1 để BuzzLingo bắt đầu lên lịch ôn cho bạn.</small></div>';
    } else {
      rc.innerHTML = `<div class="ring" style="--p:${st.retention || 0}" role="img" aria-label="Độ nhớ ước tính ${st.retention == null ? 'chưa có' : st.retention + '%'}"><span>${st.retention == null ? '—' : st.retention + '%'}</span></div><div class="grow"><b>${due.length ? `${due.length} thẻ đến hạn` : 'Chưa có thẻ nào đến hạn'}</b><small>${due.length ? due.slice(0, 3).map(itemLabel).join(' · ') : `Mai có ${store.dueTomorrowCount()} thẻ cần ôn`}</small></div><button class="secondary" data-go="review">${due.length ? 'Ôn' : 'Xem lịch'}</button>`;
    }
  }

  let pathLevel = null; const openUnits = new Set();
  const wordsSeen = (lv) => { const seen = new Set(store.state.attempts.map((a) => a.itemId)); store.allCards().forEach((c) => seen.add(c.itemId)); return Object.values(C.items).filter((it) => it.level === lv && it.kind !== 'sentence' && it.kind !== 'name' && !/^c:/.test(it.id) && seen.has(it.id)).length; };
  function renderPath() {
    const sess = store.state.session, ls = store.state.lessons;
    const nextId = nextLessonId();
    if (!pathLevel) pathLevel = nextId ? levelOf(nextId) : 1;
    $('#levelTabs').innerHTML = LEVELS.map((lv) => `<button role="tab" type="button" data-lv="${lv}" aria-selected="${lv === pathLevel}" class="${lv === pathLevel ? 'on' : ''}">HSK ${lv}${levelDone(lv) ? ' ✓' : !levelOpen(lv) ? ' 🔒' : ''}</button>`).join('');
    document.querySelectorAll('[data-lv]').forEach((b) => (b.onclick = () => { pathLevel = +b.dataset.lv; ensurePack(pathLevel).then(renderPath); renderPath(); }));
    const lv = pathLevel;
    const units = (C.hskUnits || []).filter((u) => u.level === lv);
    const head = $('#levelHead');
    if (!units.length) {
      head.innerHTML = `<div class="level-card"><b>HSK ${lv}</b><p class="hint">${loadedLevels.has(lv) ? 'Cấp này đang được soạn.' : 'Đang tải nội dung…'}</p></div>`;
      $('#units').innerHTML = '';
      return;
    }
    const lessons = levelLessons(lv), done = lessons.filter(lessonDone).length, total = C.levelWords[lv] || LEVEL_WORDS[lv] || 0, seen = wordsSeen(lv);
    head.innerHTML = `<div class="level-card"><div class="lc-row"><div><b>HSK ${lv}</b> <small>${done}/${lessons.length} bài · ${seen}/${total} từ đã gặp</small></div>${!levelDone(lv) && !placed(lv) && levelOpen(lv) ? `<button class="secondary sm" id="placeBtn" type="button">Thi vượt cấp</button>` : placed(lv) ? '<span class="tag">Đã thi vượt cấp</span>' : ''}</div>
      <div class="meterbar"><i style="width:${pct(done, lessons.length)}%"></i></div>${!levelOpen(lv) ? `<p class="hint">Học xong HSK ${lv - 1} hoặc thi vượt cấp HSK ${lv - 1} để mở cấp này.</p>` : ''}</div>`;
    const pb = $('#placeBtn'); if (pb) pb.onclick = () => startPlacement(lv);
    const nextUnit = units.find((u) => u.lessonIds.includes(nextId));
    if (nextUnit && !openUnits.size) openUnits.add(nextUnit.id);
    $('#units').innerHTML = units.map((u) => {
      const ids = u.lessonIds.filter((id) => C.lessons[id]);
      const ud = ids.filter(lessonDone).length, open = openUnits.has(u.id);
      const chk = ls[`${u.id}:check`];
      const allDone = ud === ids.length;
      const rows = ids.map((id) => {
        const L = C.lessons[id], d = lessonDone(id), unlocked = isUnlocked(id), cur = id === nextId;
        const st = d ? '✓' : unlocked ? (cur ? '▶' : '○') : '🔒';
        const tag = d ? `${ls[id].bestScore}/${ls[id].total}` : sess && sess.lessonId === id ? 'đang dở' : `${L.minutes} phút`;
        return `<li class="${d ? 'done' : ''} ${cur ? 'cur' : ''} ${unlocked ? '' : 'locked'}"><button type="button" data-lesson="${id}" ${unlocked ? '' : 'aria-disabled="true"'}><span class="st" aria-hidden="true">${st}</span><span class="lt"><small>Bài ${L.n}</small>${esc(L.title)}</span><span class="tag">${tag}</span></button></li>`;
      }).join('');
      return `<section class="unit-card ${allDone ? 'done' : ''}"><button class="unit-h" type="button" data-unit="${u.id}" aria-expanded="${open}"><span class="un">${allDone ? '✓' : ''}</span><span class="ut">${u.story ? `<span class="ep-tag">🎬 Tập ${u.story.ep} · ${esc(u.story.title)}</span>` : ''}<b>${esc(u.title)}</b><small>${esc(u.goal || '')}</small></span><span class="up">${ud}/${ids.length}</span></button>
        <div class="unit-body" ${open ? '' : 'hidden'}><ol class="lesson-rows">${rows}</ol>
        <button class="check-row" type="button" data-check="${u.id}" ${ud ? '' : 'aria-disabled="true"'}>🏁 Kiểm tra chương${chk ? ` · đạt ${chk.bestScore}/${chk.total}` : ud ? '' : ' (học ít nhất một bài trước)'}</button></div></section>`;
    }).join('');
    document.querySelectorAll('[data-unit]').forEach((b) => (b.onclick = () => { const id = b.dataset.unit; openUnits.has(id) ? openUnits.delete(id) : openUnits.add(id); renderPath(); }));
    document.querySelectorAll('[data-lesson]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.lesson;
      if (!isUnlocked(id)) { const L = C.lessons[id]; return toast(levelOpen(levelOf(id)) ? `Học xong bài trước để mở Bài ${L.n}.` : `Học xong HSK ${levelOf(id) - 1} hoặc thi vượt cấp để mở.`); }
      startLesson(id);
    }));
    document.querySelectorAll('[data-check]').forEach((b) => (b.onclick = () => {
      const u = units.find((x) => x.id === b.dataset.check);
      if (!u.lessonIds.some(lessonDone)) return toast('Học ít nhất một bài của chương trước khi kiểm tra.');
      startCheckpoint(u);
    }));
  }

  const dueLabel = (c, now) => {
    if (c.dueAt <= now) return 'Đến hạn';
    const eod = SRS.startOfNextDay(now);
    if (c.dueAt < eod) return 'Hôm nay';
    if (c.dueAt < eod + SRS.DAY) return 'Ngày mai';
    return `Sau ${SRS.formatSpan(c.dueAt - now)}`;
  };

  /** Các cặp item×kỹ năng hay sai: sai trong 60 lượt kiểm tra gần nhất, hoặc thẻ đã quên ít nhất một lần. */
  function mistakePairs() {
    const recent = store.state.attempts.filter((a) => a.verified && CHOICE_SKILLS.includes(a.skill)).slice(-60);
    const last = new Map();
    recent.forEach((a) => last.set(`${a.itemId}:${a.skill}`, a));
    const keys = new Set([...last.entries()].filter(([, a]) => !a.correct).map(([k]) => k));
    store.allCards().filter((c) => c.lapses > 0 && CHOICE_SKILLS.includes(c.skill)).forEach((c) => keys.add(c.key));
    recent.filter((a) => !a.correct).forEach((a) => keys.add(`${a.itemId}:${a.skill}`));
    return [...keys].map((k) => k.split(':')).filter(([id]) => C.items[id]);
  }

  function renderReview() {
    const now = Date.now(), cards = store.allCards().sort((a, b) => a.dueAt - b.dueAt), due = store.dueCards(now);
    const box = $('#reviewBody');
    if (!cards.length) {
      box.innerHTML = '<div class="empty"><img src="assets/bap-avatar-128.webp" srcset="assets/bap-avatar-128.webp 1x, assets/bap-avatar-256.webp 2x" width="64" height="64" alt=""><h3>Chưa có thẻ nào để ôn</h3><p>Mỗi mục bạn làm trong bài học sẽ tạo một thẻ riêng cho từng kỹ năng. Câu sai được xếp ôn vào ngày hôm sau.</p><button class="primary" data-go="path">Tới lộ trình →</button></div>';
      return;
    }
    const mist = mistakePairs().length;
    box.innerHTML = `<div class="due-card"><div><strong>${due.length}</strong><small>thẻ đến hạn</small></div><button class="primary" id="startReview" ${due.length ? '' : 'disabled'}>${due.length ? `Ôn ${Math.min(due.length, 20)} thẻ →` : 'Chưa có thẻ đến hạn'}</button></div>
      ${mist ? `<div class="mistake-card"><div><b>Luyện câu hay sai</b><small>${mist} mục bạn từng làm sai · câu hỏi mới mỗi lần, không ảnh hưởng lịch ôn</small></div><button class="secondary" id="startMistakes">Luyện →</button></div>` : ''}
      <div class="section-head"><h3>Lịch ôn của bạn</h3></div>
      <ul class="sched">${cards.map((c) => { const r = SRS.currentRetrievability(c, now); return `<li><span class="sk">${itemLabel(c)}</span><span class="when ${c.dueAt <= now ? 'due' : ''}">${dueLabel(c, now)}</span><span class="rr" title="Xác suất nhớ ước tính">${r == null ? '—' : Math.round(r * 100) + '%'}</span></li>`; }).join('')}</ul>
      <p class="hint">Mỗi kỹ năng của mỗi mục có lịch riêng (thuật toán FSRS). Khi ôn, bạn trả lời câu hỏi được sinh mới từ chính mục đó, nên lịch dựa trên kết quả kiểm tra thật.</p>`;
    const sb = $('#startReview'); if (sb) sb.onclick = () => startReview(sb);
    const mb = $('#startMistakes'); if (mb) mb.onclick = () => startRoom('mistakes');
  }

  function renderProgress() {
    const st = store.stats();
    $('#pXp').textContent = st.totalXp; $('#pStreak').textContent = st.streak;
    const lvTotal = LEVELS.reduce((n, lv) => n + (C.levelWords[lv] || LEVEL_WORDS[lv] || 0), 0), lvSeen = LEVELS.reduce((n, lv) => n + wordsSeen(lv), 0);
    $('#pItems').textContent = `${lvSeen}/${lvTotal || '—'}`;
    $('#levelProgress').innerHTML = LEVELS.map((lv) => { const tot = C.levelWords[lv] || LEVEL_WORDS[lv]; const ls = levelLessons(lv); const d = ls.filter(lessonDone).length;
      return `<div class="skillrow"><div class="skillhead"><b>HSK ${lv}</b><span>${tot ? `${wordsSeen(lv)}/${tot} từ` : 'đang soạn'}</span></div><div class="meterbar"><i style="width:${tot ? pct(wordsSeen(lv), tot) : 0}%;background:var(--teal)"></i></div><small>${ls.length ? `${d}/${ls.length} bài${placed(lv) ? ' · đã thi vượt cấp' : ''}` : levelOpen(lv) ? 'Mở tab HSK ' + lv + ' ở Lộ trình để bắt đầu' : 'Mở khi xong hoặc thi vượt HSK ' + (lv - 1)}</small></div>`; }).join('');
    $('#pRet').textContent = st.retention == null ? '—' : `${st.retention}%`;
    const names = { listen: ['Nghe', 'var(--teal)'], speak: ['Nói', 'var(--coral)'], read: ['Đọc', 'var(--blue)'], write: ['Viết', '#9b6bc7'] };
    $('#skillBars').innerHTML = Object.entries(names).map(([k, [label, color]]) => {
      const s = st.skills[k];
      let note = s.accuracy == null ? `Chưa đủ dữ liệu (${s.n}/3 lượt)` : `${s.accuracy}% đúng · ${s.n} lượt gần nhất`;
      if (k === 'speak') note = st.selfAssessed ? `${st.selfAssessed} lượt tự đánh giá · chưa chấm tự động` : 'Chưa có lượt nào · hiện là tự đánh giá';
      return `<div class="skillrow"><div class="skillhead"><b>${label}</b><span>${k === 'speak' || s.accuracy == null ? '—' : s.accuracy + '%'}</span></div><div class="meterbar" role="img" aria-label="${label}: ${note}"><i style="width:${k === 'speak' ? 0 : s.accuracy || 0}%;background:${color}"></i></div><small>${note}</small></div>`;
    }).join('');
    const produced = store.state.attempts.filter((a) => a.skill === 'produce');
    $('#produceNote').textContent = produced.length ? `Tự đặt câu: ${produced.length} lượt, ${produced.filter((a) => a.correct).length} lượt đạt yêu cầu (kiểm tra theo luật, không tính vào phần trăm).` : '';
    const now = Date.now();
    const weak = store.allCards().map((c) => ({ c, r: SRS.currentRetrievability(c, now), lapses: c.lapses })).filter((x) => x.r != null).sort((a, b) => (b.lapses - a.lapses) || (a.r - b.r)).slice(0, 4);
    $('#weakList').innerHTML = weak.length ? weak.map(({ c, r }) => `<li><span>${itemLabel(c)}</span><span class="rr">${Math.round(r * 100)}% nhớ${c.lapses ? ` · quên ${c.lapses} lần` : ''}</span></li>`).join('') : '<li class="muted">Chưa có dữ liệu. Làm một bài để thấy mục nào cần ôn.</li>';
    const wrong = store.state.attempts.filter((a) => !a.correct && a.verified).slice(-5).reverse();
    $('#wrongList').innerHTML = wrong.length ? wrong.map((a) => { const s = C.stepById[a.stepId]; return `<li><span>${s ? esc(s.title) : itemLabel(a)}</span><span class="rr">${new Date(a.createdAt).toLocaleDateString('vi-VN')}</span></li>`; }).join('') : '<li class="muted">Chưa có lỗi nào được ghi.</li>';
  }

  function renderProfile() {
    const p = profile(), f = $('#profileForm');
    if (document.activeElement && f.contains(document.activeElement)) return; // không ghi đè lúc đang gõ
    f.name.value = p.name || ''; f.minutes.value = String(p.minutes || 10); f.goal.value = p.goal || 'talk';
    const hasAi = !!(B.Coach && B.Coach.endpoint());
    f.coach.checked = !!p.coachConsent && hasAi; f.coach.disabled = !hasAi;
    $('#coachState').textContent = hasAi ? 'Mặc định tắt. Khi bật, câu hỏi và câu tự viết bạn gõ cho Bắp/Blu được gửi tới máy chủ AI để trả lời. AI chỉ giải thích, không chấm điểm.' : 'Trợ lý AI chưa được cấu hình cho bản này.';
    const cs = cloudOn ? cloud.status() : null;
    $('#storageState').innerHTML = cs && cs.signedIn
      ? `✓ Tiến độ được lưu trên thiết bị này và trong tài khoản <b>${esc(cs.email)}</b>.`
      : store.isPersistent()
        ? `✓ Tiến độ được lưu trên thiết bị này (trình duyệt). Chưa đồng bộ lên tài khoản nào.${cloudOn ? ' Lưu ý: Safari có thể tự xoá dữ liệu nếu bạn không mở app trong 7 ngày, hãy đăng nhập ở trên để giữ tiến độ.' : ''}`
        : '⚠ Trình duyệt đang chặn lưu trữ nên tiến độ chỉ tồn tại trong phiên này.';
    renderCloud();
  }

  function refresh() { renderChrome(); renderHome(); renderPath(); renderReview(); renderProgress(); renderProfile(); }
  store.subscribe(() => { if (!run) refresh(); });

  /* ---------- runner: bài học, luyện nhanh, ôn tập ---------- */
  let run = null, curStep = null;
  const lessonEl = $('#lesson'), stage = $('#lessonStage'), footerEl = $('.lesson-footer'), btn = $('#lessonBtn'), bar = $('#lessonBar');
  let disposers = [], curUi = null;

  const remember = (q) => { generated.set(q.id, q); return { sid: q.id }; };
  function ownStep(itemId, skill) {
    const it = C.items[itemId];
    if (skill === 'write' && it) { const legacy = C.steps.find((s) => s.type === 'write' && s.itemId === itemId); return legacy || { id: `w:${itemId}`, type: 'write', itemId, skill: 'write', coach: 'bap', title: `Viết chữ ${it.hanzi}`, char: it.hanzi }; }
    if (it && it.lesson && C.lessons[it.lesson] && C.lessons[it.lesson].generated) ensureLessonSteps(it.lesson);
    const match = (s) => ['speak', 'compose'].includes(s.type) && s.itemId === itemId && s.skill === skill;
    return C.steps.find(match) || [...generated.values()].find(match);
  }

  /** Sinh (một lần) các bước của bài tự động và đăng ký theo mã ổn định. */
  function ensureLessonSteps(lessonId) {
    const L = C.lessons[lessonId];
    if (!L || !L.generated) return L ? L.stepIds : [];
    if (!L.stepIds) {
      const steps = LG.stepsFor(L, { pool: learnedPool() });
      steps.forEach((st) => generated.set(st.id, st));
      L.stepIds = steps.map((st) => st.id);
    }
    return L.stepIds;
  }
  function stepFor(entry) {
    if (entry.sid && !C.stepById[entry.sid] && !generated.has(entry.sid) && C.lessons[entry.sid.split(':')[0]]) ensureLessonSteps(entry.sid.split(':')[0]);
    if (entry.sid) return C.stepById[entry.sid] || generated.get(entry.sid);
    const card = store.state.cards[entry.cardKey];
    const own = ownStep(card.itemId, card.skill);
    if (own) return own;
    // ôn tập: sinh câu hỏi có đáp án kiểm tra được thay cho thẻ tự chấm
    const q = QB.generate(card.itemId, card.skill, { pool: learnedPool() });
    if (q) { generated.set(q.id, q); return q; }
    return { id: `flip:${entry.cardKey}`, type: 'flip', itemId: card.itemId, skill: card.skill, card };
  }

  function openRun(cfg) {
    run = { ...cfg, opener: document.activeElement, results: cfg.results || [], xp: cfg.xp || 0, index: cfg.index || 0, startedAt: cfg.startedAt || Date.now() };
    lessonEl.hidden = false; shell.inert = true; bottomNav.inert = true; document.body.classList.add('noscroll');
    $('#lessonTitle').textContent = run.title;
    showStep();
  }

  function closeRun({ silent = false } = {}) {
    if (!run) return;
    const r = run;
    dispose();
    if (r.kind === 'lesson' && !r.completed) {
      saveSession(false);
      if (!silent) toast(store.isPersistent() ? 'Đã lưu vị trí. Bạn có thể tiếp tục sau.' : 'Trình duyệt chặn lưu trữ nên vị trí chỉ giữ tới khi đóng tab.');
    }
    run = null; curStep = null;
    lessonEl.hidden = true; shell.inert = false; bottomNav.inert = false; document.body.classList.remove('noscroll');
    refresh();
    if (r.opener && document.contains(r.opener)) r.opener.focus(); else { const h = $('.screen.active h1, .screen.active h2'); if (h) h.focus(); }
  }

  function dispose() {
    disposers.forEach((fn) => { try { fn(); } catch (e) { /* bỏ qua */ } });
    disposers = []; curUi = null;
    B.Audio.stop();
  }

  function saveSession(advanced) {
    if (!run || run.kind !== 'lesson') return;
    store.setSession({ kind: 'lesson', lessonId: run.lessonId, queue: run.queue, index: run.index + (advanced ? 1 : 0), results: run.results, xp: run.xp, startedAt: run.startedAt });
  }

  function setFooter(mode) { // 'check' | 'next' | 'hidden'
    footerEl.hidden = mode === 'hidden';
    footerEl.dataset.mode = mode;
    if (mode === 'next') { const last = run.index >= run.queue.length - 1; btn.textContent = last ? 'Xem kết quả' : 'Tiếp tục'; btn.disabled = false; }
    if (mode === 'check') { btn.textContent = 'Kiểm tra'; btn.disabled = true; }
  }

  function showStep() {
    if (run.index >= run.queue.length) return complete();
    dispose();
    const entry = run.queue[run.index], step = curStep = stepFor(entry);
    if (!step) { run.index++; return showStep(); } // bước không còn tồn tại (nội dung đổi version): bỏ qua
    const n = run.queue.length;
    bar.style.width = `${Math.max(4, Math.round((run.index / n) * 100))}%`;
    bar.parentElement.setAttribute('aria-valuenow', Math.round((run.index / n) * 100));
    $('#lessonCount').textContent = `${run.index + 1}/${n}`;
    setFooter('check');
    const ui = curUi = {
      stage, retry: !!entry.retry, done: false, t0: Date.now(), onCheck: null, onKey: null,
      setReady: (v) => { if (footerEl.dataset.mode === 'check') btn.disabled = !v; },
      setLabel: (t) => { ui.labelSet = true; if (footerEl.dataset.mode === 'check') btn.textContent = t; },
      useFooter: (v) => { if (!v) setFooter('hidden'); },
      onDispose: (fn) => disposers.push(fn),
      announce,
      record: (partial) => store.recordAttempt({ itemId: step.itemId, skill: step.skill, stepId: step.id, lessonId: run.lessonId, mode: run.kind, verified: true, ...partial }),
      finish: (result) => finishStep(step, entry, result, ui),
    };
    stage.innerHTML = '';
    R[step.type](step, ui);
    if (step.unscored && footerEl.dataset.mode === 'check' && !ui.labelSet) btn.textContent = 'Tiếp tục';
    stage.scrollTop = 0; lessonEl.scrollTop = 0;
    const t = $('#stepTitle', stage); if (t) t.focus({ preventScroll: true });
  }

  function scoreResult(entry, r) {
    if (r.grade != null) return { grade: r.grade, xp: r.xp || 0, hintLevel: r.hintLevel || (r.hintUsed ? 1 : 0) };
    if (!r.correct) return { grade: 1, xp: 0, hintLevel: r.hintUsed ? 1 : 0 };
    if (entry.retry) return { grade: 2, xp: 4, hintLevel: r.hintUsed ? 1 : 0 };
    if (r.hintUsed) return { grade: 2, xp: 6, hintLevel: 1 };
    return { grade: 3, xp: 10, hintLevel: 0 };
  }

  function finishStep(step, entry, r, ui) {
    if (ui.done) return {};
    ui.done = true;
    const info = {};
    if (r.neutral) { // hoạt động không chấm điểm (trò chuyện AI): đóng phiên, không ghi attempt
      closeRun({ silent: true }); toast('Đã kết thúc trò chuyện. Cuộc này không tính điểm.');
      return {};
    }
    if (r.unscored) { // thẻ học từ, ngữ pháp, hội thoại: chỉ xem, không ghi attempt
      saveSession(true);
      run.index++; showStep();
      return {};
    }
    const res = { sid: step.id, itemId: step.itemId, skill: step.skill, title: step.title || C.skillLabels[step.skill], retry: !!entry.retry, skipped: !!r.skipped, correct: !!r.correct };
    if (!r.skipped) {
      const sc = scoreResult(entry, r);
      store.recordAttempt({
        itemId: step.itemId, skill: step.skill, stepId: step.id, lessonId: run.lessonId, mode: run.kind,
        correct: !!r.correct, grade: sc.grade, hintLevel: sc.hintLevel, responseMs: Date.now() - ui.t0,
        verified: r.verified !== false, degraded: !!r.degraded, retry: !!entry.retry, xp: sc.xp, answer: r.answer,
        stage: step.skill === 'write' ? 'memory' : undefined,
      });
      // phòng "câu hay sai" là luyện thêm: không đụng lịch SRS
      if (!entry.retry && !entry.again && !run.noSchedule) store.gradeCard(step.itemId, step.skill, sc.grade, { deferToTomorrow: run.kind !== 'review' });
      run.xp += sc.xp; res.xp = sc.xp; res.grade = sc.grade;
      if (step.options) { res.correctLabel = step.options[step.answer][0]; res.yourLabel = r.answer; }
      else if (step.target) { res.correctLabel = step.target.join(''); res.yourLabel = r.answer; }
      else if (step.model) { res.correctLabel = step.model.hanzi; res.yourLabel = r.answer; }
      if (!r.correct && !entry.retry && (step.type === 'choice' || step.type === 'order') && ['lesson', 'practice'].includes(run.kind)) {
        const at = Math.min(run.queue.length, run.index + 2 + Math.floor(Math.random() * 3)); // quay lại sau 2–4 mục
        run.queue.splice(at, 0, { sid: step.id, retry: true });
        info.willRetry = true;
      }
      if (run.kind === 'review' && sc.grade === 1 && !entry.again) run.queue.push({ ...entry, again: true });
    }
    run.results.push(res);
    saveSession(true);
    setFooter('next');
    btn.focus({ preventScroll: true });
    setTimeout(() => { const f = stage.querySelector('.feedback.show'); if (f) f.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 80);
    return info;
  }

  btn.onclick = () => {
    if (!run) return;
    if (footerEl.dataset.mode === 'check') { if (curUi && curUi.onCheck && !btn.disabled) curUi.onCheck(); }
    else if (footerEl.dataset.mode === 'next') { run.index++; showStep(); }
  };
  $('#closeLesson').onclick = () => closeRun();
  document.addEventListener('keydown', (e) => {
    if (!run) return;
    if (e.key === 'Escape') { e.preventDefault(); closeRun(); return; }
    if (e.target.closest && e.target.closest('input,textarea,audio')) return;
    if (curUi && curUi.onKey && !curUi.done) { curUi.onKey(e); if (/^[1-9]$/.test(e.key)) return; }
    if (e.key === 'Enter' && !e.target.closest('button') && !footerEl.hidden && !btn.disabled) { e.preventDefault(); btn.click(); }
  });

  function complete() {
    dispose();
    run.completed = true; curStep = null;
    const own = run.results.filter((r) => !r.retry && !r.skipped);
    const total = own.length, ok = own.filter((r) => r.correct).length;
    const skipped = run.results.filter((r) => r.skipped).length;
    const mistakes = own.filter((r) => !r.correct);
    if (run.kind === 'lesson') { store.completeLesson(run.lessonId, { score: ok, total }); store.clearSession(); }
    if (cloud) cloud.syncSoon(); // học xong một lượt → đẩy lên đám mây sớm
    let verdict = '';
    if (run.kind === 'checkpoint') {
      const pass = total && ok / total >= 0.8;
      if (pass) store.completeLesson(`${run.unit.id}:check`, { score: ok, total });
      verdict = pass ? `<p class="lead"><b>✓ Đạt kiểm tra chương “${esc(run.unit.title)}”.</b></p>` : `<p class="lead">Cần đúng từ 80% để đạt. Ôn lại các bài của chương rồi thử lại nhé.</p>`;
    }
    if (run.kind === 'placement') {
      const pass = total && ok / total >= 0.8;
      if (pass) { store.setProfile({ placed: Object.assign({}, profile().placed, { [run.level]: true }) }); if (run.level < MAX_LEVEL) ensurePack(run.level + 1).then(() => { if (!run) refresh(); }); }
      verdict = pass ? `<p class="lead"><b>✓ Bạn đã vượt cấp HSK ${run.level}!</b> Mọi bài HSK ${run.level} đã mở để bạn ôn khi cần${run.level < MAX_LEVEL ? `, và HSK ${run.level + 1} đã mở khoá` : ''}.</p>` : `<p class="lead">Cần đúng từ 80% (${Math.ceil(total * 0.8)}/${total}) để vượt cấp. Bạn có thể học theo lộ trình — các bài sẽ đi nhanh với những gì bạn đã biết.</p>`;
    }
    const tomorrow = store.dueTomorrowCount();
    const ratio = total ? ok / total : 0;
    const head = !total ? 'Bạn đã bỏ qua hết các bước' : ratio >= 0.9 ? 'Rất vững' : ratio >= 0.7 ? 'Khá tốt' : 'Cần luyện thêm một chút';
    const sub = !total ? 'Bỏ qua cũng được, nhưng chưa có gì để tính tiến bộ.' : ratio >= 0.9 ? 'Bạn nhớ hầu hết ngay lần đầu.' : `Bạn đúng ${ok}/${total} câu ngay lần đầu. Phần sai đã được xếp ôn lại, đừng lo.`;
    bar.style.width = '100%'; bar.parentElement.setAttribute('aria-valuenow', 100);
    $('#lessonCount').textContent = '';
    setFooter('hidden');
    const name = profile().name || 'bạn';
    const next = run.kind === 'lesson' ? nextLessonId() : null;
    const nextL = next && next !== run.lessonId ? C.lessons[next] : null;
    const doneL = run.kind === 'lesson' ? C.lessons[run.lessonId] : null;
    const storyEnd = doneL && doneL.story && R.storyEnd ? R.storyEnd(doneL.story) : '';
    stage.innerHTML = `<div class="complete"><div class="burst" aria-hidden="true">${ratio >= 0.7 ? '🎉' : '💪'}</div><h2 id="stepTitle" tabindex="-1">${total ? `${head}, ${esc(name)}!` : head}</h2><p class="lead">${sub}</p>
      ${verdict}
      ${storyEnd}
      <div class="complete-card"><div><strong>+${run.xp}</strong><small>XP từ bài làm</small></div><div><strong>${ok}/${total}</strong><small>đúng ngay lần đầu</small></div><div><strong>${tomorrow}</strong><small>thẻ ôn ngày mai</small></div></div>
      ${skipped ? `<p class="hint">${skipped} bước đã bỏ qua và không được tính điểm.</p>` : ''}
      ${mistakes.length ? `<div class="mistakes"><h3>Cần ôn lại</h3><ul>${mistakes.map((m) => `<li><b>${esc(m.title)}</b>${m.correctLabel ? `<span>Đáp án: <b${zhAttr(m.correctLabel)}>${esc(m.correctLabel)}</b></span>` : ''}</li>`).join('')}</ul></div>` : ''}
      <p class="hint">${store.isPersistent() ? '✓ Kết quả đã được lưu trên thiết bị này.' : '⚠ Trình duyệt đang chặn lưu trữ nên kết quả này chỉ tồn tại trong phiên hiện tại.'}</p>
      ${nextL ? `<button class="primary wide" id="nextLesson">Học tiếp Bài ${nextL.n}: ${esc(nextL.title)} →</button>` : ''}
      <button class="${nextL ? 'secondary' : 'primary'} wide" id="finishRun">Về trang chính</button></div>`;
    $('#stepTitle', stage).focus();
    $('#finishRun').onclick = () => { closeRun({ silent: true }); show('home'); };
    const nb = $('#nextLesson'); if (nb) nb.onclick = () => { closeRun({ silent: true }); startLesson(next); };
  }

  /* ---------- các điểm vào ---------- */
  function startLesson(lessonId) {
    const id = typeof lessonId === 'string' ? lessonId : nextLessonId();
    if (!id) return startRoom('mix');
    const sess = store.state.session, lesson = C.lessons[id];
    if (sess && sess.lessonId === id) {
      openRun({ kind: 'lesson', lessonId: id, title: lesson.title, queue: sess.queue, index: sess.index, results: sess.results, xp: sess.xp, startedAt: sess.startedAt });
    } else {
      if (sess) { // người học chủ động chọn bài khác: bỏ phần dở của bài cũ và nói rõ
        const old = C.lessons[sess.lessonId];
        store.clearSession();
        if (old) toast(`Đã bỏ phần đang dở của Bài ${old.n}. Kết quả các câu đã làm vẫn được giữ.`);
      }
      openRun({ kind: 'lesson', lessonId: id, title: lesson.title, queue: ensureLessonSteps(id).map((sid) => ({ sid })) });
    }
  }
  function startCheckpoint(unit) {
    const qs = LG.checkpoint(unit, C.lessons, { pool: learnedPool() });
    if (!qs.length) return toast('Chưa đủ câu cho bài kiểm tra này.');
    openRun({ kind: 'checkpoint', unit, title: `Kiểm tra chương: ${unit.title}`, queue: qs.map(remember) });
  }
  function startPlacement(level) {
    ensurePack(level).then((ok) => {
      if (!ok) return toast('Chưa tải được nội dung cấp này.');
      const qs = LG.placement(level, { n: 20 });
      openRun({ kind: 'placement', level, title: `Thi vượt cấp HSK ${level}`, queue: qs.map(remember), noSchedule: true });
    });
  }

  const lessonOfStep = (st) => stepLesson[st.id] || st.id.split(':')[0];
  const openLessonSteps = (type, { doneOnly = false } = {}) => C.lessonOrder.filter((id) => lessonDone(id) || (!doneOnly && isUnlocked(id))).flatMap((id) => {
    const L = C.lessons[id]; const ids = L.generated ? ensureLessonSteps(id) : L.stepIds;
    return ids.map((sid) => C.stepById[sid] || generated.get(sid)).filter((st) => st && st.type === type);
  });
  const ROOMS = {
    listen: { title: 'Phòng Nghe', build: (pool) => QB.set(pool, ['audio', 'tone'], 6).map(remember) },
    read: { title: 'Phòng Đọc', build: (pool) => QB.set(pool, ['meaning', 'read'], 6).map(remember) },
    mix: { title: 'Luyện tổng hợp', build: (pool) => QB.set(pool, CHOICE_SKILLS, 10).map(remember) },
    speak: { title: 'Phòng Nói', build: (pool) => { const s = openLessonSteps('speak'); const mine = s.filter((x) => pool.includes(x.itemId)); return shuffle(mine.length ? mine : s.slice(0, 1)).slice(0, 3).map((x) => ({ sid: x.id })); } },
    write: { title: 'Phòng Viết', build: (pool) => { const s = openLessonSteps('write'); const mine = s.filter((x) => pool.includes(x.itemId)); return shuffle(mine.length ? mine : s.slice(0, 2)).slice(0, 3).map((x) => ({ sid: x.id })); } },
    produce: { title: 'Tự đặt câu · Phản biện', build: () => { const done = openLessonSteps('compose', { doneOnly: true }); const s = done.length ? done : openLessonSteps('compose').slice(0, 1); return shuffle(s).slice(0, 3).map((x) => ({ sid: x.id })); } },
    mistakes: { title: 'Luyện câu hay sai', noSchedule: true, build: (pool) => shuffle(mistakePairs()).slice(0, 8).map(([id, sk]) => QB.generate(id, sk, { pool })).filter(Boolean).map(remember) },
    chat: { title: 'Trò chuyện với Blu', build: () => [{ sid: 'chat-greet' }] },
  };
  function startRoom(key) {
    const room = ROOMS[key];
    const queue = room.build(learnedPool());
    if (!queue.length) return toast(key === 'mistakes' ? 'Chưa có câu sai nào để luyện. Tuyệt!' : 'Chưa có câu nào cho phòng này.');
    openRun({ kind: 'practice', room: key, title: room.title, queue, noSchedule: !!room.noSchedule });
  }
  function startReview() {
    const due = store.dueCards().slice(0, 20);
    if (!due.length) return toast('Chưa có thẻ nào đến hạn.');
    openRun({ kind: 'review', title: 'Ôn tập', queue: due.map((c) => ({ cardKey: c.key })) });
  }
  $('#heroCta').onclick = () => startLesson();
  document.querySelectorAll('[data-skill]').forEach((b) => (b.onclick = () => startRoom(b.dataset.skill)));

  /* ---------- onboarding + cá nhân ---------- */
  const onboard = $('#onboard');
  function openOnboarding() {
    onboard.hidden = false; shell.inert = true; bottomNav.inert = true;
    $('#onboardForm').hidden = false; $('#obCloud').hidden = true;
    $('#obName').focus();
  }
  function closeOnboarding() { onboard.hidden = true; shell.inert = false; bottomNav.inert = false; }
  $('#onboardForm').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    store.setProfile({ name: f.name.value.trim().slice(0, 30) || 'bạn', goal: f.goal.value, minutes: +f.minutes.value, level: f.level.value });
    closeOnboarding();
    refresh();
    toast(f.level.value === 'some' ? `Đã mở cả ${C.lessonOrder.length} bài để bạn tự chọn. Bài chẩn đoán đang được soạn.` : 'Sẵn sàng rồi, mình học thôi!');
    const h = $('#home h1, #home h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  };

  $('#profileForm').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    store.setProfile({ name: f.name.value.trim().slice(0, 30) || 'bạn', goal: f.goal.value, minutes: +f.minutes.value, coachConsent: !!f.coach.checked });
    toast(store.isPersistent() ? 'Đã lưu cài đặt.' : 'Đã áp dụng cho phiên này (trình duyệt chặn lưu trữ).');
  };
  $('#exportBtn').onclick = () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `buzzlingo-du-lieu-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const resetBox = $('#resetBox');
  $('#resetBtn').onclick = () => { resetBox.hidden = false; $('#resetNo').focus(); };
  $('#resetNo').onclick = () => { resetBox.hidden = true; $('#resetBtn').focus(); };
  $('#resetYes').onclick = async () => {
    resetBox.hidden = true;
    if (cloudOn && cloud.status().signedIn) { // xoá trên máy = đăng xuất; tiến độ trong tài khoản vẫn giữ
      await cloud.signOut({ force: true }); refresh(); toast('Đã xoá dữ liệu trên máy này và đăng xuất. Tiến độ trong tài khoản vẫn còn.'); openOnboarding(); return;
    }
    store.reset(); refresh(); toast('Đã xoá toàn bộ dữ liệu học trên thiết bị này.'); openOnboarding();
  };
  $('#bpLink').onclick = () => show('blueprint');

  /* ---------- tài khoản & đồng bộ ---------- */
  const hhmm = (ts) => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  function cloudLine(s) {
    if (s.state === 'syncing') return 'Đang đồng bộ…';
    if (s.state === 'offline') return '⚠ Đang ngoại tuyến. Tiến độ vẫn lưu trên máy và sẽ tự gửi lên khi có mạng.';
    if (s.state === 'error') return `⚠ Chưa đồng bộ được: ${s.error}`;
    if (s.lastSync) return `✓ Đã đồng bộ lúc ${hhmm(s.lastSync)}.${s.dirty ? ' Có thay đổi mới, sẽ tự gửi sau ít giây.' : ''}`;
    return 'Tiến độ tự đồng bộ trong lúc bạn học.';
  }
  function renderCloud() {
    if (!cloudOn) return;
    const s = cloud.status();
    $('#cloudHead').hidden = false; $('#cloudCard').hidden = false; $('#obLoginBtn').hidden = false;
    $('#cloudOut').hidden = s.signedIn; $('#cloudIn').hidden = !s.signedIn;
    if (s.signedIn) { $('#cloudEmail').textContent = s.email; $('#cloudStatus').textContent = cloudLine(s); }
  }
  /** Sau khi đăng nhập/đồng bộ kéo dữ liệu về: nạp các cấp HSK cần thiết, đóng onboarding nếu đã có hồ sơ, vẽ lại. */
  async function afterCloudChange() {
    const need = neededLevels();
    if (need.length) await Promise.all(need.map(ensurePack)).catch(() => {});
    if (store.state.profile && !onboard.hidden) closeOnboarding();
    if (!run) refresh();
  }
  function cloudForm(slot) {
    const onlyLogin = slot.hasAttribute('data-only-login');
    slot.innerHTML = `<form class="form cloud-form" novalidate>
      <label>Email<input type="email" name="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false"></label>
      <label>Mật khẩu<input type="password" name="password" autocomplete="current-password" minlength="6"></label>
      <div class="skill-actions"><button class="primary" type="submit" data-mode="in">Đăng nhập</button>${onlyLogin ? '' : '<button class="secondary" type="submit" data-mode="up">Tạo tài khoản</button>'}</div>
      <p class="hint cloud-msg" role="status"></p></form>`;
    const f = slot.querySelector('form'), msg = f.querySelector('.cloud-msg');
    let mode = 'in';
    f.querySelectorAll('button[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; }));
    f.onsubmit = async (e) => {
      e.preventDefault();
      const email = f.email.value.trim(), pw = f.password.value, m = mode; mode = 'in';
      if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = 'Hãy nhập email hợp lệ.'; f.email.focus(); return; }
      if (pw.length < 6) { msg.textContent = 'Mật khẩu cần ít nhất 6 ký tự.'; f.password.focus(); return; }
      const btns = f.querySelectorAll('button'); btns.forEach((b) => (b.disabled = true));
      msg.textContent = m === 'up' ? 'Đang tạo tài khoản…' : 'Đang đăng nhập và tải tiến độ…';
      const r = m === 'up' ? await cloud.signUp(email, pw) : await cloud.signIn(email, pw);
      btns.forEach((b) => (b.disabled = false));
      if (!r.ok) { msg.textContent = r.error; return; }
      if (r.needConfirm) { msg.textContent = `Đã gửi thư xác nhận tới ${email}. Bấm link trong thư, rồi quay lại đây bấm Đăng nhập.`; return; }
      f.password.value = ''; msg.textContent = '';
      await afterCloudChange();
      if (!onboard.hidden) { // tài khoản mới chưa có tiến độ → trả lời 3 câu như bình thường
        $('#obCloud').hidden = true; $('#onboardForm').hidden = false; $('#obName').focus();
        toast('Tài khoản chưa có tiến độ. Trả lời 3 câu để bắt đầu nhé!');
        return;
      }
      toast(r.synced ? (store.state.attempts.length ? 'Đã đăng nhập. Tiến độ đã được đồng bộ.' : 'Đã đăng nhập. Tiến độ sẽ tự lưu lên tài khoản.') : `Đã đăng nhập nhưng chưa đồng bộ được: ${r.error}`);
    };
  }
  if (cloudOn) {
    document.querySelectorAll('[data-cloud-form]').forEach(cloudForm);
    cloud.onStatus(() => { renderCloud(); if (!run) renderProfileStorage(); });
    let wasIn = cloud.status().signedIn;
    cloud.onStatus((s) => { if (wasIn && !s.signedIn && s.state === 'signedout') toast(s.error); wasIn = s.signedIn; });
    // đồng bộ kéo dữ liệu mới từ máy khác về → nạp gói cấp mới và vẽ lại
    store.subscribe((meta) => { if (meta && meta.source === 'cloud') afterCloudChange(); });
    $('#obLoginBtn').onclick = () => { $('#onboardForm').hidden = true; $('#obCloud').hidden = false; const i = $('#obCloud input[name=email]'); if (i) i.focus(); };
    $('#obBackBtn').onclick = () => { $('#obCloud').hidden = true; $('#onboardForm').hidden = false; $('#obName').focus(); };
    $('#cloudSyncBtn').onclick = async () => { const r = await cloud.sync(); toast(r.ok ? 'Đã đồng bộ.' : r.error); };
    const outBox = $('#cloudOutBox');
    $('#cloudOutBtn').onclick = () => { outBox.hidden = false; $('#cloudOutNo').focus(); };
    $('#cloudOutNo').onclick = () => { outBox.hidden = true; };
    $('#cloudOutYes').onclick = async () => {
      const r = await cloud.signOut();
      outBox.hidden = true;
      if (!r.ok) return toast(r.error);
      refresh(); toast('Đã đăng xuất.'); openOnboarding();
    };
    document.addEventListener('visibilitychange', () => {
      const s = cloud.status(); if (!s.signedIn) return;
      if (document.visibilityState === 'hidden') cloud.flush();
      else if (!s.lastSync || Date.now() - s.lastSync > 5 * 60 * 1000) cloud.sync(); // quay lại app → lấy tiến độ học trên máy khác
    });
    window.addEventListener('pagehide', () => cloud.flush());
    window.addEventListener('online', () => { if (cloud.status().dirty) cloud.sync(); });
  }
  function renderProfileStorage() { if (!($('#profileForm').contains(document.activeElement))) renderProfile(); }

  /* ---------- khởi động ---------- */
  function start() {
    show((location.hash || '#home').slice(1), { focus: false, push: false });
    if (cloudOn && cloud.status().signedIn) cloud.sync();
    if (!store.state.profile) openOnboarding();
    else if (store.state.attempts.length) toast('Mừng bạn quay lại! Tiến độ của bạn vẫn còn nguyên.');
    // nạp nền các cấp đã mở và cấp ngay sau đó (để biết khoá/mở); cấp xa hơn chỉ tải khi chạm tab ở Lộ trình
    const bgLevels = () => { let top = 1; LEVELS.forEach((lv) => { if (levelOpen(lv)) top = lv; }); return LEVELS.filter((lv) => lv <= Math.min(MAX_LEVEL, top + 1)); };
    setTimeout(() => Promise.all(bgLevels().map(ensurePack)).then(() => Promise.all(bgLevels().map(ensurePack))).then(() => { if (!run && ['path', 'progress', 'home'].includes((location.hash || '#home').slice(1))) refresh(); }), 1200);
  }
  const need = neededLevels();
  if (need.length) Promise.all(need.map(ensurePack)).then(start); else start();
})();
