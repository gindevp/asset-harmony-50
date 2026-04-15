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
    : (import.meta.env.VITE_API_BASE_URL ?? 'https://assetmanagerapp.up.railway.app');

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

function isGenericProblemTitle(t: string | undefined): boolean {
  if (!t || t === 'null') return true;
  return ['Bad Request', 'Forbidden', 'Unauthorized', 'Not Found', 'Internal Server Error', 'Conflict', 'Method Not Allowed'].includes(
    t,
  );
}

/** Parse JSON lỗi RFC 7807 / JHipster (fieldErrors) để hiển thị toast — ưu tiên title/detail từ server. */
export function parseProblemDetailJson(body: string | undefined): string {
  if (!body) return '';
  try {
    const j = JSON.parse(body) as {
      detail?: string;
      title?: string;
      message?: string;
      properties?: { message?: string; params?: string };
      fieldErrors?: Array<{ objectName?: string; field?: string; message?: string }>;
    };
    const friendlyByProblemKey: Record<string, string> = {
      'error.http.400': 'Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại thông tin.',
      'error.http.401': 'Sai tài khoản hoặc mật khẩu.',
      'error.http.403': 'Bạn không có quyền thực hiện thao tác này.',
      'error.http.404': 'Không tìm thấy dữ liệu yêu cầu.',
      'error.http.405': 'Thao tác không được hỗ trợ.',
      'error.http.409': 'Dữ liệu đang xung đột hoặc đã tồn tại.',
      'error.http.500': 'Hệ thống đang bận. Vui lòng thử lại sau.',
    };
    if (Array.isArray(j.fieldErrors) && j.fieldErrors.length > 0) {
      const label = (field: string) =>
        field === 'email' ? 'Email' : field === 'login' ? 'Đăng nhập' : field;
      return j.fieldErrors
        .map(f => `${label(f.field ?? '')}: ${f.message ?? ''}`.trim())
        .filter(Boolean)
        .join(' · ');
    }
    /** Title từ BadRequestAlertException — thường có mã thiết bị / vật tư; ưu tiên trước map tĩnh. */
    if (j.title && !isGenericProblemTitle(j.title)) {
      return j.title;
    }
    const problemKeys: Record<string, string> = {
      'error.nostock':
        'Chưa có bản ghi tồn kho cho vật tư trong yêu cầu. Cần nhập kho mã vật tư đó trước (Tồn kho).',
      'error.insufficientstock':
        'Không đủ tồn kho vật tư (duyệt hoặc hoàn thành cấp phát) — kiểm tra số lượng yêu cầu và nhập kho bổ sung.',
      'error.equipmentrequired':
        'Mỗi dòng thiết bị phải chọn thiết bị tồn kho trước khi duyệt / hoàn thành.',
      'error.devicerequiresline':
        'Dòng thiết bị phải chọn dòng tài sản (danh mục), không chọn item cụ thể trên phiếu yêu cầu.',
      'error.consumablerequiresitem': 'Dòng vật tư phải chọn mã tài sản (item).',
      'error.notinstock': 'Thiết bị chọn không còn ở trạng thái tồn kho (IN_STOCK).',
      ...friendlyByProblemKey,
    };
    const msgKey = j.properties?.message ?? j.message;
    if (msgKey && problemKeys[msgKey]) {
      return problemKeys[msgKey];
    }
    if (j.detail === 'Bad credentials') return 'Sai tài khoản hoặc mật khẩu.';
    if (j.title === 'Unauthorized') return 'Bạn cần đăng nhập để tiếp tục.';
    if (j.title === 'Forbidden') return 'Bạn không có quyền thực hiện thao tác này.';
    if (j.title === 'Not Found') return 'Không tìm thấy dữ liệu yêu cầu.';
    if (j.title === 'Conflict') return 'Dữ liệu đang xung đột hoặc đã tồn tại.';
    if (j.detail && j.detail.startsWith('{')) {
      try {
        const inner = JSON.parse(j.detail) as { title?: string; message?: string };
        if (inner.title && !isGenericProblemTitle(inner.title)) return inner.title;
        if (inner.message && problemKeys[inner.message]) return problemKeys[inner.message];
      } catch {
        /* ignore */
      }
    }
    if (j.detail && !/^error\.http\.\d+$/.test(j.detail) && j.detail !== 'null') return j.detail;
    if (j.message && problemKeys[j.message]) return problemKeys[j.message];
    if (j.message && !/^error\.http\.\d+$/.test(j.message)) return j.message;
  } catch {
    // ignore
  }
  return body.slice(0, 2000);
}

export function getApiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const parsed = parseProblemDetailJson(err.body);
    if (parsed) return parsed;
    const byStatus: Record<number, string> = {
      400: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
      401: 'Sai tài khoản hoặc mật khẩu, hoặc phiên đăng nhập đã hết hạn.',
      403: 'Bạn không có quyền thực hiện thao tác này.',
      404: 'Không tìm thấy dữ liệu yêu cầu.',
      409: 'Dữ liệu đang xung đột hoặc đã tồn tại.',
      500: 'Hệ thống gặp lỗi nội bộ. Vui lòng thử lại sau.',
    };
    if (byStatus[err.status]) return byStatus[err.status];
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Lỗi không xác định';
}

function redirectToLoginIfNeeded() {
  // Tránh loop khi đang ở trang login
  const p = window.location.pathname || '/';
  if (p.startsWith('/login')) return;
  const returnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
}

function handleUnauthorized(res: Response) {
  if (res.status !== 401) return;
  // JWT sai/hết hạn → clear token và đẩy về login
  setStoredToken(null);
  redirectToLoginIfNeeded();
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
  const res = await fetch(url, { ...init, headers: h, credentials: 'include' });
  // Nếu BE trả 401, auto redirect sang /login
  // (vẫn để các caller xử lý throw ApiError như hiện tại)
  if (!path.startsWith('/api/authenticate')) handleUnauthorized(res);
  return res;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(`${res.status} ${res.statusText}`, res.status, text.slice(0, 12000));
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
    throw new ApiError(`${res.status} ${res.statusText}`, res.status, text.slice(0, 12000));
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
    throw new ApiError(`${res.status}`, res.status, text.slice(0, 12000));
  }
}

/** POST multipart (FormData) — không set Content-Type để trình duyệt gửi boundary. */
export async function apiPostMultipart<T>(path: string, formData: FormData): Promise<T> {
  const res = await apiFetch(path, { method: 'POST', body: formData });
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(`${res.status} ${res.statusText}`, res.status, text.slice(0, 12000));
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
