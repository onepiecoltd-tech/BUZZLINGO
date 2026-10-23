# BuzzLingo v0.7 — Luyện nói với Gemini, rà soát nội dung HSK 4–6

## 1. Luyện nói có AI nhận xét (Gemini)

- Bước **Nói** trong bài học:
  - Trên trình duyệt có nhận dạng giọng nói (Chrome, Safari): bấm 🎤, máy nghe câu bạn nói, tô xanh chữ đúng, tô đỏ chữ thiếu hoặc sai, rồi có thể bấm **Hỏi AI** để Blu nhận xét.
  - Trên mọi nơi khác (kể cả app Windows): ghi âm rồi bấm **Gửi bản ghi cho AI**. Gemini nghe trực tiếp bản ghi, viết lại câu nó nghe được và chỉ ra chỗ cần sửa.
- **Trò chuyện với Blu** có nút 🎤: nói thay vì gõ. Blu trả lời bằng chữ và tự đọc to câu tiếng Trung.
- Máy chủ: Netlify Function `/api/coach` (`netlify/functions/coach.mjs`).
  - Mặc định dùng Gemini, model `gemini-3.5-flash-lite`.
  - API key nằm trong biến môi trường `GEMINI_API_KEY` trên Netlify, không bao giờ nằm trong `dist/`.
  - Mỗi lần ghi âm tối đa 5 giây; máy chủ nhận bản ghi tối đa khoảng 270 KB.
  - Mỗi người dùng có hạn mức 30 lượt mỗi ngày.

### Cài đặt (một lần)

```powershell
npx netlify-cli env:set GEMINI_API_KEY "khoá-lấy-ở-aistudio.google.com/apikey"
npx netlify-cli deploy --prod
```

Sau đó vào app, chọn **Cá nhân → Trợ lý AI → Bật**.

`netlify.toml` đã khai báo sẵn thư mục `dist` và thư mục functions, nên không cần chỉnh gì trên giao diện Netlify.

## 2. Kiểm tra giọng đọc

Đã kiểm tra trên cả 6 cấp: từ, ví dụ, hội thoại (nút "nghe cả bài" đọc lần lượt từng câu), chữ Hán trong truyện, các bước nghe và câu trả lời của Blu.

Lưu ý với app Windows: máy cần cài giọng tiếng Trung, trong **Settings → Time & language → Speech → Add voices → Chinese (Simplified)**.

## 3. Rà soát ngôn ngữ HSK 4–6

Đây là đợt rà soát của AI đóng vai người hiệu đính tiếng Trung. Bản rà soát này **không thay thế** việc giáo viên duyệt.

### Nghĩa tiếng Việt

Đã đọc hết 3.211 mục và sửa 21 mục:

| Cấp | Đã sửa |
|---|---|
| HSK 4 | 讲究, 度过, 充分, 根据, 应, 毛巾, 体操 |
| HSK 5 | 紧紧, 加以, 年度, 选修, 只见, 青, 愿, 相声 |
| HSK 6 | 名誉, 皮球, 起诉, 升学, 时节, 市民 |

Các mục được sửa thuộc ba loại lỗi:

- **Nghĩa sai:**
  - 时节 trước ghi "thời tiết", nay là "mùa, thời điểm trong năm".
  - 起诉 trước ghi "khởi tố", nay là "kiện, khởi kiện".
  - 升学 trước ghi "lên lớp", nay là "học lên cấp trên".
- **Nghĩa lặp lại:** ví dụ "trải qua, trải qua", "đầy đủ, đầy đủ".
- **Từ Hán Việt hiếm dùng:** ví dụ "thị dân", nay là "người dân thành phố".

### Hội thoại và ví dụ

Đã đọc khoảng 3.500 câu và viết lại khoảng 130 câu (HSK 4: 45, HSK 5: 45, HSK 6: 46 chuỗi thay đổi). Các loại lỗi chính:

- **Câu tiếng Trung không tự nhiên hoặc sai kết hợp từ.** Ví dụ:
  - 交换兴趣 → 交换看法
  - 服务很良好 → 服务良好
  - 年轻人盛行… → 年轻人中盛行…
  - 不时也该提醒 → 也该不时提醒
  - 挺起身体 → 挺直身体
  - 质量优质 → 优质产品
  - 红得通红 → 变得通红
- **Từ dùng sai ngữ cảnh.**
  - 移民 được dùng cho người từ nông thôn lên thành phố.
  - 登记 được dùng cho thủ tục ở sân bay.
  - 宽广 được dùng để tả phòng.
  - 刺激 được dùng theo nghĩa "căng thẳng".
  - 我老公是他们的叔叔: sai quan hệ họ hàng, vì người Trung gọi chị em gái của bố là 姑姑, không phải 阿姨.
- **Câu nhồi từ, lạc ý, hai lượt thoại không ăn khớp.**
  - Hỏi "什么样的寺?" mà đáp "对".
  - Nhân vật sắp ra sân bay lại chúc người kia "一路顺风".
  - Nhiều câu cuối bài gồm ba ý không liên quan, nay đã tách ra hoặc viết lại.
- **Lỗi bản dịch tiếng Việt.**
  - Câu tiếng Trung nói "ở nhà" nhưng bản dịch lại ghi "ở ký túc xá".
  - "Chàng trai" sửa thành "Cháu à" cho đúng lời một ông cụ.
  - "mùa không mưa" sửa thành "mùa khô".
- **Câu trích dẫn chưa chuẩn:** bỏ "天下没有不散的宴会", vì câu gốc là 筵席 hoặc 宴席.
- **Chủ đề nhạy cảm:**
  - Bỏ câu mang tính khẩu hiệu "党要为人民做事".
  - Bỏ câu "học bắn súng ở bảo tàng chiến tranh".
  - Viết lại bài tội phạm ở mức thông tin trung tính.
- **Pinyin:** sửa một lỗi tách từ, 推迟到 bị đọc thành "tuī chídào".

Sau khi sửa, mọi câu vẫn chỉ dùng từ đã học tới bài đó. Từ mới của từng bài vẫn xuất hiện trong ví dụ hoặc hội thoại của chính bài đó. Build cả 6 cấp: 0 lỗi, 0 cảnh báo.

### Vẫn nên để giáo viên xem

- Các bài chữ đa âm ở cuối HSK 6 (h6-104…110), nhất là:
  - 露出: hiện dùng lòu; từ điển chấp nhận cả lù và lòu.
  - 比画: hiện đọc bǐhuà; khẩu ngữ đọc bǐhua.
- Một số câu vẫn hơi "sách vở" vì chỉ được dùng từ đã học, ví dụ các từ văn viết như 此, 于, 罢了 trong hội thoại.
- Các bài quân sự, chính trị (HSK 4 bài 64–65, HSK 6 bài 55–61) đã ở mức trung tính, nhưng nên có người xác nhận văn phong phù hợp với đối tượng học.

## Kiểm thử

| Bộ kiểm thử | Kết quả |
|---|---|
| Đơn vị | 55 đạt |
| Trình duyệt | 141 đạt |
| Trợ lý AI và luyện nói (trình duyệt) | 63 đạt |
