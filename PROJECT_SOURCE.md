# BuzzLingo — Project Source of Truth

> Tài liệu này là bản tóm tắt chuẩn của toàn bộ dự án BuzzLingo. Khi thiết kế, viết nội dung, tạo hình hoặc phát triển app, ưu tiên tài liệu này cùng với [`AUDIT.md`](AUDIT.md).

## 1. Tổng quan

**BuzzLingo** là ứng dụng mobile-first giúp người Việt tự học tiếng Trung phổ thông từ số 0.

- Ngôn ngữ giao diện: tiếng Việt.
- Ngôn ngữ học: Mandarin phổ thông, chữ giản thể và Pinyin.
- Nền tảng đích: iOS và Android.
- Định hướng kỹ thuật: React Native + Expo.
- Mô hình sản phẩm: freemium, không quảng cáo gây gián đoạn.
- Chế độ học: bài ngắn hằng ngày, dùng được offline sau khi tải bài.
- Khung nội dung: nền tảng định hướng HSK; không tuyên bố hoàn thành HSK khi chưa có ma trận coverage và checkpoint tương ứng.

**Lời hứa sản phẩm:** giúp người mới nghe được, nói được, đọc được và viết được những tình huống tiếng Trung thiết yếu mà không bị ngợp bởi chữ Hán.

## 2. Trạng thái dự án

Phiên bản hiện tại là **prototype kiểm chứng ý tưởng và UX**, chưa phải learning MVP production.

- Live prototype: <https://buzzlingo-chinese-starter.onepieco-ltd.chatgpt.site/>
- Source prototype: [`dist/index.html`](dist/index.html)
- Báo cáo thẩm định và tiêu chí beta: [`AUDIT.md`](AUDIT.md)
- Kiến trúc mục tiêu: React Native Expo + SQLite offline + Supabase.

Prototype hiện có (v0.2, cập nhật 14/10/2026):

- Onboarding, Hôm nay, Lộ trình, Ôn tập, Tiến bộ, Cá nhân; Blueprint nằm trong Cá nhân.
- Bài 1 `你好` tích hợp nghe, nói, đọc, viết (10 bước), câu sai quay lại sau 2–4 mục, resume.
- Attempt, XP, streak, thẻ SRS lưu bền trong localStorage; xuất JSON và xoá dữ liệu.
- FSRS-4.5 theo `item × skill` với nút chấm hiện khoảng ôn dự đoán.
- Viết có kiểm tra thứ tự/hướng/vị trí nét bằng Hanzi Writer (tô → chép → viết từ nhớ).
- Nói: ghi âm, phát hiện có tiếng, nghe lại, tự đánh giá.
- Accessibility cơ bản và ảnh WebP.

Những phần chưa hoạt động thật:

- Chấm phát âm tự động (bước Nói là tự đánh giá, không tính vào phần trăm kỹ năng).
- Audio Mandarin được kiểm soát (hiện dùng giọng TTS của thiết bị; hỗ trợ `src` file thu sẵn trong `content.js` nhưng chưa có file).
- Đồng bộ tài khoản/backend.
- Nội dung khóa học bốn tuần (mới có Bài 1; các bài khác ghi "Đang soạn").
- Checkpoint HSK, diagnostic và đánh giá bốn kỹ năng; kiểm tra giữ nhớ sau 7 ngày.

## 3. Người học mục tiêu

### Nhóm chính

- Người Việt chưa từng học tiếng Trung hoặc mới bắt đầu.
- Muốn giao tiếp thực tế trước khi học sâu chữ Hán.
- Có khoảng 5–15 phút mỗi ngày.
- Thường nhầm thanh điệu, âm bật hơi, retroflex và các cặp âm gần nhau.
- Cần giải thích ngắn, rõ bằng tiếng Việt và phản hồi không gây áp lực.

### Nhu cầu cốt lõi

1. Biết hôm nay nên học gì.
2. Nghe được âm mẫu chuẩn và nghe lại dễ dàng.
3. Biết mình phát âm sai ở đâu, không chỉ nhận điểm chung chung.
4. Học chữ Hán theo lớp, có thành phần và thứ tự nét.
5. Ôn đúng nội dung sắp quên.
6. Nhìn thấy tiến bộ thật của từng kỹ năng.

