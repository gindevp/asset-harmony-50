import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { FilterBar, type FilterField } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
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
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatBizCodeDisplay } from '@/utils/formatCodes';
import { formatDate } from '@/data/mockData';
import { lossReportStatusLabels } from '@/data/mockData';
import type { LossReportRequestDto } from '@/api/types';
import { mapAssetItemDto, useAssetItems, useEmployees, useEnrichedEquipmentList, useLossReportRequests } from '@/hooks/useEntityApi';
import {
  formatCombinedLossSummary,
  getLossReportKindDisplayLabel,
  lossReportKindUpper,
} from '@/utils/lossReportCombinedDisplay';
import { ApiError, apiDelete, apiPatch, getApiErrorMessage, parseProblemDetailJson } from '@/api/http';
import { canDeleteLossReportAsRequester, canEditLossReportAsRequester } from '@/utils/requestRecordActions';
import { buildLossAssetRows } from '@/utils/lossReportAssetRows';
import { catalogItemNameOnly } from '@/utils/catalogItemDisplay';
import {
  formatLossOccurredAtForDisplay,
  lossOccurredAtFromDatetimeLocal,
  lossOccurredAtToDatetimeLocalValue,
} from '@/utils/lossReportForm';
import { RequesterEmployeeInfo } from '@/components/shared/RequesterEmployeeInfo';
import { LossReportRequestNarrativeFields } from '@/components/shared/LossReportRequestNarrativeFields';
import { PageLoading } from '@/components/shared/page-loading';
import type { AssetItem, Equipment } from '@/data/mockData';

function lossKindUpper(r: LossReportRequestDto): string {
  return String(r.lossKind ?? '').toUpperCase();
}

function lossRowMatchesSearch(
  r: LossReportRequestDto,
  assetItems: AssetItem[],
  equipments: Equipment[],
  q: string,
): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const parts: string[] = [
    r.code ?? '',
    formatBizCodeDisplay(r.code ?? ''),
    r.reason ?? '',
    r.lossDescription ?? '',
    getLossReportKindDisplayLabel(r, true),
    lossReportStatusLabels[r.status ?? ''] ?? '',
    r.status ?? '',
  ];
  if (r.equipment) {
    parts.push(r.equipment.equipmentCode ?? '');
    const iid = r.equipment.assetItem?.id;
    if (iid != null) parts.push(catalogItemNameOnly(String(iid), assetItems));
  }
  if (r.consumableAssignment?.assetItem?.id != null) {
    parts.push(catalogItemNameOnly(String(r.consumableAssignment.assetItem.id), assetItems));
  }
  if (lossKindUpper(r) === 'COMBINED') {
    parts.push(formatCombinedLossSummary(r, assetItems, equipments));
  }
  if (r.lossOccurredAt?.trim()) {
    parts.push(r.lossOccurredAt);
    parts.push(formatLossOccurredAtForDisplay(r.lossOccurredAt));
  }
  return parts.join(' ').toLowerCase().includes(s);
}

