import { useEffect, useMemo, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import type { ReturnRequest } from '@/data/mockData';
import {
  returnStatusLabels,
  returnDispositionLabels,
  getEmployeeName,
  getDepartmentName,
  getItemName,
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

const ReturnRequests = () => {
  const qc = useQueryClient();
  const retQ = useReturnRequestsView();
  const empQ = useEmployees();
  const depQ = useDepartments();
  const iQ = useAssetItems();
  const returnRequests = retQ.data ?? [];
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

  useEffect(() => {
    if (!selected || dialogMode !== 'edit') return;
    setEditReturnReason(selected.reason ?? '');
  }, [selected?.id, dialogMode, selected?.reason]);

  const rawLinesQ = useQuery({
    queryKey: ['api', 'return-request-lines', 'for', selected?.id],
    queryFn: async () => {
      const all = await apiGet<ReturnRequestLineDto[]>(`/api/return-request-lines?${PAGE_ALL}`);
      return all.filter(l => String(l.request?.id) === selected!.id);
    },
    enabled: !!selected?.id && selected.status === 'APPROVED',
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['api', 'return-requests-view'] });
    void qc.invalidateQueries({ queryKey: ['api', 'return-request-lines'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment-assignments'] });
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
        toast.success('Đã duyệt yêu cầu thu hồi — chọn dòng thực tế rồi hoàn tất');
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

  const patchLineSelected = async (lineId: number, sel: boolean) => {
    setBusy(true);
    try {
      await apiPatch(`/api/return-request-lines/${lineId}`, { id: lineId, selected: sel });
      await rawLinesQ.refetch();
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setBusy(false);
    }
  };

  const patchLineDisposition = async (lineId: number, disposition: string) => {
    setBusy(true);
    try {
      await apiPatch(`/api/return-request-lines/${lineId}`, { id: lineId, disposition });
      await rawLinesQ.refetch();
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setBusy(false);
    }
  };

  const completeReturn = async () => {
    if (!selected) return;
    const lines = rawLinesQ.data ?? [];
    const anySel = lines.some(l => l.selected === true);
    if (!anySel) {
      toast.error('Chọn ít nhất một dòng thu hồi thực tế');
      return;
    }
    await patchReturnStatus('COMPLETED');
  };

  const sorted = returnRequests
    .filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (
          !r.code.toLowerCase().includes(s) &&
          !getEmployeeName(r.requesterId, employees).toLowerCase().includes(s)
        ) {
          return false;
        }
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
    { key: 'requester', label: 'Người yêu cầu', render: r => getEmployeeName(r.requesterId, employees) },
    { key: 'department', label: 'Phòng ban', render: r => getDepartmentName(r.departmentId, departments) },
    { key: 'reason', label: 'Lý do', render: r => <span className="max-w-xs truncate block">{r.reason}</span> },
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
              setSelected(r);
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
                setDialogMode('edit');
                setSelected(r);
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

  const lineColumnsPending: Column<ReturnRequest['lines'][0]>[] = [
    { key: 'item', label: 'Tài sản', render: r => getItemName(r.itemId, assetItems) },
    { key: 'equipment', label: 'Mã TB', render: r => r.equipmentId || '—' },
    { key: 'quantity', label: 'SL thu hồi', className: 'text-right' },
    {
      key: 'sel',
      label: 'Thu hồi',
      render: r => (r.selected ? 'Có' : 'Không'),
    },
    {
      key: 'disposition',
      label: 'Hướng xử lý',
      render: r => (r.disposition ? returnDispositionLabels[r.disposition] ?? r.disposition : '—'),
    },
    { key: 'notes', label: 'Ghi chú' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Yêu cầu thu hồi</h1>
        </div>
      </div>
      <FilterBar
        fields={[
          { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã YC, người yêu cầu...' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: Object.entries(returnStatusLabels).map(([v, l]) => ({ value: v, label: l })) },
        ]}
        values={filters}
        onChange={(k, v) => { setFilters(prev => ({ ...prev, [k]: v })); setPage(1); }}
        onReset={() => { setFilters({}); setPage(1); }}
      />
      <DataTable columns={columns} data={sorted} currentPage={page} onPageChange={setPage} />

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
              Xem hoặc chỉnh sửa yêu cầu thu hồi, chọn hướng xử lý từng dòng khi phiếu đã duyệt.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <RequesterEmployeeInfo requesterId={selected.requesterId} employees={employees} />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Phòng ban (trên phiếu):</span> {getDepartmentName(selected.departmentId, departments)}</div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={returnStatusLabels[selected.status]} /></div>
                {dialogMode === 'edit' && canEditReturnRequestFields(selected.status) ? (
                  <div className="col-span-2 space-y-2 border rounded-md p-3 bg-muted/20">
                    <Label>Lý do / ghi chú</Label>
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
                  <div className="col-span-2"><span className="text-muted-foreground">Lý do:</span> {selected.reason}</div>
                )}
              </div>

              {selected.status === 'APPROVED' ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Đánh dấu dòng sẽ thu hồi thực tế (chỉ các dòng được chọn mới cập nhật kho khi hoàn tất).
                  </p>
                  {rawLinesQ.isLoading && <p className="text-sm text-muted-foreground">Đang tải dòng…</p>}
                  <DataTable
                    columns={[
                      {
                        key: 'pick',
                        label: 'Chọn',
                        render: (l: ReturnRequestLineDto) => (
                          <Checkbox
                            checked={l.selected === true}
                            disabled={busy}
                            onCheckedChange={v => void patchLineSelected(l.id!, v === true)}
                          />
                        ),
                      },
                      {
                        key: 'item',
                        label: 'Tài sản',
                        render: (l: ReturnRequestLineDto) =>
                          getItemName(String(l.assetItem?.id ?? ''), assetItems),
                      },
                      {
                        key: 'equipment',
                        label: 'Mã TB',
                        render: (l: ReturnRequestLineDto) =>
                          l.equipment?.equipmentCode
                            ? formatEquipmentCodeDisplay(l.equipment.equipmentCode)
                            : (l.equipment?.id ?? '—'),
                      },
                      { key: 'quantity', label: 'SL', className: 'text-right', render: (l: ReturnRequestLineDto) => l.quantity ?? 0 },
                      {
                        key: 'disposition',
                        label: 'Hướng xử lý',
                        render: (l: ReturnRequestLineDto) => {
                          const v = (l.disposition ?? 'TO_STOCK') as string;
                          return (
                            <Select
                              value={v}
                              disabled={busy || l.selected !== true}
                              onValueChange={val => void patchLineDisposition(l.id!, val)}
                            >
                              <SelectTrigger className="w-[11rem] h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(returnDispositionLabels).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        },
                      },
                      { key: 'notes', label: 'Ghi chú', render: (l: ReturnRequestLineDto) => l.note ?? '' },
                    ]}
                    data={rawLinesQ.data ?? []}
                    emptyMessage="Không có dòng"
                  />
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button type="button" disabled={busy} onClick={() => void completeReturn()}>
                      Hoàn tất thu hồi
                    </Button>
                  </div>
                </div>
              ) : (
                <DataTable columns={lineColumnsPending} data={selected.lines} />
              )}

              {selected.status === 'PENDING' && (
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
