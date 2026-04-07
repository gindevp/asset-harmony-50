import type { AssetItem, ReturnRequest } from '@/data/mockData';
import { catalogItemNameOnly } from '@/utils/catalogItemDisplay';
import { REQUEST_KIND_COMBINED_ADMIN, REQUEST_KIND_COMBINED_EMPLOYEE } from '@/utils/requestListKindLabels';

export function returnRequestHeaderNote(r: ReturnRequest): string {
  const x = r as ReturnRequest & { note?: string };
  return (x.note ?? x.reason ?? '').trim();
}

/** Cột «Loại» — cùng cách gọi như sửa chữa / báo mất khi có cả TB + VT. */
export function getReturnListKindLabel(r: ReturnRequest, forEmployeePortal = false): string {
  const lines = r.lines ?? [];
  if (lines.length === 0) return '—';
  let hasDevice = false;
  let hasConsumable = false;
  for (const l of lines) {
    if (String(l.lineType ?? 'DEVICE').toUpperCase() === 'CONSUMABLE') hasConsumable = true;
    else hasDevice = true;
  }
  if (hasDevice && hasConsumable) return forEmployeePortal ? REQUEST_KIND_COMBINED_EMPLOYEE : REQUEST_KIND_COMBINED_ADMIN;
  if (hasConsumable) return 'Vật tư';
  return 'Thiết bị';
}

/** Tên mặt hàng duy nhất trên phiếu — cột «Tên tài sản». */
export function formatReturnRequestAssetNamesSummary(r: ReturnRequest, assetItems: AssetItem[]): string {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const l of r.lines ?? []) {
    const name = catalogItemNameOnly(l.itemId, assetItems);
    if (name && name !== '—' && !seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
  }
  if (ordered.length === 0) return '—';
  return ordered.join(' · ');
}
