import type { ConsumableAssignmentDto } from '@/api/types';
import type { Equipment, RepairRequest } from '@/data/mockData';
import { equipmentStatusLabels } from '@/data/mockData';
import { consumableQuantityHeld, getConsumableAssignmentDisplayStatus } from '@/utils/myEquipment';

/** Gộp thiết bị cùng mặt hàng (danh mục) — mỗi nhóm nhiều chiếc vật lý. */
export type GroupedEquipmentRow = {
  itemId: string;
  equipments: Equipment[];
  count: number;
};

export function groupEquipmentByCatalogItem(equipment: Equipment[]): GroupedEquipmentRow[] {
  const m = new Map<string, Equipment[]>();
  for (const e of equipment) {
    const id = (e.itemId ?? '').trim() || '_unknown';
    if (!m.has(id)) m.set(id, []);
    m.get(id)!.push(e);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => String(a.equipmentCode).localeCompare(String(b.equipmentCode), 'vi'));
  }
  return [...m.entries()]
    .map(([itemId, equipments]) => ({
      itemId: itemId === '_unknown' ? '' : itemId,
      equipments,
      count: equipments.length,
    }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId, 'vi'));
}

/** Trạng thái hiển thị gộp: cùng trạng thái → badge; khác → nhãn chung. */
export function aggregateEquipmentGroupDisplayStatus(equipments: Equipment[]): { status: string; label: string } {
  if (equipments.length === 0) return { status: '—', label: '—' };
  const set = new Set(equipments.map(e => e.status));
  if (set.size === 1) {
    const s = equipments[0].status;
    return { status: s, label: equipmentStatusLabels[s] ?? s };
  }
  return { status: 'MIXED', label: 'Nhiều trạng thái' };
}

/** Gộp dòng bàn giao vật tư cùng mặt hàng (asset item). */
export type GroupedConsumableRow = {
  assetItemId: string;
  assignments: ConsumableAssignmentDto[];
};

export function groupConsumableAssignmentsByAssetItem(list: ConsumableAssignmentDto[]): GroupedConsumableRow[] {
  const m = new Map<string, ConsumableAssignmentDto[]>();
  for (const a of list) {
    const id = a.assetItem?.id != null ? String(a.assetItem.id) : '';
    if (!id) continue;
    if (!m.has(id)) m.set(id, []);
    m.get(id)!.push(a);
  }
  for (const arr of m.values()) {
    arr.sort((x, y) => Number(x.id ?? 0) - Number(y.id ?? 0));
  }
  return [...m.entries()]
    .map(([assetItemId, assignments]) => ({ assetItemId, assignments }))
    .sort((a, b) => a.assetItemId.localeCompare(b.assetItemId, 'vi'));
}

export function totalHeldForConsumableGroup(assignments: ConsumableAssignmentDto[]): number {
  return assignments.reduce((s, a) => s + consumableQuantityHeld(a), 0);
}

export function totalReturnedForConsumableGroup(assignments: ConsumableAssignmentDto[]): number {
  return assignments.reduce((s, a) => s + (a.returnedQuantity ?? 0), 0);
}

export function aggregateConsumableDisplayStatus(
  assignments: ConsumableAssignmentDto[],
  repairRequests: RepairRequest[],
  lossApprovedAssignmentIds?: Set<string>,
): { status: string; label: string } {
  const st = assignments.map(a =>
    getConsumableAssignmentDisplayStatus(a, repairRequests, lossApprovedAssignmentIds),
  );
  if (st.some(s => s.status === 'UNDER_REPAIR')) {
    return st.find(s => s.status === 'UNDER_REPAIR')!;
  }
  if (st.some(s => s.status === 'IN_USE')) {
    return st.find(s => s.status === 'IN_USE')!;
  }
  if (st.some(s => s.status === 'LOST')) {
    return st.find(s => s.status === 'LOST')!;
  }
  return st[0] ?? { status: 'IN_USE', label: equipmentStatusLabels.IN_USE };
}

/** Chia SL báo mất theo FIFO trên các dòng bàn giao (id tăng dần). */
export function splitConsumableLossAcrossAssignments(
  assignments: ConsumableAssignmentDto[],
  totalQty: number,
): { assignmentId: number; qty: number }[] {
  let remaining = totalQty;
  const sorted = [...assignments].sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0));
  const out: { assignmentId: number; qty: number }[] = [];
  for (const a of sorted) {
    const h = consumableQuantityHeld(a);
    if (h <= 0) continue;
    const take = Math.min(h, remaining);
    if (take > 0 && a.id != null) {
      out.push({ assignmentId: Number(a.id), qty: take });
      remaining -= take;
    }
    if (remaining <= 0) break;
  }
  return out;
}

/** Danh sách phẳng, không gộp theo danh mục — sắp xếp để dễ quan sát từng chiếc / từng dòng bàn giao. */
export function sortEquipmentForDisplay(equipment: Equipment[]): Equipment[] {
  return [...equipment].sort((a, b) => {
    const c = String(a.itemId ?? '').localeCompare(String(b.itemId ?? ''), 'vi');
    if (c !== 0) return c;
    return String(a.equipmentCode).localeCompare(String(b.equipmentCode), 'vi');
  });
}

export function sortConsumableAssignmentsForDisplay(list: ConsumableAssignmentDto[]): ConsumableAssignmentDto[] {
  return [...list].sort((a, b) => {
    const ia = String(a.assetItem?.id ?? '');
    const ib = String(b.assetItem?.id ?? '');
    const c = ia.localeCompare(ib, 'vi');
    if (c !== 0) return c;
    return Number(a.id ?? 0) - Number(b.id ?? 0);
  });
}
