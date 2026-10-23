# BuzzLingo prototype

> Tài liệu chuẩn toàn dự án, bao gồm hình ảnh, sản phẩm, nội dung và kiến trúc: [`PROJECT_SOURCE.md`](PROJECT_SOURCE.md). Trạng thái thẩm định và tiêu chí nghiệm thu: [`AUDIT.md`](AUDIT.md).

Prototype mobile-first cho người Việt bắt đầu học Mandarin (chữ giản thể + Pinyin). Bản này là HTML/CSS/JS không cần build, dùng để kiểm chứng UX trước khi chuyển sang React Native Expo.

## Có gì mới ở v0.5 (chi tiết: [`CAP-NHAT-v0.5.md`](CAP-NHAT-v0.5.md))

- **Lộ trình HSK 3.0 cấp 1–3**: đủ 2.245 từ chuẩn (500 + 772 + 973), 254 bài trong 43 chương theo tình huống giao tiếp. Mỗi bài: từ mới, ngữ pháp kèm ví dụ, hội thoại chỉ dùng từ đã học, chữ luyện viết và bước luyện tự sinh.
- Tab HSK 1 · 2 · 3 trên Lộ trình, kiểm tra chương, thi vượt cấp; gói nội dung từng cấp nạp theo nhu cầu.
- Nội dung nằm trong `content/` (hướng dẫn: [`content/README.md`](content/README.md)), dựng bằng `node tools/build-content.mjs`. Nội dung HSK 2–3 là bản nháp AI, cần giáo viên duyệt.

## Có gì mới ở v0.4 (chi tiết: [`CAP-NHAT-v0.4.md`](CAP-NHAT-v0.4.md))

- **3 bài học thật**, mở lần lượt: Chào hỏi (`你好`) · Tôi là… (`我是`, `不是`, `吗`) · Cảm ơn & tạm biệt (`谢谢`, `不客气`, `再见`). Mỗi bài có nghe, nói, đọc, viết và một bước **tự đặt câu**.
- **Ngân hàng câu hỏi tự sinh** (`js/qbank.js`): ôn tập SRS bằng câu có chấm (không còn thẻ tự chấm), phòng Nghe/Đọc sinh câu mới mỗi lần, "Luyện câu hay sai", "Luyện tổng hợp". Đáp án nhiễu cùng âm khác thanh.
- **Phản biện câu tự viết** (`js/critique.js`), chạy trên máy: hỏi ngược trước, gợi ý cụ thể sau; bắt lỗi dấu thanh, biến thanh 不/thanh 3, vị trí 吗, đảo chữ, `我是好`, viết tiếng Việt. AI phản biện (chế độ `critique`) là tuỳ chọn, không ảnh hưởng điểm.
- **Bộ câu hỏi vàng 50 ca** + script so sánh nhà cung cấp AI: [`eval/README.md`](eval/README.md).
- Proxy AI hỗ trợ DeepSeek, OpenAI, Gemini, Meta Muse: [`docs/AI-COACH.md`](docs/AI-COACH.md).

## Phạm vi tương tác (v0.2)

- 5 mục cho người học: Hôm nay, Lộ trình, Ôn tập, Tiến bộ, Cá nhân. Blueprint nằm trong Cá nhân → Về dự án.
- Onboarding thật (tên, mục tiêu, thời gian/ngày, trình độ); mọi con số lấy từ dữ liệu người học.
- **Bài 1 `你好`** gồm 10 bước: nghe thanh, nghe hiểu, ghép nghĩa, hoàn thành câu, hội thoại, nói theo mẫu, viết `你` và `好` (tô → chép → viết từ nhớ), ghép lời chào, vé ra cửa nghe → chữ.
- Kết quả trung thực: lưu đúng/sai; câu sai quay lại sau 2–4 mục và được xếp ôn vào ngày hôm sau; XP chỉ cộng từ lượt làm bài thật (đúng lần đầu 10, dùng gợi ý 6, làm lại 4, sai 0).
- Resume: thoát giữa bài (nút × hoặc Esc) sẽ lưu vị trí; mở lại tiếp tục đúng câu.
- Nói: ghi âm → nghe lại → tự đánh giá. Có phát hiện có tiếng/không tiếng. **Chưa chấm phát âm tự động** và giao diện ghi rõ như vậy.
- Viết: Hanzi Writer kiểm tra thứ tự, hướng và vị trí nét (dữ liệu nét nhúng sẵn, chạy offline).
- SRS: FSRS-4.5 theo `item × skill`; nút chấm hiện khoảng ôn dự đoán; Ôn tập dùng thẻ đến hạn thật.
- Lưu bằng localStorage (xuất JSON / xoá dữ liệu trong Cá nhân). Nếu trình duyệt chặn lưu trữ, app báo rõ.
- Truy cập: dialog có focus trap, Esc, phím số 1–4 chọn đáp án, `aria-live`, `lang="zh-Hans"`, touch target ≥ 44 px, tôn trọng reduced motion.
- Thiết bị không có giọng Mandarin: app nói thật và cho bỏ qua bước nghe (không tính điểm).

