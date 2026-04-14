import type { ConsumableAssignmentDto } from '@/api/types';
import type { Equipment, RepairRequest, ReturnRequest } from '@/data/mockData';
import { equipmentStatusLabels } from '@/data/mockData';
import { isReturnRequestOpen } from '@/utils/openAssetRequestBlocks';

/** Cách thiết bị «thuộc» tài khoản NV theo bàn giao (cá nhân / PB / vị trí — chỉ khi phiếu không gán cá nhân). */
export type MyAssetScope = 'personal' | 'department' | 'location';

/** Khớp `note` trên equipment-assignment / consumable-assignment (BE AllocationRequestService). */
const ASSIGNMENT_NOTE_DEPARTMENT_POOL = 'scoped=DEPT';
const ASSIGNMENT_NOTE_LOCATION_POOL = 'scoped=LOC';
const ASSIGNMENT_NOTE_COMPANY_VI = 'đối tượng: công ty';
const ASSIGNMENT_NOTE_COMPANY_ASCII = 'doi tuong: cong ty';

function hasCompanyLocationHint(note: string): boolean {
  const n = note.toLowerCase();
  return (
    n.includes(ASSIGNMENT_NOTE_LOCATION_POOL.toLowerCase()) ||
    n.includes(ASSIGNMENT_NOTE_COMPANY_VI) ||
    n.includes(ASSIGNMENT_NOTE_COMPANY_ASCII)
  );
}

function assignmentEmployeeId(a: ConsumableAssignmentDto): string | null {
  if (a.employee?.id != null) return String(a.employee.id);
  const raw = (a as { employeeId?: number | string }).employeeId;
  return raw != null ? String(raw) : null;
}

function assignmentDepartmentId(a: ConsumableAssignmentDto): string | null {
  if (a.department?.id != null) return String(a.department.id);
  const raw = (a as { departmentId?: number | string }).departmentId;
  return raw != null ? String(raw) : null;
}

function assignmentLocationId(a: ConsumableAssignmentDto): string | null {
  if (a.location?.id != null) return String(a.location.id);
  const raw = (a as { locationId?: number | string }).locationId;
  return raw != null ? String(raw) : null;
}

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
 * Xác định thiết bị có hiển thị trong «Tài sản của tôi» không (đang gán / đã báo mất duyệt — vẫn hiện với trạng thái Mất).
 */
export function resolveMyAssetScope(
  e: Equipment,
  employeeId: string | null,
  departmentId: string | null,
  locationId: string | null,
): MyAssetScope | null {
  if (!employeeId) return null;
  const visible =
    e.status === 'IN_USE' || e.status === 'PENDING_ISSUE' || e.status === 'LOST';
  if (!visible) return null;

  /**
   * Cấp phát theo vị trí có thể vẫn có employee nhận bàn giao ở assignment.
   * Nếu vị trí đến trực tiếp từ assignment.location thì ưu tiên xem là tài sản công ty theo vị trí.
   */
  if (e.locationAssignedDirectly && e.assignedLocation && locationId && e.assignedLocation === locationId) {
    return 'location';
  }

  /**
   * Cấp phát có đối tượng nhận = phòng ban: BE gán cả NV nhận bàn giao → vẫn «scoped=DEPT» trên note,
   * toàn bộ NV cùng PB thấy thiết bị (không chỉ người được gán).
   */
  if (
    e.departmentPoolFromAllocation &&
    e.assignedDepartment &&
    departmentId &&
    e.assignedDepartment === departmentId
  ) {
    return 'department';
  }
  if (
    e.locationPoolFromAllocation &&
    e.assignedLocation &&
    locationId &&
    e.assignedLocation === locationId
  ) {
    return 'location';
  }
  if (e.assignedTo === employeeId) return 'personal';
  /**
   * Chỉ «Phòng ban» / «Vị trí» khi phiếu gán không gán cho cá nhân.
   */
  const noPersonalHolder = !e.assignedTo || String(e.assignedTo).trim() === '';
  if (noPersonalHolder && e.assignedDepartment && departmentId && e.assignedDepartment === departmentId) {
    return 'department';
  }
  if (noPersonalHolder && e.assignedLocation && locationId && e.assignedLocation === locationId) {
    return 'location';
  }
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
  /** Dòng đã duyệt báo mất (SL còn giữ = 0) vẫn hiển thị trong «Tài sản của tôi». */
  lossApprovedAssignmentIds?: Set<string>,
): MyAssetScope | null {
  if (!employeeId) return null;
  const held = consumableQuantityHeld(a);
  const lossLine = lossApprovedAssignmentIds?.has(String(a.id ?? ''));
  if (held <= 0 && !lossLine) return null;

  const note = typeof a.note === 'string' ? a.note : '';
  const aEmpId = assignmentEmployeeId(a);
  const aDepId = assignmentDepartmentId(a);
  const aLocId = assignmentLocationId(a);
  if (note.includes(ASSIGNMENT_NOTE_DEPARTMENT_POOL) && aDepId && departmentId && aDepId === departmentId) {
    return 'department';
  }
  if (note.includes(ASSIGNMENT_NOTE_LOCATION_POOL) && aLocId && locationId && aLocId === locationId) {
    return 'location';
  }
  if (hasCompanyLocationHint(note) && aLocId && locationId && aLocId === locationId) {
    return 'location';
  }
  if (aEmpId && aEmpId === employeeId) return 'personal';
  const noPersonalHolder = !aEmpId;
  if (noPersonalHolder && aDepId && departmentId && aDepId === departmentId) {
    return 'department';
  }
  if (noPersonalHolder && aLocId && locationId && aLocId === locationId) {
    return 'location';
  }
  return null;
}

