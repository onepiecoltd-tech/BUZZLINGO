# Thẩm định dự án BuzzLingo

## Kết luận

BuzzLingo hiện là **prototype kiểm chứng ý tưởng và UX**, chưa phải learning MVP có thể chứng minh người học tiến bộ.

- Có thể tiếp tục đầu tư theo hướng **GO có điều kiện**.
- Có thể dùng để thử thương hiệu, linh vật, điều hướng và mức độ yêu thích.
- Chưa nên quảng bá là “đủ 4 kỹ năng”, “SRS thông minh” hoặc “lộ trình HSK” cho đến khi dữ liệu học tập và cơ chế đánh giá hoạt động thật.

## Điểm hiện tại

| Hạng mục | Điểm |
| --- | ---: |
| Định vị cho người Việt từ số 0 | 8/10 |
| Thương hiệu và UI mobile | 7/10 |
| Định hướng sư phạm | 6/10 |
| Thực chất 4 kỹ năng | 3/10 |
| SRS và dữ liệu tiến bộ | 2/10 |
| Accessibility | 4/10 |
| Sẵn sàng production | 3/10 |

Đánh giá tổng thể: **concept demo 7/10; learning MVP 4/10**.

## Điểm mạnh

- Đối tượng rõ: người Việt bắt đầu từ số 0.
- Trục học hợp lý: âm → thanh điệu → nghĩa → chữ Hán → giao tiếp.
- Giao diện mobile dễ hiểu, có điểm vào cho Nghe–Nói–Đọc–Viết.
- Bắp và Blu tạo được nhận diện thương hiệu nhất quán.
- Hướng kiến trúc React Native Expo + SQLite offline + Supabase phù hợp cho iOS/Android.
- Ý tưởng FSRS theo `user × learning_item × skill` là đúng hướng.

## P0 — phải hoàn thành trước learning MVP

1. **Kết quả trung thực:** lưu đúng/sai; không hiển thị `4/4` hoặc cộng đủ XP khi người học trả lời sai.
2. **Nói có bằng chứng:** phát hiện tiếng nói, cho nghe lại và cung cấp phản hồi âm tiết/thanh điệu; nếu chưa chấm tự động phải ghi rõ đây là bài tự đánh giá.
3. **Viết có kiểm tra:** kiểm tra số nét, thứ tự, hướng và vị trí; hỗ trợ tô → chép → viết từ nhớ.
4. **Tiến độ được lưu thật:** attempts, XP, lesson progress và lịch SRS phải còn nguyên sau tải lại.
5. **SRS thật:** mỗi `item × skill` có grade, lịch sử attempt và `due_at`; không dùng lịch 1/3/7 ngày cố định.
6. **Nội dung có chuẩn đầu ra:** syllabus Pinyin, tone pairs, lỗi thường gặp của người Việt, ma trận từ vựng/ngữ pháp/chức năng giao tiếp và checkpoint bốn kỹ năng.

## P1 — cần hoàn thành trước pilot

- Dùng audio Mandarin được kiểm soát thay vì phụ thuộc hoàn toàn vào giọng trình duyệt.
- Đưa Nghe–Nói–Đọc–Viết vào cùng một learning loop; tránh bốn phòng demo rời.
- Mỗi bài có CTA rõ: kiểm tra, luyện lại, tiếp tục, hoàn thành và resume.
- Tách Blueprint khỏi thanh điều hướng dành cho người học.
- Thêm onboarding và diagnostic thay cho tên, XP và phần trăm hard-code.
- Hoàn thiện accessibility: semantic dialog, focus management, `aria-live`, bàn phím, nhãn `zh-Hans`, reduced motion, tương phản và touch target tối thiểu 44 px.
- Tối ưu ảnh hero/avatar sang WebP hoặc AVIF và kích thước phù hợp; dọn các asset/archive cũ.

## Vertical slice cần xây trước

Hoàn thiện một bài `你好` thật trước khi mở rộng nội dung:

1. Nghe audio-only và nhận diện đúng câu/thanh điệu.
2. Shadowing, ghi âm, nghe lại và nhận phản hồi có mục tiêu.
3. Đọc từ/câu mới với Pinyin được làm mờ dần.
4. Viết `你` và `好` theo ba nấc: tô, chép, viết từ nhớ.
5. Exit ticket dùng một tình huống mới, không lặp nguyên mẫu.
6. Lưu mọi attempt, lỗi, mức gợi ý, XP và lịch ôn.
7. Câu sai quay lại sau 2–4 mục và được xếp ôn ngày hôm sau.

