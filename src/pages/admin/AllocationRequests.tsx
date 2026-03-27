import { useState } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Eye } from 'lucide-react';
import {
  allocationRequests, AllocationRequest, allocationStatusLabels,
  getEmployeeName, getDepartmentName, getItemName, formatDate
} from '@/data/mockData';
import { toast } from 'sonner';

const AllocationRequests = () => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AllocationRequest | null>(null);

  const filtered = allocationRequests.filter(r => {
    if (filters.search && !r.code.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.status && r.status !== filters.status) return false;
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<AllocationRequest>[] = [
    { key: 'code', label: 'Mã YC', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'requester', label: 'Người yêu cầu', render: r => getEmployeeName(r.requesterId) },
    { key: 'department', label: 'Phòng ban', render: r => getDepartmentName(r.departmentId) },
    { key: 'reason', label: 'Lý do', render: r => <span className="max-w-xs truncate block">{r.reason}</span> },
    { key: 'lines', label: 'Số dòng', render: r => r.lines.length },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={allocationStatusLabels[r.status]} /> },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>
        <Eye className="h-4 w-4" />
      </Button>
    )},
  ];

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã yêu cầu...' },
    { key: 'status', label: 'Trạng thái', type: 'select', options: Object.entries(allocationStatusLabels).map(([v, l]) => ({ value: v, label: l })) },
  ];

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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Chi tiết yêu cầu {selected?.code}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Người yêu cầu:</span> {getEmployeeName(selected.requesterId)}</div>
                <div><span className="text-muted-foreground">Phòng ban:</span> {getDepartmentName(selected.departmentId)}</div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={allocationStatusLabels[selected.status]} /></div>
                <div className="col-span-2"><span className="text-muted-foreground">Lý do:</span> {selected.reason}</div>
                {selected.rejectionReason && (
                  <div className="col-span-2 p-3 rounded-md bg-red-50 border border-red-200 text-sm">
                    <span className="font-medium text-red-800">Lý do từ chối:</span> {selected.rejectionReason}
                  </div>
                )}
              </div>
              <DataTable
                columns={[
                  { key: 'item', label: 'Tài sản', render: (r: any) => getItemName(r.itemId) },
                  { key: 'quantity', label: 'Số lượng', className: 'text-right' },
                  { key: 'equipment', label: 'TB được chọn', render: (r: any) => r.equipmentId || '—' },
                  { key: 'notes', label: 'Ghi chú' },
                ]}
                data={selected.lines}
              />
              {selected.status === 'CHO_DUYET' && (
                <ApprovalActionBar
                  onApprove={() => toast.success('Đã duyệt yêu cầu (demo)')}
                  onReject={() => toast.info('Đã từ chối yêu cầu (demo)')}
                  onPrint={() => toast.info('In (demo)')}
                  onExport={() => toast.info('Xuất (demo)')}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AllocationRequests;
