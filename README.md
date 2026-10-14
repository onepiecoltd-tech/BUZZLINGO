# BuzzLingo prototype

Prototype mobile-first cho người Việt bắt đầu học Mandarin (chữ giản thể + Pinyin). Bản này là HTML/CSS/JS không cần build, dùng để kiểm chứng UX trước khi chuyển sang React Native Expo.

## Phạm vi tương tác

- 5 khu vực: Hôm nay, Lộ trình HSK, Ôn SRS, Tiến bộ, Blueprint.
- Một bài học end-to-end gồm 4 dạng bài: nhận diện thanh điệu, nối âm-nghĩa, hoàn thành câu và phản xạ hội thoại.
- Bốn phòng luyện độc lập: Nghe có audio Mandarin, Nói ghi âm cục bộ, Đọc nối Hanzi–Pinyin–nghĩa, Viết có canvas tô chữ bằng chuột hoặc ngón tay.
- Flashcard SRS có lật thẻ và chọn lịch ôn; XP được cập nhật sau bài học.
- Responsive: mobile bottom navigation, desktop side navigation.

## Blueprint sản phẩm

- Đối tượng: người Việt chưa biết tiếng Trung; mục tiêu đầu là nói được, không bị ngợp bởi chữ Hán.
- Trục học: nghe âm → nhận diện thanh → hiểu nghĩa → thấy chữ → dùng trong hội thoại.
- `dist/assets/mascot-model-reference.png` là model chính thức cho cả hai linh vật. Bắp là chó cái tai dựng, trắng–nâu, nơ và hoodie vàng; Blu là mèo đực trắng tuyết, mắt xanh và hoodie xanh. Mọi biến thể phải giữ đúng đặc điểm này.
- MVP 4 tuần: Pinyin/thanh điệu; chào hỏi; số/tuổi/quốc tịch; gia đình/sở thích; gọi món; 60–90 Hanzi và checkpoint nền HSK 1.

## Kiến trúc app đề xuất

- Client: React Native + Expo Router, TypeScript, Zustand, NativeWind hoặc Tamagui, Expo Audio/Haptics/Notifications, SQLite offline.
- Backend: Supabase Auth + Postgres + Storage + Edge Functions. Dùng Row Level Security theo `user_id`.
- Nội dung: lesson JSON/MDX có schema/version, tách nội dung khỏi UI để tái dùng trên mobile/web.
- SRS: FSRS, trạng thái theo `user × learning_item × skill` để nghĩa, nghe, thanh điệu và viết có lịch riêng.
- Speech: gửi audio qua signed URL đến Edge Function; gọi dịch vụ pronunciation assessment; chấm theo âm tiết/Pinyin + contour thanh điệu, tránh phạt sai vì Hanzi đồng âm.

## Mô hình dữ liệu tối thiểu

`profiles`, `courses`, `units`, `lessons`, `learning_items`, `lesson_steps`, `attempts`, `skill_reviews`, `daily_progress`, `audio_assets`.

## Giả định

- Mandarin phổ thông, chữ giản thể, HSK 3.0 làm khung nhưng MVP chỉ tới nền HSK 1.
- Freemium không quảng cáo; tải bài để học offline; cloud sync khi có mạng.
- `dist/assets/buzzlingo-mascots-canonical.png` là asset ứng dụng hiện hành, dùng chung cho hero và avatar coach của cả Bắp lẫn Blu.
- Avatar coach dùng hai ảnh riêng `bap-coach-avatar.png` và `blu-coach-avatar.png`; hiển thị bằng `object-fit: contain` để toàn bộ tai và mặt luôn nằm gọn trong khung nhỏ.

## Nguồn tham chiếu sản phẩm

- Duolingo: bài ngắn, path, gamification, luyện nghe-nói và character practice — https://en.duolingo.com/course/zh/en/Learn-Ch
- Airlearn: “learn first, practice next”, giải thích ngữ pháp/văn hoá, giao diện tối giản — https://apps.apple.com/us/app/airlearn-language-learning/id6479639235
- Hanzii: từ điển Trung–Việt, offline, phạm vi người học từ đầu tới HSK6 — https://api.hanzii.net/
- HelloChinese: game-based curriculum, speech recognition, handwriting, native video, SRS — https://www.hellochinese.cc/
- Pleco: từ điển, OCR, handwriting, audio và flashcards tuỳ biến — https://www.pleco.com/
- ChineseSkill: lộ trình từ số 0 tới HSK4, bài ngắn và đa dạng activity — https://www.chineseskill.com/

## Chạy local

Mở `dist/index.html` trực tiếp hoặc phục vụ thư mục `dist/` bằng một static server.
