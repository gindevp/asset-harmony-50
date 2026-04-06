import type { AllocationRequestLine } from '@/data/mockData';

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

