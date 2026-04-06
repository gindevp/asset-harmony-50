import type { RepairRequestLineDto } from '@/api/types';
import type { AssetItem } from '@/data/mockData';
import { getItemCode, getItemName } from '@/data/mockData';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';

/** Tên hiển thị dòng phiếu sửa chữa (danh mục). */
export function repairLineDisplayName(l: RepairRequestLineDto, assetItems: AssetItem[]): string {
  const fromConsumable = l.assetItem?.name?.trim();
  if (fromConsumable) return fromConsumable;
  const eqAi = l.equipment?.assetItem;
  if (eqAi?.name?.trim()) return eqAi.name.trim();
  const id = eqAi?.id != null ? String(eqAi.id) : '';
  if (id) return getItemName(id, assetItems);
  return '—';
}

/**
 * Mã tài sản (danh mục): ưu tiên mã hàng; thiết bị không có danh mục thì hiện mã thiết bị.
 */
export function repairLineAssetCatalogCode(l: RepairRequestLineDto, assetItems: AssetItem[]): string {
  const isConsumable = String(l.lineType ?? '').toUpperCase() === 'CONSUMABLE';
  if (isConsumable) {
    const id = l.assetItem?.id != null ? String(l.assetItem.id) : '';
    const fromApi = l.assetItem?.code?.trim();
    return fromApi || (id ? getItemCode(id, assetItems) : '') || '—';
  }
  const eq = l.equipment;
  if (!eq) return '—';
  const eqAi = eq.assetItem;
  const id = eqAi?.id != null ? String(eqAi.id) : '';
  const catalog = eqAi?.code?.trim() || (id ? getItemCode(id, assetItems) : '');
  if (catalog) return catalog;
  return eq.equipmentCode ? formatEquipmentCodeDisplay(eq.equipmentCode) : '—';
}

export function repairLineSerialDisplay(l: RepairRequestLineDto): string {
  if (String(l.lineType ?? '').toUpperCase() === 'CONSUMABLE') return '—';
  const s = l.equipment?.serial?.trim();
  return s && s.length > 0 ? s : '—';
}

/** SL: vật tư theo quantity; thiết bị mỗi dòng = 1 chiếc (DB có thể null). */
export function repairLineQuantityDisplay(l: RepairRequestLineDto): number {
  const isConsumable = String(l.lineType ?? '').toUpperCase() === 'CONSUMABLE';
  const q = l.quantity;
  if (isConsumable) return typeof q === 'number' && !Number.isNaN(q) ? q : 0;
  if (typeof q === 'number' && q > 0) return q;
  return 1;
}