## Blueprint sản phẩm

- Đối tượng: người Việt chưa biết tiếng Trung; mục tiêu đầu là nói được, không bị ngợp bởi chữ Hán.
- Trục học: nghe âm → nhận diện thanh → hiểu nghĩa → thấy chữ → dùng trong hội thoại.
- `design/masters/mascot-model-reference.png` là model chính thức cho cả hai linh vật. Bắp là chó cái tai dựng, trắng–nâu, nơ và hoodie vàng; Blu là mèo đực trắng tuyết, mắt xanh và hoodie xanh. Mọi biến thể phải giữ đúng đặc điểm này.
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

- Mandarin phổ thông, chữ giản thể, HSK 3.0 làm khung; lộ trình hiện phủ HSK 1–3 (2.245 từ). Nội dung HSK 2–3 là bản nháp AI cần duyệt.
- Freemium không quảng cáo; tải bài để học offline; cloud sync khi có mạng.
- `design/masters/buzzlingo-mascots-canonical.png` là master của hero; app dùng bản `dist/assets/mascots-*.webp`.
- Avatar coach: master `design/masters/{bap,blu}-coach-avatar.png`; app dùng `dist/assets/{bap,blu}-avatar-{128,256}.webp`, hiển thị `object-fit: contain` để không cắt tai và mặt.

## Nguồn tham chiếu sản phẩm

- Duolingo: bài ngắn, path, gamification, luyện nghe-nói và character practice — https://en.duolingo.com/course/zh/en/Learn-Ch
- Airlearn: “learn first, practice next”, giải thích ngữ pháp/văn hoá, giao diện tối giản — https://apps.apple.com/us/app/airlearn-language-learning/id6479639235
- Hanzii: từ điển Trung–Việt, offline, phạm vi người học từ đầu tới HSK6 — https://api.hanzii.net/
- HelloChinese: game-based curriculum, speech recognition, handwriting, native video, SRS — https://www.hellochinese.cc/
- Pleco: từ điển, OCR, handwriting, audio và flashcards tuỳ biến — https://www.pleco.com/
- ChineseSkill: lộ trình từ số 0 tới HSK4, bài ngắn và đa dạng activity — https://www.chineseskill.com/

## Cấu trúc

```text
dist/                 # thư mục được deploy (static)
  index.html
  css/app.css
  js/srs.js           # FSRS-4.5 (chạy được cả Node)
  js/store.js         # attempts, thẻ SRS, XP, streak, session (chạy được cả Node)
  js/content.js       # nội dung bài + schema (tách khỏi UI)
  js/audio.js         # phát âm: file thu sẵn nếu có, nếu không dùng giọng zh-* của thiết bị
  js/qbank.js         # ngân hàng câu hỏi tự sinh (chạy được cả Node)
  js/critique.js      # phản biện câu tự viết theo luật (chạy được cả Node)
  js/coach.js         # trợ lý AI tuỳ chọn (mặc định tắt)
  js/renderers.js     # choice, order, speak, write, flip, compose
  js/app.js           # điều hướng, màn hình, runner, onboarding
  vendor/             # Hanzi Writer (MIT) + dữ liệu nét 你 好 我 是 不 吗 谢 再 见 客 气 (Arphic PL)
  assets/*.webp
design/masters/       # ảnh gốc chất lượng cao (không deploy)
archive/              # gói release cũ và biến thể linh vật cũ (không deploy)
server/               # proxy trợ lý AI (Cloudflare Workers / Fetch API)
eval/                 # bộ câu hỏi vàng + script so sánh nhà cung cấp AI
docs/                 # tài liệu trợ lý AI
tests/                # unit (Node) và E2E (Playwright)
```

Thêm bài mới: thêm `items`, `steps`, `lessons` vào `js/content.js`; thêm chữ mới vào `vendor/hanzi-data.js` nếu có bước viết.

## Chạy local

Mở `dist/index.html` trực tiếp hoặc phục vụ thư mục `dist/` bằng một static server.

## Kiểm thử

- `npm test`: unit test cho SRS, store, nội dung, ngân hàng câu hỏi, phản biện, proxy AI và bộ chấm (Node ≥ 18, không cần cài gói).
- `npm run test:e2e:ai`: E2E trợ lý AI với endpoint giả.
- `npm run eval:mock`: chạy thử bộ câu hỏi vàng không tốn tiền; xem `eval/README.md` để chạy với API thật.
- `npm run test:e2e`: E2E bằng Playwright Chromium (cần `playwright`; đặt `PLAYWRIGHT_PATH` nếu cài ở nơi khác). Ảnh chụp lưu ở `.shots/`.
