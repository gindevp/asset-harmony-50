import type { EquipmentAssignmentDto, EquipmentDto } from '@/api/types';
import { mapEquipmentDto } from '@/api/viewModels';
import type { Equipment } from '@/data/mockData';

/**
 * Phiếu gán còn hiệu lực (chưa trả thiết bị).
 * - Không có returnedDate (null / rỗng / chỉ khoảng trắng) → đang gán.
 * - Nếu returnedDate < assignedDate (dữ liệu ngược, thường gặp ở seed sai) → vẫn coi là đang gán để ghép được với thiết bị.
 */
/**
 * Khớp BE `findFirstByEquipment_IdAndReturnedDateIsNull`: có phiếu gán với ngày trả **null/rỗng** (bàn giao đang mở).
 * Khác `isAssignmentActive`: không coi phiếu đã có `returnedDate` là «còn hiệu lực» dù ngày lỗi (trước ngày gán).
 */
export function hasBackendOpenEquipmentAssignment(
  equipmentId: string,
  assignments: EquipmentAssignmentDto[],
): boolean {
  return assignments.some(a => {
    const raw = a.equipmentId ?? a.equipment?.id;
    if (raw == null || String(raw) !== String(equipmentId)) return false;
    const r = a.returnedDate;
    if (r === undefined || r === null) return true;
    if (typeof r === 'string' && r.trim() === '') return true;
    return false;
  });
}

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

function assignmentMatchesEquipment(e: EquipmentDto, a: EquipmentAssignmentDto): boolean {
  const eIdStr = e.id != null && e.id !== undefined ? String(e.id) : '';
  const eCodeNorm = (e.equipmentCode ?? '').trim().toLowerCase();
  const raw = a.equipmentId ?? a.equipment?.id;
  const aIdStr = raw != null && raw !== undefined ? String(raw) : '';
  if (eIdStr !== '' && aIdStr !== '' && eIdStr === aIdStr) {
    return true;
  }
  const aCodeNorm = (a.equipment?.equipmentCode ?? '').trim().toLowerCase();
  return eCodeNorm !== '' && aCodeNorm !== '' && eCodeNorm === aCodeNorm;
}

/**
 * Chọn phiếu gán mới nhất khớp thiết bị (id assignment giảm dần).
 * So khớp: equipmentId hoặc equipment.id (so sánh String), sau đó equipmentCode (trim).
 * Ưu tiên phiếu còn hiệu lực. Thiết bị LOST: sau khi duyệt mất BE đóng phiếu — lấy phiếu mới nhất (đã trả)
 * để vẫn có snapshot NV / PB / vị trí cho «Tài sản của tôi».
 */
export function pickAssignmentForEquipment(
  e: EquipmentDto,
  assignments: EquipmentAssignmentDto[],
): EquipmentAssignmentDto | undefined {
  const sortedActive = [...assignments]
    .filter(isAssignmentActive)
    .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));

  for (const a of sortedActive) {
    if (assignmentMatchesEquipment(e, a)) {
      return a;
    }
  }

  const lost = String(e.status ?? '').toUpperCase() === 'LOST';
  if (!lost) {
    return undefined;
  }

  const sortedAll = [...assignments].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
  for (const a of sortedAll) {
    if (assignmentMatchesEquipment(e, a)) {
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
