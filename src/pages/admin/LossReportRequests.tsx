import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar } from '@/components/shared/FilterBar';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';
import { RequesterEmployeeInfo } from '@/components/shared/RequesterEmployeeInfo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatBizCodeDisplay } from '@/utils/formatCodes';
import { getRequesterDisplayByJobTitle, getItemName, formatDate } from '@/data/mockData';
import { lossReportStatusLabels } from '@/data/mockData';
import type { LossReportRequestDto } from '@/api/types';
import { ApiError, apiDelete, apiPatch, getApiErrorMessage, parseProblemDetailJson } from '@/api/http';
import { getStoredToken } from '@/api/http';
import { hasAnyAuthority } from '@/auth/jwt';
import type { Equipment } from '@/data/mockData';
import { mapAssetItemDto, useAssetItems, useEmployees, useEnrichedEquipmentList, useLossReportRequests } from '@/hooks/useEntityApi';
import { formatCombinedLossSummary, getLossReportKindDisplayLabel, lossReportKindUpper } from '@/utils/lossReportCombinedDisplay';
import { LossReportRequestNarrativeFields } from '@/components/shared/LossReportRequestNarrativeFields';
import { PageLoading } from '@/components/shared/page-loading';
import { buildLossAssetRows } from '@/utils/lossReportAssetRows';
import {
  formatLossOccurredAtForDisplay,
  lossOccurredAtFromDatetimeLocal,
  lossOccurredAtToDatetimeLocalValue,
} from '@/utils/lossReportForm';

