import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/api/http';
import type { StockDocumentEventDto } from '@/api/types';
import { formatDateTime, stockInStatusLabels, stockOutStatusLabels } from '@/data/mockData';

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Tạo phiếu',
  UPDATE: 'Cập nhật',
  STATUS_CHANGE: 'Đổi trạng thái',
  DELETE: 'Xóa phiếu',
};

type Props = { kind: 'receipt' | 'issue'; docId: string | number | undefined };

const ASSIGNEE_TYPE_LABELS: Record<string, string> = {
  EMPLOYEE: 'Nhân viên',
  DEPARTMENT: 'Phòng ban',
  LOCATION: 'Vị trí',
  COMPANY: 'Công ty',
};

function parseDetailPairs(detail: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of detail.split(',')) {
    const s = raw.trim();
    if (!s) continue;
    const idx = s.indexOf('=');
    if (idx < 0) continue;
    const k = s.slice(0, idx).trim();
    const v = s.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = v;
  }
  return out;
}

function chip(key: string, label: string, value: string) {
  return (
    <span
      key={key}
      className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground"
    >
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

export function StockDocumentHistoryBlock({ kind, docId }: Props) {
  const idNum = docId != null && docId !== '' ? Number(docId) : NaN;
  const q = useQuery({
    queryKey: ['api', 'stock-document-events', kind, idNum],
    queryFn: () =>
      apiGet<StockDocumentEventDto[]>(
        kind === 'receipt' ? `/api/stock-receipts/${idNum}/events` : `/api/stock-issues/${idNum}/events`
      ),
    enabled: Number.isFinite(idNum),
  });

  const rows = q.data ?? [];

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">Lịch sử thao tác trên phiếu</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {q.isLoading && <p className="text-sm text-muted-foreground">Đang tải…</p>}
        {q.isError && (
          <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : 'Không tải được lịch sử'}</p>
        )}
        {!q.isLoading && !q.isError && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Chưa có sự kiện ghi nhận.</p>
        )}
        {!q.isLoading && rows.length > 0 && (
          <ul className="space-y-3 text-sm">
            {rows.map(ev => (
              <li key={ev.id ?? `${ev.occurredAt}-${ev.action}`} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <span className="font-medium text-foreground">
                    {ev.action ? ACTION_LABELS[ev.action] ?? ev.action : '—'}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {ev.occurredAt ? formatDateTime(ev.occurredAt) : ''}
                  </span>
                </div>
                {ev.summary && <p className="text-muted-foreground mt-0.5">{ev.summary}</p>}
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {ev.login && chip('actor', 'Người thao tác', ev.login)}
                  {ev.detail &&
                    (() => {
                      const pairs = parseDetailPairs(ev.detail);
                      const chips: JSX.Element[] = [];
                      if (pairs.status) {
                        const lbl = kind === 'receipt' ? stockInStatusLabels[pairs.status] : stockOutStatusLabels[pairs.status];
                        chips.push(chip('status', 'Trạng thái', lbl ?? pairs.status));
                      }
                      const assignee = pairs.assigneeType ?? pairs.assignee;
                      if (assignee) chips.push(chip('assignee', 'Đối tượng', ASSIGNEE_TYPE_LABELS[assignee] ?? assignee));
                      if (chips.length > 0) return chips;
                      return <span className="text-muted-foreground break-all">{ev.detail}</span>;
                    })()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
