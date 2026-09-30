const TOKEN_KEY = 'nm_token';
const ADMIN_KEY = 'nm_admin_token';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = 'error') { super(message); }
}

function read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function write(key: string, v: string | null) { try { if (v) localStorage.setItem(key, v); else localStorage.removeItem(key); } catch { /* storage unavailable */ } }

export const tokens = {
  get customer() { return read(TOKEN_KEY); }, set customer(v) { write(TOKEN_KEY, v); },
  get admin() { return read(ADMIN_KEY); }, set admin(v) { write(ADMIN_KEY, v); }
};

async function request<T>(method: string, url: string, body?: unknown, as: 'customer' | 'admin' = 'customer'): Promise<T> {
  const token = as === 'admin' ? tokens.admin : tokens.customer;
  const res = await fetch('/api' + url, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) { if (as === 'admin') tokens.admin = null; else tokens.customer = null; }
    throw new ApiError(res.status, data.message ?? 'Ошибка сети', data.error);
  }
  return data as T;
}

export const api = {
  get: <T,>(url: string) => request<T>('GET', url),
  post: <T,>(url: string, body: unknown = {}) => request<T>('POST', url, body),
  patch: <T,>(url: string, body: unknown) => request<T>('PATCH', url, body),
  admin: {
    get: <T,>(url: string) => request<T>('GET', url, undefined, 'admin'),
    post: <T,>(url: string, body: unknown = {}) => request<T>('POST', url, body, 'admin'),
    patch: <T,>(url: string, body: unknown) => request<T>('PATCH', url, body, 'admin'),
    del: <T,>(url: string) => request<T>('DELETE', url, undefined, 'admin')
  }
};
