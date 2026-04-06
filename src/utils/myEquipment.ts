import type { ConsumableAssignmentDto } from '@/api/types';
import type { Equipment, RepairRequest } from '@/data/mockData';
import { equipmentStatusLabels } from '@/data/mockData';

/** Cách thiết bị «thuộc» tài khoản NV theo bàn giao (cá nhân / PB / vị trí — chỉ khi phiếu không gán cá nhân). */
export type MyAssetScope = 'personal' | 'department' | 'location';

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

  if (e.assignedTo === employeeId) return 'personal';
  /**
   * Chỉ «Phòng ban» / «Vị trí» khi phiếu gán không gán cho cá nhân.
   * mapEquipmentDto lấy assignedDepartment/assignedLocation cả từ NV đang giữ (để hiển thị),
   * nếu so khớp PB/Vị trí khi vẫn có assignedTo thì cả phòng sẽ thấy tài sản cá nhân của đồng nghiệp.
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

  if (a.employee?.id != null && String(a.employee.id) === employeeId) return 'personal';
  const noPersonalHolder = a.employee?.id == null;
  if (noPersonalHolder && a.department?.id != null && departmentId && String(a.department.id) === departmentId) {
    return 'department';
  }
  if (noPersonalHolder && a.location?.id != null && locationId && String(a.location.id) === locationId) {
    return 'location';
  }
  return null;
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
  const holderId = a.employee?.id != null ? String(a.employee.id) : '';

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