## 4. Nhận diện hình ảnh

### 4.1 Hình ảnh chuẩn của Bắp và Blu

![Bắp và Blu cùng học chữ 你](design/masters/buzzlingo-mascots-canonical.png)

File ứng dụng chuẩn: [`design/masters/buzzlingo-mascots-canonical.png`](design/masters/buzzlingo-mascots-canonical.png)

### 4.2 Model reference

![Model chuẩn của Bắp và Blu](design/masters/mascot-model-reference.png)

File tham chiếu tạo biến thể mới: [`design/masters/mascot-model-reference.png`](design/masters/mascot-model-reference.png)

### 4.3 Avatar coach

| Bắp | Blu |
| --- | --- |
| ![Avatar Bắp](design/masters/bap-coach-avatar.png) | ![Avatar Blu](design/masters/blu-coach-avatar.png) |

- Bắp: [`design/masters/bap-coach-avatar.png`](design/masters/bap-coach-avatar.png)
- Blu: [`design/masters/blu-coach-avatar.png`](design/masters/blu-coach-avatar.png)

### 4.4 Quy chuẩn nhân vật

**Bắp**

- Chó cái.
- Lông trắng–nâu.
- Tai dựng lớn; không dùng phiên bản tai cụp.
- Mắt nâu, biểu cảm vui vẻ và khích lệ.
- Nơ vàng và hoodie vàng.
- Vai trò: dẫn đường, giải thích, động viên và tạo cảm giác an toàn.

**Blu**

- Mèo đực.
- Lông trắng như tuyết.
- Tai dựng, mắt xanh ngọc.
- Hoodie xanh lam/xanh cyan.
- Vai trò: đặt câu hỏi, gợi ý mẹo nhớ, luyện phản xạ và tạo bất ngờ.

**Quy tắc bắt buộc**

- Mọi ảnh Bắp/Blu mới phải bám sát model reference.
- Khi hiển thị avatar nhỏ, phải giữ trọn mắt, mũi, miệng và phần tai nhận diện.
- Không thay đổi giới tính, màu lông, màu mắt hoặc màu trang phục chính.
- Không dùng emoji chó/mèo để thay mascot ở trải nghiệm production.
- `bap-blu.png`, `bap-blu-v2.png`, `bap-blu-v3.png` là biến thể cũ; không dùng làm chuẩn mới.

## 5. Nguyên tắc sản phẩm và UX

1. **Âm trước, chữ sau:** tuần đầu ưu tiên Pinyin, thanh điệu và phản xạ nghe–nói; Hanzi xuất hiện theo lớp.
2. **Hiểu rồi mới chơi:** giải thích tiếng Việt ngắn trước khi yêu cầu làm bài.
3. **Lỗi là dữ liệu:** lỗi được dùng để tạo bài ôn; không làm người học xấu hổ.
4. **Bài ngắn nhưng có đầu ra:** mỗi buổi phải kết thúc bằng một hành động giao tiếp đo được.
5. **Bốn kỹ năng liên kết:** Nghe–Nói–Đọc–Viết nằm trong cùng learning loop, không phải bốn khu vực rời rạc.
6. **Tiến bộ trung thực:** XP và phần trăm chỉ sinh từ attempt thật.
7. **Mobile-first:** thao tác một tay, touch target tối thiểu 44 px, hỗ trợ safe-area.
8. **Accessible by default:** contrast, font size, screen reader, bàn phím, reduced motion và phương án thay thế canvas.

## 6. Kiến trúc thông tin

### Điều hướng dành cho người học

1. **Hôm nay:** bài tiếp theo, mục tiêu ngày, luyện nhanh và ôn đến hạn.
2. **Lộ trình:** unit, lesson, checkpoint và trạng thái mở khóa.
3. **Ôn tập:** hàng đợi SRS theo kỹ năng.
4. **Tiến bộ:** năng lực Nghe–Nói–Đọc–Viết, streak và mục tiêu.
5. **Cá nhân/Cài đặt:** tài khoản, offline, quyền micro, thông báo và privacy.

