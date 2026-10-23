# BuzzLingo v0.6 — Lộ trình HSK 3.0 đủ 6 cấp

BuzzLingo giờ có đủ **HSK 1–6** theo chuẩn HSK 3.0 (GF0025-2021): 5.456 từ. Ba cấp mới 4–5–6 (3.211 từ) được soạn theo đúng cách của cấp 1–3: mỗi bài có từ mới, một điểm ngữ pháp kèm ví dụ, hội thoại **chỉ dùng từ đã học tới bài đó**, chữ luyện viết và các bước luyện tự sinh.

## Số liệu cấp mới

| Cấp | Số từ | Chương | Bài | Câu hội thoại | Chữ luyện viết |
|---|---|---|---|---|---|
| HSK 4 | 1.000 | 17 | 99 | 594 | 188 |
| HSK 5 | 1.071 | 20 | 109 | 654 | 174 |
| HSK 6 | 1.140 | 21 | 110 | 661 | 170 |

Build kiểm tra cả 6 cấp: 0 lỗi, 0 cảnh báo. Tổng cộng 572 bài, 3.464 câu hội thoại.

## Thay đổi trong app

- Lộ trình có 6 tab HSK 1–6. Cấp sau mở khi học xong hoặc thi vượt cấp trước; gói nội dung từng cấp nạp theo nhu cầu.
- Sửa lỗi mất tiếng trên iPhone (Safari): đọc lại danh sách giọng mỗi lần phát, tự gỡ kẹt bộ đọc, chỉ báo "không có giọng" khi phát thật sự thất bại.

## Thay đổi trong công cụ nội dung

- `tools/import-hsk.mjs` nhập đủ 6 cấp; Pinyin đa âm cấp 4–6 chọn tay.
- Luật mới: 看 / 当 đọc mặc định kàn / dāng; 得了 chỉ là một từ khi đứng đầu vế câu; không ghép 个人 sau 多. Xem `content/README.md`.
- Kiểm thử: 50 kiểm thử đơn vị, 141 kiểm thử trình duyệt (thêm luồng I: nạp gói HSK 4–6, mở cấp 6, học trọn một bài HSK 6).

## Cần người duyệt trước khi phát hành

Nội dung HSK 2–6 là **bản nháp do AI soạn**, đã qua kiểm tra máy (từ vựng, thứ tự học, Pinyin) nhưng chưa qua giáo viên.

1. Nghĩa tiếng Việt của 3.211 từ HSK 4–6 (`content/vi/hsk4.tsv`, `hsk5.tsv`, `hsk6.tsv`).
2. Độ tự nhiên của khoảng 1.900 câu hội thoại HSK 4–6. Vì chỉ được dùng từ đã học nên đôi chỗ hơi "sách vở".
3. Các bài gom chữ đơn và chữ đa âm ở cuối HSK 6 (本, 成, 副, 冲, 露, 蒙, 涨, 转…): nên xem kỹ cách đọc.
4. Chủ đề nhạy cảm (tội phạm, quân sự, chính trị) đã viết ở mức trung tính, mang tính kiến thức; cần người duyệt xác nhận văn phong.
