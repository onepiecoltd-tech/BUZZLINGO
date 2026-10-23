# Trợ lý AI Bắp/Blu — quyết định và cách triển khai

## Quyết định

**Có dùng LLM, nhưng chỉ cho vai trò giải thích và đồng hành. Mặc định tắt.**

| Việc | Dùng LLM? | Lý do |
| --- | --- | --- |
| Giải thích vì sao sai, mẹo nhớ bằng tiếng Việt | Có | Nội dung mềm, có đáp án và mục giải thích làm mỏ neo |
| Hỏi đáp tự do trong ngữ cảnh bài | Có | Giá trị cao, rủi ro thấp khi kẹp từ vựng |
| Luyện hội thoại đóng vai | Có | Mô phỏng tương tác; không chấm điểm |
| Phản biện câu tự viết (hỏi ngược, gợi ý một lỗi) | Có, **sau** bộ kiểm tra theo luật | Bộ kiểm tra trên máy (`dist/js/critique.js`) quyết định đạt/chưa đạt; AI chỉ hỏi gợi mở và nhận kết quả đó làm mỏ neo |
| Chấm đúng/sai của bài kiểm tra | **Không** | Phải xác định và kiểm thử được (AUDIT: "tiến bộ trung thực") |
| Luyện nói: chỉ chỗ máy nghe khác câu mẫu | Không cần LLM | Nhận dạng giọng nói của trình duyệt + so chữ trên máy (`dist/js/speech.js`), chỉ để gợi ý |
| Luyện nói: nhận xét, sửa câu đã nói | Có (Gemini) | Gửi văn bản nhận dạng hoặc bản ghi (khi người học bấm gửi); Gemini nghe được audio. Chỉ gợi ý, không chấm điểm |
| Chấm điểm phát âm, thanh điệu | **Không** | Nhận xét của AI về thanh điệu chỉ là gợi ý; muốn chấm điểm từng âm tiết cần dịch vụ pronunciation riêng (ví dụ Azure) |
| Xếp lịch ôn (SRS), XP | **Không** | Đã có FSRS và attempt thật |
| Sinh nội dung bài học | Chỉ để soạn nháp offline, người duyệt | LLM hay sai Pinyin/thanh điệu |

## Kiến trúc

```text
Trình duyệt (dist/)  --POST JSON-->  Proxy (netlify/functions/coach.mjs → server/worker.mjs)  --->  Gemini | DeepSeek | OpenAI | Muse
   js/coach.js                        giữ API key, hạn mức, CORS
```

- **Key không bao giờ nằm trong `dist/`** (hosting là static). Chỉ proxy giữ key.
- `server/coach-core.mjs`: kiểm tra đầu vào, dựng prompt, tạo request theo nhà cung cấp, làm sạch đầu ra. Không phụ thuộc runtime.
- `server/worker.mjs`: handler Fetch API (Cloudflare Workers, Deno, Bun, Supabase Edge Functions bọc lại nếu cần).
- Đổi nhà cung cấp bằng `PROVIDER=deepseek|openai|gemini|muse`, `MODEL` tuỳ chọn. **Hãy đặt `MODEL` rõ ràng và kiểm tra tên model/giá mới nhất trên trang nhà cung cấp trước khi triển khai** (tên model đổi nhanh; mặc định DeepSeek là `deepseek-flash`, còn OpenAI/Gemini trong code có thể đã cũ).

## Các lớp bảo vệ (đã có test)

1. Người học phải **đồng ý** (Cá nhân → Bật trợ lý AI). Chưa đồng ý hoặc chưa có endpoint: không gửi gì, nút bị ẩn.
2. Chỉ gửi chữ người học gõ/nói (đã nhận dạng), ngữ cảnh câu hỏi và danh sách chữ đã học. Bản ghi giọng chỉ gửi khi người học bấm "Gửi bản ghi cho AI". Không gửi tên, hồ sơ, dữ liệu học tập.
3. Prompt ép: chỉ dùng chữ Hán đã học, không chấm phát âm, nói "mình chưa chắc" khi không chắc, coi tin nhắn người học là dữ liệu (chống prompt injection).
4. Đầu ra đi qua `sanitizeReply` ở server và kiểm tra lần nữa ở client: nếu AI dùng chữ chưa học, hiển thị thông báo an toàn thay vì nội dung đó.
5. Hạn mức: 25 lượt/ngày phía client, `DAILY_LIMIT` (mặc định 30) phía proxy; giới hạn độ dài, số lượt lịch sử, kích thước body; timeout 15 giây; lỗi nhà cung cấp không lộ chi tiết.
6. Giao diện luôn ghi "do AI viết, có thể sai". AI không đổi attempt, XP hay lịch SRS (có test).

