#!/usr/bin/env node
/* Nhập danh sách từ HSK 3.0 cấp 1–6 → content/hsk/hsk30.json (từ, Pinyin, từ loại, chữ Hán theo cấp).
 * Nguồn (MIT): danh sách chính thức OCR — github.com/elkmovie/hsk30 (Pleco);
 *              Pinyin/từ loại — github.com/drkameleon/complete-hsk-vocabulary.
 * Dùng: git clone hai repo trên vào một thư mục rồi: node tools/import-hsk.mjs <thư-mục-hsk30> <thư-mục-complete-hsk-vocabulary>
 * Từ đa âm được chọn theo bảng PINYIN bên dưới (dựa vào thứ tự Pinyin của danh sách chính thức). Mục trong REVIEW cần người duyệt. */
import fs from 'node:fs';
import path from 'node:path';

const [srcList, srcComp] = process.argv.slice(2);
if (!srcList || !srcComp) { console.error('Dùng: node tools/import-hsk.mjs <hsk30> <complete-hsk-vocabulary>'); process.exit(1); }

// cấp-số thứ tự → Pinyin (từ đa âm, thanh nhẹ, tên riêng, mục thiếu trong nguồn Pinyin)
export const PINYIN = {
  '1-5': 'ba', '1-21': 'Běijīng', '1-24': 'bǐ', '1-25': 'bié', '1-37': 'chà', '1-42': 'chē', '1-49': 'chūlái', '1-56': 'dǎ', '1-61': 'dà',
  '1-66': 'de', '1-67': 'de', '1-69': 'dì', '1-71': 'dìfang', '1-86': 'dōngxi', '1-89': 'dōu', '1-90': 'dú', '1-95': 'duōshao', '1-109': 'fēn',
  '1-111': 'gān', '1-113': 'gàn', '1-117': 'gàosu', '1-120': 'gè', '1-121': 'gěi', '1-131': 'guò', '1-132': 'hái', '1-136': 'Hànyǔ', '1-138': 'hǎo',
  '1-139': 'hǎochī', '1-143': 'hào', '1-144': 'hē', '1-145': 'hé', '1-153': 'huán', '1-160': 'huì', '1-165': 'jǐ', '1-172': 'jiān', '1-173': 'jiàn',
  '1-175': 'jiāo', '1-192': 'kàn', '1-210': 'le', '1-211': 'lèi', '1-227': 'ma', '1-232': 'méi', '1-250': 'nǎ', '1-254': 'nà', '1-268': 'nán',
  '1-269': 'ne', '1-276': 'nǚ', '1-280': 'nǚrén', '1-283': 'pǎo', '1-289': 'qǐlái', '1-315': 'shàng', '1-324': 'shǎo', '1-349': 'shuō', '1-361': 'tīng',
  '1-414': 'xīngqīrì', '1-415': 'xīngqītiān', '1-416': 'xíng', '1-423': 'yào', '1-426': 'yè', '1-449': 'yǔ', '1-451': 'yuǎn', '1-469': 'zhe',
  '1-472': 'zhèng', '1-476': 'zhōng', '1-477': 'Zhōngguó', '1-479': 'Zhōngwén', '1-483': 'zhòng', '1-489': 'zi',
  '2-1': 'a', '2-17': 'bèi', '2-24': 'biān', '2-50': 'cǎo', '2-53': 'chá', '2-55': 'cháng', '2-58': 'chǎng', '2-62': 'chēng', '2-79': 'Chūnjié',
  '2-107': 'dāng', '2-108': 'dāngshí', '2-109': 'dǎo', '2-111': 'dào', '2-115': 'dé', '2-118': 'děi', '2-139': 'dù', '2-154': 'fā', '2-164': 'fēn',
  '2-185': 'gāozhōng', '2-187': 'gèng', '2-198': 'gùshi', '2-207': 'guòlái', '2-209': 'guòqù', '2-210': 'guo', '2-214': 'hǎo', '2-215': 'hǎochu',
  '2-219': 'hǎoshì', '2-245': 'huì', '2-260': 'jià', '2-273': 'jiǎo', '2-276': 'jiǎo', '2-280': 'jiàoxué', '2-288': 'jié', '2-291': 'jiéguǒ',
  '2-307': 'jù', '2-309': 'kǎ', '2-344': 'lí', '2-354': 'liáng', '2-377': 'miàn', '2-378': 'miàn', '2-387': 'nà', '2-401': 'niǎo', '2-402': 'nòng',
  '2-414': 'piányi', '2-415': 'piàn', '2-428': 'qí', '2-481': 'shěng', '2-482': 'shěng', '2-501': 'shǔ', '2-525': 'tí', '2-543': 'tōng',
  '2-549': 'tóu', '2-550': 'tou', '2-565': 'wàn', '2-570': 'wèi', '2-574': 'wèi', '2-583': 'xīfāng', '2-676': 'Yīngwén', '2-677': 'Yīngyǔ',
  '2-703': 'zán', '2-705': 'zāng', '2-712': 'zhàn', '2-715': 'zhǎng', '2-730': 'zhǐ', '2-739': 'zhōngyī', '2-740': 'zhòngdiǎn',
  '3-6': 'bǎ', '3-7': 'bǎ', '3-14': 'bǎn', '3-28': 'bēi', '3-30': 'bèi', '3-36': 'běnshi', '3-76': 'Chángchéng', '3-79': 'chǎng', '3-83': 'cháo',
  '3-101': 'chóng', '3-109': 'chuán', '3-130': 'dàifu', '3-153': 'diào', '3-241': 'gōngfu', '3-275': 'guóqìng', '3-279': 'guòqù', '3-283': 'háng',
  '3-286': 'hé', '3-297': 'hùliánwǎng', '3-300': 'huárén', '3-301': 'huà', '3-318': 'jíle', '3-359': 'jiēshi', '3-372': 'jǐnliàng', '3-380': 'jīngjù',
  '3-386': 'jīngshén', '3-387': 'jīngshen', '3-420': 'kōng', '3-433': 'lè', '3-452': 'Liánhéguó', '3-455': 'liǎo', '3-485': 'měiyuán', '3-528': 'pàng',
  '3-555': 'qiáng', '3-561': 'qīn', '3-633': 'shēngyi', '3-654': 'shìjièbēi', '3-681': 'shǔ', '3-692': 'suǒzhǎng', '3-697': 'tāng', '3-708': 'tiáo',
  '3-724': 'tóu', '3-751': 'wéi', '3-752': 'wèi', '3-772': 'xì', '3-822': 'yā', '3-872': 'yuē', '3-896': 'zhèng', '3-905': 'zhī',
  '3-928': 'Zhōnghuá mínzú', '2-44': 'bùyīhuìr', '3-931': 'zhǒng', '3-949': 'zhuǎn', '3-953': 'zhuī',
  // cấp 4–6
  '4-2': 'ā', '4-7': 'ān', '4-22': 'báo', '4-46': 'bié', '4-71': 'céng', '4-96': 'chǐ', '4-99': 'chōng', '4-112': 'chù', '4-125': 'cì',
  '4-134': 'dá', '4-143': 'dàfang', '4-152': 'dàye', '4-169': 'dǎochē', '4-170': 'dàochē', '4-172': 'de', '4-180': 'dǐ', '4-181': 'dìfāng', '4-213': 'ěxin',
  '4-242': 'fēnzhī', '4-317': 'hào', '4-328': 'huá', '4-329': 'huà', '4-364': 'jì', '4-390': 'jiàng', '4-402': 'jié', '4-407': 'jǐnkuài', '4-428': 'juǎn',
  '4-429': 'juàn', '4-441': 'kòng', '4-459': 'lǎogōng', '4-475': 'liǎ', '4-477': 'liáng', '4-500': 'luò', '4-525': 'mō', '4-531': 'na', '4-565': 'qīzi',
  '4-579': 'qiǎn', '4-581': 'qiē', '4-593': 'quān', '4-602': 'rénjia', '4-608': 'sàn', '4-609': 'sǎo', '4-610': 'sè', '4-671': 'shuā', '4-711': 'tiāo',
  '4-714': 'tiǎo', '4-734': 'tǔdì', '4-745': 'wáng', '4-760': 'wèi', '4-790': 'xiān', '4-860': 'yào', '4-885': 'yīng', '4-935': 'zháo', '4-939': 'zhé',
  '4-964': 'zhòng', '4-976': 'zhuǎndòng', '5-81': 'chā', '5-101': 'chēng', '5-109': 'chéng', '5-121': 'chòu', '5-151': 'dá', '5-153': 'dǎ', '5-160': 'dàdū',
  '5-172': 'dāi', '5-183': 'dāngnián', '5-186': 'dǎng', '5-190': 'déle', '5-275': 'gēnqián', '5-301': 'guǎng', '5-314': 'hàn', '5-369': 'jiā', '5-371': 'jià',
  '5-389': 'jiāng', '5-436': 'ké', '5-437': 'kě', '5-456': 'là', '5-482': 'lìng', '5-546': 'pēn', '5-552': 'pǐ', '5-591': 'qiǎng', '5-637': 'sǎn',
  '5-644': 'shān', '5-645': 'shàn', '5-651': 'shāo', '5-687': 'shí', '5-721': 'shuōfǎ', '5-743': 'tán', '5-772': 'tǔ', '5-773': 'tù', '5-794': 'wēnhé',
  '5-813': 'xià', '5-874': 'yányǔ', '5-896': 'yǐ', '5-908': 'yìng', '5-976': 'zhǎng', '5-997': 'zhèng', '5-1050': 'zhuǎnxiàng', '6-2': 'ái', '6-6': 'bàle',
  '6-27': 'bèizhe', '6-43': 'biǎn', '6-47': 'biàn', '6-86': 'cáng', '6-89': 'cè', '6-136': 'chòng', '6-199': 'dàng', '6-201': 'dàngtiān', '6-203': 'dàng',
  '6-283': 'fú', '6-297': 'gān', '6-371': 'hàoxué', '6-378': 'héng', '6-400': 'hùn', '6-437': 'jiào', '6-443': 'jié', '6-450': 'jiě', '6-458': 'jìn',
  '6-481': 'jù', '6-496': 'kāitōng', '6-499': 'kān', '6-503': 'kànhǎo', '6-521': 'la', '6-557': 'lòu', '6-562': 'lù', '6-566': 'ma', '6-567': 'mái',
  '6-573': 'mēng', '6-574': 'méng', '6-594': 'mó', '6-610': 'ní', '6-616': 'pào', '6-617': 'pào', '6-634': 'pū', '6-701': 'sāi', '6-740': 'shí',
  '6-781': 'tà', '6-787': 'tàng', '6-812': 'tóng', '6-814': 'tóngháng', '6-834': 'wa', '6-999': 'yǔ', '6-1017': 'yūn', '6-1030': 'zhā', '6-1032': 'zhà',
  '6-1043': 'zhǎng', '6-1047': 'zhàng', '6-1059': 'zhèngdāng', '6-1091': 'zhōu', '6-1103': 'zhuàn', '6-1104': 'zhuàndòng', '6-1105': 'zhuàn', '6-1125': 'zú', '6-1132': 'zuān',
  '6-1137': 'zuò',
};
// thứ tự Pinyin không đủ phân định → cần người biết tiếng Trung duyệt
export const REVIEW = ['2-260', '2-501'];

