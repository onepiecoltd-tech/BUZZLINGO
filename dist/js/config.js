/* Cấu hình triển khai. coachEndpoint trống = tắt trợ lý AI.
 * Trợ lý AI chạy bằng hàm Netlify ở netlify/functions/coach.mjs (xem docs/AI-COACH.md). KHÔNG đặt API key ở đây:
 * key Gemini đặt trên Netlify (biến môi trường GEMINI_API_KEY). Dùng địa chỉ đầy đủ để app Windows cũng gọi được. */
/* Đồng bộ tiến độ (Supabase): điền Project URL và khoá công khai: "Publishable key" (sb_publishable_…) hoặc khoá cũ "anon public" (Supabase → Project Settings → API Keys).
 * Khoá này là khoá công khai, an toàn khi đã chạy supabase/schema.sql (bật Row Level Security). Không dán khoá secret / service_role.
 * Để trống = tắt đồng bộ, app chỉ lưu trên máy. Có thể điền bằng lệnh: node tools/set-supabase.mjs <url> <anon-key> */
window.BuzzConfig = Object.assign({
  coachEndpoint: 'https://peppy-faun-a6f96c.netlify.app/api/coach',
  supabaseUrl: 'https://supabase.com/dashboard/project/bjqombrikmoqmntulutrsb_publishable_lNDGzhhXurCXHoC2lBUsvw_pwsDIQWn',
  supabaseAnonKey: '',
}, window.BuzzConfig || {});
