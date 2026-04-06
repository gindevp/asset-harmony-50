import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AttachmentNoteView } from '@/components/shared/AttachmentNoteView';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterBar, type FilterField } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Eye, Paperclip, Pencil, Plus } from 'lucide-react';
import {
  allocationStatusLabels,
  formatDate,
  getAssetLineDisplay,
  getItemName,
  repairStatusLabels,
  returnStatusLabels,
  returnLineKindLabel,
  type AllocationRequest,
  type RepairRequest,
  type ReturnRequest,
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
import { ApiError, apiGet, apiPatch, parseProblemDetailJson } from '@/api/http';
import type { RepairRequestDto, RepairRequestLineDto } from '@/api/types';
import { formatBizCodeDisplay, formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import {
  repairLineAssetCatalogCode,
  repairLineDisplayName,
  repairLineQuantityDisplay,
  repairLineSerialDisplay,
} from '@/utils/repairRequestLineDisplay';
import { buildAllocationDetailRows, sumAllocationLineQuantities } from '@/utils/allocationDisplayRows';
import {
  canCancelAllocationAsEmployee,
  canCancelReturnAsEmployee,
  canEditAllocationRequestFields,
  canEditRepairRequestFields,
  canEditReturnRequestFields,
} from '@/utils/requestRecordActions';
import { cn } from '@/lib/utils';
import { LoadingIndicator, PageLoading } from '@/components/shared/page-loading';

type RequestSection = 'allocation' | 'repair' | 'return';

function matchesAllocationSearch(r: AllocationRequest, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const blob = [r.code, formatBizCodeDisplay(r.code), r.reason, r.assigneeSummary, r.beneficiaryNote]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return blob.includes(s);
}

function matchesRepairSearch(r: RepairRequest, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const blob = [r.code, formatBizCodeDisplay(r.code), r.issue, r.description, r.attachmentNote]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return blob.includes(s);
}

function matchesReturnSearch(r: ReturnRequest, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const blob = [r.code, formatBizCodeDisplay(r.code), r.reason].filter(Boolean).join(' ').toLowerCase();
  return blob.includes(s);
}

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

  const [filters, setFilters] = useState({ search: '', status: '' });
  useEffect(() => {
    setFilters({ search: '', status: '' });
  }, [section]);

  const filterFields: FilterField[] = useMemo(() => {
    const statusOpts =
      section === 'allocation'
        ? Object.entries(allocationStatusLabels).map(([value, label]) => ({ value, label }))
        : section === 'repair'
          ? Object.entries(repairStatusLabels).map(([value, label]) => ({ value, label }))
          : Object.entries(returnStatusLabels).map(([value, label]) => ({ value, label }));
    const placeholder =
      section === 'allocation'
        ? 'Mã, lý do, đối tượng nhận…'
        : section === 'repair'
          ? 'Mã, vấn đề, mô tả, đính kèm…'
          : 'Mã, ghi chú…';
    return [
      {
        key: 'search',
        label: 'Tìm kiếm',
        type: 'text',
        placeholder,
        inputClassName: 'min-w-[12rem] max-w-xl w-full sm:w-72 md:w-96',
      },
      { key: 'status', label: 'Trạng thái', type: 'select', options: statusOpts },
    ];
  }, [section]);

  const filteredAllocations = useMemo(() => {
    let list = myAllocations;
    if (filters.status) list = list.filter(r => r.status === filters.status);
    if (filters.search.trim()) list = list.filter(r => matchesAllocationSearch(r, filters.search));
    return list;
  }, [myAllocations, filters]);

  const filteredRepairs = useMemo(() => {
    let list = myRepairs;
    if (filters.status) list = list.filter(r => r.status === filters.status);
    if (filters.search.trim()) list = list.filter(r => matchesRepairSearch(r, filters.search));
    return list;
  }, [myRepairs, filters]);

  const filteredReturns = useMemo(() => {
    let list = myReturns;
    if (filters.status) list = list.filter(r => r.status === filters.status);
    if (filters.search.trim()) list = list.filter(r => matchesReturnSearch(r, filters.search));
    return list;
  }, [myReturns, filters]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['api', 'allocation-requests-view'] });
    await qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });
    await qc.invalidateQueries({ queryKey: ['api', 'repair-requests'] });
    await qc.invalidateQueries({ queryKey: ['api', 'return-requests-view'] });
  };

  const goNew = (kind: 'allocation' | 'repair' | 'return') => {
    const p = location.pathname.startsWith('/admin') ? '/admin' : '/employee';
    if (kind === 'allocation') navigate(`${p}/request-new`);
    else if (kind === 'repair') navigate(`${p}/request-new/repair`);
    else navigate(`${p}/request-new/return`);
  };

  const [cancelBusy, setCancelBusy] = useState<string | null>(null);
  const iQ = useAssetItems();
  const alQ = useAssetLines();
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const assetLinesApi = alQ.data ?? [];

  const hubLoading =
    arQ.isLoading || rrQ.isLoading || retQ.isLoading || eqQ.isLoading || iQ.isLoading || alQ.isLoading;

  type EmpDetail =
    | null
    | { section: 'allocation'; mode: 'view' | 'edit'; row: AllocationRequest }
    | { section: 'repair'; mode: 'view' | 'edit'; row: RepairRequest }
    | { section: 'return'; mode: 'view' | 'edit'; row: ReturnRequest };

  const [empDetail, setEmpDetail] = useState<EmpDetail>(null);
  const [eaReason, setEaReason] = useState('');
  const [erIssue, setErIssue] = useState('');
  const [erDesc, setErDesc] = useState('');
  const [erAttach, setErAttach] = useState('');
  const [etReason, setEtReason] = useState('');
  const [empBusy, setEmpBusy] = useState(false);

  const repairEmpDetailQ = useQuery({
    queryKey: ['api', 'repair-requests', empDetail?.section === 'repair' ? empDetail.row.id : undefined],
    queryFn: () => apiGet<RepairRequestDto>(`/api/repair-requests/${empDetail!.row.id}`),
    enabled: empDetail?.section === 'repair' && !!empDetail.row.id,
  });

  const repairEmpDetailLines = useMemo(() => {
    const raw = repairEmpDetailQ.data?.lines ?? [];
    return [...raw].sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0));
  }, [repairEmpDetailQ.data?.lines]);

  const repairEmpLineColumns: Column<RepairRequestLineDto>[] = useMemo(
    () => [
      {
        key: 'lineType',
        label: 'Loại',
        render: l =>
          String(l.lineType ?? 'DEVICE').toUpperCase() === 'CONSUMABLE' ? 'Vật tư' : 'Thiết bị',
      },
      {
        key: 'item',
        label: 'Tài sản',
        render: l => repairLineDisplayName(l, assetItems),
      },
      {
        key: 'equipmentCode',
        label: 'Mã tài sản',
        render: l => repairLineAssetCatalogCode(l, assetItems),
      },
      {
        key: 'serial',
        label: 'Serial',
        render: l => repairLineSerialDisplay(l),
      },
      {
        key: 'quantity',
        label: 'SL',
        className: 'text-right',
        render: l => repairLineQuantityDisplay(l),
      },
    ],
    [assetItems],
  );

  useEffect(() => {
    if (!empDetail || empDetail.mode !== 'edit') return;
    if (empDetail.section === 'allocation') {
      setEaReason(empDetail.row.reason ?? '');
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

      {hubLoading ? (
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
            { key: 'lines', label: 'Số lượng', render: (r: AllocationRequest) => sumAllocationLineQuantities(r.lines) },
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
          data={filteredAllocations}
          emptyMessage={
            myAllocations.length === 0
              ? 'Bạn chưa có yêu cầu cấp phát nào'
              : 'Không có yêu cầu nào khớp tìm kiếm hoặc lọc trạng thái.'
          }
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
          data={filteredRepairs}
          emptyMessage={
            myRepairs.length === 0
              ? 'Bạn chưa có yêu cầu sửa chữa nào'
              : 'Không có yêu cầu nào khớp tìm kiếm hoặc lọc trạng thái.'
          }
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
          data={filteredReturns}
          emptyMessage={
            myReturns.length === 0
              ? 'Bạn chưa có yêu cầu thu hồi nào'
              : 'Không có yêu cầu nào khớp tìm kiếm hoặc lọc trạng thái.'
          }
        />
      )}
        </>
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
              {empDetail.row.status === 'REJECTED' && empDetail.row.rejectionReason?.trim() ? (
                <div className="rounded-md border border-destructive/25 bg-destructive/5 p-3">
                  <span className="text-muted-foreground">Lý do từ chối:</span>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{empDetail.row.rejectionReason}</p>
                </div>
              ) : null}
              <div><span className="text-muted-foreground">Đối tượng nhận:</span> {empDetail.row.assigneeSummary}</div>
              {empDetail.mode === 'edit' && canEditAllocationRequestFields(empDetail.row.status) ? (
                <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                  <div className="space-y-2">
                    <Label>Lý do</Label>
                    <Textarea value={eaReason} onChange={e => setEaReason(e.target.value)} rows={3} disabled={empBusy} />
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
                  {empDetail.row.attachmentNote ? (
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Đính kèm</div>
                      <AttachmentNoteView text={empDetail.row.attachmentNote} showCaption={false} />
                    </div>
                  ) : null}
                </>
              )}
              <div className="text-muted-foreground border-t pt-2">
                <p className="font-medium text-foreground mb-1">Các dòng</p>
                <ul className="list-disc pl-4 space-y-1">
                  {buildAllocationDetailRows(empDetail.row.lines).map(row => {
                    if (row.kind === 'device_group') {
                      const label =
                        assetLinesApi.find(l => String(l.id) === row.assetLineId)?.name?.trim() ||
                        getAssetLineDisplay(row.assetLineId, assetLinesApi);
                      const qty = row.lines.reduce((s, l) => s + (l.quantity ?? 1), 0);
                      return (
                        <li key={row.id}>
                          {label} × {qty}
                        </li>
                      );
                    }
                    const line = row.line;
                    const lt = (line.lineType ?? '').toUpperCase();
                    const label =
                      lt === 'CONSUMABLE'
                        ? line.assetLineId
                          ? assetLinesApi.find(l => String(l.id) === line.assetLineId)?.name?.trim() ||
                            getAssetLineDisplay(line.assetLineId, assetLinesApi)
                          : getItemName(line.itemId, assetItems)
                        : line.assetLineId
                          ? assetLinesApi.find(l => String(l.id) === line.assetLineId)?.name?.trim() ||
                            getAssetLineDisplay(line.assetLineId, assetLinesApi)
                          : getItemName(line.itemId, assetItems);
                    return (
                      <li key={line.id}>
                        {label} × {line.quantity}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
          {empDetail?.section === 'repair' && (
            <div className="space-y-3 text-sm">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Thiết bị / vật tư</p>
                {repairEmpDetailQ.isLoading && <LoadingIndicator label="Đang tải dòng…" />}
                {repairEmpDetailQ.isError && (
                  <p className="text-sm text-muted-foreground">Không tải được chi tiết dòng — thử đóng và mở lại.</p>
                )}
                {!repairEmpDetailQ.isLoading && !repairEmpDetailQ.isError && (
                  <DataTable
                    columns={repairEmpLineColumns}
                    data={repairEmpDetailLines}
                    emptyMessage="Không có dòng"
                  />
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">Ngày tạo:</span> {formatDate(empDetail.row.createdAt)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">Trạng thái:</span>{' '}
                  <StatusBadge status={empDetail.row.status} label={repairStatusLabels[empDetail.row.status] ?? empDetail.row.status} />
                </div>
              </div>
              {empDetail.row.status === 'REJECTED' && empDetail.row.rejectionReason?.trim() ? (
                <div className="rounded-md border border-destructive/25 bg-destructive/5 p-3">
                  <span className="text-muted-foreground">Lý do từ chối:</span>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{empDetail.row.rejectionReason}</p>
                </div>
              ) : null}
              {empDetail.mode === 'edit' && canEditRepairRequestFields(empDetail.row.status) ? (
                <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                  <div className="space-y-2">
                    <Label className="font-medium">Vấn đề</Label>
                    <Input value={erIssue} onChange={e => setErIssue(e.target.value)} maxLength={100} disabled={empBusy} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">Mô tả</Label>
                    <Textarea value={erDesc} onChange={e => setErDesc(e.target.value)} rows={3} disabled={empBusy} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">Đính kèm / ghi chú</Label>
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
                <div className="p-3 rounded-md bg-muted space-y-2">
                  <p className="text-sm font-medium">Vấn đề: {empDetail.row.issue}</p>
                  {empDetail.row.description ? (
                    <p className="text-sm font-medium whitespace-pre-wrap">Mô tả: {empDetail.row.description}</p>
                  ) : null}
                  {empDetail.row.attachmentNote ? <AttachmentNoteView text={empDetail.row.attachmentNote} /> : null}
                </div>
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
                <p className="font-medium text-foreground mb-1">Thiết bị / vật tư thu hồi</p>
                <ul className="list-disc pl-4 space-y-1">
                  {empDetail.row.lines.map(line => {
                    const kind = returnLineKindLabel(line.lineType);
                    const name = getItemName(line.itemId, assetItems);
                    const eqCode =
                      line.equipmentId && equipments.find(e => e.id === line.equipmentId)?.equipmentCode;
                    const tail =
                      line.lineType === 'CONSUMABLE'
                        ? ` × ${line.quantity}`
                        : eqCode
                          ? ` — ${formatEquipmentCodeDisplay(eqCode)}`
                          : '';
                    return (
                      <li key={line.id}>
                        <span className="text-foreground font-medium">{kind}:</span> {name}
                        {tail}
                      </li>
                    );
                  })}
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
