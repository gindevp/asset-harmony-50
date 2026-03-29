import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye } from 'lucide-react';
import type { AllocationRequest } from '@/data/mockData';
import {
  allocationStatusLabels,
  getEmployeeName,
  getDepartmentName,
  getItemName,
  formatDate,
} from '@/data/mockData';
import { toast } from 'sonner';
import { formatBizCodeDisplay, formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { apiGet, apiPatch, PAGE_ALL } from '@/api/http';
import type { AllocationRequestLineDto } from '@/api/types';
import {
  mapAssetItemDto,
  useAllocationRequestsView,
  useAssetItems,
  useDepartments,
  useEmployees,
  useEnrichedEquipmentList,
} from '@/hooks/useEntityApi';

const AllocationRequests = () => {
  const qc = useQueryClient();
  const arQ = useAllocationRequestsView();
  const empQ = useEmployees();
  const depQ = useDepartments();
  const iQ = useAssetItems();
  const eqQ = useEnrichedEquipmentList();
  const allocationRequests = arQ.data ?? [];
  const employees = empQ.data ?? [];
  const departments = depQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const equipments = eqQ.data ?? [];

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AllocationRequest | null>(null);
  const [busy, setBusy] = useState(false);

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
      label: '',
      render: r => (
        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setSelected(r); }}>
          <Eye className="h-4 w-4" />
        </Button>
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
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi cập nhật');
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
          <p className="page-description">Duyệt và quản lý yêu cầu cấp phát tài sản</p>
        </div>
      </div>

      <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết yêu cầu {selected ? formatBizCodeDisplay(selected.code) : ''}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Người yêu cầu:</span> {getEmployeeName(selected.requesterId, employees)}</div>
                <div><span className="text-muted-foreground">Phòng ban:</span> {getDepartmentName(selected.departmentId, departments)}</div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={allocationStatusLabels[selected.status]} /></div>
                <div className="col-span-2"><span className="text-muted-foreground">Lý do:</span> {selected.reason}</div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Đối tượng được cấp:</span>{' '}
                  <span className="font-medium">{selected.assigneeSummary}</span>
                  {selected.assigneeType !== 'EMPLOYEE' && (
                    <span className="text-muted-foreground text-xs ml-2">({selected.assigneeType})</span>
                  )}
                </div>
                {selected.beneficiaryNote && (
                  <div className="col-span-2"><span className="text-muted-foreground">Ghi chú thêm:</span> {selected.beneficiaryNote}</div>
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
                    const avail = equipments.filter(e => e.itemId === itemId && e.status === 'IN_STOCK');
                    if (line.lineType !== 'DEVICE') {
                      return (
                        <div key={line.id} className="flex flex-wrap items-center gap-2 py-1">
                          <span className="text-muted-foreground">Vật tư:</span>
                          <span>{getItemName(itemId, assetItems)} × {line.quantity ?? 0}</span>
                        </div>
                      );
                    }
                    const cur = line.equipment?.id != null ? String(line.equipment.id) : '';
                    return (
                      <div key={line.id} className="flex flex-wrap items-center gap-2 py-1">
                        <span className="min-w-[8rem]">{getItemName(itemId, assetItems)}</span>
                        <Select
                          value={cur || undefined}
                          onValueChange={v => void saveLineEquipment(line.id!, Number(v))}
                          disabled={busy}
                        >
                          <SelectTrigger className="w-[220px] h-9">
                            <SelectValue placeholder="Chọn mã TB tồn kho" />
                          </SelectTrigger>
                          <SelectContent>
                            {avail.map(e => (
                              <SelectItem key={e.id} value={e.id}>
                                {formatEquipmentCodeDisplay(e.equipmentCode)} — {e.serial || '—'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}

              <DataTable
                columns={[
                  { key: 'item', label: 'Tài sản', render: (r: any) => getItemName(r.itemId, assetItems) },
                  { key: 'quantity', label: 'Số lượng', className: 'text-right' },
                  { key: 'equipment', label: 'TB được chọn', render: (r: any) => r.equipmentId || '—' },
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
    </div>
  );
};

export default AllocationRequests;
