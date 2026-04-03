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
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar } from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import type { RepairRequest } from '@/data/mockData';
import {
  repairStatusLabels,
  getEmployeeName,
  getDepartmentName,
  formatDate,
  getItemName,
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
  useEnrichedEquipmentList,
  useRepairRequestsView,
} from '@/hooks/useEntityApi';
import { ApiError, apiDelete, apiPatch, parseProblemDetailJson } from '@/api/http';
import { AttachmentNoteView } from '@/components/shared/AttachmentNoteView';
import { canDeleteRepairRequest, canEditRepairRequestFields } from '@/utils/requestRecordActions';

const outcomeLabels: Record<string, string> = {
  RETURN_USER: 'Trả lại người dùng',
  RETURN_STOCK: 'Trả về kho',
  MARK_BROKEN: 'Đánh dấu hỏng',
};

const RepairRequests = () => {
  const qc = useQueryClient();
  const rrQ = useRepairRequestsView();
  const eqQ = useEnrichedEquipmentList();
  const iQ = useAssetItems();
  const empQ = useEmployees();
  const depQ = useDepartments();

  const repairRequests = rrQ.data ?? [];
  const equipments = eqQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const employees = empQ.data ?? [];
  const departments = depQ.data ?? [];

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RepairRequest | null>(null);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit'>('view');
  const [editIssue, setEditIssue] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAttachment, setEditAttachment] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RepairRequest | null>(null);
  const [outcome, setOutcome] = useState<string>('RETURN_USER');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selected || dialogMode !== 'edit') return;
    setEditIssue(selected.issue ?? '');
    setEditDesc(selected.description ?? '');
    setEditAttachment(selected.attachmentNote ?? '');
  }, [selected?.id, dialogMode, selected?.issue, selected?.description, selected?.attachmentNote]);

  useEffect(() => {
    if (!selected) return;
    if (selected.result && outcomeLabels[selected.result]) setOutcome(selected.result);
    else setOutcome('RETURN_USER');
  }, [selected?.id, selected?.result]);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });

  const patch = async (body: Record<string, unknown>) => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiPatch(`/api/repair-requests/${selected.id}`, { id: Number(selected.id), ...body });
      toast.success('Đã cập nhật yêu cầu sửa chữa');
      setSelected(null);
      setDialogMode('view');
      invalidate();
    } catch (e) {
      const bodyErr = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(bodyErr ?? '') || (e instanceof Error ? e.message : 'Lỗi API'));
    } finally {
      setBusy(false);
    }
  };

  const saveRepairContent = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiPatch(`/api/repair-requests/${selected.id}`, {
        id: Number(selected.id),
        problemCategory: editIssue.trim().slice(0, 100),
        description: editDesc.trim() || undefined,
        attachmentNote: editAttachment.trim() || undefined,
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

  const confirmDeleteRepair = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiDelete(`/api/repair-requests/${deleteTarget.id}`);
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

  const sorted = repairRequests
    .filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const eq = equipments.find(e => e.id === r.equipmentId);
        const eqLabel = eq ? `${eq.equipmentCode} ${getItemName(eq.itemId, assetItems)}` : '';
        if (
          !r.code.toLowerCase().includes(s) &&
          !eqLabel.toLowerCase().includes(s) &&
          !getEmployeeName(r.requesterId, employees).toLowerCase().includes(s)
        ) {
          return false;
        }
      }
      if (filters.status && r.status !== filters.status) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<RepairRequest>[] = [
    {
      key: 'code',
      label: 'Mã YC',
      render: r => <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code)}</span>,
    },
    { key: 'requester', label: 'Người yêu cầu', render: r => getEmployeeName(r.requesterId, employees) },
    { key: 'department', label: 'Phòng ban', render: r => getDepartmentName(r.departmentId, departments) },
    {
      key: 'equipment',
      label: 'Thiết bị',
      render: r => {
        const eq = equipments.find(e => e.id === r.equipmentId);
        return eq
          ? `${formatEquipmentCodeDisplay(eq.equipmentCode)} - ${getItemName(eq.itemId, assetItems)}`
          : r.equipmentId;
      },
    },
    { key: 'issue', label: 'Vấn đề' },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={repairStatusLabels[r.status]} /> },
    { key: 'result', label: 'Kết quả', render: r => (r.result ? outcomeLabels[r.result] ?? r.result : '—') },
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
          {canEditRepairRequestFields(r.status) ? (
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
          {canDeleteRepairRequest(r.status) ? (
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
          <h1 className="page-title">Yêu cầu sửa chữa</h1>
        </div>
      </div>
      <FilterBar
        fields={[
          { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã YC, thiết bị, người YC...' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: Object.entries(repairStatusLabels).map(([v, l]) => ({ value: v, label: l })) },
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'edit' ? 'Sửa yêu cầu' : 'Chi tiết yêu cầu'} sửa chữa{' '}
              {selected ? formatBizCodeDisplay(selected.code) : ''}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <RequesterEmployeeInfo requesterId={selected.requesterId} employees={employees} />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Phòng ban (trên phiếu):</span> {getDepartmentName(selected.departmentId, departments)}</div>
                <div>
                  <span className="text-muted-foreground">Thiết bị:</span>{' '}
                  {(() => {
                    const eq = equipments.find(e => e.id === selected.equipmentId);
                    return eq
                      ? `${formatEquipmentCodeDisplay(eq.equipmentCode)} - ${getItemName(eq.itemId, assetItems)}`
                      : '';
                  })()}
                </div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={repairStatusLabels[selected.status]} /></div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                {selected.result && (
                  <div><span className="text-muted-foreground">Kết quả xử lý:</span> {outcomeLabels[selected.result] ?? selected.result}</div>
                )}
              </div>
              {dialogMode === 'edit' && canEditRepairRequestFields(selected.status) ? (
                <div className="space-y-3 border rounded-md p-3 bg-muted/20">
                  <div className="space-y-2">
                    <Label>Vấn đề (tối đa 100 ký tự)</Label>
                    <Input value={editIssue} onChange={e => setEditIssue(e.target.value)} maxLength={100} disabled={busy} />
                  </div>
                  <div className="space-y-2">
                    <Label>Mô tả chi tiết</Label>
                    <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} disabled={busy} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ghi chú / link đính kèm (FILE:url…)</Label>
                    <Textarea value={editAttachment} onChange={e => setEditAttachment(e.target.value)} rows={2} disabled={busy} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" disabled={busy} onClick={() => void saveRepairContent()}>
                      Lưu
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setDialogMode('view')}>
                      Xem (thoát sửa)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-md bg-muted">
                  <p className="text-sm font-medium mb-1">Vấn đề: {selected.issue}</p>
                  <p className="text-sm text-muted-foreground">{selected.description}</p>
                  {selected.attachmentNote ? (
                    <div className="mt-2">
                      <AttachmentNoteView text={selected.attachmentNote} />
                    </div>
                  ) : null}
                </div>
              )}
              {selected.status === 'NEW' && (
                <ApprovalActionBar
                  approveLabel="Tiếp nhận"
                  rejectLabel="Từ chối"
                  onApprove={() => void patch({ status: 'ACCEPTED' })}
                  onReject={() => void patch({ status: 'REJECTED' })}
                  onPrint={() => window.print()}
                  onExport={() => toast.info('Xuất (demo)')}
                />
              )}
              {(selected.status === 'ACCEPTED' || selected.status === 'IN_PROGRESS') && (
                <div className="space-y-3">
                  {selected.status === 'ACCEPTED' && (
                    <Button variant="secondary" disabled={busy} onClick={() => void patch({ status: 'IN_PROGRESS' })}>
                      Chuyển trạng thái: đang sửa
                    </Button>
                  )}
                  <div className="space-y-2">
                    <Label>Kết quả sau sửa chữa</Label>
                    <Select value={outcome} onValueChange={setOutcome} disabled={busy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(outcomeLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ApprovalActionBar
                    approveLabel="Hoàn tất"
                    showReject={false}
                    onApprove={() => void patch({ status: 'COMPLETED', repairOutcome: outcome })}
                    onPrint={() => window.print()}
                    onExport={() => toast.info('Xuất (demo)')}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa yêu cầu sửa chữa?</AlertDialogTitle>
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
                void confirmDeleteRepair();
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

export default RepairRequests;
