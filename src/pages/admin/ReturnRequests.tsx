import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar } from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import type { ReturnRequest } from '@/data/mockData';
import {
  returnStatusLabels,
  returnLineKindLabel,
  getRequesterDisplayByJobTitle,
  getDepartmentName,
  formatDate,
} from '@/data/mockData';
import { toast } from 'sonner';
import { formatBizCodeDisplay, formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';
import { RequesterEmployeeInfo } from '@/components/shared/RequesterEmployeeInfo';
import {
  mapAssetItemDto,
  useAssetItems,
  useDepartments,
  useEmployees,
  useReturnRequestsView,
} from '@/hooks/useEntityApi';
import { ApiError, apiDelete, apiGet, apiPatch, parseProblemDetailJson, PAGE_ALL } from '@/api/http';
import type { ReturnRequestLineDto } from '@/api/types';
import { canDeleteReturnRequest, canEditReturnRequestFields } from '@/utils/requestRecordActions';
import { LoadingIndicator, PageLoading } from '@/components/shared/page-loading';
import { catalogItemNameOnly } from '@/utils/catalogItemDisplay';
import {
  formatReturnRequestAssetNamesSummary,
  getReturnListKindLabel,
  returnRequestHeaderNote,
} from '@/utils/returnRequestListDisplay';

function returnStatusKey(s: string | undefined): string {
  return String(s ?? '').trim().toUpperCase();
}

const ReturnRequests = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const retQ = useReturnRequestsView();
  const empQ = useEmployees();
  const depQ = useDepartments();
  const iQ = useAssetItems();
  const returnRequests = retQ.data?.requests ?? [];
  const employees = empQ.data ?? [];
  const departments = depQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReturnRequest | null>(null);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit'>('view');
  const [editReturnReason, setEditReturnReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ReturnRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const listLoading = retQ.isLoading || empQ.isLoading || depQ.isLoading || iQ.isLoading;

  const rawLinesQ = useQuery({
    queryKey: ['api', 'return-request-lines', 'for', selected?.id],
    queryFn: async () => {
      const all = await apiGet<ReturnRequestLineDto[]>(`/api/return-request-lines?${PAGE_ALL}`);
      return all.filter(l => String(l.request?.id) === selected!.id);
    },
    enabled: !!selected?.id,
  });

  useEffect(() => {
    if (!selected || dialogMode !== 'edit') return;
    setEditReturnReason(returnRequestHeaderNote(selected));
  }, [selected?.id, dialogMode, selected ? returnRequestHeaderNote(selected) : '']);

  /** Phiếu APPROVED: tự chọn hết dòng (bỏ checkbox) — backend vẫn cần selected=true khi hoàn tất. */
  useEffect(() => {
    if (!selected?.id || returnStatusKey(selected.status) !== 'APPROVED') return;
    const lines = rawLinesQ.data;
    if (!lines?.length || rawLinesQ.isLoading) return;
    const need = lines.filter(l => l.selected !== true);
    if (need.length === 0) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        await Promise.all(
          need.map(l => apiPatch(`/api/return-request-lines/${l.id}`, { id: Number(l.id), selected: true })),
        );
        if (!cancelled) await rawLinesQ.refetch();
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Lỗi API');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.status, rawLinesQ.data, rawLinesQ.isLoading]);

  const pickFreshReturn = useCallback(
    (r: ReturnRequest) => returnRequests.find(x => x.id === r.id) ?? r,
    [returnRequests],
  );

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['api', 'return-requests-view'] });
    void qc.invalidateQueries({ queryKey: ['api', 'return-request-lines'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment-assignments'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-assignments'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks-view'] });
  };

  const saveReturnNote = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiPatch(`/api/return-requests/${selected.id}`, {
        id: Number(selected.id),
        note: editReturnReason.trim(),
      });
      toast.success('Đã lưu thay đổi');
      setDialogMode('view');
      setSelected(null);
      invalidate();
    } catch (e) {
      const bodyErr = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(bodyErr ?? '') || (e instanceof Error ? e.message : 'Lỗi API'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteReturn = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiDelete(`/api/return-requests/${deleteTarget.id}`);
      toast.success('Đã xóa yêu cầu');
      if (selected?.id === deleteTarget.id) {
        setSelected(null);
        setDialogMode('view');
      }
      setDeleteTarget(null);
      invalidate();
    } catch (e) {
      const bodyErr = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(bodyErr ?? '') || (e instanceof Error ? e.message : 'Lỗi API'));
    } finally {
      setBusy(false);
    }
  };

  const patchReturnStatus = async (status: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiPatch(`/api/return-requests/${selected.id}`, { id: Number(selected.id), status });
      if (status === 'APPROVED') {
        toast.success('Đã duyệt yêu cầu thu hồi — bấm Hoàn tất khi sẵn sàng');
        setSelected(prev => (prev ? { ...prev, status: 'APPROVED' } : null));
      } else if (status === 'REJECTED') {
        toast.success('Đã từ chối yêu cầu');
        setSelected(null);
        setDialogMode('view');
      } else if (status === 'COMPLETED') {
        toast.success('Đã hoàn thành thu hồi (cập nhật kho & bàn giao)');
        setSelected(null);
        setDialogMode('view');
      } else {
        toast.success('Đã cập nhật yêu cầu');
        setSelected(null);
        setDialogMode('view');
      }
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setBusy(false);
    }
  };

  const sortedReturnLines = useMemo(() => {
    const raw = rawLinesQ.data ?? [];
    return [...raw].sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0));
  }, [rawLinesQ.data]);

  const returnDetailLineColumns = useMemo((): Column<ReturnRequestLineDto>[] => {
    return [
      {
        key: 'lineType',
        label: 'Loại',
        render: l => returnLineKindLabel(l.lineType),
      },
      {
        key: 'item',
        label: 'Tài sản',
        render: l => catalogItemNameOnly(String(l.assetItem?.id ?? ''), assetItems),
      },
      {
        key: 'equipment',
        label: 'Mã TB',
        render: l =>
          l.equipment?.equipmentCode
            ? formatEquipmentCodeDisplay(l.equipment.equipmentCode)
            : '—',
      },
      {
        key: 'serial',
        label: 'Serial',
        render: l =>
          String(l.lineType ?? 'DEVICE').toUpperCase() === 'CONSUMABLE'
            ? '—'
            : (l.equipment?.serial ?? '—'),
      },
      { key: 'quantity', label: 'SL', className: 'text-right', render: l => l.quantity ?? 0 },
    ];
  }, [assetItems]);

  const completeReturn = async () => {
    if (!selected) return;
    const lines = sortedReturnLines;
    if (lines.length === 0) {
      toast.error('Không có dòng thu hồi');
      return;
    }
    const missing = lines.filter(l => l.selected !== true);
    if (missing.length > 0) {
      setBusy(true);
      try {
        await Promise.all(
          missing.map(l => apiPatch(`/api/return-request-lines/${l.id}`, { id: Number(l.id), selected: true })),
        );
        await rawLinesQ.refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Lỗi API');
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    await patchReturnStatus('COMPLETED');
  };

  const sorted = returnRequests
    .filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const blob = [
          r.code,
          formatBizCodeDisplay(r.code),
          getEmployeeName(r.requesterId, employees),
          getDepartmentName(r.departmentId, departments),
          returnRequestHeaderNote(r),
          getReturnListKindLabel(r),
          formatReturnRequestAssetNamesSummary(r, assetItems),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!blob.includes(s)) return false;
      }
      if (filters.status && r.status !== filters.status) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<ReturnRequest>[] = [
    {
      key: 'code',
      label: 'Mã YC',
      render: r => <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code)}</span>,
    },
    { key: 'requester', label: 'Người yêu cầu', render: r => getRequesterDisplayByJobTitle(r.requesterId, employees) },
    { key: 'department', label: 'Phòng ban', render: r => getDepartmentName(r.departmentId, departments) },
    {
      key: 'kind',
      label: 'Loại',
      render: r => getReturnListKindLabel(r),
    },
    {
      key: 'note',
      label: 'Ghi chú',
      render: r => <span className="max-w-xs truncate block">{returnRequestHeaderNote(r) || '—'}</span>,
    },
    { key: 'lines', label: 'Số dòng', render: r => r.lines.length },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={returnStatusLabels[r.status]} /> },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'w-[9rem]',
      render: r => (
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Xem"
            onClick={() => {
              setDialogMode('view');
              setSelected(pickFreshReturn(r));
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canEditReturnRequestFields(r.status) ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Sửa"
              onClick={() => {
                navigate(`/admin/request-new/return?editId=${encodeURIComponent(String(r.id))}`);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          {canDeleteReturnRequest(r.status) ? (
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
        <div>
          <h1 className="page-title">Yêu cầu thu hồi</h1>
        </div>
      </div>
      {listLoading ? (
        <PageLoading minHeight="min-h-[45vh]" />
      ) : (
        <>
      <FilterBar
        fields={[
          { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã YC, người yêu cầu, loại, tên tài sản, ghi chú…' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: Object.entries(returnStatusLabels).map(([v, l]) => ({ value: v, label: l })) },
        ]}
        values={filters}
        onChange={(k, v) => { setFilters(prev => ({ ...prev, [k]: v })); setPage(1); }}
        onReset={() => { setFilters({}); setPage(1); }}
      />
      <DataTable columns={columns} data={sorted} currentPage={page} onPageChange={setPage} />
        </>
      )}

      <Dialog
        open={!!selected}
        onOpenChange={open => {
          if (!open) {
            setSelected(null);
            setDialogMode('view');
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'edit' ? 'Sửa yêu cầu' : 'Chi tiết yêu cầu'} thu hồi {selected?.code}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Xem hoặc chỉnh sửa yêu cầu thu hồi; khi đã duyệt, các dòng được chọn tự động — hoàn tất để cập nhật kho (mặc định trả về kho).
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <RequesterEmployeeInfo
                requesterId={selected.requesterId}
                employees={employees}
                hideLocation
                appendRows={[
                  { label: 'Ngày tạo', value: formatDate(selected.createdAt) },
                  {
                    label: 'Trạng thái',
                    value: (
                      <StatusBadge
                        status={selected.status}
                        label={returnStatusLabels[selected.status] ?? returnStatusKey(selected.status)}
                      />
                    ),
                  },
                ]}
              />
              {dialogMode === 'edit' && canEditReturnRequestFields(returnStatusKey(selected.status)) ? (
                <div className="space-y-2 border rounded-md p-3 bg-muted/20 text-sm">
                  <Label>Ghi chú</Label>
                  <Textarea value={editReturnReason} onChange={e => setEditReturnReason(e.target.value)} rows={3} disabled={busy} />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" size="sm" disabled={busy} onClick={() => void saveReturnNote()}>
                      Lưu
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setDialogMode('view')}>
                      Xem (thoát sửa)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm">
                  <span className="text-muted-foreground">Ghi chú:</span> {returnRequestHeaderNote(selected) || '—'}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Thiết bị / vật tư thu hồi</p>
                {returnStatusKey(selected.status) === 'APPROVED' ? (
                  <p className="text-sm text-muted-foreground">
                    Tất cả dòng được áp dụng khi hoàn tất. Hướng xử lý mặc định:{' '}
                    <span className="font-medium text-foreground">trả về kho</span>.
                  </p>
                ) : null}
                {rawLinesQ.isLoading && <LoadingIndicator label="Đang tải dòng…" />}
                {rawLinesQ.isError && (
                  <p className="text-sm text-destructive">Không tải được chi tiết dòng từ máy chủ.</p>
                )}
                <DataTable
                  columns={returnDetailLineColumns}
                  data={sortedReturnLines}
                  emptyMessage="Không có dòng"
                />
                {returnStatusKey(selected.status) === 'APPROVED' ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button type="button" disabled={busy} onClick={() => void completeReturn()}>
                      Hoàn tất thu hồi
                    </Button>
                  </div>
                ) : null}
              </div>

              {returnStatusKey(selected.status) === 'PENDING' && (
                <ApprovalActionBar
                  disabled={busy}
                  onApprove={() => void patchReturnStatus('APPROVED')}
                  onReject={() => void patchReturnStatus('REJECTED')}
                  onPrint={() => toast.info('In (demo)')}
                  onExport={() => toast.info('Xuất (demo)')}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa yêu cầu thu hồi?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `Không hoàn tác. Mã: ${formatBizCodeDisplay(deleteTarget.code)}` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={e => {
                e.preventDefault();
                void confirmDeleteReturn();
              }}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReturnRequests;
