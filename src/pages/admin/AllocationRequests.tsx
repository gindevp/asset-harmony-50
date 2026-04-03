import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';
import { RequesterEmployeeInfo } from '@/components/shared/RequesterEmployeeInfo';
import { Button } from '@/components/ui/button';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import type { AllocationRequest } from '@/data/mockData';
import {
  allocationStatusLabels,
  getEmployeeName,
  getDepartmentName,
  getItemName,
  getAssetLineDisplay,
  formatDate,
} from '@/data/mockData';
import { toast } from 'sonner';
import { formatBizCodeDisplay, formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { ApiError, apiDelete, apiGet, apiPatch, parseProblemDetailJson, PAGE_ALL } from '@/api/http';
import type { AllocationRequestLineDto } from '@/api/types';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { AttachmentNoteView } from '@/components/shared/AttachmentNoteView';
import {
  mapAssetItemDto,
  useAllocationRequestsView,
  useAssetItems,
  useAssetLines,
  useDepartments,
  useEmployees,
  useEnrichedEquipmentList,
} from '@/hooks/useEntityApi';
import {
  canDeleteAllocationRequest,
  canEditAllocationRequestFields,
} from '@/utils/requestRecordActions';

const AllocationRequests = () => {
  const qc = useQueryClient();
  const arQ = useAllocationRequestsView();
  const empQ = useEmployees();
  const depQ = useDepartments();
  const iQ = useAssetItems();
  const alQ = useAssetLines();
  const eqQ = useEnrichedEquipmentList();
  const allocationRequests = arQ.data ?? [];
  const employees = empQ.data ?? [];
  const departments = depQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const assetLinesApi = alQ.data ?? [];
  const equipments = eqQ.data ?? [];

  const equipmentsInStockForDeviceLine = (line: AllocationRequestLineDto) => {
    const lineId = line.assetLine?.id != null ? String(line.assetLine.id) : '';
    const itemId = String(line.assetItem?.id ?? '');
    const itemIds = new Set<string>();
    if (lineId) {
      assetItems.filter(i => i.lineId === lineId).forEach(i => itemIds.add(i.id));
    } else if (itemId) {
      itemIds.add(itemId);
    }
    return equipments.filter(e => itemIds.has(e.itemId) && e.status === 'IN_STOCK');
  };

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AllocationRequest | null>(null);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit'>('view');
  const [editReason, setEditReason] = useState('');
  const [editAttachmentNote, setEditAttachmentNote] = useState('');
  const [editBeneficiaryNote, setEditBeneficiaryNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AllocationRequest | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selected || dialogMode !== 'edit') return;
    setEditReason(selected.reason ?? '');
    setEditAttachmentNote(selected.attachmentNote ?? '');
    setEditBeneficiaryNote(selected.beneficiaryNote ?? '');
  }, [selected?.id, dialogMode, selected?.reason, selected?.attachmentNote, selected?.beneficiaryNote]);

  const rawLinesQ = useQuery({
    queryKey: ['api', 'allocation-request-lines', 'for', selected?.id],
    queryFn: async () => {
      const all = await apiGet<AllocationRequestLineDto[]>(`/api/allocation-request-lines?${PAGE_ALL}`);
      return all.filter(l => String(l.request?.id) === selected!.id);
    },
    enabled: !!selected?.id && selected.status === 'PENDING',
  });

  const filtered = allocationRequests
    .filter(r => {
      if (filters.search && !r.code.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.status && r.status !== filters.status) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<AllocationRequest>[] = [
    {
      key: 'code',
      label: 'Mã YC',
      render: r => <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code)}</span>,
    },
    { key: 'requester', label: 'Người yêu cầu', render: r => getEmployeeName(r.requesterId, employees) },
    { key: 'department', label: 'Phòng ban', render: r => getDepartmentName(r.departmentId, departments) },
    { key: 'reason', label: 'Lý do', render: r => <span className="max-w-xs truncate block">{r.reason}</span> },
    {
      key: 'assignee',
      label: 'Đối tượng nhận',
      render: r => <span className="max-w-[12rem] truncate block" title={r.assigneeSummary}>{r.assigneeSummary}</span>,
    },
    {
      key: 'stockIssue',
      label: 'Phiếu xuất',
      render: r =>
        r.stockIssueCode ? (
          <span className="font-mono text-xs">{r.stockIssueCode}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: 'lines', label: 'Số dòng', render: r => r.lines.length },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={allocationStatusLabels[r.status]} /> },
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
          {canEditAllocationRequestFields(r.status) ? (
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
          {canDeleteAllocationRequest(r.status) ? (
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

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã yêu cầu...' },
    { key: 'status', label: 'Trạng thái', type: 'select', options: Object.entries(allocationStatusLabels).map(([v, l]) => ({ value: v, label: l })) },
  ];

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['api', 'allocation-requests-view'] });
    void qc.invalidateQueries({ queryKey: ['api', 'allocation-request-lines'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment-assignments'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks-view'] });
  };

  const saveLineEquipment = async (lineId: number, equipmentId: number) => {
    setBusy(true);
    try {
      await apiPatch(`/api/allocation-request-lines/${lineId}`, { id: lineId, equipment: { id: equipmentId } });
      toast.success('Đã gán thiết bị cho dòng');
      void rawLinesQ.refetch();
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi cập nhật dòng');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiPatch(`/api/allocation-requests/${selected.id}`, {
        id: Number(selected.id),
        status,
      });
      toast.success('Đã cập nhật trạng thái yêu cầu');
      setSelected(null);
      setDialogMode('view');
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi cập nhật');
    } finally {
      setBusy(false);
    }
  };

  const saveAllocationContent = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiPatch(`/api/allocation-requests/${selected.id}`, {
        id: Number(selected.id),
        reason: editReason.trim() || undefined,
        attachmentNote: editAttachmentNote.trim() || undefined,
        beneficiaryNote: editBeneficiaryNote.trim() || undefined,
      });
      toast.success('Đã lưu thay đổi');
      setDialogMode('view');
      setSelected(null);
      invalidate();
    } catch (e) {
      const body = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(body ?? '') || (e instanceof Error ? e.message : 'Lỗi API'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteAllocation = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiDelete(`/api/allocation-requests/${deleteTarget.id}`);
      toast.success('Đã xóa yêu cầu');
      if (selected?.id === deleteTarget.id) {
        setSelected(null);
        setDialogMode('view');
      }
      setDeleteTarget(null);
      invalidate();
    } catch (e) {
      const body = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(body ?? '') || (e instanceof Error ? e.message : 'Lỗi API'));
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    const { data: lines } = await rawLinesQ.refetch();
    for (const l of lines ?? []) {
      if (l.lineType === 'DEVICE' && (l.equipment?.id == null || l.equipment.id === undefined)) {
        toast.error('Chọn thiết bị tồn kho cho tất cả dòng thiết bị trước khi duyệt');
        return;
      }
    }
    await setStatus('APPROVED');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Yêu cầu cấp phát</h1>
        </div>
      </div>

      <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />

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
              {dialogMode === 'edit' ? 'Sửa yêu cầu' : 'Chi tiết yêu cầu'}{' '}
              {selected ? formatBizCodeDisplay(selected.code) : ''}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <RequesterEmployeeInfo requesterId={selected.requesterId} employees={employees} />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Phòng ban (trên phiếu):</span> {getDepartmentName(selected.departmentId, departments)}</div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={allocationStatusLabels[selected.status]} /></div>
                {dialogMode === 'edit' && canEditAllocationRequestFields(selected.status) ? (
                  <div className="col-span-2 space-y-3 border rounded-md p-3 bg-muted/20">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Đối tượng được cấp:</span>{' '}
                      <span className="font-medium">{selected.assigneeSummary}</span>
                      {selected.assigneeType !== 'EMPLOYEE' && (
                        <span className="text-muted-foreground text-xs ml-2">({selected.assigneeType})</span>
                      )}
                    </p>
                    <div className="space-y-2">
                      <Label>Lý do</Label>
                      <Textarea value={editReason} onChange={e => setEditReason(e.target.value)} rows={3} disabled={busy} />
                    </div>
                    <div className="space-y-2">
                      <Label>Ghi chú / link đính kèm (text; dòng FILE:url nếu đã upload)</Label>
                      <Textarea
                        value={editAttachmentNote}
                        onChange={e => setEditAttachmentNote(e.target.value)}
                        rows={3}
                        disabled={busy}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ghi chú thêm (người nhận)</Label>
                      <Textarea
                        value={editBeneficiaryNote}
                        onChange={e => setEditBeneficiaryNote(e.target.value)}
                        rows={2}
                        disabled={busy}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" disabled={busy} onClick={() => void saveAllocationContent()}>
                        Lưu
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setDialogMode('view')}>
                        Xem (thoát sửa)
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="col-span-2"><span className="text-muted-foreground">Lý do:</span> {selected.reason}</div>
                    {selected.attachmentNote ? (
                      <div className="col-span-2">
                        <AttachmentNoteView text={selected.attachmentNote} />
                      </div>
                    ) : null}
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Đối tượng được cấp:</span>{' '}
                      <span className="font-medium">{selected.assigneeSummary}</span>
                      {selected.assigneeType !== 'EMPLOYEE' && (
                        <span className="text-muted-foreground text-xs ml-2">({selected.assigneeType})</span>
                      )}
                    </div>
                    {selected.beneficiaryNote ? (
                      <div className="col-span-2"><span className="text-muted-foreground">Ghi chú thêm:</span> {selected.beneficiaryNote}</div>
                    ) : null}
                  </>
                )}
                {selected.stockIssueCode && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Phiếu xuất kho:</span>{' '}
                    <span className="font-mono text-sm font-medium">{selected.stockIssueCode}</span>
                  </div>
                )}
              </div>

              {selected.status === 'PENDING' && (
                <div className="space-y-3 text-sm border rounded-md p-3 bg-muted/30">
                  <p className="font-medium">Chọn thiết bị tồn kho (dòng DEVICE) trước khi duyệt</p>
                  {rawLinesQ.isLoading && <p className="text-muted-foreground">Đang tải dòng yêu cầu…</p>}
                  {(rawLinesQ.data ?? []).map(line => {
                    const itemId = String(line.assetItem?.id ?? '');
                    const lineIdStr = line.assetLine?.id != null ? String(line.assetLine.id) : '';
                    const avail = equipmentsInStockForDeviceLine(line);
                    if (line.lineType !== 'DEVICE') {
                      return (
                        <div key={line.id} className="flex flex-wrap items-center gap-2 py-1">
                          <span className="text-muted-foreground">Vật tư:</span>
                          <span>{getItemName(itemId, assetItems)} × {line.quantity ?? 0}</span>
                        </div>
                      );
                    }
                    const cur = line.equipment?.id != null ? String(line.equipment.id) : '';
                    const rowLabel = lineIdStr
                      ? getAssetLineDisplay(lineIdStr, assetLinesApi)
                      : getItemName(itemId, assetItems);
                    const equipOptions = avail.map(e => ({
                      value: e.id,
                      label: `${formatEquipmentCodeDisplay(e.equipmentCode)} — ${e.serial || '—'}`,
                      searchText: `${e.equipmentCode ?? ''} ${e.serial ?? ''} ${e.itemId}`,
                    }));
                    return (
                      <div key={line.id} className="flex flex-col gap-1 py-2 border-b last:border-0">
                        <span className="text-sm font-medium">{rowLabel}</span>
                        <span className="text-xs text-muted-foreground">Chọn thiết bị tồn kho (item thuộc dòng trên)</span>
                        <SearchableSelect
                          value={cur}
                          onValueChange={v => void saveLineEquipment(line.id!, Number(v))}
                          options={equipOptions}
                          placeholder="Chọn mã TB tồn kho…"
                          searchPlaceholder="Tìm mã TB, serial…"
                          emptyText={avail.length === 0 ? 'Không có TB tồn kho cho dòng này' : 'Không khớp tìm kiếm'}
                          disabled={busy}
                          triggerClassName="max-w-md w-full"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <DataTable
                columns={[
                  {
                    key: 'item',
                    label: 'Dòng / mã tài sản',
                    render: (r: (typeof selected.lines)[0]) =>
                      r.assetLineId
                        ? getAssetLineDisplay(r.assetLineId, assetLinesApi)
                        : getItemName(r.itemId, assetItems),
                  },
                  { key: 'quantity', label: 'Số lượng', className: 'text-right' },
                  {
                    key: 'equipment',
                    label: 'TB được chọn',
                    render: (r: (typeof selected.lines)[0]) =>
                      r.equipmentId
                        ? formatEquipmentCodeDisplay(
                            equipments.find(e => e.id === r.equipmentId)?.equipmentCode ?? '',
                          )
                        : '—',
                  },
                  { key: 'notes', label: 'Ghi chú' },
                ]}
                data={selected.lines}
              />
              {selected.status === 'PENDING' && (
                <ApprovalActionBar
                  disabled={busy}
                  onApprove={() => void handleApprove()}
                  onReject={() => void setStatus('REJECTED')}
                  onCancel={() => void setStatus('CANCELLED')}
                  showCancel
                  onPrint={() => toast.info('In (theo template nội bộ)')}
                  onExport={() => toast.info('Xuất CSV từ bảng')}
                />
              )}
              {selected.status === 'APPROVED' && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button type="button" size="sm" disabled={busy} onClick={() => void setStatus('EXPORT_SLIP_CREATED')}>
                    Đã tạo phiếu xuất kho
                  </Button>
                  <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void setStatus('COMPLETED')}>
                    Hoàn thành
                  </Button>
                </div>
              )}
              {selected.status === 'EXPORT_SLIP_CREATED' && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button type="button" size="sm" disabled={busy} onClick={() => void setStatus('COMPLETED')}>
                    Hoàn thành cấp phát
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa yêu cầu cấp phát?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Hành động không hoàn tác. Mã: ${formatBizCodeDisplay(deleteTarget.code)}`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={e => {
                e.preventDefault();
                void confirmDeleteAllocation();
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

export default AllocationRequests;