/** "ài hào" → "àihào"; thêm ' trước âm tiết bắt đầu bằng a/e/o (nǚ'ér, kě'ài); giữ khoảng trắng nếu bảng PINYIN viết rời. */
function joinPinyin(p, fixed) {
  if (fixed && / /.test(fixed)) return fixed.normalize('NFC');
  return p.trim().split(/\s+/).map((s, i) => (i && /^[aeoāáǎàēéěèōóǒò]/i.test(s) ? `'${s}` : s)).join('').normalize('NFC');
}

function parseList(file) {
  let lv = 0; const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const s = line.trim();
    if (/^[一二三四五六七八九]+级|^高等/.test(s)) { lv++; out[lv] = []; continue; }
    const m = /^(\d+)\s+(.*)$/.exec(s);
    if (m && lv) out[lv].push([+m[1], m[2]]);
  }
  return out;
}

const MISSING = [];
const LEVELS = [1, 2, 3, 4, 5, 6];
const EXPECT = [500, 772, 973, 1000, 1071, 1140];
const words = parseList(path.join(srcList, 'wordlist.txt'));
const chars = parseList(path.join(srcList, 'charlist.txt'));
const comp = JSON.parse(fs.readFileSync(path.join(srcComp, 'complete.json'), 'utf8'));
const by = new Map();
for (const e of comp) { if (!by.has(e.simplified)) by.set(e.simplified, []); by.get(e.simplified).push(e); }

