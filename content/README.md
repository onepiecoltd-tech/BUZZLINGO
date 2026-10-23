# Nội dung HSK 3.0 (cấp 1–6)

Mọi nội dung học nằm ở đây, tách khỏi giao diện. `tools/build-content.mjs` đọc các file này, kiểm tra, rồi sinh gói `dist/content/hsk{1..6}.js` mà app nạp.

```bash
node tools/build-content.mjs --check     # chỉ kiểm tra
node tools/build-content.mjs --strokes <thư mục hanzi-writer-data>   # dựng gói + dữ liệu nét chữ
```

Build dừng nếu có lỗi. Cảnh báo không chặn build nhưng nên xử lý hết (hiện tại: 0 lỗi, 0 cảnh báo).

## Các file

| File | Nội dung |
|---|---|
| `hsk/hsk30.json` | Danh sách từ chuẩn HSK 3.0: 500 + 772 + 973 = 2.245 từ, kèm Pinyin và từ loại. Sinh bằng `tools/import-hsk.mjs`, không sửa tay. |
| `vi/hsk{1..6}.tsv` | Nghĩa tiếng Việt, mỗi dòng `id<TAB>nghĩa`. Bản nháp AI, cần người duyệt. |
| `extra.tsv` | Từ ngoài danh sách HSK: `id<TAB>pinyin<TAB>nghĩa<TAB>loại`. Loại `name` (tên riêng, luôn dùng được) hoặc `particle`. |
| `curriculum/hsk{1..6}.json` | Chương, bài, ngữ pháp, hội thoại. |

## Mã từ

Mã từ là chữ Hán (`开始`). Khi một chữ có nhiều mục trong danh sách chuẩn, mục sau thêm hậu tố: `还~huan2`, `为~wei2` (wéi), `为~wei3` (wèi, giới từ), `背~bei2` (bēi), `背~bei3` (bèi, cái lưng), `精神~jingshen2` (jīngshen, tỉnh táo). Phần trước dấu `~` là chữ Hán thật.

## Định dạng một bài

```json
{
  "id": "h3-02",
  "title": "Thói quen lâu năm",
  "words": "每 总是 总 始终 仍然 仍 已 久 旧",
  "extra": "",
  "g": ["Tiêu đề ngữ pháp", "Giải thích", [["例句", "Nghĩa"], ...]],
  "d": [["Người nói", "中文句子", "Nghĩa tiếng Việt"], ...],
  "w": "每旧"
}
```

- `words`: từ mới của bài, mỗi từ HSK chỉ được dạy một lần trong toàn khoá.
- `d`: hội thoại, ít nhất 3 câu. **Mọi từ trong hội thoại và ví dụ phải đã học tới bài này.** Build báo lỗi nếu có từ chưa học.
- `w`: chữ luyện viết.
- `"complete": true` ở đầu file: build báo lỗi nếu còn từ của cấp chưa xếp vào bài.

## Ghi chú trong câu tiếng Trung

| Cách viết | Ý nghĩa |
|---|---|
| `得{děi}`, `行{háng}`, `重{chóng}`, `背{bēi}` | Chọn cách đọc cho chữ đa âm. Nếu có mục từ khớp cách đọc đó, câu được gắn vào mục từ ấy. |
| `精神{jīngshen}` | Chú thích sau chữ cuối của từ nhiều chữ: chọn mục từ có đúng Pinyin đó. |
| `就\|要`, `你的\|话` | Ép ranh giới từ khi máy tách sai (`就要` = sắp, `的话` = nếu). |

Dấu `|` chỉ dùng trong câu (`d`, ví dụ trong `g`), không dùng trong phần giải thích.

## Luật tự động khi tách từ và ghép Pinyin

- Ưu tiên từ đã học; trong bài dạy một chữ đa âm thì nghĩa mới được ưu tiên (trừ 了, 只, 得: cách đọc do luật hoặc chú thích quyết định).
- 不: bú trước thanh 4; đọc nhẹ `bu` trong câu hỏi chính phản (`贵不贵`) và bổ ngữ khả năng (`听不懂`, `走不上去`, `理解不了`).
- 一: yí / yì theo thanh sau, giữ yī khi là số đếm, thứ tự, ngày tháng (vẫn biến thanh trước 百, 千).
- 了 sau `V不` / `V得` đọc liǎo. 只 sau số / 这 / 那 đọc zhī. 得 trước 了 / 到 / số đọc dé. 过 sau động từ đọc guo.
- `个人` không được nhận sau số hoặc 这 / 那 / 每 (`每个人` = mỗi người).
- Chữ 重, 背, 调 phải chú thích khi người học đã biết hơn một cách đọc; build cảnh báo nếu thiếu.

## Bổ sung cho HSK 4–6

- `看`, `当` luôn đọc kàn / dāng mặc định; muốn đọc kān (trông nom) hay dàng (coi là) phải chú thích: `看{kān}孩子`, `当{dàng}真`.
- `得了` chỉ được nhận là một từ (déle = thôi được) khi đứng đầu vế câu; `他得了金牌` đọc dé le.
- `个人` không được ghép sau `多` (`三十多个人`).
- Khi máy ghép nhầm từ đa âm mới của cấp cao (ví dụ `比如一座` thành `比 / 如一`), thêm `|`: `比如|一座`.
