/* Supabase giả trong bộ nhớ (Auth + bảng progress) cho kiểm thử: đúng các đường dẫn, mã lỗi và RLS mà cloud.js dùng. */
function createFakeSupabase({ confirmEmail = false, tokenTtl = 3600 } = {}) {
  const users = new Map();   // email → { id, email, password, confirmed }
  const tokens = new Map();  // access_token → user id
  const refresh = new Map(); // refresh_token → user id
  const rows = new Map();    // user id → { data, updated_at }
  const log = [];
  let n = 0, clock = Date.parse('2026-10-23T08:00:00Z');
  const stamp = () => new Date((clock += 1000)).toISOString();
  const json = (status, body) => ({ status, body: body == null ? '' : JSON.stringify(body) });
  const issue = (u) => { const at = `at-${++n}`, rt = `rt-${n}`; tokens.set(at, u.id); refresh.set(rt, u.id); return { access_token: at, refresh_token: rt, expires_in: tokenTtl, token_type: 'bearer', user: { id: u.id, email: u.email } }; };

  function handle(method, url, headers, bodyText) {
    const u = new URL(url);
    const body = bodyText ? JSON.parse(bodyText) : null;
    log.push({ method, path: u.pathname + u.search, body });
    if (!headers.apikey) return json(401, { message: 'No API key found in request' });
    if (u.pathname === '/auth/v1/signup') {
      if (users.has(body.email)) return confirmEmail ? json(200, { id: 'x', email: body.email, identities: [] }) : json(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      if (!body.password || body.password.length < 6) return json(422, { error_code: 'weak_password', msg: 'weak' });
      const user = { id: `u-${users.size + 1}-0000-0000`, email: body.email, password: body.password, confirmed: !confirmEmail };
      users.set(body.email, user);
      return confirmEmail ? json(200, { id: user.id, email: user.email, identities: [{}] }) : json(200, issue(user));
    }
    if (u.pathname === '/auth/v1/token') {
      const gt = u.searchParams.get('grant_type');
      if (gt === 'password') {
        const user = users.get(body.email);
        if (!user || user.password !== body.password) return json(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        if (!user.confirmed) return json(400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
        return json(200, issue(user));
      }
      if (gt === 'refresh_token') {
        const id = refresh.get(body.refresh_token);
        if (!id) return json(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
        refresh.delete(body.refresh_token);
        return json(200, issue([...users.values()].find((x) => x.id === id)));
      }
    }
    if (u.pathname === '/auth/v1/logout') return json(204, null);
    if (u.pathname === '/rest/v1/progress') {
      const auth = (headers.Authorization || headers.authorization || '').replace(/^Bearer /, '');
      const me = tokens.get(auth);
      if (!me) return json(401, { code: 'PGRST301', message: 'JWT expired' });
      const want = (u.searchParams.get('user_id') || '').replace(/^eq\./, '');
      const sel = (u.searchParams.get('select') || '*').split(',');
      const pick = (r, id) => Object.fromEntries(sel.map((k) => [k, k === 'user_id' ? id : r[k]]));
      if (method === 'GET') return json(200, want === me && rows.has(me) ? [pick(rows.get(me), me)] : []); // RLS: chỉ thấy dòng của mình
      if (method === 'POST') {
        if (body.user_id !== me) return json(403, { code: '42501', message: 'new row violates row-level security policy' });
        const r = { data: body.data, updated_at: stamp() };
        rows.set(me, r);
        return json(201, [pick(r, me)]);
      }
    }
    return json(404, { message: 'not found' });
  }

  async function fetchImpl(url, opts = {}) {
    const r = handle(opts.method || 'GET', url, opts.headers || {}, opts.body);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => r.body };
  }
  return { fetchImpl, handle, users, rows, tokens, log, expireAll: () => tokens.clear(), confirmAll: () => users.forEach((x) => (x.confirmed = true)) };
}
module.exports = { createFakeSupabase };