const out = [];
const seen = new Map();
for (const lv of LEVELS) {
  for (const [n, raw] of words[lv]) {
    const note = (/（(.+?)）/.exec(raw) || [])[1] || '';
    const head = raw.replace(/（.*?）/g, '').replace(/[¹²³]/g, '');
    const forms = head.split('｜').map((x) => x.trim());
    const hanzi = forms[0].replace(/…/g, '');
    const key = `${lv}-${n}`;
    const es = by.get(hanzi) || [];
    const tagged = es.filter((e) => (e.level || []).includes(`new-${lv}`));
    const pool = (tagged.length ? tagged : es).flatMap((e) => e.forms.map((f) => f.transcriptions.pinyin));
    const lower = [...new Set(pool.filter((p) => !/^[A-Z]/.test(p)))];
    let pinyin = PINYIN[key] || (lower.length === 1 ? lower[0] : null);
    if (!pinyin && pool.length && new Set(pool).size === 1) pinyin = pool[0];
    if (!pinyin) { MISSING.push(`${key}\t${raw}\t${pool.join(',')}`); continue; }
    pinyin = joinPinyin(pinyin.replace(/[0-5]/g, '').replace(/u:/g, 'ü').replace(/U:/g, 'Ü'), PINYIN[key]);
    const pos = [...new Set((tagged[0] || es[0] || {}).pos || [])];
    // id: chữ Hán; trùng chữ (đồng tự khác âm/nghĩa) → thêm Pinyin không dấu
    let id = hanzi;
    if (seen.has(id)) id = `${hanzi}~${pinyin.normalize('NFD').replace(/[̀-ͯ]/g, '')}${seen.get(hanzi) + 1}`;
    seen.set(hanzi, (seen.get(hanzi) || 0) + 1);
    out.push({ id, level: lv, n, hanzi, pinyin, alt: forms.slice(1), note, pos, review: REVIEW.includes(key) || undefined, ...(raw.startsWith('…') ? { pattern: raw.replace(/（.*?）/g, '') } : {}) });
  }
}
if (MISSING.length) { console.error(MISSING.join('\n')); throw new Error(`Thiếu Pinyin cho ${MISSING.length} mục`); }
const charLv = Object.fromEntries(LEVELS.map((lv) => [lv, chars[lv].map(([, c]) => c.trim())]));
const counts = LEVELS.map((lv) => out.filter((w) => w.level === lv).length);
if (counts.join() !== EXPECT.slice(0, LEVELS.length).join()) throw new Error(`Số từ không khớp chuẩn: ${counts}`);
const target = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../content/hsk/hsk30.json');
fs.writeFileSync(target, JSON.stringify({ source: `HSK 3.0 (GF0025-2021) cấp 1–${LEVELS.length} · danh sách OCR của Pleco (MIT) + Pinyin từ complete-hsk-vocabulary (MIT), đa âm chọn theo tools/import-hsk.mjs`, counts: { words: counts, chars: LEVELS.map((l) => charLv[l].length) }, chars: charLv, words: out }, null, 1));
console.log('Đã ghi', target, counts);
