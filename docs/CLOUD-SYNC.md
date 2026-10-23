# Đồng bộ tiến độ với Supabase

## Vì sao cần

BuzzLingo lưu tiến độ trong bộ nhớ của trình duyệt (`localStorage`). Có ba trường hợp làm mất tiến độ đó:

- **Safari (iPhone, iPad, Mac) tự xoá dữ liệu.** Một trang web mở bằng link mà 7 ngày không được mở lại sẽ bị Safari xoá dữ liệu.
- **App trên Màn hình chính dùng bộ nhớ riêng.** App đã "Thêm vào Màn hình chính" có bộ nhớ tách khỏi Safari, nên không thấy tiến độ đã học trong Safari.
- **Đổi máy.**

Khi bật đồng bộ, tiến độ có thêm một bản sao trong tài khoản Supabase. Mất dữ liệu ở máy nào thì chỉ cần đăng nhập lại là lấy về đủ.

## Cài đặt (khoảng 10 phút, làm một lần)

1. **Tạo project.** Vào [supabase.com](https://supabase.com), chọn **New project**. Nên chọn vùng **Southeast Asia (Singapore)**.
2. **Tạo bảng.** Vào **SQL Editor**, dán toàn bộ file `supabase/schema.sql`, bấm **Run**. Lệnh này tạo bảng `progress` và bật Row Level Security, nên mỗi tài khoản chỉ đọc và ghi được dữ liệu của chính mình.
3. **Cài đăng nhập bằng email.** Vào **Authentication**:
   - **Sign In / Providers → Email**: để bật.
   - Nên tắt **Confirm email** nếu app chỉ dành cho bạn và người quen. Lý do: máy chủ email mặc định của Supabase chỉ gửi được rất ít thư mỗi giờ, và nếu bật thì người dùng phải bấm link trong thư rồi mới đăng nhập được.
   - **URL Configuration → Site URL**: điền `https://peppy-faun-a6f96c.netlify.app`. Nếu vẫn bật xác nhận email, link trong thư sẽ mở đúng app.
4. **Lấy URL và khoá.** Vào **Project Settings → API Keys**, chép hai giá trị:
   - **Project URL**, dạng `https://xxxx.supabase.co`.
   - **Publishable key**, dạng `sb_publishable_…`. Project cũ thì dùng khoá **anon public**, dạng `eyJ…`.

   Đây là khoá công khai, được phép nằm trong app.

   > ⚠ **Không** dùng khoá *secret* hay *service_role*. Lệnh ở bước 5 sẽ từ chối các khoá này.
5. **Đưa cấu hình vào app.** Chạy trong thư mục `buzzlingo`:

   ```powershell
   node tools/set-supabase.mjs https://xxxx.supabase.co sb_publishable_xxxxxxxx
   npx netlify-cli deploy --prod
   ```

   Muốn bản Windows cũng đồng bộ thì đóng gói lại file exe (trong thư mục `desktop`, chạy `npm run build`).

## Cách dùng

- **Máy đang có tiến độ:** vào **Cá nhân → Tài khoản & đồng bộ → Tạo tài khoản**. Tiến độ hiện có được đưa lên tài khoản.
- **Máy mới, hoặc Safari đã xoá dữ liệu:** ở màn hình chào, bấm **Đã có tài khoản? Đăng nhập để lấy lại tiến độ**.
- **Khi nào app tự đồng bộ:**
  - vài giây sau khi học xong một bài;
  - khi có thay đổi: gom lại, gửi sau 15 giây không có thay đổi mới, chậm nhất sau 1 phút;
  - khi bạn chuyển sang app khác;
  - khi mở lại app.
- **Học trên hai máy:** tiến độ được **gộp**. Lượt làm bài, bài đã xong, điểm cao nhất và thẻ ôn được giữ đầy đủ ở cả hai bên, không bên nào ghi đè mất bên nào.
- **Mất mạng:** app vẫn học và lưu trên máy như bình thường, có mạng lại thì tự gửi lên.
- **Đăng xuất:**
  - App gửi nốt dữ liệu lên tài khoản, rồi xoá dữ liệu trên máy để người khác dùng máy không thấy.
  - Nếu chưa gửi được (đang mất mạng), app không cho đăng xuất để tránh mất dữ liệu.
  - Nút "Xoá dữ liệu…" khi đang đăng nhập cũng sẽ đăng xuất. Tiến độ trong tài khoản vẫn còn.

## Kỹ thuật

| Phần | Chi tiết |
|---|---|
| `dist/js/cloud.js` | Gọi thẳng REST của Supabase (`/auth/v1`, `/rest/v1/progress`), không cần thư viện. |
| Phiên đăng nhập | Lưu ở `localStorage['buzzlingo.auth']`. Token được tự làm mới. Nếu refresh token hỏng, app đăng xuất và báo cho người dùng. |
| Một vòng đồng bộ | 1. Hỏi `updated_at` trên đám mây (rất nhẹ).<br>2. Nếu khác bản đã biết thì tải bản đầy đủ và gộp bằng `Store.mergeStates`.<br>3. Đẩy bản đã gộp lên nếu máy này có thay đổi. |
| `Store.mergeStates(a, b)` | Kết quả không phụ thuộc thứ tự; gộp lại lần nữa vẫn y như cũ, nên các máy luôn hội tụ về cùng một bản. |
| Dữ liệu của tài khoản khác | Dữ liệu trên máy có đánh dấu chủ sở hữu (`owner`). Nếu nó thuộc tài khoản khác, app thay bằng dữ liệu của tài khoản vừa đăng nhập, không trộn lẫn. |
| Kiểm thử | `tests/cloud.test.mjs`: 12 kiểm thử đơn vị.<br>`tests/e2e-cloud.cjs`: 28 kiểm tra trình duyệt.<br>Cả hai dùng Supabase giả trong `tests/fake-supabase.cjs`. |
