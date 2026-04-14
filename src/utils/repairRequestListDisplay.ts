import type { AssetItem, Equipment, RepairRequest } from '@/data/mockData';
import { repairRequestEquipmentIds } from '@/data/mockData';
import { catalogItemNameOnly } from '@/utils/catalogItemDisplay';
import { REQUEST_KIND_COMBINED_ADMIN, REQUEST_KIND_COMBINED_EMPLOYEE } from '@/utils/requestListKindLabels';

/** Cột «Loại» trên danh sách YC sửa chữa — cùng cách gọi như cấp phát / báo mất khi có cả TB + VT. */
export function getRepairListKindLabel(r: RepairRequest, forEmployeePortal = false): string {
  const hasDevice =
    (r.equipmentLineIds && r.equipmentLineIds.length > 0) || Boolean(String(r.equipmentId ?? '').trim());
  const hasConsumable = (r.consumableRepairLines?.length ?? 0) > 0;
  if (hasDevice && hasConsumable) return forEmployeePortal ? REQUEST_KIND_COMBINED_EMPLOYEE : REQUEST_KIND_COMBINED_ADMIN;
  if (hasConsumable) return 'Vật tư';
  if (hasDevice) return 'Thiết bị';
  return '—';
}

/** Tên mặt hàng duy nhất trên phiếu, nối bằng « · » — cột «Tên tài sản». */
export function formatRepairRequestAssetNamesSummary(
  r: RepairRequest,
  equipments: Equipment[],
  assetItems: AssetItem[],
): string {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of repairRequestEquipmentIds(r)) {
    const eq = equipments.find(e => e.id === id);
    const name = eq?.itemId ? catalogItemNameOnly(eq.itemId, assetItems) : '—';
    if (name && name !== '—' && !seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
  }
  for (const c of r.consumableRepairLines ?? []) {
    const name = catalogItemNameOnly(c.assetItemId, assetItems);
    if (name && name !== '—' && !seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
  }
  if (ordered.length === 0) return '—';
  return ordered.join(' · ');
}

/**
 * Cột «Loại yêu cầu»:
 * - Công ty: có ít nhất 1 thiết bị trên phiếu thuộc cấp phát theo vị trí/công ty.
 * - Cá nhân/Phòng ban: còn lại.
 */
export function getRepairRequestTypeLabel(r: RepairRequest, equipments: Equipment[]): string {
  const eqIds = repairRequestEquipmentIds(r);
  const hasCompanyEquipment = eqIds.some(id => {
    const eq = equipments.find(e => e.id === id);
    if (!eq) return false;
    return Boolean(eq.locationAssignedDirectly || eq.locationPoolFromAllocation);
  });
  return hasCompanyEquipment ? 'Công ty' : 'Cá nhân/Phòng ban';
}