## Triển khai nhanh với Netlify + Gemini (khuyên dùng)

Hàm `netlify/functions/coach.mjs` chạy cùng site Netlify với app, địa chỉ `https://peppy-faun-a6f96c.netlify.app/api/coach` (đã điền sẵn trong `dist/js/config.js`). `netlify.toml` khai báo thư mục web và thư mục hàm.

1. Lấy API key Gemini: vào https://aistudio.google.com/apikey → **Create API key** → copy.
2. Trong PowerShell, ở thư mục `buzzlingo` (đã liên kết với site từ lần deploy trước):

```powershell
npx netlify-cli env:set GEMINI_API_KEY "dán_key_vào_đây"
npx netlify-cli deploy --prod
```

3. Mở app → **Cá nhân** → tick **Bật trợ lý AI** → Lưu.

Tuỳ chọn: `MODEL` (mặc định `gemini-3.5-flash-lite`, rẻ, có gói miễn phí, nghe được audio; muốn hay hơn dùng `gemini-3.8-flash`), `DAILY_LIMIT` (mặc định 30 lượt/người/ngày). Đặt bằng `npx netlify-cli env:set TÊN giá_trị` rồi deploy lại.

Hàm Netlify dừng sau 10 giây nên proxy đặt timeout 9 giây. Nguồn được phép mặc định: địa chỉ site và `null` (app Windows mở file cục bộ).

## Triển khai trên Cloudflare Workers (cách khác)

```bash
npm i -g wrangler
cd server
# wrangler.toml: name = "buzzlingo-coach", main = "worker.mjs", compatibility_date = "2026-10-01"
wrangler secret put API_KEY
wrangler secret put PROVIDER        # deepseek | openai | gemini | muse
wrangler secret put ALLOWED_ORIGIN  # https://buzzlingo-chinese-starter.onepieco-ltd.chatgpt.site
wrangler deploy
```

Sau đó điền URL vào `dist/js/config.js`:

```js
window.BuzzConfig = { coachEndpoint: 'https://buzzlingo-coach.<tên>.workers.dev/' };
```

Hạn mức trong `worker.mjs` nằm trong bộ nhớ (best effort). Trước khi mở cho nhiều người hãy chuyển sang KV/Durable Objects hoặc Postgres, và gắn hạn mức theo tài khoản khi đã có đăng nhập.

## Meta Muse Spark (`PROVIDER=muse`)

- Endpoint `https://api.meta.ai/v1/chat/completions` (tương thích OpenAI), khoá đặt ở `API_KEY` (là `MODEL_API_KEY` của Meta). Mặc định `MODEL=muse-spark-1.3` (Standard: $1,25 vào / $4,25 ra mỗi 1M token, **không** dùng dữ liệu để huấn luyện).
- `muse-spark-1.3-contributor` rẻ hơn ~12-21 lần ($0,10 / $0,20) nhưng **Meta được huấn luyện trên prompt và câu trả lời**, chưa rõ thời gian lưu hay quyền xoá. Chỉ dùng khi đã ghi rõ trong màn hình đồng ý và chính sách riêng tư; không bật mặc định. Giới hạn của chế độ này: 150 request/phút/team.
- Muse suy luận mức cao theo mặc định, tốn token ra và có thể cắt cụt JSON. Code gửi `reasoning_effort: "minimal"`; đổi bằng `REASONING_EFFORT` hoặc `off` để bỏ tham số nếu API từ chối. **Tham số này và chế độ JSON chưa được kiểm tra với API thật** — chạy thử một lượt trước khi mở cho người học.
- Chưa có chương trình "1 tỷ token miễn phí" nào được xác minh; bản miễn phí qua OpenCode Zen không có hạn mức công bố và không dành cho app bên thứ ba.

## Chế độ (`mode`)

