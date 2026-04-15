import type { LossReportRequestDto, ReturnRequestLineDto } from '@/api/types';
import type { RepairRequest, ReturnRequest } from '@/data/mockData';
import { repairRequestEquipmentIds } from '@/data/mockData';

/** Phiếu cha trên dòng REST: cần `request.status` (BE map trong ReturnRequestLine). */
export function isReturnLineParentOpen(line: ReturnRequestLineDto): boolean {
  const st = String(line.request?.status ?? '').toUpperCase();
  return st === 'PENDING' || st === 'APPROVED';
}

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

/** Khi sửa phiếu: bỏ góp SL/dòng của chính phiếu đó để tính «còn lại» đúng. */
export type OpenRequestAggregationOptions = {
  excludeRepairRequestId?: number;
  excludeReturnRequestId?: number;
  excludeLossRequestId?: number;
  /**
   * Khi tạo/sửa phiếu sửa chữa: không cộng SL đang trong phiếu thu hồi mở vào pending vật tư
   * (cho phép vừa thu hồi vừa gửi sửa cùng mặt hàng — BE chấp nhận theo nghiệp vụ).
   */
  excludeConsumableReturnPending?: boolean;
};

function shouldExcludeReturnRequest(rr: ReturnRequest, opts?: OpenRequestAggregationOptions | null): boolean {
  const ex = opts?.excludeReturnRequestId;
  if (ex == null || rr.id == null) return false;
  return Number(rr.id) === ex;
}

function shouldExcludeReturnLineRequest(line: ReturnRequestLineDto, opts?: OpenRequestAggregationOptions | null): boolean {
  const ex = opts?.excludeReturnRequestId;
  if (ex == null) return false;
  const rid = line.request?.id;
  if (rid == null) return false;
  return Number(rid) === ex;
}

function shouldExcludeRepair(r: RepairRequest, opts?: OpenRequestAggregationOptions | null): boolean {
  const ex = opts?.excludeRepairRequestId;
  if (ex == null || r.id == null) return false;
  return Number(r.id) === ex;
}

function shouldExcludeLoss(l: LossReportRequestDto, opts?: OpenRequestAggregationOptions | null): boolean {
  const ex = opts?.excludeLossRequestId;
  if (ex == null || l.id == null) return false;
  return Number(l.id) === ex;
}

/**
 * Thiết bị (id) → chuỗi mô tả phiếu đang mở: sửa/báo mất theo **đúng người gửi**; thu hồi theo **mọi** phiếu mở
 * (khớp backend — không thêm cùng TB vào hai phiếu thu hồi chờ/đã duyệt dù khác người).
 */
