import type { ConsumableAssignmentDto } from '@/api/types';
import type { Equipment } from '@/data/mockData';

/** Cách thiết bị «thuộc» tài khoản NV theo bàn giao (cá nhân / PB / vị trí / đồng phòng ban). */
export type MyAssetScope = 'personal' | 'department' | 'location' | 'peer';

const scopeLabels: Record<MyAssetScope, string> = {
  personal: 'Cá nhân',
  department: 'Phòng ban',
  location: 'Vị trí',
  peer: 'Đồng phòng ban',
};

export function myAssetScopeLabel(scope: MyAssetScope | null | undefined): string {
  if (!scope) return '—';
  return scopeLabels[scope] ?? scope;
}

/**
 * Xác định thiết bị có hiển thị trong «Tài sản của tôi» không (đang IN_USE/PENDING với bàn giao khớp).
 */
export function resolveMyAssetScope(
  e: Equipment,
  employeeId: string | null,
  departmentId: string | null,
  locationId: string | null,
): MyAssetScope | null {
  if (!employeeId) return null;
  const inUse = e.status === 'IN_USE' || e.status === 'PENDING_ISSUE';
  if (!inUse) return null;

  if (e.assignedTo === employeeId) return 'personal';
  if (e.assignedDepartment && departmentId && e.assignedDepartment === departmentId) return 'department';
  if (e.assignedLocation && locationId && e.assignedLocation === locationId) return 'location';
  return null;
}

export function filterEquipmentForMyAccount(
  list: Equipment[],
  employeeId: string | null,
  departmentId: string | null,
  locationId: string | null,
): Equipment[] {
  return list.filter(eq => resolveMyAssetScope(eq, employeeId, departmentId, locationId) != null);
}

/**
 * Điều phối phòng ban: thêm thiết bị đang gán cho nhân viên cùng phòng (theo tài liệu «xem tài sản phòng ban»).
 */
export function filterEquipmentWithDepartmentPeers(
  list: Equipment[],
  employeeId: string | null,
  departmentId: string | null,
  locationId: string | null,
  sameDepartmentEmployeeIds: string[],
): Equipment[] {
  const base = filterEquipmentForMyAccount(list, employeeId, departmentId, locationId);
  if (!departmentId || sameDepartmentEmployeeIds.length === 0) {
    return base;
  }
  const peerSet = new Set(sameDepartmentEmployeeIds);
  const baseIds = new Set(base.map(e => e.id));
  const extras = list.filter(eq => {
    if (baseIds.has(eq.id)) return false;
    const inUse = eq.status === 'IN_USE' || eq.status === 'PENDING_ISSUE';
    if (!inUse || !eq.assignedTo) return false;
    return peerSet.has(eq.assignedTo);
  });
  return [...base, ...extras];
}

/** Phạm vi hiển thị (kèm đồng phòng ban cho điều phối). */
export function resolveMyAssetScopeWithPeers(
  e: Equipment,
  employeeId: string | null,
  departmentId: string | null,
  locationId: string | null,
  sameDepartmentEmployeeIds: string[] | undefined,
): MyAssetScope | null {
  const s = resolveMyAssetScope(e, employeeId, departmentId, locationId);
  if (s) return s;
  if (!sameDepartmentEmployeeIds?.length || !e.assignedTo) return null;
  const peerSet = new Set(sameDepartmentEmployeeIds);
  const inUse = e.status === 'IN_USE' || e.status === 'PENDING_ISSUE';
  if (inUse && peerSet.has(e.assignedTo)) return 'peer';
  return null;
}

/** Số lượng vật tư còn đang giữ (đã cấp − đã thu hồi). */
export function consumableQuantityHeld(a: { quantity?: number; returnedQuantity?: number }): number {
  const q = a.quantity ?? 0;
  const r = a.returnedQuantity ?? 0;
  return Math.max(0, q - r);
}

/**
 * Dòng gán vật tư có hiển thị trong «Tài sản của tôi» không (cá nhân / PB / vị trí).
 */
export function resolveMyConsumableScope(
  a: ConsumableAssignmentDto,
  employeeId: string | null,
  departmentId: string | null,
  locationId: string | null,
): MyAssetScope | null {
  if (!employeeId) return null;
  if (consumableQuantityHeld(a) <= 0) return null;

  if (a.employee?.id != null && String(a.employee.id) === employeeId) return 'personal';
  if (a.department?.id != null && departmentId && String(a.department.id) === departmentId) return 'department';
  if (a.location?.id != null && locationId && String(a.location.id) === locationId) return 'location';
  return null;
}

export function filterConsumableAssignmentsForMyAccount(
  list: ConsumableAssignmentDto[],
  employeeId: string | null,
  departmentId: string | null,
  locationId: string | null,
): ConsumableAssignmentDto[] {
  return list.filter(a => resolveMyConsumableScope(a, employeeId, departmentId, locationId) != null);
}

/** Điều phối PB: thêm vật tư gán cho NV cùng phòng (cùng logic thiết bị). */
export function filterConsumableAssignmentsWithDepartmentPeers(
  list: ConsumableAssignmentDto[],
  employeeId: string | null,
  departmentId: string | null,
  locationId: string | null,
  sameDepartmentEmployeeIds: string[],
): ConsumableAssignmentDto[] {
  const base = filterConsumableAssignmentsForMyAccount(list, employeeId, departmentId, locationId);
  if (!departmentId || sameDepartmentEmployeeIds.length === 0) {
    return base;
  }
  const peerSet = new Set(sameDepartmentEmployeeIds);
  const baseIds = new Set(base.map(x => String(x.id ?? '')));
  const extras = list.filter(a => {
    if (baseIds.has(String(a.id ?? ''))) return false;
    if (consumableQuantityHeld(a) <= 0) return false;
    const aid = a.employee?.id != null ? String(a.employee.id) : null;
    if (!aid || !peerSet.has(aid)) return false;
    return true;
  });
  return [...base, ...extras];
}

export function resolveMyConsumableScopeWithPeers(
  a: ConsumableAssignmentDto,
  employeeId: string | null,
  departmentId: string | null,
  locationId: string | null,
  sameDepartmentEmployeeIds: string[] | undefined,
): MyAssetScope | null {
  const s = resolveMyConsumableScope(a, employeeId, departmentId, locationId);
  if (s) return s;
  if (!sameDepartmentEmployeeIds?.length || a.employee?.id == null) return null;
  if (consumableQuantityHeld(a) <= 0) return null;
  const peerSet = new Set(sameDepartmentEmployeeIds);
  const aid = String(a.employee.id);
  if (peerSet.has(aid) && aid !== employeeId) return 'peer';
  return null;
}
