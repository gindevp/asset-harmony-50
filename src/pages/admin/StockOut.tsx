import { useState } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Eye } from 'lucide-react';
import {
  stockOuts, StockOut, stockOutStatusLabels, formatDate, getItemName,
  getEmployeeName, getDepartmentName, getLocationName
} from '@/data/mockData';
import { toast } from 'sonner';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';

const recipientTypeLabels: Record<string, string> = {
  EMPLOYEE: 'Nhân viên', DEPARTMENT: 'Phòng ban', LOCATION: 'Vị trí',
};

const getRecipientName = (type: string, id: string) => {
  switch (type) {
    case 'EMPLOYEE': return getEmployeeName(id);
    case 'DEPARTMENT': return getDepartmentName(id);
    case 'LOCATION': return getLocationName(id);
    default: return id;
  }
};

const StockOutPage = () => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StockOut | null>(null);

  const filtered = stockOuts.filter(so => {
    if (filters.search && !so.code.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.status && so.status !== filters.status) return false;
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<StockOut>[] = [
    { key: 'code', label: 'Mã phiếu', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'recipient', label: 'Đối tượng nhận', render: r => (
      <div>
        <span className="text-xs text-muted-foreground">{recipientTypeLabels[r.recipientType]}: </span>
        {getRecipientName(r.recipientType, r.recipientId)}
      </div>
    )},
    { key: 'request', label: 'Yêu cầu', render: r => r.requestId ? <span className="font-mono text-sm">{r.requestId}</span> : '—' },
    { key: 'lines', label: 'Số dòng', render: r => r.lines.length },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={stockOutStatusLabels[r.status]} /> },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>
        <Eye className="h-4 w-4" />
      </Button>
    )},
  ];

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã phiếu...' },
    { key: 'status', label: 'Trạng thái', type: 'select', options: Object.entries(stockOutStatusLabels).map(([v, l]) => ({ value: v, label: l })) },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Xuất kho</h1>
          <p className="page-description">Quản lý phiếu xuất kho / cấp phát</p>
        </div>
        <Button onClick={() => toast.info('Mở form tạo phiếu xuất kho (demo)')}><Plus className="h-4 w-4 mr-1" /> Tạo phiếu xuất</Button>
      </div>

      <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Chi tiết phiếu xuất {selected?.code}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Đối tượng nhận:</span> {recipientTypeLabels[selected.recipientType]} – {getRecipientName(selected.recipientType, selected.recipientId)}</div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={stockOutStatusLabels[selected.status]} /></div>
                <div><span className="text-muted-foreground">Người tạo:</span> {getEmployeeName(selected.createdBy)}</div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Ghi chú:</span> {selected.notes}</div>
              </div>
              <DataTable
                columns={[
                  { key: 'item', label: 'Tài sản', render: (r: any) => getItemName(r.itemId) },
                  { key: 'equipment', label: 'Mã TB', render: (r: any) => r.equipmentId || '—' },
                  { key: 'quantity', label: 'SL', className: 'text-right' },
                ]}
                data={selected.lines}
              />
              {selected.status === 'DRAFT' && (
                <ApprovalActionBar
                  approveLabel="Xác nhận"
                  onApprove={() => toast.success('Đã xác nhận phiếu (demo)')}
                  onCancel={() => toast.info('Đã hủy phiếu (demo)')}
                  showReject={false} showCancel={true}
                  onPrint={() => toast.info('In phiếu (demo)')}
                  onExport={() => toast.info('Xuất phiếu (demo)')}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockOutPage;
