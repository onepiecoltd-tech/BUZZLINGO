/* BuzzLingo · nội dung bài học tách khỏi UI (schema v2).
 * Thêm bài mới = thêm items + steps + lesson. Câu ôn tập và phòng luyện được sinh tự động từ items (xem qbank.js).
 * item.kind: char (một chữ) | word (từ/cụm) | sentence (câu). item.lesson: bài giới thiệu mục này. */
(function () {
  'use strict';

  const items = {
    // Bài 1 · Chào hỏi
    '你': { id: '你', lesson: 'l1-nihao', kind: 'char', hanzi: '你', pinyin: 'nǐ', vi: 'bạn', tone: 3, strokes: 7 },
    '好': { id: '好', lesson: 'l1-nihao', kind: 'char', hanzi: '好', pinyin: 'hǎo', vi: 'tốt, khoẻ', tone: 3, strokes: 6 },
    '你好': { id: '你好', lesson: 'l1-nihao', kind: 'word', hanzi: '你好', pinyin: 'nǐ hǎo', vi: 'xin chào', parts: ['你', '好'], note: 'Hai thanh 3 liền nhau: chữ đầu đọc gần như thanh 2, nhưng vẫn viết là nǐ hǎo.' },
    // Bài 2 · Tôi là…
    '我': { id: '我', lesson: 'l2-woshi', kind: 'char', hanzi: '我', pinyin: 'wǒ', vi: 'tôi', tone: 3, strokes: 7 },
    '是': { id: '是', lesson: 'l2-woshi', kind: 'char', hanzi: '是', pinyin: 'shì', vi: 'là, phải', tone: 4, strokes: 9 },
    '不': { id: '不', lesson: 'l2-woshi', kind: 'char', hanzi: '不', pinyin: 'bù', vi: 'không', tone: 4, strokes: 4 },
    '吗': { id: '吗', lesson: 'l2-woshi', kind: 'char', hanzi: '吗', pinyin: 'ma', vi: 'trợ từ hỏi (… không?)', tone: 0, strokes: 6 },
    '我是': { id: '我是', lesson: 'l2-woshi', kind: 'word', hanzi: '我是', pinyin: 'wǒ shì', vi: 'tôi là', parts: ['我', '是'] },
    '不是': { id: '不是', lesson: 'l2-woshi', kind: 'word', hanzi: '不是', pinyin: 'bú shì', vi: 'không phải', parts: ['不', '是'], note: '不 gốc là bù; đứng trước thanh 4 thì đọc thành bú.' },
    '你好吗': { id: '你好吗', lesson: 'l2-woshi', kind: 'sentence', hanzi: '你好吗？', pinyin: 'nǐ hǎo ma?', vi: 'Bạn khoẻ không?', parts: ['你', '好', '吗'] },
    // Bài 3 · Cảm ơn & tạm biệt
    '谢谢': { id: '谢谢', lesson: 'l3-xiexie', kind: 'word', hanzi: '谢谢', pinyin: 'xièxie', vi: 'cảm ơn', parts: ['谢', '谢'] },
    '不客气': { id: '不客气', lesson: 'l3-xiexie', kind: 'word', hanzi: '不客气', pinyin: 'bú kèqi', vi: 'không có gì', parts: ['不', '客', '气'], note: '不 đứng trước kè (thanh 4) nên đọc là bú.' },
    '再': { id: '再', lesson: 'l3-xiexie', kind: 'char', hanzi: '再', pinyin: 'zài', vi: 'lại, nữa', tone: 4, strokes: 6 },
    '见': { id: '见', lesson: 'l3-xiexie', kind: 'char', hanzi: '见', pinyin: 'jiàn', vi: 'gặp, thấy', tone: 4, strokes: 4 },
    '再见': { id: '再见', lesson: 'l3-xiexie', kind: 'word', hanzi: '再见', pinyin: 'zàijiàn', vi: 'tạm biệt', parts: ['再', '见'] },
  };

  const skillLabels = { audio: 'Nghe hiểu', tone: 'Nhận diện thanh', meaning: 'Nhớ nghĩa', read: 'Đọc chữ', speak: 'Nói', write: 'Viết chữ', produce: 'Tự đặt câu', chat: 'Trò chuyện' };

  // Nghĩa tiếng Việt dùng làm đáp án nhiễu khi chưa đủ mục đã học.
  const viDistractors = ['cảm ơn', 'tạm biệt', 'xin lỗi', 'không', 'tôi', 'anh ấy', 'chúng ta', 'rất', 'cũng', 'gì', 'ai', 'đây'];

  const steps = [
    /* ================= Bài 1 ================= */
    {
      id: 's1-tone', type: 'choice', coach: 'bap', itemId: '你', skill: 'tone',
      title: 'Nghe và chọn thanh điệu',
      prompt: 'Chạm loa, nghe âm “ni” (chữ 你), rồi chọn thanh điệu bạn nghe được.',
      audio: { text: '你' },
      options: [['nī', 'Thanh 1 · cao, phẳng'], ['ní', 'Thanh 2 · đi lên'], ['nǐ', 'Thanh 3 · hạ thấp rồi nhấc lên'], ['nì', 'Thanh 4 · đi xuống dứt khoát']],
      answer: 2,
      hint: 'Thanh 3 là thanh duy nhất hạ xuống thấp trước khi nhấc lên.',
      explain: 'Thanh 3 hạ thấp rồi nhấc nhẹ lên. Đừng đọc như dấu hỏi tiếng Việt: thanh 3 của tiếng Trung thấp và kéo dài hơn.',
    },
    {
      id: 's2-audio', type: 'choice', coach: 'blu', itemId: '你好', skill: 'audio',
      title: 'Nghe và hiểu',
      prompt: 'Nghe lời chào, rồi chọn nghĩa đúng. Lần này chưa có chữ để nhìn.',
      audio: { text: '你好' },
      options: [['Xin chào', ''], ['Cảm ơn', ''], ['Tạm biệt', ''], ['Không', '']],
      answer: 0,
      hint: 'Đây là câu người ta nói đầu tiên khi gặp nhau.',
      explain: '你好 — nǐ hǎo — nghĩa là “xin chào”.',
    },
    {
      id: 's3-meaning', type: 'choice', coach: 'blu', itemId: '你', skill: 'meaning',
      title: 'Ghép chữ với nghĩa',
      prompt: 'Chữ này đọc là nǐ. Nghĩa của nó là gì?',
      stimulus: { hanzi: '你', pinyin: 'nǐ' },
      options: [['tôi', 'Người đang nói'], ['bạn', 'Người đang nghe'], ['anh ấy', 'Người được nhắc tới'], ['chúng ta', 'Một nhóm người']],
      answer: 1,
      hint: 'Khi chào ai đó, bạn nói với “người đang nghe”.',
      explain: '你 nghĩa là “bạn” — đại từ rất thường gặp.',
    },
    {
      id: 's4-complete', type: 'choice', coach: 'bap', itemId: '好', skill: 'read',
      title: 'Hoàn thành lời chào',
      prompt: 'Chọn chữ còn thiếu để thành “xin chào”.',
      stimulus: { hanzi: '你 ＿', pinyin: '' },
      options: [['好', 'hǎo · tốt, khoẻ'], ['是', 'shì · là'], ['我', 'wǒ · tôi'], ['吗', 'ma · trợ từ hỏi']],
      answer: 0,
      hint: 'Chữ cần tìm nghĩa là “tốt, khoẻ”.',
      explain: '你好 — nǐ hǎo: “bạn” + “tốt” = xin chào.',
    },
    {
      id: 's5-dialog', type: 'choice', coach: 'bap', itemId: '你好', skill: 'meaning',
      title: 'Hội thoại mini',
      prompt: 'Bắp chào bạn. Bạn đáp lại thế nào?',
      stimulus: { bubble: 'Bắp: Nǐ hǎo!' },
      options: [['Nǐ hǎo!', 'Chào bạn!'], ['Wǒ shì Blu.', 'Tôi là Blu.'], ['Bù hǎo.', 'Không ổn.'], ['Xièxie.', 'Cảm ơn.']],
      answer: 0,
      hint: 'Được chào thì chào lại bằng đúng câu đó.',
      explain: 'Nǐ hǎo! — chào lại bằng chính lời chào là tự nhiên nhất.',
    },
    {
      id: 's6-speak', type: 'speak', coach: 'blu', itemId: '你好', skill: 'speak',
      title: 'Nói theo mẫu',
      prompt: 'Nghe mẫu, ghi âm, nghe lại rồi so với mẫu.',
      hanzi: '你好', pinyin: 'nǐ hǎo', audio: { text: '你好' },
      tips: [
        'Hai thanh 3 đứng liền nhau: chữ đầu đọc gần như thanh 2 (ní hǎo). Vẫn viết là nǐ hǎo.',
        '“h” trong hǎo nhẹ, gần với “kh” trong tiếng Việt chứ không phải “h” thật nhẹ.',
      ],
    },
    { id: 's7-write-ni', type: 'write', coach: 'bap', itemId: '你', skill: 'write', title: 'Viết chữ 你' },
    { id: 's8-write-hao', type: 'write', coach: 'blu', itemId: '好', skill: 'write', title: 'Viết chữ 好' },
    {
      id: 's9-order', type: 'order', coach: 'blu', itemId: '你好', skill: 'read',
      title: 'Ghép lời chào',
      prompt: 'Chạm các chữ theo thứ tự để tạo “xin chào”.',
      tokens: ['好', '你'], target: ['你', '好'],
      hint: 'Người được chào đứng trước.',
      explain: '你好 = 你 (bạn) + 好 (tốt) → “chào bạn”.',
    },
    {
      id: 's10-exit', type: 'choice', coach: 'bap', itemId: '你好', skill: 'audio', exit: true,
      title: 'Vé ra cửa: nghe và chọn chữ',
      prompt: 'Bạn bước vào quán và nghe người phục vụ chào. Chọn đúng chữ bạn vừa nghe — không có Pinyin hỗ trợ.',
      audio: { text: '你好' },
      options: [['你好', 'Xin chào'], ['谢谢', 'Cảm ơn'], ['再见', 'Tạm biệt'], ['对不起', 'Xin lỗi']],
      revealSub: true, answer: 0,
      hint: 'Chữ đầu tiên là “bạn”.',
      explain: '你好 là lời chào. Bạn vừa nối được âm → chữ mà không cần Pinyin.',
    },
    {
      id: 'c1-greet', type: 'compose', coach: 'blu', itemId: '你好', skill: 'produce',
      title: 'Tự viết: chào lại Blu',
      task: 'Blu vừa chào bạn: “你好！”. Hãy tự viết câu chào lại Blu.',
      accept: 'Gõ chữ Hán (你好) hoặc Pinyin có dấu (nǐ hǎo). Gõ số thanh cũng được: ni3 hao3.',
      need: [{ any: ['你好'], ask: 'Câu của bạn đã có lời chào chưa? Người Trung chào nhau bằng hai chữ nào?', fix: 'Dùng 你好 (nǐ hǎo).' }],
      model: { hanzi: '你好！', pinyin: 'Nǐ hǎo!' },
    },

    /* ================= Bài 2 ================= */
    {
      id: 'l2-meaning-wo', type: 'choice', coach: 'bap', itemId: '我', skill: 'meaning',
      title: 'Chữ mới: 我',
      prompt: 'Chữ này đọc là wǒ. Đoán xem nghĩa là gì?',
      stimulus: { hanzi: '我', pinyin: 'wǒ' },
      options: [['tôi', 'Người đang nói'], ['bạn', 'Người đang nghe'], ['là', 'Động từ nối'], ['không', 'Phủ định']],
      answer: 0,
      hint: 'Bạn đã biết 你 là “bạn”. Chữ này là người đối diện của 你.',
      explain: '我 (wǒ) = tôi. 你 (nǐ) = bạn. Cả hai đều mang thanh 3.',
    },
    {
      id: 'l2-tone-shi', type: 'choice', coach: 'blu', itemId: '是', skill: 'tone',
      title: 'Nghe thanh của 是',
      prompt: 'Nghe chữ 是 (nghĩa: là), rồi chọn thanh điệu.',
      audio: { text: '是' },
      options: [['shī', 'Thanh 1 · cao, phẳng'], ['shí', 'Thanh 2 · đi lên'], ['shǐ', 'Thanh 3 · hạ thấp rồi nhấc lên'], ['shì', 'Thanh 4 · đi xuống dứt khoát']],
      answer: 3,
      hint: 'Âm này rơi xuống nhanh, giống khi ra lệnh “Đi!”.',
      explain: '是 shì mang thanh 4: đi từ cao xuống thấp, dứt khoát. “sh” uốn đầu lưỡi lên (gần “s” uốn lưỡi của giọng miền Nam), đừng đọc thành “x”.',
    },
    {
      id: 'l2-read-bu', type: 'choice', coach: 'bap', itemId: '不', skill: 'read',
      title: 'Đọc chữ 不',
      prompt: 'Chữ 不 nghĩa là “không”. Khi đứng một mình, nó đọc thế nào?',
      stimulus: { hanzi: '不', pinyin: '' },
      options: [['bū', 'Thanh 1'], ['bú', 'Thanh 2'], ['bǔ', 'Thanh 3'], ['bù', 'Thanh 4']],
      answer: 3,
      hint: 'Giống 是, chữ này cũng đi xuống dứt khoát.',
      explain: '不 gốc là bù (thanh 4). Nhưng khi đứng trước một chữ thanh 4, nó đổi thành bú — câu tiếp theo sẽ thấy.',
    },
    {
      id: 'l2-sandhi-bushi', type: 'choice', coach: 'blu', itemId: '不是', skill: 'read',
      title: 'Bẫy biến thanh: 不是',
      prompt: '不 (bù) + 是 (shì, thanh 4). Ghép lại, người ta đọc là gì?',
      stimulus: { hanzi: '不是', pinyin: '' },
      options: [['bù shì', 'Giữ nguyên thanh 4'], ['bú shì', '不 đổi sang thanh 2'], ['bù shí', '是 đổi sang thanh 2'], ['bǔ shì', '不 đổi sang thanh 3']],
      answer: 1,
      hint: 'Hai thanh 4 liền nhau rất khó đọc. Chữ đầu sẽ đổi.',
      explain: 'Quy tắc: 不 đứng trước thanh 4 thì đọc thành bú. Nên 不是 đọc là bú shì. Nhiều sách cũng viết luôn là bú shì.',
    },
    {
      id: 'l2-order-woshi', type: 'order', coach: 'bap', itemId: '我是', skill: 'read',
      title: 'Giới thiệu bản thân',
      prompt: 'Ghép thành câu “Tôi là Bắp.”',
      tokens: ['是', 'Bắp', '我'], target: ['我', '是', 'Bắp'],
      hint: 'Giống tiếng Việt: tôi → là → tên.',
      explain: '我是 Bắp。 = Tôi là Bắp. Thứ tự giống hệt tiếng Việt.',
    },
    {
      id: 'l2-ma-question', type: 'choice', coach: 'blu', itemId: '吗', skill: 'read',
      title: 'Biến câu thành câu hỏi',
      prompt: 'Câu 你是 Blu。 nghĩa là “Bạn là Blu.” Muốn hỏi “Bạn là Blu phải không?” thì viết thế nào?',
      options: [['吗你是 Blu？', ''], ['你吗是 Blu？', ''], ['你是 Blu 吗？', ''], ['你是吗 Blu？', '']],
      answer: 2,
      hint: 'Trong tiếng Việt, “không?” đứng ở đâu trong câu hỏi?',
      explain: '吗 (ma, thanh nhẹ) đặt ở CUỐI câu để biến câu khẳng định thành câu hỏi có/không. Giữ nguyên thứ tự các chữ còn lại.',
    },
    {
      id: 'l2-dialog', type: 'choice', coach: 'bap', itemId: '不是', skill: 'meaning',
      title: 'Hội thoại: nhận nhầm người',
      prompt: 'Bắp nhìn Blu và hỏi nhầm. Blu nên trả lời thế nào?',
      stimulus: { bubble: 'Bắp: 你是 Bắp 吗？ (Bạn là Bắp phải không?)' },
      options: [['不是，我是 Blu。', 'Không phải, tôi là Blu.'], ['是，我是 Blu。', 'Phải, tôi là Blu.'], ['你好吗？', 'Bạn khoẻ không?'], ['我不是。你是 Blu。', 'Tôi không phải. Bạn là Blu.']],
      answer: 0,
      hint: 'Blu không phải Bắp, nên câu trả lời mở đầu bằng “không phải”.',
      explain: '不是 (bú shì) = không phải. Trả lời câu hỏi 是…吗？ bằng 是 (phải) hoặc 不是 (không phải), rồi nói thông tin đúng.',
    },
    {
      id: 'l2-audio-nihaoma', type: 'choice', coach: 'blu', itemId: '你好吗', skill: 'audio',
      title: 'Nghe câu hỏi thăm',
      prompt: 'Nghe câu sau, rồi chọn nghĩa đúng.',
      audio: { text: '你好吗' },
      options: [['Bạn khoẻ không?', ''], ['Xin chào', ''], ['Bạn là ai?', ''], ['Tôi khoẻ', '']],
      answer: 0,
      hint: 'Có thêm chữ 吗 ở cuối nên đây là câu hỏi.',
      explain: '你好吗？ (nǐ hǎo ma?) = Bạn khoẻ không? Đây là câu trong sách học; khi gặp nhau, người bản xứ thường chỉ nói 你好.',
    },
    {
      id: 'l2-speak-woshi', type: 'speak', coach: 'bap', itemId: '我是', skill: 'speak',
      title: 'Nói: 我是…',
      prompt: 'Nghe mẫu “wǒ shì”, ghi âm rồi so sánh. Bạn có thể nói thêm tên mình sau đó.',
      hanzi: '我是', pinyin: 'wǒ shì', audio: { text: '我是' },
      tips: [
        '“sh” trong shì: uốn đầu lưỡi lên gần vòm miệng (gần “s” uốn lưỡi của giọng miền Nam), đừng đọc thành “x”.',
        'wǒ hạ thấp (thanh 3), shì rơi xuống dứt khoát (thanh 4). Đọc liền: wǒ shì.',
      ],
    },
    { id: 'l2-write-wo', type: 'write', coach: 'blu', itemId: '我', skill: 'write', title: 'Viết chữ 我' },
    { id: 'l2-write-shi', type: 'write', coach: 'bap', itemId: '是', skill: 'write', title: 'Viết chữ 是' },
    {
      id: 'c2-intro', type: 'compose', coach: 'bap', itemId: '我是', skill: 'produce',
      title: 'Tự viết: giới thiệu bản thân',
      task: 'Bắp hỏi: “你是 Blu 吗？”. Bạn không phải Blu. Hãy trả lời và nói bạn là ai (tên bạn viết bằng chữ Latinh).',
      accept: 'Ví dụ khung câu: 不是，我是 + tên. Gõ chữ Hán hoặc Pinyin có dấu.',
      need: [
        { any: ['不是'], ask: 'Bạn có phải Blu không? Câu trả lời nên mở đầu bằng từ nào để nói “không phải”?', fix: 'Mở đầu bằng 不是 (bú shì).' },
        { any: ['我是'], ask: 'Bạn đã nói “tôi là …” chưa? Hai chữ nào nghĩa là “tôi là”?', fix: 'Thêm 我是 (wǒ shì) + tên bạn.' },
      ],
      model: { hanzi: '不是，我是 Lan。', pinyin: 'Bú shì, wǒ shì Lan.' },
    },
    {
      id: 'l2-exit', type: 'choice', coach: 'blu', itemId: '不是', skill: 'audio', exit: true,
      title: 'Vé ra cửa: nghe và chọn chữ',
      prompt: 'Bắp hỏi một bạn mèo: “你是 Blu 吗？”. Nghe câu trả lời rồi chọn đúng chữ — không có Pinyin.',
      audio: { text: '不是' },
      options: [['不是', 'Không phải'], ['是', 'Phải'], ['我是', 'Tôi là'], ['你是', 'Bạn là']],
      revealSub: true, answer: 0,
      hint: 'Có hai âm, âm đầu là “không”.',
      explain: '不是 (bú shì) = không phải. Nghe ra được biến thanh bú là bạn đã tiến rất xa.',
    },

    /* ================= Bài 3 ================= */
    {
      id: 'l3-audio-xiexie', type: 'choice', coach: 'bap', itemId: '谢谢', skill: 'audio',
      title: 'Nghe và hiểu',
      prompt: 'Blu đưa bạn một chiếc bánh và bạn nghe câu này. Nghĩa là gì?',
      audio: { text: '谢谢' },
      options: [['Cảm ơn', ''], ['Xin chào', ''], ['Tạm biệt', ''], ['Không phải', '']],
      answer: 0,
      hint: 'Câu này thường nói khi nhận quà.',
      explain: '谢谢 (xièxie) = cảm ơn.',
    },
    {
      id: 'l3-neutral', type: 'choice', coach: 'blu', itemId: '谢谢', skill: 'read',
      title: 'Thanh nhẹ',
      prompt: 'Trong 谢谢, chữ thứ hai đọc nhẹ và ngắn (thanh nhẹ, không có dấu). Pinyin đúng là gì?',
      stimulus: { hanzi: '谢谢', pinyin: '' },
      options: [['xièxiè', 'Hai thanh 4'], ['xièxie', 'Thanh 4 + thanh nhẹ'], ['xiéxie', 'Thanh 2 + thanh nhẹ'], ['xiēxie', 'Thanh 1 + thanh nhẹ']],
      answer: 1,
      hint: 'Thanh nhẹ không có dấu trên chữ.',
      explain: 'xièxie: chữ đầu thanh 4, chữ sau thanh nhẹ (không dấu, đọc lướt). Giống chữ 吗 (ma) ở bài trước.',
    },
    {
      id: 'l3-meaning-zaijian', type: 'choice', coach: 'bap', itemId: '再见', skill: 'meaning',
      title: 'Ghép từ với nghĩa',
      prompt: '再 (zài) = lại, 见 (jiàn) = gặp. Vậy 再见 nghĩa là gì?',
      stimulus: { hanzi: '再见', pinyin: 'zàijiàn' },
      options: [['tạm biệt', 'Hẹn gặp lại'], ['xin chào', 'Lần đầu gặp'], ['cảm ơn', 'Biết ơn'], ['không có gì', 'Đáp lời cảm ơn']],
      answer: 0,
      hint: '“Gặp lại” — khi nào người ta nói câu này?',
      explain: '再见 = “gặp lại” → tạm biệt. Hai chữ đều thanh 4: zài jiàn, đọc dứt khoát.',
    },
    {
      id: 'l3-dialog', type: 'choice', coach: 'blu', itemId: '不客气', skill: 'meaning',
      title: 'Hội thoại: đáp lời cảm ơn',
      prompt: 'Bạn giúp Blu nhặt đồ. Blu cảm ơn bạn. Bạn đáp lại thế nào?',
      stimulus: { bubble: 'Blu: 谢谢！' },
      options: [['不客气！', 'Không có gì!'], ['再见！', 'Tạm biệt!'], ['你好！', 'Xin chào!'], ['不是！', 'Không phải!']],
      answer: 0,
      hint: 'Tiếng Việt hay đáp “Không có gì”.',
      explain: '不客气 (bú kèqi) = không có gì, đừng khách sáo. Đây là cách đáp phổ biến nhất khi được cảm ơn.',
    },
    {
      id: 'l3-sandhi-bukeqi', type: 'choice', coach: 'bap', itemId: '不客气', skill: 'read',
      title: 'Nhớ lại quy tắc của 不',
      prompt: '客 đọc là kè (thanh 4). Vậy 不客气 đọc thế nào?',
      stimulus: { hanzi: '不客气', pinyin: '' },
      options: [['bù kèqi', ''], ['bú kèqi', ''], ['bǔ kèqi', ''], ['bù kéqi', '']],
      answer: 1,
      hint: 'Giống hệt 不是 ở bài 2.',
      explain: '不 đứng trước thanh 4 (kè) nên đọc là bú: bú kèqi. 气 ở đây đọc nhẹ.',
    },
    {
      id: 'l3-order-bukeqi', type: 'order', coach: 'blu', itemId: '不客气', skill: 'read',
      title: 'Ghép “không có gì”',
      prompt: 'Chạm các chữ theo đúng thứ tự để thành “không có gì”.',
      tokens: ['气', '不', '客'], target: ['不', '客', '气'],
      hint: 'Bắt đầu bằng chữ “không”.',
      explain: '不客气 = 不 (không) + 客气 (khách sáo) → “đừng khách sáo”.',
    },
    {
      id: 'l3-tone-jian', type: 'choice', coach: 'bap', itemId: '见', skill: 'tone',
      title: 'Nghe thanh của 见',
      prompt: 'Nghe chữ 见 (gặp), rồi chọn thanh điệu.',
      audio: { text: '见' },
      options: [['jiān', 'Thanh 1 · cao, phẳng'], ['jián', 'Thanh 2 · đi lên'], ['jiǎn', 'Thanh 3 · hạ thấp rồi nhấc lên'], ['jiàn', 'Thanh 4 · đi xuống dứt khoát']],
      answer: 3,
      hint: 'Cũng giống 是 và 再.',
      explain: '见 jiàn mang thanh 4. “j” đọc gần “ch” tiếng Việt nhưng lưỡi chạm sau răng dưới, không bật hơi.',
    },
    {
      id: 'l3-speak-xiexie', type: 'speak', coach: 'blu', itemId: '谢谢', skill: 'speak',
      title: 'Nói: 谢谢',
      prompt: 'Nghe mẫu, ghi âm, nghe lại rồi so với mẫu.',
      hanzi: '谢谢', pinyin: 'xièxie', audio: { text: '谢谢' },
      tips: [
        '“x” gần chữ “x” tiếng Việt nhưng môi dẹt sang hai bên, đầu lưỡi đặt sau răng dưới.',
        'Chữ đầu rơi xuống (thanh 4), chữ sau đọc nhẹ và ngắn hơn hẳn.',
      ],
    },
    { id: 'l3-write-zai', type: 'write', coach: 'bap', itemId: '再', skill: 'write', title: 'Viết chữ 再' },
    { id: 'l3-write-jian', type: 'write', coach: 'blu', itemId: '见', skill: 'write', title: 'Viết chữ 见' },
    {
      id: 'c3-thanks', type: 'compose', coach: 'blu', itemId: '不客气', skill: 'produce',
      title: 'Tự viết: đáp lời và chào tạm biệt',
      task: 'Blu nói: “谢谢！” rồi chuẩn bị về. Hãy đáp lời cảm ơn và chào tạm biệt Blu.',
      accept: 'Viết 2 ý trong một câu. Gõ chữ Hán hoặc Pinyin có dấu.',
      need: [
        { any: ['不客气'], ask: 'Khi được cảm ơn, bạn đáp “không có gì” bằng ba chữ nào?', fix: 'Đáp bằng 不客气 (bú kèqi).' },
        { any: ['再见'], ask: 'Bạn đã chào tạm biệt chưa? Từ nào nghĩa là “gặp lại”?', fix: 'Thêm 再见 (zàijiàn).' },
      ],
      model: { hanzi: '不客气！再见！', pinyin: 'Bú kèqi! Zàijiàn!' },
    },
    {
      id: 'l3-exit', type: 'choice', coach: 'bap', itemId: '再见', skill: 'audio', exit: true,
      title: 'Vé ra cửa: nghe và chọn chữ',
      prompt: 'Bạn rời quán và nghe người phục vụ nói. Chọn đúng chữ bạn vừa nghe — không có Pinyin.',
      audio: { text: '再见' },
      options: [['再见', 'Tạm biệt'], ['谢谢', 'Cảm ơn'], ['你好', 'Xin chào'], ['不客气', 'Không có gì']],
      revealSub: true, answer: 0,
      hint: 'Hai âm, đều rơi xuống dứt khoát.',
      explain: '再见 (zàijiàn) = tạm biệt. Bạn đã có đủ: chào — giới thiệu — cảm ơn — tạm biệt.',
    },
  ];

  // Bài trò chuyện với AI nằm ngoài lesson: không chấm điểm, chỉ hiện khi trợ lý AI được bật.
  const chatStep = {
    id: 'chat-greet', type: 'chat', coach: 'blu', itemId: '你好', skill: 'chat', title: 'Trò chuyện với Blu',
    prompt: 'Blu vừa gặp bạn lần đầu. Hãy chào lại và trò chuyện bằng những gì đã học. Bạn có thể gõ Pinyin hoặc chữ Hán, Blu sẽ nhắc nếu cần.',
    opening: { zh: '你好！', pinyin: 'nǐ hǎo!', vi: 'Xin chào!' },
  };
  const stepById = Object.fromEntries([...steps, chatStep].map((s) => [s.id, s]));

  const lessons = {
    'l1-nihao': { id: 'l1-nihao', n: 1, title: 'Chào hỏi tự nhiên', minutes: 8, intro: 'Nghe, nói, đọc, viết <b lang="zh-Hans">你好</b> (nǐ hǎo) trong một bài.',
      stepIds: ['s1-tone', 's2-audio', 's3-meaning', 's4-complete', 's5-dialog', 's6-speak', 's7-write-ni', 's8-write-hao', 's9-order', 'c1-greet', 's10-exit'] },
    'l2-woshi': { id: 'l2-woshi', n: 2, title: 'Tôi là…', minutes: 10, intro: 'Giới thiệu bản thân với <b lang="zh-Hans">我是</b>, phủ định bằng <b lang="zh-Hans">不是</b>, hỏi bằng <b lang="zh-Hans">吗</b>.',
      stepIds: ['l2-meaning-wo', 'l2-tone-shi', 'l2-read-bu', 'l2-sandhi-bushi', 'l2-order-woshi', 'l2-ma-question', 'l2-dialog', 'l2-audio-nihaoma', 'l2-speak-woshi', 'l2-write-wo', 'l2-write-shi', 'c2-intro', 'l2-exit'] },
    'l3-xiexie': { id: 'l3-xiexie', n: 3, title: 'Cảm ơn & tạm biệt', minutes: 10, intro: 'Cảm ơn bằng <b lang="zh-Hans">谢谢</b>, đáp <b lang="zh-Hans">不客气</b>, chào về bằng <b lang="zh-Hans">再见</b>.',
      stepIds: ['l3-audio-xiexie', 'l3-neutral', 'l3-meaning-zaijian', 'l3-dialog', 'l3-sandhi-bukeqi', 'l3-order-bukeqi', 'l3-tone-jian', 'l3-speak-xiexie', 'l3-write-zai', 'l3-write-jian', 'c3-thanks', 'l3-exit'] },
  };
  const lessonOrder = ['l1-nihao', 'l2-woshi', 'l3-xiexie'];

  const units = [
    { id: 'u1', title: 'Chào hỏi tự nhiên', sub: 'Nghe · Nói · Đọc · Viết với 你 好', lessonId: 'l1-nihao' },
    { id: 'u2', title: 'Tôi là…', sub: '我 · 是 · 不是 · câu hỏi 吗', lessonId: 'l2-woshi' },
    { id: 'u3', title: 'Cảm ơn & tạm biệt', sub: '谢谢 · 不客气 · 再见 · thanh nhẹ', lessonId: 'l3-xiexie' },
    { id: 'u4', title: 'Pinyin và 4 thanh điệu', sub: 'Âm bật hơi, tone pairs', soon: true },
    { id: 'u5', title: 'Checkpoint tuần 1', sub: 'Hội thoại chào hỏi 30 giây', soon: true },
  ];

  // Chữ có dữ liệu nét (vendor/hanzi-data.js): tô → chép → viết từ nhớ.
  const writeChars = { '你': '你', '好': '好', '我': '我', '是': '是', '再': '再', '见': '见' };

  window.Buzz = window.Buzz || {};
  window.Buzz.Content = { version: '0.5.0', legacyIds: { ni: '你', hao: '好', nihao: '你好', wo: '我', shi: '是', bu: '不', ma: '吗', woshi: '我是', bushi: '不是', nihaoma: '你好吗', xiexie: '谢谢', bukeqi: '不客气', zai: '再', jian: '见', zaijian: '再见' }, items, steps, stepById, lessons, lessonOrder, units, skillLabels, writeChars, viDistractors };
})();