Blueprint kỹ thuật không nằm trong thanh điều hướng production của người học.

### Onboarding đề xuất

1. Mục tiêu: giao tiếp, du lịch, học tập hoặc HSK.
2. Thời gian mỗi ngày: 5, 10 hoặc 15 phút.
3. Kinh nghiệm: từ số 0 hoặc đã biết một ít.
4. Giới thiệu quyền micro và cách xử lý bản ghi.
5. Diagnostic ngắn về nghe âm/thanh điệu; người từ số 0 có thể bỏ qua.

## 7. Learning loop chuẩn

Mỗi bài 6–12 phút đi theo vòng:

1. Ôn các mục đến hạn bằng audio-first retrieval.
2. Mẫu hội thoại ngắn trong tình huống thật.
3. Giải thích tiếng Việt và đối chiếu lỗi thường gặp.
4. Nghe phân biệt âm, thanh điệu và ý nghĩa.
5. Shadowing → ghi âm → nghe lại → phản hồi có mục tiêu.
6. Đọc với Pinyin được làm mờ dần.
7. Viết theo ba nấc: tô → chép → viết từ nhớ.
8. Exit ticket bằng tình huống mới.
9. Lỗi được xếp lại sau 2–4 mục và đưa vào SRS.

## 8. Định nghĩa bốn kỹ năng

### Nghe

- Lượt đầu ưu tiên audio-only.
- Có ít nhất hai giọng người trong khóa học.
- Đo nhận diện âm/thanh điệu và hiểu thông tin.
- Không đặt sẵn Pinyin có dấu khi đang kiểm tra khả năng nghe thanh điệu.

### Nói

- Cho nghe mẫu, ghi âm và nghe lại.
- Phản hồi theo âm đầu, vận mẫu, thanh điệu và độ trôi chảy.
- Chấm pronunciation phải được hiệu chỉnh bằng mẫu giọng người Việt.
- Nếu chưa có chấm tự động, ghi rõ đây là hoạt động tự nghe và tự đánh giá.

### Đọc

- Đi từ Hanzi + Pinyin tới Hanzi không Pinyin.
- Đo hiểu từ, câu và thông tin mới; không chỉ ghép một chữ với Pinyin.
- Tách recognition, reading aloud và reading comprehension.

### Viết

- Học thành phần chữ, số nét, thứ tự và hướng nét.
- Đi từ tô → chép → viết từ nhớ.
- Tách handwriting với khả năng tạo câu viết.
- Có phương án thay thế cho người không thể thao tác kéo trên canvas.

## 9. MVP nội dung bốn tuần

Giả định: 5 bài chính và 1 checkpoint mỗi tuần; mỗi bài 10–15 phút.

| Tuần | Nội dung | Đầu ra đo được |
| --- | --- | --- |
| 1 | Cấu trúc âm tiết, 4 thanh + thanh nhẹ, tone pairs, biến điệu trong `你好`, chào hỏi và tên; 15 Hanzi nhận diện/5 viết | Nhận diện ≥8/10 âm–thanh mới; hội thoại chào hỏi 30 giây, đủ 4/5 ý định |
| 2 | Số 0–99, tuổi, quốc tịch; `叫`, `是`, `不`, `吗`, `几`, `多大`; thêm 15/5 Hanzi | Hiểu ≥8/10 thông tin số/danh tính; tự giới thiệu 45 giây; đọc ba hồ sơ ngắn |
| 3 | Gia đình, sở thích; `有/没有`, `的`, `喜欢`, `个`; thêm 15/5 Hanzi | Mô tả ba người và ba sở thích; trả lời ≥4/5 câu từ audio mới; viết ba câu có hỗ trợ |
| 4 | Ăn uống, số lượng, giá và yêu cầu lịch sự; `要`, `想`, `请`, `这个`, `多少`; thêm 15/5 Hanzi | Role-play gọi món 60–90 giây; lấy đúng ≥80% thông tin từ hội thoại mới; đọc menu và tạo đơn gọi món |

