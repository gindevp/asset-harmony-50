import { useState } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar } from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye } from 'lucide-react';
import {
  returnRequests, ReturnRequest, returnStatusLabels,
  getEmployeeName, getDepartmentName, getItemName, formatDate
} from '@/data/mockData';
import { toast } from 'sonner';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';

const ReturnRequests = () => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReturnRequest | null>(null);

  const sorted = returnRequests.filter(r => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!r.code.toLowerCase().includes(s) && !getEmployeeName(r.requesterId).toLowerCase().includes(s)) return false;
    }
    if (filters.status && r.status !== filters.status) return false;
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<ReturnRequest>[] = [
    { key: 'code', label: 'Mã YC', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'requester', label: 'Người yêu cầu', render: r => getEmployeeName(r.requesterId) },
    { key: 'department', label: 'Phòng ban', render: r => getDepartmentName(r.departmentId) },
    { key: 'reason', label: 'Lý do', render: r => <span className="max-w-xs truncate block">{r.reason}</span> },
    { key: 'lines', label: 'Số dòng', render: r => r.lines.length },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={returnStatusLabels[r.status]} /> },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>
        <Eye className="h-4 w-4" />
      </Button>
    )},
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Yêu cầu thu hồi</h1>
          <p className="page-description">Duyệt và xử lý yêu cầu thu hồi tài sản</p>
        </div>
      </div>
      <DataTable columns={columns} data={sorted} currentPage={page} onPageChange={setPage} />

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Chi tiết yêu cầu thu hồi {selected?.code}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Người yêu cầu:</span> {getEmployeeName(selected.requesterId)}</div>
                <div><span className="text-muted-foreground">Phòng ban:</span> {getDepartmentName(selected.departmentId)}</div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={returnStatusLabels[selected.status]} /></div>
                <div className="col-span-2"><span className="text-muted-foreground">Lý do:</span> {selected.reason}</div>
              </div>
              <DataTable
                columns={[
                  { key: 'item', label: 'Tài sản', render: (r: any) => getItemName(r.itemId) },
                  { key: 'equipment', label: 'Mã TB', render: (r: any) => r.equipmentId || '—' },
                  { key: 'quantity', label: 'SL thu hồi', className: 'text-right' },
                  { key: 'notes', label: 'Ghi chú' },
                ]}
                data={selected.lines}
              />
              {selected.status === 'CHO_DUYET' && (
                <ApprovalActionBar
                  onApprove={() => toast.success('Đã duyệt (demo)')}
                  onReject={() => toast.info('Đã từ chối (demo)')}
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

export default ReturnRequests;