/** Danh sách YC báo mất của tài khoản (API đã lọc theo người gửi). */
const EmployeeLossReports = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const lrQ = useLossReportRequests();
  const iQ = useAssetItems();
  const eqQ = useEnrichedEquipmentList();
  const empQ = useEmployees();
  const rows = lrQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const equipments = (eqQ.data ?? []) as Equipment[];
  const employees = empQ.data ?? [];
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LossReportRequestDto | null>(null);
  const [editRow, setEditRow] = useState<LossReportRequestDto | null>(null);
  const [editLossOccurredAt, setEditLossOccurredAt] = useState('');
  const [editLossLocation, setEditLossLocation] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editLossDescription, setEditLossDescription] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LossReportRequestDto | null>(null);
  const [busy, setBusy] = useState(false);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['api', 'loss-report-requests'] });
  }, [qc]);

  useEffect(() => {
    if (!editRow) return;
    setEditLossOccurredAt(lossOccurredAtToDatetimeLocalValue(editRow.lossOccurredAt));
    setEditLossLocation(editRow.lossLocation?.trim() ?? '');
    setEditReason(editRow.reason?.trim() ?? '');
    setEditLossDescription(editRow.lossDescription?.trim() ?? '');
    setEditQuantity(editRow.quantity != null ? String(editRow.quantity) : '');
  }, [editRow]);

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
      setSelected(null);
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

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.requestDate ?? '').localeCompare(a.requestDate ?? '')),
    [rows],
  );

  const [filters, setFilters] = useState({ search: '', status: '' });

  const pageLoading = lrQ.isLoading || iQ.isLoading || eqQ.isLoading || empQ.isLoading;

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        key: 'search',
        label: 'Tìm kiếm',
        type: 'text',
        placeholder: 'Mã, lý do, tài sản, loại…',
        inputClassName: 'min-w-[12rem] max-w-xl w-full sm:w-72 md:w-96',
      },
      {
        key: 'status',
        label: 'Trạng thái',
        type: 'select',
        options: Object.entries(lossReportStatusLabels).map(([value, label]) => ({ value, label })),
      },
    ],
    [],
  );

  const filteredSorted = useMemo(() => {
    let list = sorted;
    if (filters.status) list = list.filter(r => String(r.status ?? '') === filters.status);
    if (filters.search.trim()) list = list.filter(r => lossRowMatchesSearch(r, assetItems, equipments, filters.search));
    return list;
  }, [sorted, filters, assetItems, equipments]);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.status]);

  const columns: Column<LossReportRequestDto>[] = [
    {
      key: 'code',
      label: 'Mã YC',
      render: r => <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code ?? '')}</span>,
    },
    {
      key: 'kind',
      label: 'Loại',
      render: r => getLossReportKindDisplayLabel(r, true),
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
      label: '',
      className: 'w-[7.5rem]',
      render: r => (
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Xem" onClick={() => setSelected(r)}>
            <Eye className="h-4 w-4" />
          </Button>
          {canEditLossReportAsRequester(r.status) ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Sửa"
              onClick={() => setEditRow(r)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          {canDeleteLossReportAsRequester(r.status) ? (
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
          ) : null}
        </div>
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
            onClick={() => navigate('/employee/request-new/loss')}
          >
            <Plus className="h-4 w-4 mr-1 shrink-0" />
            Tạo yêu cầu báo mất
          </Button>
        </div>
      </div>

      {pageLoading ? (
        <PageLoading minHeight="min-h-[45vh]" />
      ) : (
        <>
      <div className="mb-4">
        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
          onReset={() => setFilters({ search: '', status: '' })}
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredSorted}
        currentPage={page}
        onPageChange={setPage}
        emptyMessage={
          rows.length === 0
            ? 'Chưa có yêu cầu báo mất.'
            : 'Không có yêu cầu nào khớp tìm kiếm hoặc lọc trạng thái.'
        }
      />
        </>
      )}

      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-4xl w-[min(100%,56rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết {selected?.code ? formatBizCodeDisplay(selected.code) : ''}</DialogTitle>
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
                  {getLossReportKindDisplayLabel(selected, true)}
                </div>
              </div>
              {(() => {
                const assetRows = buildLossAssetRows(selected, assetItems, equipments);
                return assetRows.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-muted-foreground">Tài sản trong phiếu</div>
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full min-w-[28rem] text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Loại</th>
                            <th className="px-3 py-2 text-left font-medium">Tài sản</th>
                            <th className="px-3 py-2 text-right font-medium">SL báo mất</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assetRows.map((a, idx) => (
                            <tr key={`${a.type}-${idx}`} className="border-t">
                              <td className="px-3 py-2">{a.type}</td>
                              <td className="px-3 py-2 break-words">{a.asset}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{a.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null;
              })()}
              <LossReportRequestNarrativeFields row={selected} />
              {canEditLossReportAsRequester(selected.status) && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditRow(selected);
                      setSelected(null);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Sửa
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Xóa
                  </Button>
                </div>
              )}
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
                  disabled={busy}
                  className="w-full max-w-md font-sans tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Địa điểm</Label>
                <Input value={editLossLocation} onChange={e => setEditLossLocation(e.target.value)} disabled={busy} />
              </div>
              <div className="space-y-1.5">
                <Label>Lý do</Label>
                <Textarea value={editReason} onChange={e => setEditReason(e.target.value)} rows={2} disabled={busy} />
              </div>
              <div className="space-y-1.5">
                <Label>Mô tả chi tiết</Label>
                <Textarea value={editLossDescription} onChange={e => setEditLossDescription(e.target.value)} rows={3} disabled={busy} />
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
                    disabled={busy}
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
              Chỉ áp dụng khi phiếu đang chờ duyệt. Không hoàn tác.
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

export default EmployeeLossReports;