/** Thiết bị (id) nằm trong phiếu thu hồi mở do người dùng gửi — để badge «Chờ thu hồi» / trừ khỏi «Đang sử dụng». */
export function equipmentIdsOnOpenReturnForRequester(empId: string | null, returnRequests: ReturnRequest[]): Set<string> {
  const ids = new Set<string>();
  if (!empId) return ids;
  for (const rr of returnRequests) {
    if (String(rr.requesterId) !== empId || !isReturnRequestOpen(rr)) continue;
    for (const line of rr.lines ?? []) {
      if (String(line.lineType ?? 'DEVICE').toUpperCase() === 'CONSUMABLE') continue;
      if (line.equipmentId) ids.add(String(line.equipmentId));
    }
  }
  return ids;
}

/**
 * Trạng thái hiển thị thiết bị trên «Tài sản của tôi»:
 * ưu tiên mất/hỏng/thanh lý/sửa theo API; nếu đang IN_USE nhưng có YC thu hồi mở → Chờ thu hồi.
 */
export function getEquipmentDisplayStatusForMyAssets(
  e: Equipment,
  empId: string | null,
  returnRequests: ReturnRequest[],
): { status: string; label: string } {
  const base = e.status;
  const label = equipmentStatusLabels[base] ?? base;
  if (base === 'LOST' || base === 'DISPOSED' || base === 'BROKEN' || base === 'UNDER_REPAIR' || base === 'PENDING_RETURN') {
    return { status: base, label };
  }
  const onReturn = equipmentIdsOnOpenReturnForRequester(empId, returnRequests);
  if (base === 'IN_USE' && onReturn.has(String(e.id))) {
    return { status: 'PENDING_RETURN', label: equipmentStatusLabels.PENDING_RETURN };
  }
  return { status: base, label };
}

export function filterConsumableAssignmentsForMyAccount(
  list: ConsumableAssignmentDto[],
  employeeId: string | null,
  departmentId: string | null,
  locationId: string | null,
  lossApprovedAssignmentIds?: Set<string>,
): ConsumableAssignmentDto[] {
  return list.filter(
    a => resolveMyConsumableScope(a, employeeId, departmentId, locationId, lossApprovedAssignmentIds) != null,
  );
}

/**
 * Trạng thái hiển thị cho vật tư (Tài sản của tôi): cùng họ badge với thiết bị —
 * Đang sử dụng khi còn giữ; Đang sửa chữa khi có yêu cầu sửa chữa chưa kết thúc
 * (NEW / ACCEPTED / IN_PROGRESS) do đúng người giữ bàn giao gửi, kèm dòng vật tư trùng mặt hàng.
 */
export function getConsumableAssignmentDisplayStatus(
  a: ConsumableAssignmentDto,
  repairRequests: RepairRequest[],
  lossApprovedAssignmentIds?: Set<string>,
): { status: string; label: string } {
  const held = consumableQuantityHeld(a);
  if (held <= 0) {
    if (lossApprovedAssignmentIds?.has(String(a.id ?? ''))) {
      return { status: 'LOST', label: equipmentStatusLabels.LOST };
    }
    return { status: 'IN_STOCK', label: equipmentStatusLabels.IN_STOCK };
  }

  const assetItemId = a.assetItem?.id != null ? String(a.assetItem.id) : '';
  const holderId = assignmentEmployeeId(a) ?? '';

  if (assetItemId && holderId) {
    for (const r of repairRequests) {
      if (r.status === 'COMPLETED' || r.status === 'REJECTED') continue;
      if (r.requesterId !== holderId) continue;
      const hit = (r.consumableRepairLines ?? []).some(
        c => c.assetItemId === assetItemId && (c.quantity ?? 0) > 0,
      );
      if (hit) {
        return { status: 'UNDER_REPAIR', label: equipmentStatusLabels.UNDER_REPAIR };
      }
    }
  }

  return { status: 'IN_USE', label: equipmentStatusLabels.IN_USE };
}
