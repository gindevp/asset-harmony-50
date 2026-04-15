import type { ConsumableAssignmentDto } from '@/api/types';
import type { Equipment } from '@/data/mockData';

/** Giá trị cho input `datetime-local` (giờ địa phương). */
export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowDatetimeLocalValue(): string {
  return toDatetimeLocalValue(new Date());
}

/** Gửi API: chuỗi ISO từ giá trị datetime-local (rỗng nếu không hợp lệ). */
export function lossOccurredAtFromDatetimeLocal(local: string): string {
  const t = local.trim();
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

/** Giá trị đã lưu (ISO hoặc chuỗi parse được) → `datetime-local` để sửa trong modal. */
export function lossOccurredAtToDatetimeLocalValue(stored: string | undefined | null): string {
  const t = stored?.trim() ?? '';
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return toDatetimeLocalValue(d);
}

/** Hiển thị (ISO hoặc text tự do). */
export function formatLossOccurredAtForDisplay(s: string): string {
  const t = s.trim();
  if (!t) return '';
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  }
  return t;
}

/** Địa điểm / vị trí từ snapshot bàn giao thiết bị. */
export function lossLocationLabelFromEquipment(e: Equipment): string {
  const parts: string[] = [];
  if (e.assignedLocationName?.trim()) parts.push(`Vị trí: ${e.assignedLocationName.trim()}`);
  else if (e.assignedLocation?.trim()) parts.push(`Vị trí: ${e.assignedLocation.trim()}`);
  if (e.assignedDepartmentName?.trim()) parts.push(`Phòng ban: ${e.assignedDepartmentName.trim()}`);
  else if (e.assignedDepartment?.trim()) parts.push(`Phòng ban: ${e.assignedDepartment.trim()}`);
  if (e.assignedToName?.trim()) parts.push(`Bàn giao NV: ${e.assignedToName.trim()}`);
  else if (e.assignedTo?.trim()) parts.push(`NV: ${e.assignedTo.trim()}`);
  return parts.length > 0 ? parts.join(' · ') : '';
}

/** Địa điểm / vị trí từ bàn giao vật tư. */
export function lossLocationLabelFromConsumableAssignment(a: ConsumableAssignmentDto): string {
  const parts: string[] = [];
  if (a.location?.name?.trim()) parts.push(`Vị trí: ${a.location.name.trim()}`);
  if (a.department?.name?.trim()) parts.push(`Phòng ban: ${a.department.name.trim()}`);
  const en = a.employee?.fullName?.trim() || a.employee?.code?.trim();
  if (en) parts.push(`NV: ${en}`);
  return parts.length > 0 ? parts.join(' · ') : '';
}
