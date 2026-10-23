/* BuzzLingo · trợ lý AI chạy trên Netlify Functions (cùng site với app, không cần Cloudflare).
 * Biến môi trường đặt trên Netlify: GEMINI_API_KEY (bắt buộc), MODEL? (mặc định gemini-3.5-flash-lite), DAILY_LIMIT?, ALLOWED_ORIGIN?
 * Địa chỉ: https://<site>.netlify.app/api/coach */
import { handle } from '../../server/worker.mjs';

const env = () => ({
  PROVIDER: process.env.PROVIDER || 'gemini',
  API_KEY: process.env.GEMINI_API_KEY || process.env.API_KEY || '',
  MODEL: process.env.MODEL || '',
  DAILY_LIMIT: process.env.DAILY_LIMIT || '',
  // site web + app Windows (trang file:// gửi Origin "null")
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || [process.env.URL, process.env.DEPLOY_PRIME_URL, 'https://peppy-faun-a6f96c.netlify.app', 'null', 'file://'].filter(Boolean).join(','),
  TIMEOUT_MS: '9000', // hàm Netlify dừng sau 10 giây
});

export default async (request) => handle(request, env());
export const config = { path: '/api/coach' };