Mục tiêu MVP: khoảng 60 Hanzi nhận diện trong ngữ cảnh, trong đó 15–20 chữ viết được từ trí nhớ. Không đồng nhất “đã tô chữ” với “đã biết viết”.

## 10. Pinyin và thanh điệu

Syllabus phải bao gồm:

- Initials và finals.
- Âm bật hơi/không bật hơi.
- `j/q/x`, `zh/ch/sh/r`, `z/c/s` và `ü`.
- Bốn thanh và thanh nhẹ.
- Tone pairs và half-third tone.
- Biến điệu thanh 3 trong `你好`.
- Biến điệu `一` và `不`.
- Các bài đối chiếu lỗi thường gặp của người Việt.

Không ánh xạ máy móc thanh Mandarin với dấu thanh tiếng Việt.

## 11. SRS và mastery

SRS dùng FSRS hoặc thuật toán có đặc tính tương đương, theo khóa:

`user × learning_item × skill`

Một mục có thể có lịch riêng cho:

- Nhận diện audio.
- Nhớ nghĩa.
- Nhận diện thanh điệu.
- Nói lại.
- Nhận diện Hanzi.
- Viết Hanzi.

Mỗi review phải lưu `attempt`, `grade`, `response_time`, `hint_level`, `created_at` và `due_at`.

Mastery yêu cầu đúng không gợi ý trong ít nhất hai phiên cách nhau 24 giờ và có kiểm tra giữ nhớ sau 7 ngày.

## 12. Kiến trúc ứng dụng mục tiêu

### Client

- React Native + Expo Router + TypeScript.
- NativeWind hoặc Tamagui; chọn một hệ thống duy nhất.
- Zustand cho UI/session state.
- SQLite cho nội dung, attempts, SRS và queue sync offline.
- Expo Audio, Haptics, Notifications và SecureStore.

### Backend

- Supabase Auth.
- Postgres + Row Level Security theo `user_id`.
- Storage cho audio/nội dung.
- Edge Functions cho pronunciation assessment, signed URL và logic tin cậy phía server.

### Module nên tách

- `content-schema`: schema/version/migration nội dung.
- `lesson-engine`: renderer và điều phối step.
- `attempt-store`: lưu local-first và sync.
- `scoring`: multiple choice, pronunciation và handwriting adapters.
- `srs`: scheduler theo từng kỹ năng.
- `audio`: tải, cache, playback, recording và upload.
- `analytics`: sự kiện sản phẩm và learning events.
- `design-system`: token màu, typography, component và mascot usage.

## 13. Mô hình dữ liệu tối thiểu

- `profiles`
- `courses`
- `units`
- `lessons`
- `learning_items`
- `lesson_steps`
- `attempts`
- `skill_reviews`
- `daily_progress`
- `audio_assets`
- `content_versions`
- `sync_queue`

Không tính progress từ số hiển thị hard-code. Mọi số liệu phải được tổng hợp từ attempts hợp lệ.

## 14. Privacy và an toàn dữ liệu

- Giải thích mục đích trước khi xin quyền micro.
- Cho phép học ở chế độ không dùng micro.
- Nêu rõ bản ghi chỉ nằm trên thiết bị hay được upload.
- Khi upload: dùng signed URL, mã hóa truyền tải, thời hạn lưu ngắn và nút xoá.
- Không dùng audio học viên để huấn luyện mô hình nếu chưa có đồng ý riêng.
- Không hiển thị “đã lưu” khi dữ liệu chưa được lưu thật.

## 15. Asset inventory

| File | Vai trò | Trạng thái |
| --- | --- | --- |
| `buzzlingo-mascots-canonical.png` | Hero Bắp và Blu cùng chữ `你` | Chuẩn hiện hành |
| `mascot-model-reference.png` | Model tham chiếu tạo hình | Chuẩn bắt buộc |
| `bap-coach-avatar.png` | Avatar nhỏ của Bắp | Đang dùng |
| `blu-coach-avatar.png` | Avatar nhỏ của Blu | Đang dùng |
| `bap-face-reference.png` | Reference cũ của mặt Bắp | Chỉ tham khảo |
| `bap-blu.png` | Biến thể cũ | Không dùng làm chuẩn |
| `bap-blu-v2.png` | Biến thể cũ | Không dùng làm chuẩn |
| `bap-blu-v3.png` | Biến thể cũ | Không dùng làm chuẩn |

