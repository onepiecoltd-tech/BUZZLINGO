/* Tiện ích Pinyin cho công cụ dựng nội dung: biến thanh 不/一 kiểu sách giáo khoa, ghép câu, viết hoa đầu câu. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Q = require('../dist/js/qbank.js');

export const { toneOf, withTone, splitSyllables, stripTones } = Q;

const NUMERALS = new Set([...'零一二三四五六七八九十百两几第']);

/**
 * Biến thanh trong một chuỗi âm tiết đã gắn với chữ Hán tương ứng.
 * syl: [{ch, py}] theo thứ tự trong câu. 不 trước thanh 4 → bú. 一 trước thanh 4 → yí, trước thanh 1/2/3 → yì,
 * giữ yī khi là số đếm/thứ tự (十一, 第一, 一月, 一号, 一二三) hoặc đứng cuối.
 */
export function applySandhi(syl) {
  return syl.map((s, i) => {
    const next = syl[i + 1], prev = syl[i - 1];
    if (!next || !next.py || next.punct) return s;
    const t = toneOf(next.py);
    if (s.ch === '不' && s.py.toLowerCase() === 'bù' && t === 4) return { ...s, py: withTone(s.py, 2) };
    if (s.ch === '一' && s.py.toLowerCase() === 'yī') {
      if ((prev && NUMERALS.has(prev.ch)) || (NUMERALS.has(next.ch) && !/^[百千]$/.test(next.ch)) || /^[月号]$/.test(next.ch)) return s;
      if (t === 4) return { ...s, py: withTone(s.py, 2) };
      if (t >= 1 && t <= 3) return { ...s, py: withTone(s.py, 4) };
      if (t === 0 && next.ch === '个') return { ...s, py: withTone(s.py, 2) };
    }
    return s;
  });
}

/** Âm tiết của một từ, gắn với từng chữ (xử lý 儿hoá: âm tiết cuối "…r" ứng với hai chữ). */
export function sylOfWord(hanzi, pinyin) {
  const chars = [...hanzi];
  const syl = splitSyllables(pinyin) || [];
  const out = [];
  let k = 0;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '儿' && i > 0 && i === chars.length - 1 && syl.length === chars.length - 1) { out[out.length - 1].ch += '儿'; continue; }
    out.push({ ch: chars[i], py: syl[k++] || '' });
  }
  return out;
}

/** Pinyin hiển thị của một từ đứng riêng (áp biến thanh bên trong từ, ví dụ 不客气 → bú kèqi, 一样 → yíyàng). */
export function displayWordPinyin(hanzi, pinyin) {
  if (!/[不一]/.test(hanzi) || /\s/.test(pinyin)) return pinyin;
  const syl = applySandhi(sylOfWord(hanzi, pinyin));
  return joinSyl(syl.map((s) => s.py));
}

export function joinSyl(arr) {
  return arr.map((s, i) => (i && /^[aeoāáǎàēéěèōóǒò]/i.test(s) ? `'${s}` : s)).join('');
}

export const capFirst = (s) => s.replace(/^(\s*["“]?)(\p{L})/u, (m, a, b) => a + b.toUpperCase());
