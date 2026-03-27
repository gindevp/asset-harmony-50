import { useState } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Eye } from 'lucide-react';
import {
  stockIns, StockIn, stockInStatusLabels, stockInSourceLabels,
  formatCurrency, formatDate, getItemName, getSupplierName, getEmployeeName
} from '@/data/mockData';
import { toast } from 'sonner';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';

const StockInPage = () => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StockIn | null>(null);

  const filtered = stockIns.filter(si => {
    if (filters.search && !si.code.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.status && si.status !== filters.status) return false;
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<StockIn>[] = [
    { key: 'code', label: 'Mã phiếu', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'source', label: 'Nguồn nhập', render: r => stockInSourceLabels[r.source] },
    { key: 'supplier', label: 'NCC', render: r => r.supplierId ? getSupplierName(r.supplierId) : '—' },
    { key: 'lines', label: 'Số dòng', render: r => r.lines.length },
    { key: 'totalAmount', label: 'Tổng tiền', render: r => formatCurrency(r.totalAmount), className: 'text-right' },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={stockInStatusLabels[r.status]} /> },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>
        <Eye className="h-4 w-4" />
      </Button>
    )},
  ];

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã phiếu...' },
    { key: 'status', label: 'Trạng thái', type: 'select', options: Object.entries(stockInStatusLabels).map(([v, l]) => ({ value: v, label: l })) },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhập kho</h1>
          <p className="page-description">Quản lý phiếu nhập kho</p>
        </div>
        <Button onClick={() => toast.info('Mở form tạo phiếu nhập kho (demo)')}><Plus className="h-4 w-4 mr-1" /> Tạo phiếu nhập</Button>
      </div>

      <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Chi tiết phiếu nhập {selected?.code}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Nguồn nhập:</span> {stockInSourceLabels[selected.source]}</div>
                <div><span className="text-muted-foreground">NCC:</span> {selected.supplierId ? getSupplierName(selected.supplierId) : '—'}</div>
                <div><span className="text-muted-foreground">Người tạo:</span> {getEmployeeName(selected.createdBy)}</div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={stockInStatusLabels[selected.status]} /></div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                {selected.confirmedAt && <div><span className="text-muted-foreground">Ngày XN:</span> {formatDate(selected.confirmedAt)}</div>}
                <div className="col-span-2"><span className="text-muted-foreground">Ghi chú:</span> {selected.notes}</div>
              </div>
              <DataTable
                columns={[
                  { key: 'item', label: 'Tài sản', render: (r: any) => getItemName(r.itemId) },
                  { key: 'quantity', label: 'SL', className: 'text-right' },
                  { key: 'unitPrice', label: 'Đơn giá', render: (r: any) => formatCurrency(r.unitPrice), className: 'text-right' },
                  { key: 'totalPrice', label: 'Thành tiền', render: (r: any) => formatCurrency(r.totalPrice), className: 'text-right' },
                ]}
                data={selected.lines}
              />
              <div className="text-right font-semibold text-lg">Tổng: {formatCurrency(selected.totalAmount)}</div>
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

export default StockInPage;