Ảnh hiện khá nặng. Trước production cần:

- Giữ file gốc chất lượng cao làm master.
- Xuất WebP/AVIF theo kích thước 1x/2x.
- Avatar runtime chỉ cần khoảng 128–256 px.
- Hero mobile không cần ảnh PNG trên 2 MB.
- Lazy-load ảnh ngoài màn hình và preload đúng asset của bài tiếp theo.

## 16. Cấu trúc source hiện tại

```text
sites/buzzlingo/
├─ README.md  PROJECT_SOURCE.md  AUDIT.md  package.json
├─ dist/                      # deploy
│  ├─ index.html, css/app.css
│  ├─ js/ srs.js store.js content.js audio.js renderers.js app.js
│  ├─ vendor/ hanzi-writer.min.js hanzi-data.js (+ giấy phép)
│  └─ assets/ mascots-{640,1000}.webp, {bap,blu}-avatar-{128,256}.webp
├─ design/masters/            # ảnh gốc và model reference (không deploy)
├─ archive/                   # releases .tar.gz và biến thể cũ (không deploy)
└─ tests/ core.test.js e2e.cjs
```

## 17. Roadmap đề xuất

### Giai đoạn 1 — trung thực hóa prototype

- Lưu đúng/sai và tính kết quả thật.
- Bỏ mọi claim “đã lưu” hoặc “đã chấm” khi chưa hoạt động.
- Hoàn thiện luồng CTA, retry, resume và exit.
- Tách Blueprint khỏi learner navigation.
- Tối ưu ảnh và accessibility cơ bản.

### Giai đoạn 2 — vertical slice `你好`

- Một bài tích hợp đủ bốn kỹ năng.
- Audio chuẩn, ghi âm/nghe lại, stroke-order và feedback.
- Local attempts, XP, progress và FSRS thật.
- Exit ticket và delayed review.

### Giai đoạn 3 — app Expo và nội dung bốn tuần

- Chuyển design system và content schema sang React Native.
- SQLite offline + Supabase sync.
- Hoàn thành 20 bài và 4 checkpoint.
- Pronunciation/handwriting scoring được hiệu chỉnh.

### Giai đoạn 4 — beta

- Pilot với 20–30 người Việt mới học.
- Đo completion, lỗi, retention, delayed mastery và khả năng giao tiếp.
- Chỉ mở rộng nội dung/marketing sau khi qua tiêu chí beta trong `AUDIT.md`.

## 18. Tiêu chí hoàn thành learning MVP

- Một người dùng mới có thể onboarding và hoàn thành bài đầu mà không cần hướng dẫn bên ngoài.
- Nghe, nói, đọc và viết đều tạo ra bằng chứng học tập có thể kiểm tra.
- Sai không được ghi thành đúng; progress và XP phản ánh attempts thật.
- Dữ liệu còn nguyên sau reload, offline và đăng nhập lại.
- SRS lên lịch riêng cho từng kỹ năng.
- Nội dung có version, checkpoint và mapping tới phạm vi HSK đã tuyên bố.
- App đạt accessibility baseline và privacy flow cho micro/audio.
- Bắp và Blu tuân thủ model chuẩn trong mọi màn hình.

## 19. Nguồn tham chiếu sản phẩm

- Duolingo: bài ngắn, path và gamification.
- Airlearn: giải thích trước, luyện tập sau.
- HelloChinese: curriculum, speech recognition, handwriting và SRS.
- Hanzii: từ điển Trung–Việt và nhu cầu người học Việt.
- Pleco: từ điển, OCR, handwriting, audio và flashcards.
- ChineseSkill: bài ngắn và hoạt động đa dạng cho người mới.

Các sản phẩm trên chỉ là tham chiếu. BuzzLingo cần giữ trọng tâm riêng: **người Việt từ số 0, phản hồi phát âm phù hợp giọng Việt, bài ngắn bốn kỹ năng và hai linh vật Bắp–Blu đồng hành xuyên suốt**.

