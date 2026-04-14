import type { AllocationRequestLine, AssetItem, Equipment } from '@/data/mockData';
import { catalogItemNameOnly } from '@/utils/catalogItemDisplay';
import { getItemName, getItemCode, getAssetLineDisplay } from '@/data/mockData';
import { formatBizCodeDisplay, formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { REQUEST_KIND_COMBINED_ADMIN, REQUEST_KIND_COMBINED_EMPLOYEE } from '@/utils/requestListKindLabels';

/** Cột «Loại» trên danh sách YC cấp phát — cùng cách gọi như báo mất khi có cả TB + VT. */
export function getAllocationListKindLabel(lines: AllocationRequestLine[], forEmployeePortal = false): string {
  if (!lines.length) return '—';
  let hasDevice = false;
  let hasConsumable = false;
  for (const line of lines) {
    const t = String(line.lineType ?? 'DEVICE').toUpperCase();
    if (t === 'CONSUMABLE') hasConsumable = true;
    else hasDevice = true;
  }
  if (hasDevice && hasConsumable) return forEmployeePortal ? REQUEST_KIND_COMBINED_EMPLOYEE : REQUEST_KIND_COMBINED_ADMIN;
  if (hasConsumable) return 'Vật tư';
  return 'Thiết bị';
}

/** Tên mặt hàng duy nhất trên phiếu, nối bằng « · » — cột «Tên tài sản» trên danh sách. */
export function formatAllocationRequestAssetNamesSummary(
  lines: AllocationRequestLine[],
  assetItems: AssetItem[],
  equipments: Equipment[],
): string {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const lt = String(line.lineType ?? 'DEVICE').toUpperCase();
    let name = '';
    if (lt === 'CONSUMABLE') {
      if (line.itemId) name = catalogItemNameOnly(line.itemId, assetItems);
    } else {
      const eq = line.equipmentId ? equipments.find(e => String(e.id) === String(line.equipmentId)) : undefined;
      if (eq?.itemId) name = catalogItemNameOnly(eq.itemId, assetItems);
      else if (line.itemId) name = catalogItemNameOnly(line.itemId, assetItems);
    }
    const t = name.trim();
    if (t && t !== '—' && !seen.has(t)) {
      seen.add(t);
      ordered.push(t);
    }
  }
  if (ordered.length === 0) return '—';
  return ordered.join(' · ');
}

/**
 * Gộp các dòng DEVICE cùng dòng tài sản → một hàng hiển thị (khớp màn duyệt QLTS).
 * DEVICE không có assetLineId (legacy) → một hàng / dòng.
 */
export type AllocationDetailRow =
  | { kind: 'device_group'; id: string; assetLineId: string; lines: AllocationRequestLine[] }
  | { kind: 'single'; id: string; line: AllocationRequestLine };

export function buildAllocationDetailRows(lines: AllocationRequestLine[]): AllocationDetailRow[] {
  const usedDevice = new Set<string>();
  const out: AllocationDetailRow[] = [];
  for (const line of lines) {
    const lt = (line.lineType ?? '').toUpperCase();
    if (lt === 'CONSUMABLE') {
      out.push({ kind: 'single', id: String(line.id), line });
      continue;
    }
    if (lt === 'DEVICE' && line.assetLineId) {
      if (usedDevice.has(String(line.id))) continue;
      const al = String(line.assetLineId);
      const group = lines
        .filter(l => (l.lineType ?? '').toUpperCase() === 'DEVICE' && String(l.assetLineId ?? '') === al)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
      for (const g of group) usedDevice.add(String(g.id));
      out.push({ kind: 'device_group', id: `dg-${al}`, assetLineId: al, lines: group });
    } else {
      out.push({ kind: 'single', id: String(line.id), line });
    }
  }
  return out;
}

/** Số hàng hiển thị (sau khi gộp DEVICE cùng dòng tài sản). */
export function countAllocationDisplayRows(lines: AllocationRequestLine[]): number {
  return buildAllocationDetailRows(lines).length;
}

/** Tổng số lượng trên phiếu = cộng `quantity` của từng dòng (thiết bị + vật tư). */
export function sumAllocationLineQuantities(lines: AllocationRequestLine[]): number {
  return lines.reduce((acc, line) => {
    const q = line.quantity;
    return acc + (typeof q === 'number' && !Number.isNaN(q) ? q : 0);
  }, 0);
}