export function mapEquipmentIdToOpenRequestHints(
  requesterId: string | null,
  repairs: RepairRequest[],
  returns: ReturnRequest[],
  losses: LossReportRequestDto[],
  /** Khi có (GET toàn bộ dòng + request.status), gom đúng cả phiếu của người khác — khớp BE. */
  returnLineDtos?: ReturnRequestLineDto[] | null,
  opts?: OpenRequestAggregationOptions | null,
): Map<string, string> {
  const acc = new Map<string, string[]>();

  const push = (equipmentId: string, label: string) => {
    if (!equipmentId) return;
    const arr = acc.get(equipmentId) ?? [];
    if (!arr.includes(label)) arr.push(label);
    acc.set(equipmentId, arr);
  };

  if (returnLineDtos != null && returnLineDtos.length > 0) {
    for (const l of returnLineDtos) {
      if (!isReturnLineParentOpen(l)) continue;
      if (shouldExcludeReturnLineRequest(l, opts)) continue;
      if (String(l.lineType ?? 'DEVICE').toUpperCase() === 'CONSUMABLE') continue;
      const eqId = l.equipment?.id;
      if (eqId == null) continue;
      const tag = `Thu hồi ${l.request?.code ?? l.request?.id ?? ''}`;
      push(String(eqId), tag);
    }
  } else {
    for (const rr of returns) {
      if (!isReturnRequestOpen(rr)) continue;
      if (shouldExcludeReturnRequest(rr, opts)) continue;
      const tag = `Thu hồi ${rr.code || rr.id}`;
      for (const line of rr.lines ?? []) {
        if (String(line.lineType ?? 'DEVICE').toUpperCase() === 'CONSUMABLE') continue;
        if (line.equipmentId) push(String(line.equipmentId), tag);
      }
    }
  }

  if (requesterId) {
    for (const r of repairs) {
      if (shouldExcludeRepair(r, opts)) continue;
      if (!sameRequester(requesterId, r.requesterId) || !isRepairRequestOpen(r)) continue;
      const tag = `Sửa ${r.code || r.id}`;
      for (const id of repairRequestEquipmentIds(r)) {
        push(String(id), tag);
      }
    }

    for (const l of losses) {
      if (shouldExcludeLoss(l, opts)) continue;
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

/** Chi tiết từng phiếu đang «trừ» SL khả dụng (màn tạo yêu cầu). */
export type ConsumableOpenRequestEntry = {
  requestCode: string;
  kind: 'repair' | 'return' | 'loss';
  /** Nhãn ngắn: Thu hồi / Sửa chữa / Báo mất */
  label: string;
  qty: number;
};

export type EquipmentOpenRequestEntry = {
  requestCode: string;
  kind: 'repair' | 'return' | 'loss';
  label: string;
};

/**
 * Thiết bị → danh sách phiếu mở đang chiếm chỗ (1 TB = 1 đơn vị; hiển thị mã phiếu + loại).
 * Cùng logic lọc với {@link mapEquipmentIdToOpenRequestHints}.
 */
export function mapEquipmentIdToOpenRequestEntries(
  requesterId: string | null,
  repairs: RepairRequest[],
  returns: ReturnRequest[],
  losses: LossReportRequestDto[],
  returnLineDtos?: ReturnRequestLineDto[] | null,
  opts?: OpenRequestAggregationOptions | null,
): Map<string, EquipmentOpenRequestEntry[]> {
  const acc = new Map<string, EquipmentOpenRequestEntry[]>();

  const push = (equipmentId: string, entry: EquipmentOpenRequestEntry) => {
    if (!equipmentId) return;
    const arr = acc.get(equipmentId) ?? [];
    const key = `${entry.kind}:${entry.requestCode}`;
    if (arr.some(x => `${x.kind}:${x.requestCode}` === key)) return;
    arr.push(entry);
    acc.set(equipmentId, arr);
  };

  if (returnLineDtos != null && returnLineDtos.length > 0) {
    for (const l of returnLineDtos) {
      if (!isReturnLineParentOpen(l)) continue;
      if (shouldExcludeReturnLineRequest(l, opts)) continue;
      if (String(l.lineType ?? 'DEVICE').toUpperCase() === 'CONSUMABLE') continue;
      const eqId = l.equipment?.id;
      if (eqId == null) continue;
      const code = String(l.request?.code ?? l.request?.id ?? '').trim() || '—';
      push(String(eqId), { requestCode: code, kind: 'return', label: 'Thu hồi' });
    }
  } else {
    for (const rr of returns) {
      if (!isReturnRequestOpen(rr)) continue;
      if (shouldExcludeReturnRequest(rr, opts)) continue;
      const code = String(rr.code ?? rr.id ?? '').trim() || '—';
      for (const line of rr.lines ?? []) {
        if (String(line.lineType ?? 'DEVICE').toUpperCase() === 'CONSUMABLE') continue;
        if (line.equipmentId) {
          push(String(line.equipmentId), { requestCode: code, kind: 'return', label: 'Thu hồi' });
        }
      }
    }
  }

  if (requesterId) {
    for (const r of repairs) {
      if (shouldExcludeRepair(r, opts)) continue;
      if (!sameRequester(requesterId, r.requesterId) || !isRepairRequestOpen(r)) continue;
      const code = String(r.code ?? r.id ?? '').trim() || '—';
      for (const id of repairRequestEquipmentIds(r)) {
        push(String(id), { requestCode: code, kind: 'repair', label: 'Sửa chữa' });
      }
    }

    for (const l of losses) {
      if (shouldExcludeLoss(l, opts)) continue;
      if (!sameRequester(requesterId, l.requester?.id != null ? String(l.requester.id) : undefined) || !isLossRequestOpen(l)) {
        continue;
      }
      const code = String(l.code ?? l.id ?? '').trim() || '—';
      const kind = String(l.lossKind ?? '').toUpperCase();
      if (kind === 'EQUIPMENT') {
        const eid = l.equipment?.id;
        if (eid != null) push(String(eid), { requestCode: code, kind: 'loss', label: 'Báo mất' });
      } else if (kind === 'COMBINED' && l.lossEntries?.length) {
        for (const line of l.lossEntries) {
          if (String(line.lineType ?? '').toUpperCase() === 'EQUIPMENT' && line.equipmentId != null) {
            push(String(line.equipmentId), { requestCode: code, kind: 'loss', label: 'Báo mất' });
          }
        }
      }
    }
  }

  return acc;
}

export type ConsumableAssetItemPending = {
  repairQty: number;
  returnQty: number;
  lossQty: number;
  /** Chuỗi ngắn: ví dụ "3 SL sửa · 2 SL thu hồi · 1 SL báo mất" */
  summary: string;
  /** Từng phiếu + SL (khi có) — để hiển thị chi tiết trên UI */
  entries?: ConsumableOpenRequestEntry[];
};

/** Tổng SL đang «giữ chỗ» trên các phiếu mở (sửa + thu hồi + báo mất). */
export function consumablePendingTotal(p: ConsumableAssetItemPending | undefined): number {
  if (!p) return 0;
  return Math.max(0, p.repairQty) + Math.max(0, p.returnQty) + Math.max(0, p.lossQty);
}

/**
 * SL còn có thể đặt vào phiếu mới (theo tổng đang giữ trên UI).
 * Khi `held <= pending` → không còn chỗ (vẫn có thể hiển thị dòng nếu cần chỉnh phiếu đang sửa).
 */
export function consumableRemainingForAssetItem(held: number, pend: ConsumableAssetItemPending | undefined): number {
  return Math.max(0, held - consumablePendingTotal(pend));
}

/**
 * Gộp theo mã mặt hàng (assetItem id): sửa/báo mất theo đúng người gửi; **thu hồi** theo mọi phiếu mở
 * (trừ khi `opts.excludeConsumableReturnPending` — dùng màn tạo sửa chữa).
 * Hai phiếu thu hồi chờ/đã duyệt cùng mặt hàng vẫn do màn thu hồi / BE kiểm soát.
 */
export function mapAssetItemIdToConsumablePending(
  requesterId: string | null,
  repairs: RepairRequest[],
  returns: ReturnRequest[],
  losses: LossReportRequestDto[],
  returnLineDtos?: ReturnRequestLineDto[] | null,
  opts?: OpenRequestAggregationOptions | null,
): Map<string, ConsumableAssetItemPending> {
  type Agg = { repairQty: number; returnQty: number; lossQty: number };
  const agg = new Map<string, Agg>();
  const entryMap = new Map<string, ConsumableOpenRequestEntry[]>();

  const add = (assetItemId: string | undefined, field: keyof Agg, qty: number) => {
    if (!assetItemId) return;
    const row = agg.get(assetItemId) ?? { repairQty: 0, returnQty: 0, lossQty: 0 };
    row[field] += Math.max(0, qty);
    agg.set(assetItemId, row);
  };

  const pushEntry = (assetItemId: string | undefined, entry: ConsumableOpenRequestEntry) => {
    if (!assetItemId) return;
    const arr = entryMap.get(assetItemId) ?? [];
    arr.push(entry);
    entryMap.set(assetItemId, arr);
  };

  if (!opts?.excludeConsumableReturnPending) {
    if (returnLineDtos != null && returnLineDtos.length > 0) {
      for (const l of returnLineDtos) {
        if (!isReturnLineParentOpen(l)) continue;
        if (shouldExcludeReturnLineRequest(l, opts)) continue;
        if (String(l.lineType ?? 'DEVICE').toUpperCase() !== 'CONSUMABLE') continue;
        const aid = l.assetItem?.id != null ? String(l.assetItem.id) : '';
        if (!aid) continue;
        const q = l.quantity ?? 0;
        const code = String(l.request?.code ?? l.request?.id ?? '').trim() || '—';
        add(aid, 'returnQty', q);
        pushEntry(aid, { requestCode: code, kind: 'return', label: 'Thu hồi', qty: q });
      }
    } else {
      for (const rr of returns) {
        if (!isReturnRequestOpen(rr)) continue;
        if (shouldExcludeReturnRequest(rr, opts)) continue;
        const code = String(rr.code ?? rr.id ?? '').trim() || '—';
        for (const line of rr.lines ?? []) {
          if (String(line.lineType ?? 'DEVICE').toUpperCase() !== 'CONSUMABLE') continue;
          const aid = line.itemId;
          if (!aid) continue;
          const q = line.quantity ?? 0;
          add(String(aid), 'returnQty', q);
          pushEntry(String(aid), { requestCode: code, kind: 'return', label: 'Thu hồi', qty: q });
        }
      }
    }
  }

  if (requesterId) {
    for (const r of repairs) {
      if (shouldExcludeRepair(r, opts)) continue;
      if (!sameRequester(requesterId, r.requesterId) || !isRepairRequestOpen(r)) continue;
      const code = String(r.code ?? r.id ?? '').trim() || '—';
      for (const c of r.consumableRepairLines ?? []) {
        const q = c.quantity ?? 0;
        add(String(c.assetItemId), 'repairQty', q);
        pushEntry(String(c.assetItemId), { requestCode: code, kind: 'repair', label: 'Sửa chữa', qty: q });
      }
    }

    for (const l of losses) {
      if (shouldExcludeLoss(l, opts)) continue;
      if (!sameRequester(requesterId, l.requester?.id != null ? String(l.requester.id) : undefined) || !isLossRequestOpen(l)) {
        continue;
      }
      const lossCode = String(l.code ?? l.id ?? '').trim() || '—';
      const kind = String(l.lossKind ?? '').toUpperCase();
      if (kind === 'CONSUMABLE') {
        const aid = l.consumableAssignment?.assetItem?.id;
        if (aid == null) continue;
        const q = l.quantity ?? 0;
        add(String(aid), 'lossQty', q);
        pushEntry(String(aid), { requestCode: lossCode, kind: 'loss', label: 'Báo mất', qty: q });
      } else if (kind === 'COMBINED' && l.lossEntries?.length) {
        for (const line of l.lossEntries) {
          if (String(line.lineType ?? '').toUpperCase() !== 'CONSUMABLE') continue;
          const aid = line.assetItemId;
          if (aid == null) continue;
          const q = line.quantity ?? 0;
          add(String(aid), 'lossQty', q);
          pushEntry(String(aid), { requestCode: lossCode, kind: 'loss', label: 'Báo mất', qty: q });
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
    const entries = entryMap.get(id) ?? [];
    out.set(id, {
      repairQty: v.repairQty,
      returnQty: v.returnQty,
      lossQty: v.lossQty,
      summary: parts.join(' · '),
      entries: entries.length > 0 ? entries : undefined,
    });
  }
  return out;
}
