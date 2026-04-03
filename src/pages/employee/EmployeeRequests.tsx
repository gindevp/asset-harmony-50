import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AttachmentNoteView } from '@/components/shared/AttachmentNoteView';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Eye, Paperclip, Pencil, Plus } from 'lucide-react';
import type { AllocationRequest, RepairRequest, ReturnRequest } from '@/data/mockData';
import {
  allocationStatusLabels,
  getAssetLineDisplay,
  getItemName,
  repairStatusLabels,
  returnStatusLabels,
  formatDate,
} from '@/data/mockData';
import { toast } from 'sonner';
import { resolveEmployeeIdForRequests } from '@/api/account';
import {
  mapAssetItemDto,
  useAllocationRequestsView,
  useAssetItems,
  useAssetLines,
  useEnrichedEquipmentList,
  useRepairRequestsView,
  useReturnRequestsView,
} from '@/hooks/useEntityApi';
import { ApiError, apiPatch, parseProblemDetailJson } from '@/api/http';
import { formatBizCodeDisplay, formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import {
  canCancelAllocationAsEmployee,
  canCancelReturnAsEmployee,
  canEditAllocationRequestFields,
  canEditRepairRequestFields,
  canEditReturnRequestFields,
} from '@/utils/requestRecordActions';
import { cn } from '@/lib/utils';

type RequestSection = 'allocation' | 'repair' | 'return';

const EmployeeRequests = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const arQ = useAllocationRequestsView();
  const rrQ = useRepairRequestsView();
  const retQ = useReturnRequestsView();
  const eqQ = useEnrichedEquipmentList();

  const allocationRequests = arQ.data ?? [];
  const repairRequests = rrQ.data ?? [];
  const returnRequests = retQ.data ?? [];
  const equipments = eqQ.data ?? [];

  const myEmpIdStr = resolveEmployeeIdForRequests();

  const myAllocations = useMemo(
    () => (myEmpIdStr ? allocationRequests.filter(r => r.requesterId === myEmpIdStr) : []),
    [allocationRequests, myEmpIdStr],
  );
  const myRepairs = useMemo(
    () => (myEmpIdStr ? repairRequests.filter(r => r.requesterId === myEmpIdStr) : []),
    [repairRequests, myEmpIdStr],
  );
  const myReturns = useMemo(
    () => (myEmpIdStr ? returnRequests.filter(r => r.requesterId === myEmpIdStr) : []),
    [returnRequests, myEmpIdStr],
  );

  const section: RequestSection = useMemo(() => {
    const p = location.pathname;
    if (p.includes('repair-requests')) return 'repair';
    if (p.includes('return-requests')) return 'return';
    if (p.includes('allocation-requests')) return 'allocation';
    const q = (searchParams.get('section') || 'allocation').toLowerCase();
    if (q === 'repair' || q === 'return') return q;
    return 'allocation';
  }, [location.pathname, searchParams]);

  const pageTitle =
    section === 'repair' ? 'Yêu cầu sửa chữa' : section === 'return' ? 'Yêu cầu thu hồi' : 'Yêu cầu cấp phát';

  const createButtonLabel =
    section === 'repair'
      ? 'Tạo yêu cầu sửa chữa'
      : section === 'return'
        ? 'Tạo yêu cầu thu hồi'
        : 'Tạo yêu cầu cấp phát';

  const createButtonLabelShort =
    section === 'repair' ? 'Tạo sửa chữa' : section === 'return' ? 'Tạo thu hồi' : 'Tạo cấp phát';

  const isAdminRequestHub = location.pathname === '/admin/request-create';

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['api', 'allocation-requests-view'] });
    await qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });
    await qc.invalidateQueries({ queryKey: ['api', 'return-requests-view'] });
  };

  const goNew = (kind: 'allocation' | 'repair' | 'return') => {
    const base = location.pathname.startsWith('/admin') ? '/admin/request-new' : '/employee/request-new';
    navigate(`${base}?kind=${encodeURIComponent(kind)}`);
  };

  const [cancelBusy, setCancelBusy] = useState<string | null>(null);
  const iQ = useAssetItems();
  const alQ = useAssetLines();
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const assetLinesApi = alQ.data ?? [];

  type EmpDetail =
    | null
    | { section: 'allocation'; mode: 'view' | 'edit'; row: AllocationRequest }
    | { section: 'repair'; mode: 'view' | 'edit'; row: RepairRequest }
    | { section: 'return'; mode: 'view' | 'edit'; row: ReturnRequest };

  const [empDetail, setEmpDetail] = useState<EmpDetail>(null);
  const [eaReason, setEaReason] = useState('');
  const [eaAttach, setEaAttach] = useState('');
  const [eaBen, setEaBen] = useState('');
  const [erIssue, setErIssue] = useState('');
  const [erDesc, setErDesc] = useState('');
  const [erAttach, setErAttach] = useState('');
  const [etReason, setEtReason] = useState('');
  const [empBusy, setEmpBusy] = useState(false);

  useEffect(() => {
    if (!empDetail || empDetail.mode !== 'edit') return;
    if (empDetail.section === 'allocation') {
      setEaReason(empDetail.row.reason ?? '');
      setEaAttach(empDetail.row.attachmentNote ?? '');
      setEaBen(empDetail.row.beneficiaryNote ?? '');
    } else if (empDetail.section === 'repair') {
      setErIssue(empDetail.row.issue ?? '');
      setErDesc(empDetail.row.description ?? '');
      setErAttach(empDetail.row.attachmentNote ?? '');
    } else {
      setEtReason(empDetail.row.reason ?? '');
    }
  }, [empDetail]);

  const saveEmpAllocation = async () => {
    if (!empDetail || empDetail.section !== 'allocation') return;
    setEmpBusy(true);
    try {
      await apiPatch(`/api/allocation-requests/${empDetail.row.id}`, {
        id: Number(empDetail.row.id),
        reason: eaReason.trim() || undefined,
        attachmentNote: eaAttach.trim() || undefined,
        beneficiaryNote: eaBen.trim() || undefined,
      });
      toast.success('Đã lưu thay đổi');
      setEmpDetail(null);
      await invalidate();
    } catch (e) {
      const body = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(body ?? '') || (e instanceof Error ? e.message : 'Lỗi API'));
    } finally {
      setEmpBusy(false);
    }
  };

  const saveEmpRepair = async () => {
    if (!empDetail || empDetail.section !== 'repair') return;
    setEmpBusy(true);
    try {
      await apiPatch(`/api/repair-requests/${empDetail.row.id}`, {
        id: Number(empDetail.row.id),
        problemCategory: erIssue.trim().slice(0, 100),
        description: erDesc.trim() || undefined,
        attachmentNote: erAttach.trim() || undefined,
      });
      toast.success('Đã lưu thay đổi');
      setEmpDetail(null);
      await invalidate();
    } catch (e) {
      const body = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(body ?? '') || (e instanceof Error ? e.message : 'Lỗi API'));
    } finally {
      setEmpBusy(false);
    }
  };

  const saveEmpReturn = async () => {
    if (!empDetail || empDetail.section !== 'return') return;
    setEmpBusy(true);
    try {
      await apiPatch(`/api/return-requests/${empDetail.row.id}`, {
        id: Number(empDetail.row.id),
        note: etReason.trim(),
      });
      toast.success('Đã lưu thay đổi');
      setEmpDetail(null);
      await invalidate();
    } catch (e) {
      const body = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(body ?? '') || (e instanceof Error ? e.message : 'Lỗi API'));
    } finally {
      setEmpBusy(false);
    }
  };

  const cancelAllocation = async (id: string) => {
    setCancelBusy(id);
    try {
      await apiPatch(`/api/allocation-requests/${id}`, { id: Number(id), status: 'CANCELLED' });
      toast.success('Đã hủy yêu cầu');
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setCancelBusy(null);
    }
  };

  const cancelReturn = async (id: string) => {
    setCancelBusy(id);
    try {
      await apiPatch(`/api/return-requests/${id}`, { id: Number(id), status: 'CANCELLED' });
      toast.success('Đã hủy yêu cầu thu hồi');
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setCancelBusy(null);
    }
  };

  // (Form tạo yêu cầu đã chuyển sang trang /request-new)

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{pageTitle}</h1>
        </div>
        <Button type="button" onClick={() => goNew(section)}>
          <Plus className="h-4 w-4 mr-1 shrink-0" />
          <span className="hidden sm:inline">{createButtonLabel}</span>
          <span className="sm:hidden">{createButtonLabelShort}</span>
        </Button>
      </div>

      {isAdminRequestHub ? (
        <nav
          className="flex flex-wrap gap-1 mb-4 border-b border-border pb-2"
          aria-label="Loại yêu cầu"
        >
          <Link
            to="/admin/request-create?section=allocation"
            className={cn(
              'px-3 py-2 text-sm rounded-md transition-colors',
              section === 'allocation'
                ? 'bg-primary/15 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            Cấp phát ({myAllocations.length})
          </Link>
          <Link
            to="/admin/request-create?section=repair"
            className={cn(
              'px-3 py-2 text-sm rounded-md transition-colors',
              section === 'repair'
                ? 'bg-primary/15 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            Sửa chữa ({myRepairs.length})
          </Link>
          <Link
            to="/admin/request-create?section=return"
            className={cn(
              'px-3 py-2 text-sm rounded-md transition-colors',
              section === 'return'
                ? 'bg-primary/15 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            Thu hồi ({myReturns.length})
          </Link>
        </nav>
      ) : null}

      {section === 'allocation' && (
        <DataTable
          columns={[
            {
              key: 'code',
              label: 'Mã YC',
              render: (r: any) => (
                <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code)}</span>
              ),
            },
            { key: 'reason', label: 'Lý do' },
            {
              key: 'attach',
              label: 'Đính kèm',
              className: 'w-20 text-center',
              render: (r: { attachmentNote?: string }) =>
                r.attachmentNote?.trim() ? (
                  <span title="Có file/ghi chú đính kèm" className="inline-flex justify-center">
                    <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            {
              key: 'assignee',
              label: 'Đối tượng nhận',
              render: (r: any) => (
                <span className="max-w-[14rem] truncate block" title={r.assigneeSummary}>
                  {r.assigneeSummary}
                </span>
              ),
            },
            {
              key: 'benNote',
              label: 'Ghi chú',
              render: (r: any) => <span className="max-w-[8rem] truncate block">{r.beneficiaryNote || '—'}</span>,
            },
            { key: 'lines', label: 'Số dòng', render: (r: any) => r.lines.length },
            {
              key: 'status',
              label: 'Trạng thái',
              render: (r: any) => (
                <StatusBadge status={r.status} label={allocationStatusLabels[r.status] ?? r.status} />
              ),
            },
            { key: 'createdAt', label: 'Ngày tạo', render: (r: any) => formatDate(r.createdAt) },
            {
              key: 'act',
              label: 'Thao tác',
              className: 'min-w-[7.5rem]',
              render: (r: AllocationRequest) => (
                <div className="flex flex-wrap items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Xem"
                    onClick={() => setEmpDetail({ section: 'allocation', mode: 'view', row: r })}
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
                      onClick={() => setEmpDetail({ section: 'allocation', mode: 'edit', row: r })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {canCancelAllocationAsEmployee(r.status) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      disabled={cancelBusy === r.id}
                      onClick={() => void cancelAllocation(r.id)}
                    >
                      {cancelBusy === r.id ? '…' : 'Hủy'}
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
          data={myAllocations}
          emptyMessage="Bạn chưa có yêu cầu cấp phát nào"
        />
      )}

      {section === 'repair' && (
        <DataTable
          columns={[
            {
              key: 'code',
              label: 'Mã YC',
              render: (r: any) => (
                <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code)}</span>
              ),
            },
            { key: 'issue', label: 'Vấn đề' },
            {
              key: 'equipment',
              label: 'Thiết bị',
              render: (r: any) => {
                const eq = equipments.find(e => e.id === r.equipmentId);
                return eq ? formatEquipmentCodeDisplay(eq.equipmentCode) : '';
              },
            },
            {
              key: 'status',
              label: 'Trạng thái',
              render: (r: any) => <StatusBadge status={r.status} label={repairStatusLabels[r.status] ?? r.status} />,
            },
            { key: 'createdAt', label: 'Ngày tạo', render: (r: any) => formatDate(r.createdAt) },
            {
              key: 'act',
              label: 'Thao tác',
              className: 'min-w-[5rem]',
              render: (r: RepairRequest) => (
                <div className="flex flex-wrap items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Xem"
                    onClick={() => setEmpDetail({ section: 'repair', mode: 'view', row: r })}
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
                      onClick={() => setEmpDetail({ section: 'repair', mode: 'edit', row: r })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
          data={myRepairs}
          emptyMessage="Bạn chưa có yêu cầu sửa chữa nào"
        />
      )}

      {section === 'return' && (
        <DataTable
          columns={[
            {
              key: 'code',
              label: 'Mã YC',
              render: (r: any) => (
                <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code)}</span>
              ),
            },
            { key: 'reason', label: 'Lý do' },
            {
              key: 'status',
              label: 'Trạng thái',
              render: (r: any) => <StatusBadge status={r.status} label={returnStatusLabels[r.status] ?? r.status} />,
            },
            { key: 'createdAt', label: 'Ngày tạo', render: (r: any) => formatDate(r.createdAt) },
            {
              key: 'act',
              label: 'Thao tác',
              className: 'min-w-[7.5rem]',
              render: (r: ReturnRequest) => (
                <div className="flex flex-wrap items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Xem"
                    onClick={() => setEmpDetail({ section: 'return', mode: 'view', row: r })}
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
                      onClick={() => setEmpDetail({ section: 'return', mode: 'edit', row: r })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {canCancelReturnAsEmployee(r.status) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      disabled={cancelBusy === r.id}
                      onClick={() => void cancelReturn(r.id)}
                    >
                      {cancelBusy === r.id ? '…' : 'Hủy'}
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
          data={myReturns}
          emptyMessage="Bạn chưa có yêu cầu thu hồi nào"
        />
      )}

      <Dialog open={!!empDetail} onOpenChange={open => { if (!open) setEmpDetail(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {empDetail?.mode === 'edit' ? 'Sửa yêu cầu' : 'Chi tiết yêu cầu'}
              {empDetail ? ` ${formatBizCodeDisplay(empDetail.row.code)}` : ''}
            </DialogTitle>
          </DialogHeader>
          {empDetail?.section === 'allocation' && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Trạng thái:</span>{' '}
                <StatusBadge status={empDetail.row.status} label={allocationStatusLabels[empDetail.row.status] ?? empDetail.row.status} />
              </div>
              <div><span className="text-muted-foreground">Đối tượng nhận:</span> {empDetail.row.assigneeSummary}</div>
              {empDetail.mode === 'edit' && canEditAllocationRequestFields(empDetail.row.status) ? (
                <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                  <div className="space-y-2">
                    <Label>Lý do</Label>
                    <Textarea value={eaReason} onChange={e => setEaReason(e.target.value)} rows={3} disabled={empBusy} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ghi chú / đính kèm</Label>
                    <Textarea value={eaAttach} onChange={e => setEaAttach(e.target.value)} rows={2} disabled={empBusy} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ghi chú thêm</Label>
                    <Textarea value={eaBen} onChange={e => setEaBen(e.target.value)} rows={2} disabled={empBusy} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={empBusy} onClick={() => void saveEmpAllocation()}>
                      Lưu
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={empBusy} onClick={() => setEmpDetail({ ...empDetail, mode: 'view' })}>
                      Xem
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div><span className="text-muted-foreground">Lý do:</span> {empDetail.row.reason}</div>
                  {empDetail.row.attachmentNote ? <AttachmentNoteView text={empDetail.row.attachmentNote} /> : null}
                  {empDetail.row.beneficiaryNote ? (
                    <div><span className="text-muted-foreground">Ghi chú thêm:</span> {empDetail.row.beneficiaryNote}</div>
                  ) : null}
                </>
              )}
              <div className="text-muted-foreground border-t pt-2">
                <p className="font-medium text-foreground mb-1">Các dòng</p>
                <ul className="list-disc pl-4 space-y-1">
                  {empDetail.row.lines.map(line => (
                    <li key={line.id}>
                      {line.assetLineId
                        ? getAssetLineDisplay(line.assetLineId, assetLinesApi)
                        : getItemName(line.itemId, assetItems)}{' '}
                      × {line.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {empDetail?.section === 'repair' && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Trạng thái:</span>{' '}
                <StatusBadge status={empDetail.row.status} label={repairStatusLabels[empDetail.row.status] ?? empDetail.row.status} />
              </div>
              <div>
                <span className="text-muted-foreground">Thiết bị:</span>{' '}
                {formatEquipmentCodeDisplay(equipments.find(e => e.id === empDetail.row.equipmentId)?.equipmentCode ?? '')}
              </div>
              {empDetail.mode === 'edit' && canEditRepairRequestFields(empDetail.row.status) ? (
                <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                  <div className="space-y-2">
                    <Label>Vấn đề</Label>
                    <Input value={erIssue} onChange={e => setErIssue(e.target.value)} maxLength={100} disabled={empBusy} />
                  </div>
                  <div className="space-y-2">
                    <Label>Mô tả</Label>
                    <Textarea value={erDesc} onChange={e => setErDesc(e.target.value)} rows={3} disabled={empBusy} />
                  </div>
                  <div className="space-y-2">
                    <Label>Đính kèm / ghi chú</Label>
                    <Textarea value={erAttach} onChange={e => setErAttach(e.target.value)} rows={2} disabled={empBusy} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={empBusy} onClick={() => void saveEmpRepair()}>
                      Lưu
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={empBusy} onClick={() => setEmpDetail({ ...empDetail, mode: 'view' })}>
                      Xem
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div><span className="text-muted-foreground">Vấn đề:</span> {empDetail.row.issue}</div>
                  <div><span className="text-muted-foreground">Mô tả:</span> {empDetail.row.description}</div>
                  {empDetail.row.attachmentNote ? <AttachmentNoteView text={empDetail.row.attachmentNote} /> : null}
                </>
              )}
            </div>
          )}
          {empDetail?.section === 'return' && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Trạng thái:</span>{' '}
                <StatusBadge status={empDetail.row.status} label={returnStatusLabels[empDetail.row.status] ?? empDetail.row.status} />
              </div>
              {empDetail.mode === 'edit' && canEditReturnRequestFields(empDetail.row.status) ? (
                <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                  <Label>Lý do / ghi chú</Label>
                  <Textarea value={etReason} onChange={e => setEtReason(e.target.value)} rows={3} disabled={empBusy} />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={empBusy} onClick={() => void saveEmpReturn()}>
                      Lưu
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={empBusy} onClick={() => setEmpDetail({ ...empDetail, mode: 'view' })}>
                      Xem
                    </Button>
                  </div>
                </div>
              ) : (
                <div><span className="text-muted-foreground">Lý do:</span> {empDetail.row.reason}</div>
              )}
              <div className="text-muted-foreground border-t pt-2">
                <p className="font-medium text-foreground mb-1">Thiết bị thu hồi</p>
                <ul className="list-disc pl-4 space-y-1">
                  {empDetail.row.lines.map(line => (
                    <li key={line.id}>
                      {getItemName(line.itemId, assetItems)}
                      {line.equipmentId
                        ? ` — ${formatEquipmentCodeDisplay(equipments.find(e => e.id === line.equipmentId)?.equipmentCode ?? '')}`
                        : ''}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeRequests;
