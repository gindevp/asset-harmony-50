/** JHipster page request: 0-based page, sort — mới nhất trước (theo tài liệu: danh sách theo thời điểm tạo) */
export const PAGE_ALL = 'page=0&size=10000&sort=id,desc';

const TOKEN_KEY = 'asset_app_jwt';

/**
 * Base URL API cho môi trường production deploy.
 * - DEV: để Vite proxy /api -> localhost:8080 như hiện tại.
 * - PROD: mặc định theo backend Railway: https://assetmanager.railway.internal
 *   (có thể override bằng env `VITE_API_BASE_URL`).
 */
const API_BASE_URL =
  import.meta.env.DEV
    ? ''
    : (import.meta.env.VITE_API_BASE_URL ?? 'https://assetmanager.railway.internal');

function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!API_BASE_URL) return path;
  const base = API_BASE_URL.replace(/\/$/, '');
  if (path.startsWith('/')) return `${base}${path}`;
  return `${base}/${path}`;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('asset_app_employee_id');
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const jsonBody = typeof init.body === 'string';
  const h = new Headers(init.headers);
  const url = resolveApiUrl(path);
  if (!path.startsWith('/api/authenticate')) {
    const t = getStoredToken();
    if (t) h.set('Authorization', `Bearer ${t}`);
  }
  if (jsonBody && !h.has('Content-Type')) h.set('Content-Type', 'application/json');
  return fetch(url, { ...init, headers: h, credentials: 'include' });
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(`${res.status} ${res.statusText}`, res.status, text.slice(0, 500));
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiJson<T>(path, { method: 'GET' });
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiJson<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiJson<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiJson<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

/** GET binary (PDF, …) kèm JWT. */
export async function apiDownloadBlob(path: string): Promise<Blob> {
  const res = await apiFetch(path, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(`${res.status} ${res.statusText}`, res.status, text.slice(0, 500));
  }
  return res.blob();
}

/** Mở PDF trong tab mới (in từ trình duyệt / Ctrl+P). */
export async function openPdfInBrowserTab(path: string): Promise<void> {
  const blob = await apiDownloadBlob(path);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export async function apiDelete(path: string): Promise<void> {
  const res = await apiFetch(path, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(`${res.status}`, res.status, text.slice(0, 500));
  }
}

/** POST multipart (FormData) — không set Content-Type để trình duyệt gửi boundary. */
export async function apiPostMultipart<T>(path: string, formData: FormData): Promise<T> {
  const h = new Headers();
  const t = getStoredToken();
  if (t) h.set('Authorization', `Bearer ${t}`);
  const url = resolveApiUrl(path);
  const res = await fetch(url, { method: 'POST', body: formData, headers: h, credentials: 'include' });
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(`${res.status} ${res.statusText}`, res.status, text.slice(0, 500));
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
