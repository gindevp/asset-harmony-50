import type { EquipmentAssignmentDto, EquipmentDto } from '@/api/types';
import { mapEquipmentDto } from '@/api/viewModels';
import type { Equipment } from '@/data/mockData';

/**
 * Phiếu gán còn hiệu lực (chưa trả thiết bị).
 * - Không có returnedDate (null / rỗng / chỉ khoảng trắng) → đang gán.
 * - Nếu returnedDate < assignedDate (dữ liệu ngược, thường gặp ở seed sai) → vẫn coi là đang gán để ghép được với thiết bị.
 */
export function isAssignmentActive(a: EquipmentAssignmentDto): boolean {
  const r = a.returnedDate;
  if (r === undefined || r === null) return true;
  const rs = typeof r === 'string' ? r.trim() : String(r);
  if (rs === '') return true;
  const ad = a.assignedDate;
  if (ad) {
    const adStr = typeof ad === 'string' ? ad.trim() : String(ad);
    const tRet = Date.parse(rs);
    const tAsg = Date.parse(adStr);
    if (!Number.isNaN(tRet) && !Number.isNaN(tAsg) && tRet < tAsg) return true;
  }
  return false;
}

/**
 * Chọn phiếu gán mới nhất khớp thiết bị (id assignment giảm dần).
 * So khớp: equipmentId hoặc equipment.id (so sánh String), sau đó equipmentCode (trim).
 */
export function pickAssignmentForEquipment(
  e: EquipmentDto,
  assignments: EquipmentAssignmentDto[],
): EquipmentAssignmentDto | undefined {
  const sorted = [...assignments]
    .filter(isAssignmentActive)
    .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));

  const eIdStr = e.id != null && e.id !== undefined ? String(e.id) : '';
  const eCodeNorm = (e.equipmentCode ?? '').trim().toLowerCase();

  for (const a of sorted) {
    const raw = a.equipmentId ?? a.equipment?.id;
    const aIdStr = raw != null && raw !== undefined ? String(raw) : '';
    if (eIdStr !== '' && aIdStr !== '' && eIdStr === aIdStr) {
      return a;
    }
    const aCodeNorm = (a.equipment?.equipmentCode ?? '').trim().toLowerCase();
    if (eCodeNorm !== '' && aCodeNorm !== '' && eCodeNorm === aCodeNorm) {
      return a;
    }
  }
  return undefined;
}

export function mergeEquipmentWithAssignments(
  equipmentRows: EquipmentDto[],
  assignments: EquipmentAssignmentDto[],
): Equipment[] {
  return equipmentRows.map(e => mapEquipmentDto(e, pickAssignmentForEquipment(e, assignments)));
}
