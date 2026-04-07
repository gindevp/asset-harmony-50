import type { LossReportRequestDto } from '@/api/types';
import type { AssetItem, Equipment } from '@/data/mockData';
import { getItemName, lossReportKindLabels } from '@/data/mockData';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { REQUEST_KIND_COMBINED_EMPLOYEE } from '@/utils/requestListKindLabels';

/** lossKind API (EQUIPMENT | CONSUMABLE | COMBINED) — dùng form sửa / điều kiện hiển thị. */
export function lossReportKindUpper(r: LossReportRequestDto): string {
  return String(r.lossKind ?? '').toUpperCase();
}

/** Nhãn cột «Loại»: COMBINED + chỉ thiết bị → «Thiết bị»; chỉ vật tư → «Vật tư»; cả hai → gộp (khác nhau NV vs admin). */
export function getLossReportKindDisplayLabel(r: LossReportRequestDto, forEmployeePortal = false): string {
  const combinedLabel = forEmployeePortal ? REQUEST_KIND_COMBINED_EMPLOYEE : lossReportKindLabels.COMBINED;
  const kind = String(r.lossKind ?? '').toUpperCase();
  if (kind !== 'COMBINED') {
    return lossReportKindLabels[kind] ?? r.lossKind ?? '—';
  }
  const entries = r.lossEntries ?? [];
  if (entries.length === 0) {
    return combinedLabel;
  }
  let hasEquipment = false;
  let hasConsumable = false;
  for (const e of entries) {
    const t = String(e.lineType ?? '').toUpperCase();
    if (t === 'EQUIPMENT') hasEquipment = true;
    else if (t === 'CONSUMABLE') hasConsumable = true;
  }
  if (hasEquipment && !hasConsumable) return lossReportKindLabels.EQUIPMENT;
  if (hasConsumable && !hasEquipment) return lossReportKindLabels.CONSUMABLE;
  if (hasEquipment && hasConsumable) return combinedLabel;
  return combinedLabel;
}

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
