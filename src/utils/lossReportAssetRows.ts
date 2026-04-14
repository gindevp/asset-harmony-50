import type { LossReportRequestDto } from '@/api/types';
import type { AssetItem, Equipment } from '@/data/mockData';
import { catalogItemNameOnly } from '@/utils/catalogItemDisplay';

function lossKindUpper(r: LossReportRequestDto): string {
  return String(r.lossKind ?? '').toUpperCase();
}

export type LossAssetRow = {
  type: string;
  asset: string;
  serial: string;
  quantity: string;
};

/** Dòng bảng «Tài sản trong phiếu» — chỉ tên mặt hàng (danh mục). */
export function buildLossAssetRows(row: LossReportRequestDto, assetItems: AssetItem[], equipments: Equipment[]): LossAssetRow[] {
  const kind = lossKindUpper(row);
  if (kind === 'EQUIPMENT' && row.equipment) {
    const itemId = row.equipment.assetItem?.id != null ? String(row.equipment.assetItem.id) : '';
    return [
      {
        type: 'Thiết bị',
        asset: catalogItemNameOnly(itemId, assetItems),
        serial: (row.equipment.serial ?? '').trim() || '—',
        quantity: '1',
      },
    ];
  }
  if (kind === 'CONSUMABLE' && row.consumableAssignment?.assetItem?.id != null) {
    const id = String(row.consumableAssignment.assetItem.id);
    return [
      {
        type: 'Vật tư',
        asset: catalogItemNameOnly(id, assetItems),
        serial: '—',
        quantity: String(row.quantity ?? '—'),
      },
    ];
  }
  if (kind === 'COMBINED' && row.lossEntries?.length) {
    return row.lossEntries.map(e => {
      const t = String(e.lineType ?? '').toUpperCase();
      if (t === 'EQUIPMENT') {
        const eq = e.equipmentId != null ? equipments.find(x => Number(x.id) === Number(e.equipmentId)) : undefined;
        const itemId = eq?.itemId ?? (e.assetItemId != null ? String(e.assetItemId) : '');
        return {
          type: 'Thiết bị',
          asset: catalogItemNameOnly(itemId, assetItems),
          serial: (eq?.serial ?? '').trim() || '—',
          quantity: '1',
        };
      }
      const itemId = e.assetItemId != null ? String(e.assetItemId) : '';
      return {
        type: 'Vật tư',
        asset: catalogItemNameOnly(itemId, assetItems),
        serial: '—',
        quantity: String(e.quantity ?? '—'),
      };
    });
  }
  return [];
}