/** Cột chi tiết YC cấp phát — cùng trật tự / ý nghĩa với bảng dòng phiếu sửa chữa (Loại, Tài sản, Mã, Serial, SL). */
export type AssetLineLite = { id?: number | string; name?: string | null };

export function allocationDetailKindLabel(row: AllocationDetailRow): 'Vật tư' | 'Thiết bị' {
  if (row.kind === 'device_group') return 'Thiết bị';
  return String(row.line.lineType ?? '').toUpperCase() === 'CONSUMABLE' ? 'Vật tư' : 'Thiết bị';
}

export function allocationDetailAssetName(
  row: AllocationDetailRow,
  assetItems: AssetItem[],
  equipments: Equipment[],
  assetLinesApi: AssetLineLite[],
): string {
  if (row.kind === 'device_group') {
    const itemIds = row.lines.map(l => {
      const eq = l.equipmentId ? equipments.find(e => String(e.id) === String(l.equipmentId)) : undefined;
      return eq?.itemId;
    });
    const first = itemIds.find(Boolean);
    if (first && itemIds.every(id => id && id === first)) {
      return getItemName(first, assetItems);
    }
    const al = assetLinesApi.find(l => String(l.id) === row.assetLineId);
    return al?.name?.trim() || getAssetLineDisplay(row.assetLineId, assetLinesApi);
  }
  const r = row.line;
  const lt = (r.lineType ?? '').toUpperCase();
  if (lt === 'CONSUMABLE') {
    if (!r.itemId || !String(r.itemId).trim()) return '—';
    return getItemName(r.itemId, assetItems);
  }
  const eq = r.equipmentId ? equipments.find(e => String(e.id) === String(r.equipmentId)) : undefined;
  if (eq) return getItemName(eq.itemId, assetItems);
  return '—';
}

export function allocationDetailCatalogCode(
  row: AllocationDetailRow,
  assetItems: AssetItem[],
  equipments: Equipment[],
): string {
  if (row.kind === 'device_group') {
    const itemIds = row.lines.map(l => {
      const eq = l.equipmentId ? equipments.find(e => String(e.id) === String(l.equipmentId)) : undefined;
      return eq?.itemId;
    });
    const first = itemIds.find(Boolean);
    if (first && itemIds.every(id => id && id === first)) {
      const fromCatalog = assetItems.find(i => String(i.id) === String(first))?.code?.trim() ?? '';
      return fromCatalog ? formatBizCodeDisplay(fromCatalog) : '—';
    }
    return '—';
  }
  const r = row.line;
  const lt = (r.lineType ?? '').toUpperCase();
  if (lt === 'CONSUMABLE') {
    if (!r.itemId || !String(r.itemId).trim()) return '—';
    const fromCatalog = assetItems.find(i => String(i.id) === String(r.itemId))?.code?.trim() ?? '';
    const code = fromCatalog || r.itemCode?.trim() || (r.itemId ? getItemCode(r.itemId, assetItems) : '');
    return code ? formatBizCodeDisplay(code) : '—';
  }
  const eq = r.equipmentId ? equipments.find(e => String(e.id) === String(r.equipmentId)) : undefined;
  return eq ? formatEquipmentCodeDisplay(eq.equipmentCode) : '—';
}

export function allocationDetailSerial(row: AllocationDetailRow, equipments: Equipment[]): string {
  if (row.kind === 'device_group') {
    const parts = row.lines
      .map(l => {
        const eq = l.equipmentId ? equipments.find(e => String(e.id) === String(l.equipmentId)) : undefined;
        return (eq?.serial ?? '').trim();
      })
      .filter(Boolean);
    if (parts.length === 0) return '—';
    return [...new Set(parts)].join(', ');
  }
  const r = row.line;
  if ((r.lineType ?? '').toUpperCase() === 'CONSUMABLE') return '—';
  const eq = r.equipmentId ? equipments.find(e => String(e.id) === String(r.equipmentId)) : undefined;
  const s = (eq?.serial ?? '').trim();
  return s.length > 0 ? s : '—';
}

export function allocationDetailQuantity(row: AllocationDetailRow): number {
  return row.kind === 'device_group' ? row.lines.length : row.line.quantity;
}