const LossReportRequests = () => {
  const canAdminEditDelete = hasAnyAuthority(getStoredToken(), ['ROLE_ADMIN']);
  const qc = useQueryClient();
  const lrQ = useLossReportRequests();
  const empQ = useEmployees();
  const iQ = useAssetItems();
  const eqQ = useEnrichedEquipmentList();
  const rows = lrQ.data ?? [];
  const employees = empQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const equipments = (eqQ.data ?? []) as Equipment[];

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LossReportRequestDto | null>(null);
  const [busy, setBusy] = useState(false);

  const [editRow, setEditRow] = useState<LossReportRequestDto | null>(null);
  const [editLossOccurredAt, setEditLossOccurredAt] = useState('');
  const [editLossLocation, setEditLossLocation] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editLossDescription, setEditLossDescription] = useState('');
  const [editQuantity, setEditQuantity] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<LossReportRequestDto | null>(null);

  const pageLoading = lrQ.isLoading || empQ.isLoading || iQ.isLoading || eqQ.isLoading;

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['api', 'loss-report-requests'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment-assignments'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-assignments'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks-view'] });
  }, [qc]);

  useEffect(() => {
    if (!editRow) return;
    setEditLossOccurredAt(lossOccurredAtToDatetimeLocalValue(editRow.lossOccurredAt));
    setEditLossLocation(editRow.lossLocation?.trim() ?? '');
    setEditReason(editRow.reason?.trim() ?? '');
    setEditLossDescription(editRow.lossDescription?.trim() ?? '');
    setEditQuantity(editRow.quantity != null ? String(editRow.quantity) : '');
  }, [editRow]);

  const openEdit = (r: LossReportRequestDto) => {
    setEditRow(r);
  };

  const patchStatus = async (status: string) => {
    if (!selected?.id) return;
    setBusy(true);
    try {
      await apiPatch(`/api/loss-report-requests/${selected.id}`, {
        id: selected.id,
        status,
      });
      toast.success('Đã xác nhận — tài sản chuyển trạng thái mất');
      setSelected(null);
      invalidate();
    } catch (e) {
      const bodyErr = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(bodyErr ?? '') || getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async () => {
    if (!editRow?.id) return;
    const id = editRow.id;
    const lossIso = lossOccurredAtFromDatetimeLocal(editLossOccurredAt);
    if (!lossIso) {
      toast.error('Chọn thời gian xảy ra / phát hiện');
      return;
    }
    const body: Record<string, unknown> = {
      id,
      lossOccurredAt: lossIso,
      lossLocation: editLossLocation.trim(),
      reason: editReason.trim(),
      lossDescription: editLossDescription.trim(),
    };
    if (lossReportKindUpper(editRow) === 'CONSUMABLE') {
      const q = Number.parseInt(editQuantity.trim(), 10);
      if (!Number.isFinite(q) || q < 1) {
        toast.error('Số lượng vật tư phải là số nguyên ≥ 1');
        return;
      }
      body.quantity = q;
    }
    setBusy(true);
    try {
      await apiPatch(`/api/loss-report-requests/${id}`, body);
      toast.success('Đã cập nhật yêu cầu báo mất');
      setEditRow(null);
      invalidate();
    } catch (e) {
      const bodyErr = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(bodyErr ?? '') || getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setBusy(true);
    try {
      await apiDelete(`/api/loss-report-requests/${deleteTarget.id}`);
      toast.success('Đã xóa yêu cầu báo mất');
      setDeleteTarget(null);
      setSelected(prev => (prev?.id === deleteTarget.id ? null : prev));
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
          const combined = formatCombinedLossSummary(r, assetItems, equipments).toLowerCase();
          const reason = (r.reason ?? '').toLowerCase();
          const lossDesc = (r.lossDescription ?? '').toLowerCase();
          const lossWhen = [
            (r.lossOccurredAt ?? '').toLowerCase(),
            formatLossOccurredAtForDisplay(r.lossOccurredAt ?? '').toLowerCase(),
          ].join(' ');
          if (
            !code.includes(s) &&
            !eq.includes(s) &&
            !item.includes(s) &&
            !combined.includes(s) &&
            !reason.includes(s) &&
            !lossDesc.includes(s) &&
            !lossWhen.includes(s) &&
            !getEmployeeName(String(r.requester?.id ?? ''), employees).toLowerCase().includes(s)
          ) {
            return false;
          }
        }
        if (filters.status && r.status !== filters.status) return false;
        return true;
      })
      .sort((a, b) => (b.requestDate ?? '').localeCompare(a.requestDate ?? ''));
  }, [rows, filters, employees, assetItems, equipments]);

  const columns: Column<LossReportRequestDto>[] = [
    {
      key: 'code',
      label: 'Mã YC',
      render: r => <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code ?? '')}</span>,
    },
    {
      key: 'requester',
      label: 'Người báo',
      render: r => getRequesterDisplayByJobTitle(String(r.requester?.id ?? ''), employees),
    },
    {
      key: 'kind',
      label: 'Loại',
      render: r => getLossReportKindDisplayLabel(r),
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
      key: 'lossOccurredAt',
      label: 'Thời gian xảy ra / phát hiện',
      className: 'min-w-[10rem]',
      render: r => (
        <span className="tabular-nums text-sm text-foreground/90">
          {formatLossOccurredAtForDisplay(r.lossOccurredAt ?? '').trim() || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'w-[8.5rem]',
      render: r => (
        <div className="flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Xem" onClick={() => setSelected(r)}>
            <Eye className="h-4 w-4" />
          </Button>
          {canAdminEditDelete && r.status === 'PENDING' && (
            <>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Sửa" onClick={() => openEdit(r)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                title="Xóa"
                onClick={() => setDeleteTarget(r)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
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

      {pageLoading ? (
        <PageLoading minHeight="min-h-[45vh]" />
      ) : (
        <>
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
        </>
      )}

      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-4xl w-[min(100%,56rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết YC báo mất {selected?.code ? formatBizCodeDisplay(selected.code) : ''}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              {(() => {
                const assetRows = buildLossAssetRows(selected, assetItems, equipments);
                return (
                  <>
              <RequesterEmployeeInfo
                requesterId={String(selected.requester?.id ?? '')}
                employees={employees}
                hideLocation
                appendRows={[
                  {
                    label: 'Trạng thái',
                    value: <StatusBadge status={selected.status ?? ''} label={lossReportStatusLabels[selected.status ?? ''] ?? selected.status} />,
                  },
                  { label: 'Loại', value: getLossReportKindDisplayLabel(selected) },
                ]}
              />
              {assetRows.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-muted-foreground">Tài sản trong phiếu</div>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[28rem] text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Loại</th>
                          <th className="px-3 py-2 text-left font-medium">Tài sản</th>
                          <th className="px-3 py-2 text-left font-medium">Serial</th>
                          <th className="px-3 py-2 text-right font-medium">SL báo mất</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetRows.map((a, idx) => (
                          <tr key={`${a.type}-${idx}`} className="border-t">
                            <td className="px-3 py-2">{a.type}</td>
                            <td className="px-3 py-2 break-words">{a.asset}</td>
                            <td className="px-3 py-2 font-mono">{a.serial}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{a.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              <LossReportRequestNarrativeFields row={selected} />
              {canAdminEditDelete && selected.status === 'PENDING' && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => { openEdit(selected); setSelected(null); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Sửa
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteTarget(selected)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Xóa
                  </Button>
                </div>
              )}
              {selected.status === 'PENDING' && (
                <ApprovalActionBar
                  disabled={busy}
                  approveLabel="Xác nhận mất"
                  showReject={false}
                  onApprove={() => void patchStatus('APPROVED')}
                  onPrint={() => toast.info('In (theo template nội bộ)')}
                  onExport={() => toast.info('Xuất CSV')}
                />
              )}
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={open => { if (!open) setEditRow(null); }}>
        <DialogContent className="max-w-4xl w-[min(100%,56rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Sửa YC báo mất {editRow?.code ? formatBizCodeDisplay(editRow.code) : ''}
            </DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Thời gian (xảy ra / phát hiện)</Label>
                <Input
                  type="datetime-local"
                  value={editLossOccurredAt}
                  onChange={e => setEditLossOccurredAt(e.target.value)}
                  className="w-full max-w-md font-sans tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Địa điểm</Label>
                <Input value={editLossLocation} onChange={e => setEditLossLocation(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Lý do</Label>
                <Textarea value={editReason} onChange={e => setEditReason(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Mô tả chi tiết</Label>
                <Textarea value={editLossDescription} onChange={e => setEditLossDescription(e.target.value)} rows={3} />
              </div>
              {lossReportKindUpper(editRow) === 'CONSUMABLE' ? (
                <div className="space-y-1.5">
                  <Label>Số lượng báo mất</Label>
                  <Input
                    className="tabular-nums"
                    type="number"
                    min={1}
                    value={editQuantity}
                    onChange={e => setEditQuantity(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditRow(null)} disabled={busy}>
              Hủy
            </Button>
            <Button type="button" onClick={() => void submitEdit()} disabled={busy}>
              {busy ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa yêu cầu báo mất?</AlertDialogTitle>
            <AlertDialogDescription>
              Chỉ áp dụng khi phiếu đang chờ duyệt. Hành động không hoàn tác.
              {deleteTarget?.code ? (
                <>
                  {' '}
                  Mã: <span className="font-mono font-medium">{formatBizCodeDisplay(deleteTarget.code)}</span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={e => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={busy}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LossReportRequests;
