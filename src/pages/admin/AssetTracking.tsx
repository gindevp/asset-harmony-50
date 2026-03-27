import { useState } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { Timeline } from '@/components/shared/Timeline';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import {
  equipments, Equipment, equipmentStatusLabels, getItemName,
  getEmployeeName, getDepartmentName, formatDate, formatCurrency, calculateDepreciation
} from '@/data/mockData';

const AssetTracking = () => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Equipment | null>(null);

  const filtered = equipments.filter(eq => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!eq.equipmentCode.toLowerCase().includes(s) && !eq.serial.toLowerCase().includes(s)) return false;
    }
    if (filters.status && eq.status !== filters.status) return false;
    return true;
  });

  const columns: Column<Equipment>[] = [
    { key: 'equipmentCode', label: 'Mã TB', render: r => <span className="font-mono text-sm font-medium">{r.equipmentCode}</span> },
    { key: 'name', label: 'Tên', render: r => getItemName(r.itemId) },
    { key: 'serial', label: 'Serial' },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={equipmentStatusLabels[r.status]} /> },
    { key: 'assignedTo', label: 'Người dùng', render: r => r.assignedTo ? getEmployeeName(r.assignedTo) : '—' },
    { key: 'dept', label: 'Phòng ban', render: r => r.assignedDepartment ? getDepartmentName(r.assignedDepartment) : '—' },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={() => setSelected(r)}><Eye className="h-4 w-4" /></Button>
    )},
  ];

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã TB, Serial...' },
    { key: 'status', label: 'Trạng thái', type: 'select', options: Object.entries(equipmentStatusLabels).map(([v, l]) => ({ value: v, label: l })) },
  ];

  // Status summary
  const statusSummary = Object.entries(equipmentStatusLabels).map(([status, label]) => ({
    status, label, count: equipments.filter(e => e.status === status).length,
  })).filter(s => s.count > 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý trạng thái tài sản</h1>
          <p className="page-description">Theo dõi trạng thái vận hành thiết bị</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {statusSummary.map(s => (
          <div key={s.status} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
            <StatusBadge status={s.status} label={s.label} />
            <span className="font-semibold text-sm">{s.count}</span>
          </div>
        ))}
      </div>

      <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Lịch sử trạng thái – {selected?.equipmentCode}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Thiết bị:</span> {getItemName(selected.itemId)}</div>
                <div><span className="text-muted-foreground">Trạng thái hiện tại:</span> <StatusBadge status={selected.status} label={equipmentStatusLabels[selected.status]} /></div>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
                <CardContent>
                  <Timeline events={[
                    { id: '1', date: formatDate(selected.createdAt), title: 'Nhập kho', description: `Nhập kho với phiếu ${selected.stockInCode}`, status: 'IN_STOCK' },
                    ...(selected.assignedTo ? [{ id: '2', date: formatDate(selected.createdAt), title: 'Cấp phát', description: `Cấp cho ${getEmployeeName(selected.assignedTo)}`, status: 'IN_USE' }] : []),
                    ...(selected.status === 'UNDER_REPAIR' ? [{ id: '3', date: '15/03/2025', title: 'Sửa chữa', description: selected.notes || 'Đang sửa chữa', status: 'UNDER_REPAIR' }] : []),
                    ...(selected.status === 'BROKEN' ? [{ id: '3', date: '20/03/2025', title: 'Hỏng', description: selected.notes || 'Thiết bị hỏng', status: 'BROKEN' }] : []),
                  ]} />
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssetTracking;
