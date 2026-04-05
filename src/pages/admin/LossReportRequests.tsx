import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar } from '@/components/shared/FilterBar';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';
import { RequesterEmployeeInfo } from '@/components/shared/RequesterEmployeeInfo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye } from 'lucide-react';
import { toast } from 'sonner';
import { formatBizCodeDisplay, formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { getEmployeeName, getItemName, formatDate } from '@/data/mockData';
import {
  lossReportKindLabels,
  lossReportStatusLabels,
} from '@/data/mockData';
import type { LossReportRequestDto } from '@/api/types';
import { ApiError, apiPatch, getApiErrorMessage, parseProblemDetailJson } from '@/api/http';
import { mapAssetItemDto, useAssetItems, useEmployees, useLossReportRequests } from '@/hooks/useEntityApi';

const LossReportRequests = () => {
  const qc = useQueryClient();
  const lrQ = useLossReportRequests();
  const empQ = useEmployees();
  const iQ = useAssetItems();
  const rows = lrQ.data ?? [];
  const employees = empQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LossReportRequestDto | null>(null);
  const [busy, setBusy] = useState(false);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['api', 'loss-report-requests'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment-assignments'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-assignments'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks-view'] });
  }, [qc]);

  const patchStatus = async (status: string) => {
    if (!selected?.id) return;
    setBusy(true);
    try {
      await apiPatch(`/api/loss-report-requests/${selected.id}`, {
        id: selected.id,
        status,
      });
      toast.success(status === 'APPROVED' ? 'Đã xác nhận — tài sản chuyển trạng thái mất' : 'Đã từ chối YC báo mất');
      setSelected(null);
      invalidate();
    } catch (e) {
      const bodyErr = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(bodyErr ?? '') || getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    return rows
      .filter(r => {
        if (filters.search) {
          const s = filters.search.toLowerCase();
          const code = (r.code ?? '').toLowerCase();
          const eq = (r.equipment?.equipmentCode ?? '').toLowerCase();
          const item = r.consumableAssignment?.assetItem?.id != null
            ? getItemName(String(r.consumableAssignment.assetItem.id), assetItems).toLowerCase()
            : '';
          if (!code.includes(s) && !eq.includes(s) && !item.includes(s) && !getEmployeeName(String(r.requester?.id ?? ''), employees).toLowerCase().includes(s)) {
            return false;
          }
        }
        if (filters.status && r.status !== filters.status) return false;
        return true;
      })
      .sort((a, b) => (b.requestDate ?? '').localeCompare(a.requestDate ?? ''));
  }, [rows, filters, employees, assetItems]);

  const columns: Column<LossReportRequestDto>[] = [
    {
      key: 'code',
      label: 'Mã YC',
      render: r => <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code ?? '')}</span>,
    },
    {
      key: 'requester',
      label: 'Người báo',
      render: r => getEmployeeName(String(r.requester?.id ?? ''), employees),
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
          const id = String(r.consumableAssignment.assetItem.id);
          return (
            <span className="text-sm">
              {getItemName(id, assetItems)} — SL: {r.quantity ?? '—'}
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
      label: 'Thao tác',
      className: 'w-[4rem]',
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
        <div>
          <h1 className="page-title">Yêu cầu báo mất</h1>
        </div>
      </div>

      <FilterBar
        fields={[
          { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã YC, người báo, mã TB, tên vật tư…' },
          {
            key: 'status',
            label: 'Trạng thái',
            type: 'select',
            options: Object.entries(lossReportStatusLabels).map(([v, l]) => ({ value: v, label: l })),
          },
        ]}
        values={filters}
        onChange={(k, v) => { setFilters(prev => ({ ...prev, [k]: v })); setPage(1); }}
        onReset={() => { setFilters({}); setPage(1); }}
      />
      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />

      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết YC báo mất {selected?.code ? formatBizCodeDisplay(selected.code) : ''}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <RequesterEmployeeInfo requesterId={String(selected.requester?.id ?? '')} employees={employees} />
              <div className="grid gap-2">
                <div>
                  <span className="text-muted-foreground">Trạng thái:</span>{' '}
                  <StatusBadge status={selected.status ?? ''} label={lossReportStatusLabels[selected.status ?? ''] ?? selected.status} />
                </div>
                <div>
                  <span className="text-muted-foreground">Loại:</span>{' '}
                  {lossReportKindLabels[selected.lossKind ?? ''] ?? selected.lossKind}
                </div>
                {selected.lossKind === 'EQUIPMENT' && selected.equipment && (
                  <div>
                    <span className="text-muted-foreground">Thiết bị:</span>{' '}
                    <span className="font-mono">{formatEquipmentCodeDisplay(selected.equipment.equipmentCode)}</span>
                    {selected.equipment.assetItem?.id != null && (
                      <span className="ml-1">— {getItemName(String(selected.equipment.assetItem.id), assetItems)}</span>
                    )}
                  </div>
                )}
                {selected.lossKind === 'CONSUMABLE' && selected.consumableAssignment?.assetItem?.id != null && (
                  <div>
                    <span className="text-muted-foreground">Vật tư:</span>{' '}
                    {getItemName(String(selected.consumableAssignment.assetItem.id), assetItems)} — SL báo mất:{' '}
                    <span className="font-medium tabular-nums">{selected.quantity ?? '—'}</span>
                  </div>
                )}
                {selected.reason ? (
                  <div>
                    <span className="text-muted-foreground">Lý do / mô tả:</span>
                    <p className="mt-1 whitespace-pre-wrap">{selected.reason}</p>
                  </div>
                ) : null}
              </div>
              {selected.status === 'PENDING' && (
                <ApprovalActionBar
                  disabled={busy}
                  approveLabel="Xác nhận mất"
                  rejectLabel="Từ chối"
                  onApprove={() => void patchStatus('APPROVED')}
                  onReject={() => void patchStatus('REJECTED')}
                  onPrint={() => toast.info('In (theo template nội bộ)')}
                  onExport={() => toast.info('Xuất CSV')}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LossReportRequests;
