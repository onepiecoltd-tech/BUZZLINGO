/* BuzzLingo · SRS theo từng kỹ năng (user × item × skill).
 * Cài đặt FSRS-4.5 với tham số mặc định, độc lập DOM để test bằng Node.
 * Điểm chấm: 1 = Lại (quên), 2 = Khó, 3 = Ổn, 4 = Dễ. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Buzz = root.Buzz || {}).SRS = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
  const DECAY = -0.5;
  const FACTOR = 19 / 81;
  const DAY = 86400000;
  const RELEARN_MS = 10 * 60 * 1000;
  const REQUESTED_RETENTION = 0.9;

  const clampD = (d) => Math.min(10, Math.max(1, d));
  const retrievability = (elapsedDays, s) => Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / s, DECAY);
  const interval = (s, retention = REQUESTED_RETENTION) =>
    Math.max(1, Math.round((s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1)));
  const initS = (g) => Math.max(0.1, W[g - 1]);
  const initD = (g) => clampD(W[4] - W[5] * (g - 3));
  const nextD = (d, g) => clampD(W[7] * initD(3) + (1 - W[7]) * (d - W[6] * (g - 3)));
  const recallS = (d, s, r, g) =>
    s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1));
  const forgetS = (d, s, r) => W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));

  function newCard(itemId, skill, now) {
    return { key: `${itemId}:${skill}`, itemId, skill, state: 'new', stability: 0, difficulty: 0, reps: 0, lapses: 0, lastReviewAt: null, dueAt: now, createdAt: now };
  }

  function currentRetrievability(card, now) {
    if (card.state === 'new' || card.lastReviewAt == null) return null;
    return retrievability((now - card.lastReviewAt) / DAY, card.stability);
  }

  /** Trả về thẻ kết quả cho cả 4 mức chấm. Khoảng ôn luôn tăng dần: Khó < Ổn < Dễ. */
  function outcomes(card, now) {
    const isNew = card.state === 'new';
    const r = isNew ? 1 : currentRetrievability(card, now);
    const S = {}, D = {};
    for (const g of [1, 2, 3, 4]) {
      if (isNew) { S[g] = initS(g); D[g] = initD(g); }
      else {
        D[g] = nextD(card.difficulty, g);
        S[g] = g === 1 ? Math.min(forgetS(card.difficulty, card.stability, r), card.stability) : recallS(card.difficulty, card.stability, r, g);
      }
      S[g] = Math.max(0.1, S[g]);
    }
    const i2 = interval(S[2]);
    const i3 = Math.max(interval(S[3]), i2 + 1);
    const i4 = Math.max(interval(S[4]), i3 + 1);
    const days = { 2: i2, 3: i3, 4: i4 };
    const make = (g, dueAt, state, scheduledDays) => ({
      ...card, state, stability: S[g], difficulty: D[g], reps: card.reps + 1,
      lapses: card.lapses + (g === 1 && !isNew ? 1 : 0), lastReviewAt: now, dueAt, lastGrade: g, scheduledDays,
    });
    return {
      1: make(1, now + RELEARN_MS, isNew ? 'learning' : 'relearning', 0),
      2: make(2, now + i2 * DAY, 'review', i2),
      3: make(3, now + i3 * DAY, 'review', i3),
      4: make(4, now + i4 * DAY, 'review', i4),
    };
  }

  const review = (card, grade, now) => outcomes(card, now)[grade];

  function startOfNextDay(now) {
    const d = new Date(now);
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }

  function formatSpan(ms) {
    const min = Math.round(ms / 60000);
    if (min < 60) return `${Math.max(1, min)} phút`;
    const h = Math.round(ms / 3600000);
    if (h < 24) return `${h} giờ`;
    const d = Math.round(ms / DAY);
    if (d < 14) return `${d} ngày`;
    if (d < 60) return `${Math.round(d / 7)} tuần`;
    if (d < 365) return `${Math.round(d / 30)} tháng`;
    return `${(d / 365).toFixed(1).replace(/\.0$/, '')} năm`;
  }

  /** Nhãn khoảng ôn dự đoán cho từng nút chấm. */
  function previewLabels(card, now) {
    const o = outcomes(card, now);
    const out = {};
    for (const g of [1, 2, 3, 4]) out[g] = formatSpan(o[g].dueAt - now);
    return out;
  }

  const isDue = (card, now) => card.state === 'new' || card.dueAt <= now;

  return { W, DAY, newCard, outcomes, review, retrievability, currentRetrievability, interval, startOfNextDay, formatSpan, previewLabels, isDue };
});
