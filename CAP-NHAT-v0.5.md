# BuzzLingo v0.5 — Lộ trình HSK 3.0, cấp 1–3

Mục tiêu: học xong là **giao tiếp tự nhiên ở trình độ HSK 3** (B1 sơ). Toàn bộ 2.245 từ của chuẩn HSK 3.0 (500 + 772 + 973) được xếp vào bài theo tình huống giao tiếp. Mỗi bài có từ mới, một điểm ngữ pháp kèm ví dụ, một đoạn hội thoại **chỉ dùng từ đã học tới bài đó**, chữ luyện viết, và các bước luyện tự sinh (nghe, chọn nghĩa, sắp câu, nói, viết, tự đặt câu).

## Số liệu

| Cấp | Số từ | Chương | Bài | Câu hội thoại | Chữ luyện viết |
|---|---|---|---|---|---|
| HSK 1 | 500 | 13 | 66 (3 bài viết tay + 63 bài sinh) | 372 | 79 |
| HSK 2 | 772 | 14 | 86 | 523 | 88 |
| HSK 3 | 973 | 16 | 102 | 655 | 184 |

Build kiểm tra: 0 lỗi, 0 cảnh báo. Mỗi từ dạy đúng một lần; mọi câu chỉ dùng từ đã học.

## Chương HSK 3

1. Khởi động HSK 3 (开始, 需要, 希望, 每, 只有…才, 连…都, 除了…以外)
2. Bản thân và gia đình
3. Quê hương và thời gian (是…的, 曾经, 自从…以来)
4. Nhà cửa và sinh hoạt (câu 把, câu tồn hiện, câu 被)
5. Ăn uống và mua sắm (lượng từ, 值得, 极了)
6. Đi lại và du lịch (bổ ngữ xu hướng kép, 叫/让 bị động)
7. Học tập (V得了/V不了, 重写, 终于)
8. Nơi làm việc
9. Kinh doanh và sản xuất
10. Sức khoẻ và thể thao
11. Giải trí và truyền thông
12. Tình cảm và ứng xử (千万别, 麻烦你, 看起来/显得)
13. Nêu ý kiến và lập luận (由于…因此, 不仅…而且, 不论…都, 难道, 首先…其次)
14. Xã hội và môi trường
15. Kinh tế và công nghệ
16. Văn hoá và thế giới

## Thay đổi trong app

- Tab **HSK 1 · HSK 2 · HSK 3** trên Lộ trình; cấp sau mở khi học xong hoặc thi vượt cấp trước. Số bài đánh lại theo từng cấp (HSK 3 · Bài 1 … 102).
- Gói nội dung nạp theo nhu cầu: mở app chỉ nạp cấp đang học (hoặc cấp ngay sau cấp vừa thi vượt), các cấp còn lại nạp nền sau khoảng 1 giây. Thẻ ôn tập thuộc HSK 2/3 không còn lỗi khi mở app.
- Thi vượt cấp xong, trang Hôm nay đề xuất bài đầu của cấp tiếp theo thay vì quay về bài cũ.
- Phản biện câu tự viết: từ viết hoa giữa câu (Lan, Minh) được hiểu là tên riêng, không dò thành 蓝, 明.
- Dữ liệu người học cũ (mã bài v0.4) được chuyển mã tự động khi mở app.

## Thay đổi trong công cụ nội dung

- Pinyin chính xác hơn cho cả ba cấp: câu hỏi chính phản đọc nhẹ (`guì bu guì`), `一百` → yì bǎi, `收入不多` → bù duō, 了 = liǎo trong `吃不了`, 只 = zhī sau số, 得 = dé trong `得了金牌`, tách âm tiết đúng `bàngōngshì`, `yuángōng`, khoảng trắng trước ngoặc kép.
- Chú thích chọn cả mục từ (`精神{jīngshen}`), luật `个人` sau số/这/那/每, cảnh báo cho 重, 背, 调 khi người học đã biết hai cách đọc.
- Hướng dẫn định dạng: `content/README.md`.
- Kiểm thử: 49 kiểm thử đơn vị, 123 kiểm thử trình duyệt (thêm luồng H: nạp gói HSK 3 khi khởi động, mở cấp, học trọn một bài HSK 3), 43 kiểm thử AI.

## Cần người duyệt trước khi phát hành

Nội dung HSK 2 và HSK 3 là **bản nháp do AI soạn**, đã qua kiểm tra máy (từ vựng, thứ tự học, Pinyin) nhưng chưa qua giáo viên.

1. **Nghĩa tiếng Việt** của 772 từ HSK 2 và 973 từ HSK 3 (`content/vi/hsk2.tsv`, `hsk3.tsv`).
2. **Độ tự nhiên của hội thoại**: 1.178 câu HSK 2–3. Câu đã bị giới hạn trong từ đã học nên đôi chỗ hơi "sách vở".
3. **Chữ đa âm chọn theo ngữ cảnh**: 精神 (jīngshén / jīngshen), 背 (bēi / bèi), 行 (háng), 重 (chóng), 调 (diào / tiáo), 了 (liǎo), 得 (dé / děi), 为 (wéi).
4. **Mục trùng chữ cùng âm** trong danh sách chuẩn chỉ khác nghĩa: 把 / 把~ba2, 初 / 初~chu2, 任 / 任~ren2, 为 (HSK 2) / 为~wei3.
5. **Thông tin thực tế trong hội thoại**: Việt Nam 54 dân tộc, Trung Quốc 56 dân tộc, khoảng 50 triệu người Hoa ngoài Trung Quốc, văn minh Trung Hoa hơn 5.000 năm.
6. Mọi từ HSK 3 đều có trong hội thoại hoặc câu ví dụ, trừ 所长 (chỉ có ở thẻ từ).
