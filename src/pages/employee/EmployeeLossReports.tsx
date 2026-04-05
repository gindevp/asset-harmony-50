import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { LossReportCreateModal } from '@/components/shared/LossReportCreateModal';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Plus } from 'lucide-react';
import { formatBizCodeDisplay, formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { getItemName, formatDate } from '@/data/mockData';
import { lossReportKindLabels, lossReportStatusLabels } from '@/data/mockData';
import type { LossReportRequestDto } from '@/api/types';
import { mapAssetItemDto, useAssetItems, useLossReportRequests } from '@/hooks/useEntityApi';

/** Danh sách YC báo mất của tài khoản (API đã lọc theo người gửi). */
const EmployeeLossReports = () => {
  const qc = useQueryClient();
  const lrQ = useLossReportRequests();
  const iQ = useAssetItems();
  const rows = lrQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LossReportRequestDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.requestDate ?? '').localeCompare(a.requestDate ?? '')),
    [rows],
  );

  const columns: Column<LossReportRequestDto>[] = [
    {
      key: 'code',
      label: 'Mã YC',
      render: r => <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code ?? '')}</span>,
    },
    {
      key: 'kind',
      label: 'Loại',
      render: r => lossReportKindLabels[r.lossKind ?? ''] ?? r.lossKind,
    },
    {
      key: 'target',
      label: 'Tài sản',
      render: r => {
        if (r.lossKind === 'EQUIPMENT' && r.equipment) {
          const itemId = r.equipment.assetItem?.id != null ? String(r.equipment.assetItem.id) : '';
          return (
            <span className="text-sm">
              {formatEquipmentCodeDisplay(r.equipment.equipmentCode)}
              {itemId ? ` — ${getItemName(itemId, assetItems)}` : ''}
            </span>
          );
        }
        if (r.lossKind === 'CONSUMABLE' && r.consumableAssignment?.assetItem?.id != null) {
          return (
            <span className="text-sm">
              {getItemName(String(r.consumableAssignment.assetItem.id), assetItems)} — SL: {r.quantity ?? '—'}
            </span>
          );
        }
        return '—';
      },
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: r => <StatusBadge status={r.status ?? ''} label={lossReportStatusLabels[r.status ?? ''] ?? r.status} />,
    },
    {
      key: 'requestDate',
      label: 'Ngày gửi',
      render: r => formatDate(r.requestDate ?? ''),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[3rem]',
      render: r => (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Xem" onClick={() => setSelected(r)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 w-full">
          <div>
            <h1 className="page-title">Yêu cầu báo mất</h1>
          </div>
          <Button
            type="button"
            className="shrink-0 w-full sm:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1 shrink-0" />
            Tạo yêu cầu báo mất
          </Button>
        </div>
      </div>
      <DataTable columns={columns} data={sorted} currentPage={page} onPageChange={setPage} />

      <LossReportCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          void qc.invalidateQueries({ queryKey: ['api', 'loss-report-requests'] });
        }}
      />

      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chi tiết {selected?.code ? formatBizCodeDisplay(selected.code) : ''}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Trạng thái:</span>{' '}
                <StatusBadge status={selected.status ?? ''} label={lossReportStatusLabels[selected.status ?? ''] ?? selected.status} />
              </div>
              {selected.reason ? (
                <div>
                  <span className="text-muted-foreground">Lý do:</span>
                  <p className="mt-1 whitespace-pre-wrap">{selected.reason}</p>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeLossReports;