- `explain`: giải thích vì sao đáp án đúng, sau câu trắc nghiệm/sắp xếp.
- `ask`: hỏi thêm trong ngữ cảnh bài.
- `roleplay`: trò chuyện với Blu, tối đa 6 lượt, không chấm điểm.
- `speak`: luyện nói theo câu mẫu. Gửi `message` (văn bản trình duyệt nhận dạng được) hoặc `audio: { mime, data }` (base64, tối đa ~8 giây, chỉ Gemini). AI trả `heard` (điều người học đã nói), `reply` (nhận xét tiếng Việt: phần đúng, tối đa 2 chỗ sai kèm Pinyin, lời động viên) và `zh` (câu mẫu).
- `roleplay` + `voice: true`: tin nhắn trò chuyện đến từ nhận dạng giọng nói; AI sửa lỗi ngữ pháp/từ nhẹ nhàng nhưng bỏ qua lỗi chỉ do nhận dạng sai chữ đồng âm.
- `critique`: phản biện câu người học tự viết. Gửi kèm đề, câu mẫu (AI được dặn không đưa nguyên câu này) và kết quả bộ kiểm tra theo luật. AI khen một điểm, hỏi ngược đúng một câu về lỗi quan trọng nhất, hoặc thử thách nói thêm khi câu đã đạt. Không ảnh hưởng điểm.

## Chọn nhà cung cấp: cách quyết định

**Đã có công cụ:** `eval/golden.json` (50 ca) + `eval/run-eval.mjs` + `eval/compare.mjs`. Hướng dẫn trong `eval/README.md`.

Chạy A/B bằng cùng một bộ ~50 câu hỏi vàng (lỗi thật của người Việt: thanh 3, `zh/ch/sh`, `ü`, `j/q/x`, nhầm `是/不`), chấm 4 tiêu chí: đúng Pinyin/thanh, đúng nghĩa, tuân thủ "chỉ dùng chữ đã học", tiếng Việt tự nhiên. Đo thêm độ trễ và chi phí mỗi lượt. Cân nhắc nơi dữ liệu được xử lý (ghi vào chính sách riêng tư) và điều khoản lưu/huấn luyện của từng nhà cung cấp.

## Việc nên làm tiếp

- Tra Pinyin bằng từ điển cục bộ (CC-CEDICT) để kiểm tra chéo Pinyin do AI viết.
- Chạy bộ câu hỏi vàng với key thật cho 3–4 nhà cung cấp, đọc tay nhóm thanh-dieu và phan-bien rồi chọn.
- Khi có audio người học: dùng dịch vụ pronunciation chuyên dụng, AI chỉ diễn giải kết quả.

## Dự toán chi phí (tra bảng giá ngày 15/10/2026, USD / 1M token)

Giả định mỗi lượt gọi AI: ~1.200 token vào (prompt hệ thống ~600, lịch sử ~300, câu hỏi ~300) + ~200 token ra, chưa tính cache. Giá và tên model cần kiểm tra lại trước khi dùng.

| Mô hình | Vào | Ra | 25 lượt/ngày | 60 lượt/ngày | 120 lượt/ngày |
| --- | ---: | ---: | ---: | ---: | ---: |
| gpt-5-nano | 0,05 | 0,40 | $0,11/tháng | $0,25 | $0,50 |
| gemini-2.5-flash-lite | 0,10 | 0,40 | $0,15 | $0,36 | $0,72 |
| gpt-5.4-nano | 0,20 | 1,25 | $0,37 | $0,88 | $1,76 |
| deepseek-flash (giờ cao điểm) | 0,30 | 1,20 | $0,45 | $1,08 | $2,16 |
| gemini-3.1-flash-lite | 0,25 | 1,50 | $0,45 | $1,08 | $2,16 |
| gemini-3-flash | 0,50 | 3,00 | $0,90 | $2,16 | $4,32 |
| muse-spark-1.3-contributor (cho Meta huấn luyện) | 0,10 | 0,20 | $0,12 | $0,29 | $0,58 |
| gpt-5.4-mini | 0,75 | 4,50 | $1,35 | $3,24 | $6,48 |
| muse-spark-1.3 (Standard) | 1,25 | 4,25 | $1,50 | $3,60 | $7,20 |

DeepSeek giờ thấp điểm bằng một nửa. Cần lưu ý token "suy nghĩ" của các model reasoning được tính như token ra.
