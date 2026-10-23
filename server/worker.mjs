/* BuzzLingo · proxy trợ lý AI (Cloudflare Workers / bất kỳ runtime dùng Fetch API).
 * Biến môi trường: PROVIDER (gemini|deepseek|openai|muse), API_KEY (secret), MODEL?, ALLOWED_ORIGIN (có thể nhiều nguồn, cách nhau dấu phẩy; "null" = app Windows), DAILY_LIMIT?
 * Lưu ý: bộ đếm hạn mức bên dưới nằm trong bộ nhớ (best effort). Khi chạy thật hãy dùng KV/Durable Objects/Postgres. */
import { validateRequest, buildProviderRequest, extractText, parseModelJson, sanitizeReply, LIMITS } from './coach-core.mjs';

const counters = new Map();
const dayKey = (now) => new Date(now).toISOString().slice(0, 10);

function cors(env, origin) {
  const list = String(env.ALLOWED_ORIGIN || '').split(',').map((x) => x.trim()).filter(Boolean);
  const star = list.includes('*');
  const ok = star || (origin && list.includes(origin));
  return ok ? { 'access-control-allow-origin': star ? '*' : origin, 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } : null;
}
const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

export async function handle(request, env, { fetchImpl = fetch, now = Date.now() } = {}) {
  const origin = request.headers.get('origin');
  const h = cors(env, origin);
  if (!h) return json({ error: 'Nguồn truy cập không được phép.' }, 403, {});
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (request.method !== 'POST') return json({ error: 'Chỉ hỗ trợ POST.' }, 405, h);

  const raw = await request.text();
  if (raw.length > LIMITS.audioBody) return json({ error: 'Yêu cầu quá lớn.' }, 413, h);
  let body; try { body = JSON.parse(raw); } catch (e) { return raw.length > LIMITS.body ? json({ error: 'Yêu cầu quá lớn.' }, 413, h) : json({ error: 'Yêu cầu không hợp lệ.' }, 400, h); }
  if (!(body && body.mode === 'speak' && body.audio) && raw.length > LIMITS.body) return json({ error: 'Yêu cầu quá lớn.' }, 413, h);
  const v = validateRequest(body);
  if (!v.ok) return json({ error: v.error }, 400, h);
  const req = v.value;

  if (!env.API_KEY) return json({ error: 'Máy chủ AI chưa được cài API key. Xem docs/AI-COACH.md.' }, 503, h);

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-nf-client-connection-ip') || 'unknown';
  const key = `${req.uid || ip}:${dayKey(now)}`;
  const used = (counters.get(key) || 0) + 1;
  const limit = Number(env.DAILY_LIMIT) || 30;
  if (used > limit) return json({ error: 'Bạn đã dùng hết lượt hỏi AI hôm nay. Mai quay lại nhé!' }, 429, h);
  counters.set(key, used);
  if (counters.size > 5000) for (const k of counters.keys()) { if (!k.endsWith(dayKey(now))) counters.delete(k); }

  let upstream;
  try {
    const { url, init } = buildProviderRequest(env, req);
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), Number(env.TIMEOUT_MS) || 15000);
    upstream = await fetchImpl(url, { ...init, signal: ctl.signal }); clearTimeout(t);
  } catch (e) {
    if (e && e.code === 'audio_unsupported') return json({ error: 'Nhà cung cấp AI hiện tại không nghe được bản ghi. Hãy dùng Gemini (PROVIDER=gemini).' }, 400, h);
    return json({ error: 'Trợ lý đang bận, bạn thử lại sau nhé.' }, 502, h);
  }
  if (!upstream.ok) return json({ error: 'Trợ lý đang bận, bạn thử lại sau nhé.' }, 502, h); // không lộ lỗi nhà cung cấp
  let data; try { data = await upstream.json(); } catch (e) { return json({ error: 'Trợ lý trả lời không đúng định dạng.' }, 502, h); }
  // luyện nói: chữ của câu mẫu và chữ người học đã nói cũng hợp lệ trong lời nhận xét
  const allowed = req.mode === 'speak' ? [...req.known.hanzi, ...(`${(req.step && req.step.correct) || ''}${req.message}`.match(/[㐀-鿿]/g) || [])] : req.known.hanzi;
  const out = sanitizeReply(parseModelJson(extractText(env.PROVIDER, data)), allowed);
  if (!out) return json({ error: 'Trợ lý trả lời không đúng định dạng.' }, 502, h);
  return json({ ...out, remaining: Math.max(0, limit - used) }, 200, h);
}

export default { fetch: (request, env) => handle(request, env) };
