let accessToken = null;
let serverAuthEnabled = false;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export function setServerAuthEnabled(enabled) {
  serverAuthEnabled = Boolean(enabled);
}

export function isServerAuthEnabled() {
  return serverAuthEnabled;
}

async function refreshAccessToken() {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.ok || !data.accessToken) return false;
    setAccessToken(data.accessToken);
    return data;
  } catch {
    return false;
  }
}

export async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: options.credentials ?? 'include',
  });

  if (res.status === 401 && serverAuthEnabled && !options._retry && !String(url).includes('/api/auth/refresh')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch(url, { ...options, _retry: true });
    }
  }

  return res;
}

export async function authPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.ok !== false, status: res.status, ...data };
}

export async function authGet(path) {
  const res = await apiFetch(path, { method: 'GET' });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.ok !== false, status: res.status, ...data };
}

export { refreshAccessToken };
