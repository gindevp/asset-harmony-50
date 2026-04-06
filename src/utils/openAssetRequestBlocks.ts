import type { LossReportRequestDto } from '@/api/types';
import type { RepairRequest, ReturnRequest } from '@/data/mockData';
import { repairRequestEquipmentIds } from '@/data/mockData';

/** Phiếu sửa chưa kết thúc */
export function isRepairRequestOpen(r: RepairRequest): boolean {
  return r.status === 'NEW' || r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS';
}

/** Phiếu thu hồi chờ duyệt / đang xử lý (chưa hoàn tất / từ chối) */
export function isReturnRequestOpen(r: ReturnRequest): boolean {
  return r.status === 'PENDING' || r.status === 'APPROVED';
}

/** Báo mất chờ duyệt */
export function isLossRequestOpen(l: LossReportRequestDto): boolean {
  return String(l.status ?? '').toUpperCase() === 'PENDING';
}

function sameRequester(requesterId: string | null, rid: string | undefined): boolean {
  if (!requesterId || rid == null || rid === '') return false;
  return String(rid) === String(requesterId);
}

/**
 * Thiết bị (id) → chuỗi mô tả các phiếu đang mở (sửa / thu hồi / báo mất) của cùng người yêu cầu.
 */
export function mapEquipmentIdToOpenRequestHints(
  requesterId: string | null,
  repairs: RepairRequest[],
  returns: ReturnRequest[],
  losses: LossReportRequestDto[],
): Map<string, string> {
  const acc = new Map<string, string[]>();

  const push = (equipmentId: string, label: string) => {
    if (!equipmentId) return;
    const arr = acc.get(equipmentId) ?? [];
    if (!arr.includes(label)) arr.push(label);
    acc.set(equipmentId, arr);
  };

  if (requesterId) {
    for (const r of repairs) {
      if (!sameRequester(requesterId, r.requesterId) || !isRepairRequestOpen(r)) continue;
      const tag = `Sửa ${r.code || r.id}`;
      for (const id of repairRequestEquipmentIds(r)) {
        push(String(id), tag);
      }
    }

    for (const rr of returns) {
      if (!sameRequester(requesterId, rr.requesterId) || !isReturnRequestOpen(rr)) continue;
      const tag = `Thu hồi ${rr.code || rr.id}`;
      for (const line of rr.lines) {
        if (String(line.lineType ?? 'DEVICE').toUpperCase() === 'CONSUMABLE') continue;
        if (line.equipmentId) push(String(line.equipmentId), tag);
      }
    }

    for (const l of losses) {
      if (!sameRequester(requesterId, l.requester?.id != null ? String(l.requester.id) : undefined) || !isLossRequestOpen(l)) {
        continue;
      }
      const tag = `Báo mất ${l.code ?? l.id ?? ''}`;
      const kind = String(l.lossKind ?? '').toUpperCase();
      if (kind === 'EQUIPMENT') {
        const eid = l.equipment?.id;
        if (eid != null) push(String(eid), tag);
      } else if (kind === 'COMBINED' && l.lossEntries?.length) {
        for (const line of l.lossEntries) {
          if (String(line.lineType ?? '').toUpperCase() === 'EQUIPMENT' && line.equipmentId != null) {
            push(String(line.equipmentId), tag);
          }
        }
      }
    }
  }

  const out = new Map<string, string>();
  for (const [id, labels] of acc) {
    out.set(id, labels.join(' · '));
  }
  return out;
}

export type ConsumableAssetItemPending = {
  repairQty: number;
  returnQty: number;
  lossQty: number;
  /** Chuỗi ngắn: ví dụ "3 SL sửa · 2 SL thu hồi · 1 SL báo mất" */
  summary: string;
};

/**
 * Gộp theo mã mặt hàng (assetItem id): SL đang nằm trong phiếu sửa/thu hồi/báo mất chưa xong.
 */
export function mapAssetItemIdToConsumablePending(
  requesterId: string | null,
  repairs: RepairRequest[],
  returns: ReturnRequest[],
  losses: LossReportRequestDto[],
): Map<string, ConsumableAssetItemPending> {
  type Agg = { repairQty: number; returnQty: number; lossQty: number };
  const agg = new Map<string, Agg>();

  const add = (assetItemId: string | undefined, field: keyof Agg, qty: number) => {
    if (!assetItemId) return;
    const row = agg.get(assetItemId) ?? { repairQty: 0, returnQty: 0, lossQty: 0 };
    row[field] += Math.max(0, qty);
    agg.set(assetItemId, row);
  };

  if (requesterId) {
    for (const r of repairs) {
      if (!sameRequester(requesterId, r.requesterId) || !isRepairRequestOpen(r)) continue;
      for (const c of r.consumableRepairLines ?? []) {
        add(String(c.assetItemId), 'repairQty', c.quantity ?? 0);
      }
    }

    for (const rr of returns) {
      if (!sameRequester(requesterId, rr.requesterId) || !isReturnRequestOpen(rr)) continue;
      for (const line of rr.lines) {
        if (String(line.lineType ?? 'DEVICE').toUpperCase() !== 'CONSUMABLE') continue;
        const aid = line.itemId;
        if (!aid) continue;
        add(String(aid), 'returnQty', line.quantity ?? 0);
      }
    }

    for (const l of losses) {
      if (!sameRequester(requesterId, l.requester?.id != null ? String(l.requester.id) : undefined) || !isLossRequestOpen(l)) {
        continue;
      }
      const kind = String(l.lossKind ?? '').toUpperCase();
      if (kind === 'CONSUMABLE') {
        const aid = l.consumableAssignment?.assetItem?.id;
        if (aid == null) continue;
        add(String(aid), 'lossQty', l.quantity ?? 0);
      } else if (kind === 'COMBINED' && l.lossEntries?.length) {
        for (const line of l.lossEntries) {
          if (String(line.lineType ?? '').toUpperCase() !== 'CONSUMABLE') continue;
          const aid = line.assetItemId;
          if (aid == null) continue;
          add(String(aid), 'lossQty', line.quantity ?? 0);
        }
      }
    }
  }

  const out = new Map<string, ConsumableAssetItemPending>();
  for (const [id, v] of agg) {
    const parts: string[] = [];
    if (v.repairQty > 0) parts.push(`${v.repairQty.toLocaleString('vi-VN')} SL sửa`);
    if (v.returnQty > 0) parts.push(`${v.returnQty.toLocaleString('vi-VN')} SL thu hồi`);
    if (v.lossQty > 0) parts.push(`${v.lossQty.toLocaleString('vi-VN')} SL báo mất`);
    out.set(id, {
      repairQty: v.repairQty,
      returnQty: v.returnQty,
      lossQty: v.lossQty,
      summary: parts.join(' · '),
    });
  }
  return out;
}
