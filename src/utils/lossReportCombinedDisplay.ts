import type { LossReportRequestDto } from '@/api/types';
import type { AssetItem, Equipment } from '@/data/mockData';
import { getItemName } from '@/data/mockData';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';

/** Chuỗi hiển thị / tìm kiếm cho phiếu báo mất gộp (COMBINED). */
export function formatCombinedLossSummary(
  r: LossReportRequestDto,
  assetItems: AssetItem[],
  equipments: Equipment[],
): string {
  if (String(r.lossKind ?? '').toUpperCase() !== 'COMBINED' || !r.lossEntries?.length) return '';
  const byId = new Map(equipments.map(e => [String(e.id), e]));
  const parts: string[] = [];
  for (const line of r.lossEntries) {
    const lt = String(line.lineType ?? '').toUpperCase();
    if (lt === 'EQUIPMENT' && line.equipmentId != null) {
      const eq = byId.get(String(line.equipmentId));
      if (eq) {
        const iid = eq.itemId ? String(eq.itemId) : '';
        parts.push(
          iid
            ? `${formatEquipmentCodeDisplay(eq.equipmentCode)} — ${getItemName(iid, assetItems)}`
            : formatEquipmentCodeDisplay(eq.equipmentCode),
        );
      } else {
        parts.push(`Thiết bị #${line.equipmentId}`);
      }
    } else if (lt === 'CONSUMABLE' && line.assetItemId != null) {
      parts.push(`${getItemName(String(line.assetItemId), assetItems)} — SL: ${line.quantity ?? '—'}`);
    } else if (lt === 'CONSUMABLE' && line.consumableAssignmentId != null) {
      parts.push(`Vật tư (bàn giao #${line.consumableAssignmentId}) — SL: ${line.quantity ?? '—'}`);
    }
  }
  return parts.join(' · ');
}
