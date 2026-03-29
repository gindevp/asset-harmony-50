import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Timeline } from '@/components/shared/Timeline';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Search, X } from 'lucide-react';
import {
  equipments, Equipment, equipmentStatusLabels, getItemName,
  getEmployeeName, getDepartmentName, formatDate, assetItems,
  consumableStocks, ConsumableStock, employees, departments,
} from '@/data/mockData';

type AssetTab = 'all' | 'device' | 'consumable';

const AssetTracking = () => {
  const [tab, setTab] = useState<AssetTab>('all');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [eqPage, setEqPage] = useState(1);
  const [csPage, setCsPage] = useState(1);
  const [selected, setSelected] = useState<Equipment | null>(null);

  const resetFilters = () => setFilters({});

  // Filter equipments
  const filteredEquipments = useMemo(() => {
    return equipments.filter(eq => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const itemName = getItemName(eq.itemId).toLowerCase();
        if (!eq.equipmentCode.toLowerCase().includes(s) && !eq.serial.toLowerCase().includes(s) && !itemName.includes(s)) return false;
      }
      if (filters.status && eq.status !== filters.status) return false;
      if (filters.department && eq.assignedDepartment !== filters.department) return false;
      if (filters.employee) {
        const s = filters.employee.toLowerCase();
        if (eq.assignedTo) {
          const emp = employees.find(e => e.id === eq.assignedTo);
          if (emp && (emp.name.toLowerCase().includes(s) || emp.code.toLowerCase().includes(s))) return true;
        }
        return false;
      }
      return true;
    });
  }, [filters]);

  // Filter consumables
  const filteredConsumables = useMemo(() => {
    return consumableStocks.filter(cs => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const itemName = getItemName(cs.itemId).toLowerCase();
        if (!itemName.includes(s)) return false;
      }
      return true;
    });
  }, [filters]);

  // Status summary for equipments
  const statusSummary = Object.entries(equipmentStatusLabels).map(([status, label]) => ({
    status, label, count: equipments.filter(e => e.status === status).length,
  })).filter(s => s.count > 0);

  const eqColumns: Column<Equipment>[] = [
    { key: 'equipmentCode', label: 'Mã TB', render: r => <span className="font-mono text-sm font-medium">{r.equipmentCode}</span> },
    { key: 'name', label: 'Tên tài sản', render: r => getItemName(r.itemId) },
    { key: 'serial', label: 'Serial' },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={equipmentStatusLabels[r.status]} /> },
    { key: 'assignedTo', label: 'Người dùng', render: r => r.assignedTo ? getEmployeeName(r.assignedTo) : '—' },
    { key: 'dept', label: 'Phòng ban', render: r => r.assignedDepartment ? getDepartmentName(r.assignedDepartment) : '—' },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={() => setSelected(r)}><Eye className="h-4 w-4" /></Button>
    )},
  ];

  const csColumns: Column<ConsumableStock & { id: string }>[] = [
    { key: 'itemName', label: 'Tên vật tư', render: r => getItemName(r.itemId) },
    { key: 'itemCode', label: 'Mã tài sản', render: r => { const item = assetItems.find(i => i.id === r.itemId); return <span className="font-mono text-sm">{item?.code || ''}</span>; }},
    { key: 'totalQuantity', label: 'Tổng nhập' },
    { key: 'inStockQuantity', label: 'Tồn kho' },
    { key: 'issuedQuantity', label: 'Đã cấp phát' },
    { key: 'brokenQuantity', label: 'Hỏng' },
  ];

  const showDevices = tab === 'all' || tab === 'device';
  const showConsumables = tab === 'all' || tab === 'consumable';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý trạng thái tài sản</h1>
          <p className="page-description">Theo dõi trạng thái vận hành thiết bị và vật tư</p>
        </div>
      </div>

      {/* Status summary */}
      <div className="flex flex-wrap gap-3">
        {statusSummary.map(s => (
          <div key={s.status} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
            <StatusBadge status={s.status} label={s.label} />
            <span className="font-semibold text-sm">{s.count}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => { setTab(v as AssetTab); setEqPage(1); setCsPage(1); }}>
        <TabsList>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="device">Thiết bị</TabsTrigger>
          <TabsTrigger value="consumable">Vật tư</TabsTrigger>
        </TabsList>

        {/* Advanced filter bar */}
        <div className="filter-bar mt-4">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm tên tài sản, mã TB, serial..."
              value={filters.search || ''}
              onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
              className="pl-9 w-56 h-9"
            />
          </div>
          {showDevices && (
            <>
              <div className="relative flex-shrink-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tên/mã nhân viên..."
                  value={filters.employee || ''}
                  onChange={e => setFilters(p => ({ ...p, employee: e.target.value }))}
                  className="pl-9 w-48 h-9"
                />
              </div>
              <Select value={filters.department || 'all'} onValueChange={v => setFilters(p => ({ ...p, department: v === 'all' ? '' : v }))}>
                <SelectTrigger className="w-44 h-9 flex-shrink-0">
                  <SelectValue placeholder="Phòng ban" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả phòng ban</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.status || 'all'} onValueChange={v => setFilters(p => ({ ...p, status: v === 'all' ? '' : v }))}>
                <SelectTrigger className="w-44 h-9 flex-shrink-0">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  {Object.entries(equipmentStatusLabels).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9">
            <X className="h-4 w-4 mr-1" /> Xóa lọc
          </Button>
        </div>

        {/* Device tab content */}
        <TabsContent value="all">
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold mb-2">Thiết bị ({filteredEquipments.length})</h2>
              <DataTable columns={eqColumns} data={filteredEquipments} currentPage={eqPage} onPageChange={setEqPage} />
            </div>
            <div>
              <h2 className="text-base font-semibold mb-2">Vật tư ({filteredConsumables.length})</h2>
              <DataTable columns={csColumns} data={filteredConsumables} currentPage={csPage} onPageChange={setCsPage} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="device">
          <DataTable columns={eqColumns} data={filteredEquipments} currentPage={eqPage} onPageChange={setEqPage} />
        </TabsContent>

        <TabsContent value="consumable">
          <DataTable columns={csColumns} data={filteredConsumables} currentPage={csPage} onPageChange={setCsPage} />
        </TabsContent>
      </Tabs>

      {/* Equipment detail dialog */}
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
