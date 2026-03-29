import { apiGet } from '@/api/http';
import type { AdminUserDto } from '@/api/types';

const EMPLOYEE_ID_KEY = 'asset_app_employee_id';

/** Đồng bộ từ GET /api/account (sau đăng nhập hoặc F5). */
export async function fetchAndStoreAccountContext(): Promise<AdminUserDto | null> {
  try {
    const acc = await apiGet<AdminUserDto>('/api/account');
    if (acc.employeeId != null && acc.employeeId !== undefined) {
      localStorage.setItem(EMPLOYEE_ID_KEY, String(acc.employeeId));
    } else {
      localStorage.removeItem(EMPLOYEE_ID_KEY);
    }
    return acc;
  } catch {
    return null;
  }
}

export function getStoredEmployeeId(): string | null {
  return localStorage.getItem(EMPLOYEE_ID_KEY);
}

/**
 * Id nhân viên cho luồng NV: ưu tiên liên kết từ server; dev fallback VITE_DEV_EMPLOYEE_ID.
 */
export function resolveEmployeeIdForRequests(): string | null {
  const linked = getStoredEmployeeId();
  if (linked) return linked;
  const devId = import.meta.env.VITE_DEV_EMPLOYEE_ID;
  if (import.meta.env.DEV && devId != null && String(devId).trim() !== '') {
    return String(devId);
  }
  return null;
}

/** Khi có vị trí làm việc (sau này từ /api/account); dev: VITE_DEV_LOCATION_ID */
export function resolveEmployeeLocationIdForRequests(): string | null {
  const dev = import.meta.env.VITE_DEV_LOCATION_ID;
  if (import.meta.env.DEV && dev != null && String(dev).trim() !== '') {
    return String(dev);
  }
  return null;
}
