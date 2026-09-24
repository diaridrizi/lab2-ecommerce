// Small wrapper around fetch. Adds the access token and turns errors into exceptions.
//   const products = await api.get('/products?search=shoe');
//   await api.post('/cart/items', { productId: 1, quantity: 2 });
//
// Tokens:
// - The access token (15 min) lives only in memory (this variable), not in localStorage, so XSS can't read it later.
// - The refresh token is an httpOnly cookie the browser sends to /api/auth/refresh by itself.
// - When a request gets 401, we refresh once and retry it. If that fails the session is over.

let accessToken = null;
let sessionEnded = () => {};
let userRefreshed = () => {};
const SESSION_HINT = 'shop_has_session'; // not a secret: only says "try to refresh on page load"

export const auth = {
  getToken: () => accessToken,
  setToken: (token) => {
    accessToken = token;
    try {
      if (token) localStorage.setItem(SESSION_HINT, '1');
      else localStorage.removeItem(SESSION_HINT);
    } catch { /* storage blocked */ }
  },
  hasSessionHint: () => {
    try { return localStorage.getItem(SESSION_HINT) === '1'; } catch { return true; }
  },
  onSessionEnded: (fn) => { sessionEnded = fn; },
  // Called after every refresh with the user from the server (e.g. the role may have changed)
  onUserRefreshed: (fn) => { userRefreshed = fn; },
};

// Only one refresh at a time: parallel requests (or React StrictMode) wait for the same one
let refreshing = null;
export function refreshSession() {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          auth.setToken(null);
          const err = new Error(data.message || 'Session ended');
          err.status = res.status;
          err.code = data.code;
          throw err;
        }
        auth.setToken(data.accessToken);
        userRefreshed(data.user);
        return data; // { user, accessToken }
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

// These endpoints must not trigger a refresh-and-retry
const NO_RETRY = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

async function request(method, path, body, retried = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Access token expired or revoked: get a new one with the refresh cookie, then try again once
  if (res.status === 401 && !retried && !NO_RETRY.includes(path)) {
    try {
      await refreshSession();
      return request(method, path, body, true);
    } catch {
      sessionEnded();
    }
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};

export const money = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

export const formatDate = (d) =>
  new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

// "3 min ago", "yesterday", ...
export function timeAgo(d) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 45) return 'just now';
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, secs] of units) if (s >= secs) return rtf.format(-Math.floor(s / secs), unit);
  return rtf.format(-Math.max(1, Math.floor(s / 60)), 'minute');
}
