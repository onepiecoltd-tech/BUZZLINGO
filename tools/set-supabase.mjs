#!/usr/bin/env node
/* Điền cấu hình Supabase vào dist/js/config.js.
 * Dùng: node tools/set-supabase.mjs https://xxxx.supabase.co sb_publishable_xxx   (hoặc khoá "anon public" eyJ…)
 * Bỏ trống hai tham số để tắt đồng bộ. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [url = '', key = ''] = process.argv.slice(2);
if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(url) && !/^https:\/\//.test(url)) { console.error('URL phải có dạng https://xxxx.supabase.co'); process.exit(1); }
if (/^sb_secret_/.test(key) || /service_role/.test(Buffer.from((key.split('.')[1] || ''), 'base64').toString())) {
  console.error('Đây là khoá BÍ MẬT (secret / service_role). Hãy dùng "Publishable key" hoặc "anon public".'); process.exit(1);
}
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'js', 'config.js');
let s = fs.readFileSync(file, 'utf8');
s = s.replace(/supabaseUrl: '[^']*'/, `supabaseUrl: '${url.replace(/\/+$/, '')}'`).replace(/supabaseAnonKey: '[^']*'/, `supabaseAnonKey: '${key}'`);
fs.writeFileSync(file, s);
console.log(url ? `Đã bật đồng bộ: ${url}` : 'Đã tắt đồng bộ.');
