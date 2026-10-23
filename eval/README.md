# Bộ câu hỏi vàng · so sánh nhà cung cấp AI

50 ca trong `golden.json`, chia 6 nhóm theo lỗi thật của người Việt và các rào chắn an toàn:

| Nhóm | Số ca | Kiểm tra gì |
| --- | ---: | --- |
| thanh-dieu | 10 | thanh 3 khác dấu hỏi, biến thanh 你好 / 不是 / 不客气, thanh nhẹ 谢谢 / 吗 |
| phu-am | 8 | sh, x, h, j/q, z so với âm tiếng Việt |
| nghia-ngu-phap | 10 | vị trí 吗, lỗi 我是好, 你好吗 có tự nhiên không, nghĩa đen 再见 / 不客气 |
| phan-bien | 10 | hỏi ngược kiểu Socrates, không viết lại câu đúng hộ, khen khi câu đã đạt |
| an-toan | 8 | lộ prompt, chấm phát âm (AI không nghe được), dạy chữ chưa học, ngoài lề, thông tin cá nhân |
| dong-vai | 4 | hội thoại chỉ bằng chữ đã học |

Mỗi câu trả lời được chấm tự động 5 tiêu chí: JSON hợp lệ, **chỉ dùng chữ đã học**, có ý cần có (từ khoá), không có cụm bị cấm, không quá 120 từ. Từ khoá chỉ là heuristic, nên báo cáo luôn kèm câu trả lời để đọc. File CSV có sẵn 3 cột chấm tay (1–5): đúng Pinyin/thanh, đúng nghĩa, tiếng Việt tự nhiên.

## Chạy (Node 18+, trên máy có mạng)

```bash
# kiểm tra đường ống, không tốn tiền
npm run eval:mock

# từng nhà cung cấp (key chỉ nằm trong biến môi trường)
API_KEY=sk-... node eval/run-eval.mjs --provider deepseek --model deepseek-flash
API_KEY=...    node eval/run-eval.mjs --provider gemini   --model gemini-2.5-flash-lite
API_KEY=sk-... node eval/run-eval.mjs --provider openai   --model gpt-5-nano
API_KEY=...    node eval/run-eval.mjs --provider muse     --model muse-spark-1.3 --reasoning minimal

# bảng so sánh
node eval/compare.mjs eval/reports/*.json > eval/reports/so-sanh.md
```

Tuỳ chọn: `--only phan-bien` hoặc `--only T01,K02`, `--limit 10`, `--concurrency 3`, `--price-in 0.3 --price-out 1.2` (giá USD/1M token khi model không có trong bảng giá ở `lib.mjs`).

Một lượt chạy 50 ca tốn khoảng 70.000 token, dưới $0,1 với các model rẻ. Script dùng đúng prompt, kiểm tra đầu vào và làm sạch đầu ra của proxy thật (`server/coach-core.mjs`), nên kết quả phản ánh đúng những gì người học sẽ thấy.

## Đọc kết quả

1. Loại ngay model nào có tỉ lệ **chỉ dùng chữ đã học** dưới 95%: người học sẽ thường xuyên thấy thông báo an toàn thay cho câu trả lời.
2. Đọc tay nhóm `thanh-dieu` và `phan-bien`: đây là phần quyết định chất lượng dạy.
3. Sau đó mới so sánh độ trễ và chi phí mỗi người học mỗi tháng.

Báo cáo nằm trong `eval/reports/` (không đưa lên git).
