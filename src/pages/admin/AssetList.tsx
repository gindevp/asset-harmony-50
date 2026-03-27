import { useState } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Timeline } from '@/components/shared/Timeline';
import { Eye, FileDown } from 'lucide-react';
import {
  equipments, Equipment, consumableStocks, assetItems, assetGroups, assetTypes,
  equipmentStatusLabels, getEmployeeName, getDepartmentName, getItemName,
  formatCurrency, formatDate, calculateDepreciation, getSupplierName
} from '@/data/mockData';

const AssetList = () => {
  const [tab, setTab] = useState('devices');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  const filteredEquipments = equipments.filter(eq => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const item = assetItems.find(i => i.id === eq.itemId);
      if (!eq.equipmentCode.toLowerCase().includes(s) && !eq.serial.toLowerCase().includes(s) && !item?.name.toLowerCase().includes(s)) return false;
    }
    if (filters.status && eq.status !== filters.status) return false;
    return true;
  });

  const deviceColumns: Column<Equipment>[] = [
    { key: 'equipmentCode', label: 'Mã TB', render: r => <span className="font-mono text-sm font-medium">{r.equipmentCode}</span> },
    { key: 'name', label: 'Tên thiết bị', render: r => getItemName(r.itemId) },
    { key: 'serial', label: 'Serial' },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={equipmentStatusLabels[r.status]} /> },
    { key: 'assignedTo', label: 'Người sử dụng', render: r => r.assignedTo ? getEmployeeName(r.assignedTo) : '—' },
    { key: 'department', label: 'Phòng ban', render: r => r.assignedDepartment ? getDepartmentName(r.assignedDepartment) : '—' },
    { key: 'originalCost', label: 'Nguyên giá', render: r => formatCurrency(r.originalCost), className: 'text-right' },
    { key: 'currentValue', label: 'GT còn lại', render: r => {
      const dep = calculateDepreciation(r.originalCost, r.salvageValue, r.depreciationMonths, r.capitalizedDate);
      return formatCurrency(dep.currentValue);
    }, className: 'text-right' },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedEquipment(r); }}>
        <Eye className="h-4 w-4" />
      </Button>
    )},
  ];

  const consumableColumns: Column<typeof consumableStocks[0]>[] = [
    { key: 'item', label: 'Mã', render: r => <span className="font-mono text-sm font-medium">{assetItems.find(i => i.id === r.itemId)?.code}</span> },
    { key: 'name', label: 'Tên vật tư', render: r => getItemName(r.itemId) },
    { key: 'total', label: 'Tổng SL', render: r => r.totalQuantity, className: 'text-right' },
    { key: 'inStock', label: 'Tồn kho', render: r => <span className="font-medium text-emerald-600">{r.inStockQuantity}</span>, className: 'text-right' },
    { key: 'issued', label: 'Đã cấp', render: r => r.issuedQuantity, className: 'text-right' },
    { key: 'returned', label: 'Đã thu hồi', render: r => r.returnedQuantity, className: 'text-right' },
    { key: 'broken', label: 'Hỏng', render: r => r.brokenQuantity, className: 'text-right' },
  ];

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã, tên, serial...' },
    { key: 'status', label: 'Trạng thái', type: 'select', options: Object.entries(equipmentStatusLabels).map(([v, l]) => ({ value: v, label: l })) },
  ];

  const dep = selectedEquipment ? calculateDepreciation(selectedEquipment.originalCost, selectedEquipment.salvageValue, selectedEquipment.depreciationMonths, selectedEquipment.capitalizedDate) : null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Danh sách tài sản</h1>
          <p className="page-description">Tra cứu và theo dõi tất cả tài sản trong hệ thống</p>
        </div>
        <Button variant="outline"><FileDown className="h-4 w-4 mr-1" /> Xuất Excel</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="devices">Thiết bị ({equipments.length})</TabsTrigger>
          <TabsTrigger value="consumables">Vật tư ({consumableStocks.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="devices" className="space-y-4 mt-4">
          <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
          <DataTable columns={deviceColumns} data={filteredEquipments} currentPage={page} onPageChange={setPage} />
        </TabsContent>
        <TabsContent value="consumables" className="mt-4">
          <DataTable columns={consumableColumns} data={consumableStocks} />
        </TabsContent>
      </Tabs>

      {/* Equipment Detail Dialog */}
      <Dialog open={!!selectedEquipment} onOpenChange={() => setSelectedEquipment(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Chi tiết thiết bị {selectedEquipment?.equipmentCode}</DialogTitle>
          </DialogHeader>
          {selectedEquipment && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Tên:</span> <span className="font-medium">{getItemName(selectedEquipment.itemId)}</span></div>
                <div><span className="text-muted-foreground">Serial:</span> <span className="font-mono">{selectedEquipment.serial}</span></div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selectedEquipment.status} label={equipmentStatusLabels[selectedEquipment.status]} /></div>
                <div><span className="text-muted-foreground">NCC:</span> {getSupplierName(selectedEquipment.supplierId)}</div>
                <div><span className="text-muted-foreground">Người dùng:</span> {selectedEquipment.assignedTo ? getEmployeeName(selectedEquipment.assignedTo) : '—'}</div>
                <div><span className="text-muted-foreground">Phòng ban:</span> {selectedEquipment.assignedDepartment ? getDepartmentName(selectedEquipment.assignedDepartment) : '—'}</div>
              </div>

              {dep && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Khấu hao đường thẳng</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><span className="text-muted-foreground block">Nguyên giá</span><span className="font-semibold">{formatCurrency(selectedEquipment.originalCost)}</span></div>
                      <div><span className="text-muted-foreground block">KH/tháng</span><span className="font-semibold">{formatCurrency(dep.monthlyDep)}</span></div>
                      <div><span className="text-muted-foreground block">KH lũy kế ({dep.effectiveElapsed}/{dep.totalMonths} tháng)</span><span className="font-semibold">{formatCurrency(dep.accumulated)}</span></div>
                      <div><span className="text-muted-foreground block">GT còn lại</span><span className="font-semibold text-primary">{formatCurrency(dep.currentValue)}</span></div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(dep.effectiveElapsed / dep.totalMonths) * 100}%` }} />
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle className="text-base">Lịch sử</CardTitle></CardHeader>
                <CardContent>
                  <Timeline events={[
                    { id: '1', date: formatDate(selectedEquipment.createdAt), title: 'Nhập kho', description: `Phiếu ${selectedEquipment.stockInCode}` },
                    ...(selectedEquipment.assignedTo ? [{ id: '2', date: formatDate(selectedEquipment.createdAt), title: 'Cấp phát', description: `Cho ${getEmployeeName(selectedEquipment.assignedTo!)}` }] : []),
                    ...(selectedEquipment.status === 'UNDER_REPAIR' ? [{ id: '3', date: '2025-03-15', title: 'Sửa chữa', description: selectedEquipment.notes, status: 'Đang sửa' }] : []),
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

export default AssetList;
