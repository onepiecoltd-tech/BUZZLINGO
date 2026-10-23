# BuzzLingo v0.8 — Tài khoản và đồng bộ tiến độ (Supabase)

- Mục **Cá nhân → Tài khoản & đồng bộ**: tạo tài khoản hoặc đăng nhập bằng email và mật khẩu. Tiến độ được lưu thêm một bản trong Supabase.
- Màn hình chào có nút **Đã có tài khoản? Đăng nhập để lấy lại tiến độ**. Dùng khi Safari đã xoá dữ liệu hoặc khi học trên máy mới.
- Tự đồng bộ: sau mỗi bài, khi chuyển app, khi mở lại app. Học trên nhiều máy thì tiến độ được gộp, không bên nào ghi đè mất bên nào. Mất mạng vẫn học bình thường, có mạng lại thì tự gửi.
- Thêm biểu tượng và manifest để "Thêm vào Màn hình chính" trên iPhone ra một app riêng. App trên Màn hình chính không bị Safari xoá dữ liệu sau 7 ngày, nhưng có bộ nhớ riêng, nên phải đăng nhập một lần trong đó.
- App xin trình duyệt giữ dữ liệu lâu dài (`navigator.storage.persist`).
- Chưa điền cấu hình Supabase thì mọi thứ chạy như cũ: chỉ lưu trên máy, không gọi mạng.

Cách cài đặt: xem `docs/CLOUD-SYNC.md`. File SQL: `supabase/schema.sql`. Điền cấu hình: `node tools/set-supabase.mjs <url> <publishable-key>`.

Kiểm thử:

| Bộ kiểm thử | Kết quả |
|---|---|
| Đơn vị | 67 đạt (thêm 12 kiểm thử đồng bộ) |
| Trình duyệt | 141 đạt |
| Trợ lý AI | 63 đạt |
| Đồng bộ | 28 đạt |
