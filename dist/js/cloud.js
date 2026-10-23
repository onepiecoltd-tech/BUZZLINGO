/* BuzzLingo · đồng bộ tiến độ lên Supabase (tuỳ chọn).
 * - Không dùng thư viện: gọi thẳng REST của Supabase Auth (/auth/v1) và PostgREST (/rest/v1) bằng fetch.
 * - Khoá "anon" của Supabase là khoá công khai, được phép nằm trong app; dữ liệu được bảo vệ bằng Row Level Security
 *   (mỗi người chỉ đọc/ghi được dòng của mình — xem supabase/schema.sql). TUYỆT ĐỐI không đặt khoá service_role ở đây.
 * - Dữ liệu học vẫn lưu trên máy trước (local-first); đám mây là bản sao để lấy lại khi Safari xoá dữ liệu hoặc khi đổi máy.
 * - Mỗi lần đồng bộ: hỏi đám mây có bản mới hơn không → gộp (Store.mergeStates, không mất tiến độ bên nào) → đẩy bản đã gộp lên. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.Buzz = root.Buzz || {}).Cloud = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const AUTH_KEY = 'buzzlingo.auth';
  const ERR = {
    invalid_credentials: 'Sai email hoặc mật khẩu.',
    email_not_confirmed: 'Email chưa được xác nhận. Mở thư Supabase gửi cho bạn, bấm xác nhận rồi đăng nhập lại.',
    user_already_exists: 'Email này đã có tài khoản. Hãy bấm Đăng nhập.',
    email_exists: 'Email này đã có tài khoản. Hãy bấm Đăng nhập.',
    weak_password: 'Mật khẩu quá ngắn (cần ít nhất 6 ký tự).',
    validation_failed: 'Email hoặc mật khẩu không hợp lệ.',
    email_address_invalid: 'Địa chỉ email không hợp lệ.',
    over_email_send_rate_limit: 'Gửi email xác nhận quá nhiều lần. Đợi vài phút rồi thử lại.',
    over_request_rate_limit: 'Thử quá nhiều lần. Đợi một lát rồi thử lại.',
    signup_disabled: 'Máy chủ đang tắt chức năng tạo tài khoản.',
  };

  function createCloud({ url, anonKey, store, storage = null, fetchImpl = (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null), now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout, debounceMs = 15000, maxWaitMs = 60000 } = {}) {
    const base = String(url || '').replace(/\/+$/, '');
    const configured = !!(base && anonKey && fetchImpl);
    let session = null;          // { access_token, refresh_token, expires_at (giây), user: { id, email } }
    let remoteAt = null;         // updated_at của bản trên đám mây mà máy này đã thấy
    let dirty = false, busy = false, again = false, timer = null, firstDirtyAt = 0;
    const status = { state: 'idle', lastSync: 0, error: '' };
    const listeners = new Set();
    const emit = () => listeners.forEach((fn) => { try { fn(api.status()); } catch (e) { /* bỏ qua lỗi UI */ } });

    const readAuth = () => { try { const s = JSON.parse((storage && storage.getItem(AUTH_KEY)) || 'null'); return s && s.access_token && s.user ? s : null; } catch (e) { return null; } };
    const writeAuth = (s) => { try { if (!storage) return; if (s) storage.setItem(AUTH_KEY, JSON.stringify(s)); else storage.removeItem(AUTH_KEY); } catch (e) { /* bỏ qua */ } };
    session = configured ? readAuth() : null;
    if (session) remoteAt = session.remoteAt || null;

    // Authorization chỉ gửi khi đã có token người dùng (khoá publishable kiểu mới "sb_publishable_…" không phải JWT)
    const headers = (token, extra) => Object.assign({ apikey: anonKey, 'Content-Type': 'application/json' }, token ? { Authorization: `Bearer ${token}` } : {}, extra || {});
    async function call(path, { method = 'GET', body, token, extra, keepalive = false } = {}) {
      let res;
      try { res = await fetchImpl(base + path, { method, headers: headers(token, extra), body: body == null ? undefined : JSON.stringify(body), keepalive }); }
      catch (e) { const err = new Error('Không kết nối được máy chủ đồng bộ.'); err.offline = true; throw err; }
      const text = await res.text();
      let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      if (!res.ok) {
        const code = (data && (data.error_code || data.code || data.error)) || '';
        const err = new Error(ERR[code] || (data && (data.msg || data.message || data.error_description)) || `Lỗi máy chủ (${res.status}).`);
        err.status = res.status; err.code = code; throw err;
      }
      return data;
    }

    function keepSession(d) {
      if (!d || !d.access_token) return false;
      session = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(now() / 1000) + (d.expires_in || 3600), user: { id: d.user && d.user.id, email: d.user && d.user.email }, remoteAt };
      writeAuth(session);
      return true;
    }
    function dropSession() { session = null; remoteAt = null; writeAuth(null); }

    async function token(force = false) {
      if (!session) throw Object.assign(new Error('Bạn chưa đăng nhập.'), { status: 401 });
      if (!force && session.expires_at - 60 > now() / 1000) return session.access_token;
      try {
        const d = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
        keepSession(d);
        return session.access_token;
      } catch (e) {
        if (!e.offline) { dropSession(); status.state = 'signedout'; status.error = 'Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.'; emit(); }
        throw e;
      }
    }
    async function authed(path, opts) {
      try { return await call(path, { ...opts, token: await token() }); }
      catch (e) { if (e.status === 401 && session) return call(path, { ...opts, token: await token(true) }); throw e; }
    }

    const uid = () => session && session.user && session.user.id;
    const rowPath = (sel) => `/rest/v1/progress?user_id=eq.${encodeURIComponent(uid())}&select=${sel}`;
    async function pull(full) {
      const rows = await authed(rowPath(full ? 'data,updated_at' : 'updated_at'));
      return rows && rows[0] ? rows[0] : null;
    }
    async function push(keepalive) {
      const rows = await authed('/rest/v1/progress?on_conflict=user_id&select=updated_at', {
        method: 'POST', body: { user_id: uid(), data: store.state }, keepalive,
        extra: { Prefer: 'resolution=merge-duplicates,return=representation' },
      });
      remoteAt = rows && rows[0] ? rows[0].updated_at : remoteAt;
      if (session) { session.remoteAt = remoteAt; writeAuth(session); }
    }

    /** Một vòng đồng bộ đầy đủ. Trả { ok, error? }. */
    async function sync({ keepalive = false } = {}) {
      if (!configured || !session) return { ok: false, error: 'Bạn chưa đăng nhập.' };
      if (busy) { again = true; return { ok: true, queued: true }; }
      busy = true; clearTimer(timer); timer = null;
      status.state = 'syncing'; status.error = ''; emit();
      try {
        const head = await pull(false);
        if (head && head.updated_at !== remoteAt) {
          const row = await pull(true);
          if (row && row.data) store.mergeIn(row.data);
          remoteAt = row ? row.updated_at : remoteAt;
        }
        const wasDirty = dirty; dirty = false; firstDirtyAt = 0;
        if (wasDirty || !head) await push(keepalive); // không có gì mới ở máy này thì bản trên đám mây đã đủ
        status.state = 'ok'; status.lastSync = now(); emit();
        return { ok: true };
      } catch (e) {
        dirty = true;
        if (session) { status.state = e.offline ? 'offline' : 'error'; status.error = e.message; }
        emit();
        return { ok: false, error: e.message };
      } finally {
        busy = false;
        if (again) { again = false; schedule(1500); }
      }
    }

    function schedule(ms = debounceMs) {
      if (!session) return;
      clearTimer(timer);
      const wait = firstDirtyAt ? Math.max(0, Math.min(ms, firstDirtyAt + maxWaitMs - now())) : ms;
      timer = setTimer(() => { timer = null; sync(); }, wait);
    }
    // mỗi thay đổi do người học tạo ra → đánh dấu cần đẩy lên (gộp nhiều thay đổi vào một lần gửi)
    if (store && store.subscribe) store.subscribe((meta) => {
      if (meta && meta.source === 'cloud') return;
      if (!session) return;
      dirty = true; if (!firstDirtyAt) firstDirtyAt = now();
      schedule();
    });

    async function afterLogin() {
      const id = uid();
      // dữ liệu trên máy thuộc tài khoản khác → không trộn, lấy đúng dữ liệu của tài khoản này
      if (store.state.owner && store.state.owner !== id) {
        const row = await pull(true).catch(() => null);
        store.replaceState(row && row.data ? row.data : null);
        remoteAt = row ? row.updated_at : null;
      }
      store.setOwner(id);
      dirty = true; remoteAt = null; // lần đầu luôn tải bản đầy đủ rồi gộp
      return sync();
    }

    const api = {
      configured,
      status: () => ({ configured, signedIn: !!session, email: session && session.user ? session.user.email : '', ...status, dirty }),
      onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },

      async signIn(email, password) {
        if (!configured) return { ok: false, error: 'Chưa cấu hình đồng bộ.' };
        try {
          const d = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: String(email).trim(), password } });
          keepSession(d); emit();
          const r = await afterLogin();
          return { ok: true, synced: r.ok, error: r.ok ? '' : r.error };
        } catch (e) { return { ok: false, error: e.message }; }
      },

      async signUp(email, password) {
        if (!configured) return { ok: false, error: 'Chưa cấu hình đồng bộ.' };
        try {
          const d = await call('/auth/v1/signup', { method: 'POST', body: { email: String(email).trim(), password } });
          if (keepSession(d)) { emit(); const r = await afterLogin(); return { ok: true, synced: r.ok, error: r.ok ? '' : r.error }; }
          // Supabase bật "Confirm email": chưa có phiên, chờ người dùng bấm link trong thư
          if (d && (d.id || (d.user && d.user.id)) && Array.isArray(d.identities) && d.identities.length === 0) return { ok: false, error: ERR.user_already_exists };
          return { ok: true, needConfirm: true };
        } catch (e) { return { ok: false, error: e.message }; }
      },

      /** Đăng xuất: đẩy nốt dữ liệu lên rồi xoá dữ liệu trên máy (để người khác dùng máy không thấy/ghi lẫn). */
      async signOut({ force = false } = {}) {
        if (!session) return { ok: true };
        if (dirty || !status.lastSync) {
          const r = await sync();
          if (!r.ok && !force) return { ok: false, error: `Chưa đẩy được dữ liệu mới lên đám mây (${r.error}). Kết nối mạng rồi thử lại.` };
        }
        const t = session.access_token;
        call('/auth/v1/logout', { method: 'POST', token: t }).catch(() => {});
        dropSession(); clearTimer(timer); timer = null; dirty = false;
        status.state = 'idle'; status.error = ''; status.lastSync = 0;
        store.reset();
        emit();
        return { ok: true };
      },

      sync,
      syncSoon(ms = 1500) { if (session) { dirty = true; schedule(ms); } },
      /** Gọi khi tab bị ẩn/đóng: đẩy ngay nếu còn thay đổi chưa gửi. */
      flush() { if (session && dirty && !busy) sync({ keepalive: JSON.stringify(store.state).length < 60000 }); },
    };
    return api;
  }

  return { createCloud, AUTH_KEY };
});
