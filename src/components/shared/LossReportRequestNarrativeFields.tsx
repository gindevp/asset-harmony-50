import type { LossReportRequestDto } from '@/api/types';
import { formatLossOccurredAtForDisplay } from '@/utils/lossReportForm';

/**
 * Hiển thị thời gian / địa điểm / lý do / mô tả (bản ghi mới) hoặc khối reason định dạng cũ.
 */
export function LossReportRequestNarrativeFields({ row }: { row: LossReportRequestDto }) {
  const occ = row.lossOccurredAt?.trim();
  const loc = row.lossLocation?.trim();
  const reason = row.reason?.trim();
  const desc = row.lossDescription?.trim();

  const hasStructured = !!(occ || loc || desc);

  if (hasStructured) {
    return (
      <div className="space-y-3 rounded-md border bg-muted/30 p-3">
        {occ ? (
          <div>
            <span className="text-muted-foreground">Thời gian (theo báo cáo):</span>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{formatLossOccurredAtForDisplay(occ)}</p>
          </div>
        ) : null}
        {loc ? (
          <div>
            <span className="text-muted-foreground">Địa điểm:</span>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{loc}</p>
          </div>
        ) : null}
        {reason ? (
          <div>
            <span className="text-muted-foreground">Lý do:</span>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{reason}</p>
          </div>
        ) : null}
        {desc ? (
          <div>
            <span className="text-muted-foreground">Mô tả mất:</span>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{desc}</p>
          </div>
        ) : null}
      </div>
    );
  }

  if (reason) {
    return (
      <div className="rounded-md border bg-muted/30 p-3">
        <span className="text-muted-foreground">Nội dung (ghi chú — định dạng cũ):</span>
        <p className="mt-1 whitespace-pre-wrap text-foreground">{row.reason}</p>
      </div>
    );
  }

  return null;
}
