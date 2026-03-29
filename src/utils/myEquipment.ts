import type { Equipment } from '@/data/mockData';

/** Cách thiết bị «thuộc» tài khoản NV theo bàn giao (cá nhân / PB / vị trí / đồng phòng ban). */
export type MyAssetScope = 'personal' | 'department' | 'location' | 'peer';

const scopeLabels: Record<MyAssetScope, string> = {
  personal: 'Cá nhân',
  department: 'Phòng ban',
  location: 'Vị trí',
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
