# BuzzLingo v0.4 · Hệ thống câu hỏi + Phản biện

Giải nén đè vào thư mục `buzzlingo` (giữ nguyên cấu trúc thư mục). Không cần build. Dữ liệu học cũ trong trình duyệt vẫn dùng được: ai đã xong Bài 1 sẽ thấy Bài 2 mở sẵn.

## Có gì mới

**1. Ba bài học thật, mở lần lượt**
- Bài 1 · Chào hỏi (thêm bước tự viết câu) · Bài 2 · Tôi là… (我 是 不 吗, 不是, 你好吗) · Bài 3 · Cảm ơn & tạm biệt (谢谢 不客气 再见, thanh nhẹ).
- Hai bẫy biến thanh hay sai: 不是 đọc bú shì, 不客气 đọc bú kèqi.
- Luyện viết thêm 4 chữ 我 是 再 见 (đã kiểm tra số nét khớp dữ liệu).
- Chọn "Đã biết một ít" khi bắt đầu thì mở cả 3 bài. Học xong bài thì có nút "Học tiếp Bài n".

**2. Ngân hàng câu hỏi tự sinh (`dist/js/qbank.js`)**
- Từ mỗi mục, sinh câu theo kỹ năng: nghe chọn chữ, nghe chọn thanh, đọc chọn Pinyin, nghĩa ↔ chữ, ghép thứ tự.
- Đáp án nhiễu "khó đúng chỗ": cùng âm khác thanh (nī/ní/nǐ/nì), chữ và nghĩa ưu tiên lấy từ những gì đã học. Không lấy cách đọc biến thanh (ní hǎo) làm đáp án sai.
- **Ôn tập SRS giờ là câu hỏi có chấm** thay cho thẻ tự chấm, nên lịch ôn dựa trên kết quả kiểm tra thật.
- Phòng Nghe/Đọc sinh câu mới mỗi lần, chỉ trong phạm vi đã học. Thêm "Luyện tổng hợp" khi đã xong hết bài.
- **Luyện câu hay sai** (màn Ôn tập): câu mới cho những mục từng sai; không làm đổi lịch ôn.

**3. Tự đặt câu · Phản biện (`dist/js/critique.js`)**
- Mỗi bài có một bước tự viết câu theo tình huống. Gõ chữ Hán, Pinyin có dấu, hoặc số thanh (ni3 hao3); tên riêng viết chữ Latinh.
- Chạy **ngay trên máy, không cần AI**. App hiện lại câu đã hiểu ("Mình hiểu câu của bạn là: 我是 Lan"), rồi **hỏi ngược** từng lỗi. Gợi ý cụ thể chỉ hiện khi bạn bấm (và được ít XP hơn).
- Bắt được: thiếu/sai dấu thanh, biến thanh 不 và thanh 3 (chỉ nhắc, không tính sai), 吗 sai vị trí hoặc thiếu dấu ？, đảo chữ (好你, 客不气), 我是好, chữ chưa học, viết bằng tiếng Việt, thiếu ý đề yêu cầu.
- Nếu bật trợ lý AI: nút "Nhờ Blu phản biện" (chế độ `critique` ở proxy). AI nhận kết quả bộ kiểm tra làm mỏ neo, được dặn khen một điểm, hỏi gợi mở một câu và không viết lại câu đúng hộ. AI không ảnh hưởng điểm.
- Phòng mới "Tự đặt câu · Phản biện" ở trang chủ.

**4. Bộ câu hỏi vàng để chọn nhà cung cấp AI (`eval/`)**
- 50 ca, 6 nhóm (thanh điệu, phụ âm, nghĩa/ngữ pháp, phản biện, an toàn, đóng vai). Chấm tự động 5 tiêu chí, kèm token, độ trễ, chi phí. Báo cáo dạng markdown + CSV (có cột chấm tay) + JSON. Có `compare.mjs` để ghép bảng so sánh.
- Hướng dẫn: `eval/README.md`. Đường ống đã kiểm tra bằng mô hình giả; **chưa chạy với API thật** (cần key và mạng trên máy bạn).

## Kiểm tra đã chạy

- `npm test`: 43/43 (nội dung, ngân hàng câu hỏi, phản biện, proxy, bộ chấm).
- `npm run test:e2e`: 91/91 trên Chromium (thêm luồng: mở khoá bài, Bài 2 đầy đủ, phản biện, câu hay sai, "đã biết một ít").
- `npm run test:e2e:ai`: 43/43 (thêm AI phản biện với endpoint giả).

## Đoạn thêm vào README.md (mục "Tính năng")

```md
- 3 bài học (chào hỏi · tôi là… · cảm ơn & tạm biệt), mở lần lượt; mỗi bài có nghe, nói, đọc, viết và tự đặt câu.
- Ngân hàng câu hỏi tự sinh (`dist/js/qbank.js`): ôn tập SRS bằng câu có chấm, phòng luyện sinh câu mới mỗi lần, luyện câu hay sai.
- Phản biện câu tự viết chạy trên máy (`dist/js/critique.js`): hỏi ngược trước, gợi ý sau; AI phản biện là tuỳ chọn.
- Bộ câu hỏi vàng 50 ca + script so sánh nhà cung cấp AI (`eval/`).
```

## Việc nên làm tiếp

1. Chạy `eval/` với key thật cho 3–4 nhà cung cấp, đọc tay nhóm thanh điệu và phản biện, rồi chọn.
2. Thu audio người thật cho 15 mục hiện có (TTS trình duyệt đọc thanh chưa chuẩn).
3. Bài 4–5 (Pinyin bật hơi, checkpoint hội thoại) và bài chẩn đoán cho người "đã biết một ít".
