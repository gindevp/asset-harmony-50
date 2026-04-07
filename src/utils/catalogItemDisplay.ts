import type { AssetItem } from '@/data/mockData';

/** Chỉ tên mặt hàng trong danh mục (không mã, không hiện id thô) — dùng cột «Tên tài sản» trên danh sách. */
export function catalogItemNameOnly(itemId: string | undefined | null, assetItems: AssetItem[]): string {
  if (itemId == null || String(itemId).trim() === '') return '—';
  const i = assetItems.find(x => String(x.id) === String(itemId));
  const n = (i?.name ?? '').trim();
  return n || '—';
}