## Kiến trúc MVP đề xuất

- **Client:** React Native + Expo Router + TypeScript.
- **Local:** SQLite cho nội dung tải về, attempts, queue đồng bộ và SRS offline.
- **State:** Zustand chỉ giữ UI/session state; dữ liệu học tập bền vững lưu trong SQLite.
- **Backend:** Supabase Auth, Postgres, Storage, Edge Functions và Row Level Security.
- **Content:** JSON/MDX có schema/version, tách khỏi UI.
- **Exercise engine:** renderer dùng chung cho nghe, nói, đọc, viết và checkpoint.
- **Scoring:** adapter riêng cho trắc nghiệm, pronunciation và handwriting.
- **SRS:** FSRS theo từng kỹ năng, có sync và xử lý xung đột.
- **Privacy:** xin quyền micro có giải thích; công khai việc upload, thời gian lưu và xoá audio khi bắt đầu chấm trên server.

## Tiêu chí qua vòng beta

- Không còn số liệu hoặc thông báo “đã lưu” giả.
- Reload/offline không làm mất attempt, XP hoặc lịch ôn.
- Nghe và đọc đạt ít nhất 80% trên nội dung chưa gặp.
- Nói hoàn thành đúng tối thiểu 4/5 ý định giao tiếp và không có lỗi gây hiểu nhầm.
- Viết đúng thứ tự/hướng nét tối thiểu 80% và viết được 4/5 chữ mục tiêu từ trí nhớ.
- Mastery cần đúng không gợi ý trong hai phiên cách nhau ít nhất 24 giờ và có kiểm tra giữ nhớ sau 7 ngày.
- Pilot với 20–30 người Việt mới học trước khi mở rộng nội dung hoặc marketing.

## Ước lượng

Với một lập trình viên mobile, một full-stack bán thời gian và một người phụ trách nội dung, cần khoảng **8–12 tuần** để đạt beta học thật: app Expo, persistence/offline, vertical slice bốn kỹ năng, SRS, chấm nói/viết cơ bản, accessibility và pilot nội bộ.


## Cập nhật 14/10/2026 — v0.2

Trạng thái các hạng mục P0/P1 sau đợt phát triển này:

| Hạng mục | Trạng thái |
| --- | --- |
| P0-1 Kết quả trung thực | Xong: lưu đúng/sai, XP chỉ từ attempt, sai không còn thành `4/4` |
| P0-2 Nói có bằng chứng | Một phần: ghi âm, phát hiện có tiếng, nghe lại, tự đánh giá có ghi rõ; chưa chấm âm tiết/thanh tự động |
| P0-3 Viết có kiểm tra | Xong cho `你` `好`: kiểm tra số nét, thứ tự, hướng, vị trí; ba nấc tô → chép → nhớ |
| P0-4 Tiến độ lưu thật | Xong (localStorage); chưa đồng bộ cloud |
| P0-5 SRS thật | Xong: FSRS-4.5 theo item × skill, có unit test; chưa có kiểm tra giữ nhớ 7 ngày |
| P0-6 Nội dung có chuẩn đầu ra | Chưa: mới có vertical slice Bài 1 |
| P1 Câu sai quay lại, resume, CTA | Xong |
| P1 Tách Blueprint khỏi điều hướng | Xong |
| P1 Onboarding | Xong (diagnostic chưa có) |
| P1 Accessibility cơ bản | Phần lớn: dialog/focus trap/Esc, aria-live, lang, 44 px, reduced motion; chưa kiểm tra bằng screen reader thật |
| P1 Tối ưu ảnh | Xong: ~2 MB → 6–120 KB WebP; ảnh gốc chuyển sang `design/masters/` |
| P1 Audio được kiểm soát | Chưa: vẫn dùng TTS của thiết bị; thiết bị không có giọng Mandarin sẽ bỏ qua bước nghe |

Rủi ro đã biết:

- Giọng TTS khác nhau giữa thiết bị; thanh điệu của âm đơn có thể không chuẩn. Cần bản thu người thật trước pilot.
- Hanzi Writer kiểm tra hình dạng nét nhưng không chấm "độ đẹp"; ngưỡng `leniency` cần hiệu chỉnh với người học thật.
- Điểm Nói là tự đánh giá, vì vậy không được dùng để tuyên bố tiến bộ kỹ năng Nói.
