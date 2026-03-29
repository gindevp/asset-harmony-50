import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, FileDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { apiPatch } from '@/api/http';
import {
  equipmentStatusLabels,
  getEmployeeName,
  getDepartmentName,
  getItemName,
  formatCurrency,
  calculateDepreciation,
} from '@/data/mockData';
import type { ConsumableStock, Equipment } from '@/data/mockData';
import {
  mapAssetItemDto,
  useAssetItems,
  useConsumableStocksView,
  useDepartments,
  useEmployees,
  useEnrichedEquipmentList,
} from '@/hooks/useEntityApi';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';

interface DeviceSummary {
  itemId: string;
  code: string;
  name: string;
  total: number;
  inStock: number;
  inUse: number;
  underRepair: number;
  broken: number;
  lost: number;
  disposed: number;
}

const AssetList = () => {
  const qc = useQueryClient();
  const iQ = useAssetItems();
  const csQ = useConsumableStocksView();
  const eqQ = useEnrichedEquipmentList();
  const empQ = useEmployees();
  const depQ = useDepartments();

  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const consumableStocks = csQ.data ?? [];
  const equipments = eqQ.data ?? [];
  const employees = empQ.data ?? [];
  const departments = depQ.data ?? [];

  const [tab, setTab] = useState('devices');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<DeviceSummary | null>(null);
  const [eqStatusBusy, setEqStatusBusy] = useState<string | null>(null);

  const changeEquipmentStatus = async (eq: Equipment, newStatus: string) => {
    if (newStatus === eq.status) return;
    if (['DISPOSED', 'LOST', 'BROKEN'].includes(newStatus)) {
      if (!window.confirm(`Xác nhận đổi trạng thái thành «${equipmentStatusLabels[newStatus]}»?`)) return;
    }
    setEqStatusBusy(eq.id);
    try {
      await apiPatch(`/api/equipment/${eq.id}`, { id: Number(eq.id), status: newStatus });
      toast.success('Đã cập nhật trạng thái thiết bị');
      void qc.invalidateQueries({ queryKey: ['api', 'equipment'] });
      void qc.invalidateQueries({ queryKey: ['api', 'equipment-assignments'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không cập nhật được trạng thái');
    } finally {
      setEqStatusBusy(null);
    }
  };

  const deviceSummaries = useMemo<DeviceSummary[]>(() => {
    const map = new Map<string, DeviceSummary>();
    for (const eq of equipments) {
      const item = assetItems.find(i => i.id === eq.itemId);
      if (!item || item.managementType !== 'DEVICE') continue;
      if (!map.has(eq.itemId)) {
        map.set(eq.itemId, {
          itemId: eq.itemId,
          code: item.code,
          name: item.name,
          total: 0,
          inStock: 0,
          inUse: 0,
          underRepair: 0,
          broken: 0,
          lost: 0,
          disposed: 0,
        });
      }
      const s = map.get(eq.itemId)!;
      s.total++;
      if (eq.status === 'IN_STOCK') s.inStock++;
      else if (eq.status === 'IN_USE' || eq.status === 'PENDING_ISSUE') s.inUse++;
      else if (eq.status === 'UNDER_REPAIR') s.underRepair++;
      else if (eq.status === 'BROKEN') s.broken++;
      else if (eq.status === 'LOST') s.lost++;
      else if (eq.status === 'DISPOSED') s.disposed++;
    }
    return Array.from(map.values());
  }, [equipments, assetItems]);

  const filteredDevices = useMemo(() => {
    return deviceSummaries.filter(d => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!d.name.toLowerCase().includes(s) && !d.code.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [deviceSummaries, filters]);

  const deviceColumns: Column<DeviceSummary>[] = [
    { key: 'code', label: 'Mã TS', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'name', label: 'Tên thiết bị' },
    { key: 'total', label: 'Tổng SL', className: 'text-right', render: r => <span className="font-medium">{r.total}</span> },
    { key: 'inStock', label: 'Tồn kho', className: 'text-right', render: r => <span className="font-medium text-emerald-600">{r.inStock}</span> },
    { key: 'inUse', label: 'Đang dùng', className: 'text-right', render: r => <span className="font-medium text-blue-600">{r.inUse}</span> },
    { key: 'underRepair', label: 'Đang sửa', className: 'text-right', render: r => <span className={r.underRepair > 0 ? 'font-medium text-orange-600' : ''}>{r.underRepair}</span> },
    { key: 'broken', label: 'Hỏng', className: 'text-right', render: r => <span className={r.broken > 0 ? 'font-medium text-destructive' : ''}>{r.broken}</span> },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedItem(r); }}>
        <Eye className="h-4 w-4" />
      </Button>
    )},
  ];

  const consumableColumns: Column<ConsumableStock>[] = [
    {
      key: 'item',
      label: 'Mã',
      render: r => <span className="font-mono text-sm font-medium">{assetItems.find(i => i.id === r.itemId)?.code}</span>,
    },
    { key: 'name', label: 'Tên vật tư', render: r => getItemName(r.itemId, assetItems) },
    { key: 'total', label: 'Tổng SL', render: r => r.totalQuantity, className: 'text-right' },
    { key: 'inStock', label: 'Tồn kho', render: r => <span className="font-medium text-emerald-600">{r.inStockQuantity}</span>, className: 'text-right' },
    { key: 'issued', label: 'Đã cấp', render: r => r.issuedQuantity, className: 'text-right' },
    { key: 'broken', label: 'Hỏng', render: r => r.brokenQuantity, className: 'text-right' },
  ];

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã, tên tài sản...' },
  ];

  // Get equipment list for selected item detail
  const selectedEquipments = selectedItem ? equipments.filter(eq => eq.itemId === selectedItem.itemId) : [];

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
          <TabsTrigger value="devices">Thiết bị ({deviceSummaries.length})</TabsTrigger>
          <TabsTrigger value="consumables">Vật tư ({consumableStocks.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="devices" className="space-y-4 mt-4">
          <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
          <DataTable columns={deviceColumns} data={filteredDevices} currentPage={page} onPageChange={setPage} />
        </TabsContent>
        <TabsContent value="consumables" className="mt-4">
          <DataTable columns={consumableColumns} data={consumableStocks} />
        </TabsContent>
      </Tabs>

      {/* Device Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết thiết bị: {selectedItem?.name}</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-lg font-bold">{selectedItem.total}</div>
                  <div className="text-xs text-muted-foreground">Tổng</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-emerald-50">
                  <div className="text-lg font-bold text-emerald-600">{selectedItem.inStock}</div>
                  <div className="text-xs text-muted-foreground">Tồn kho</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50">
                  <div className="text-lg font-bold text-blue-600">{selectedItem.inUse}</div>
                  <div className="text-xs text-muted-foreground">Đang dùng</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-orange-50">
                  <div className="text-lg font-bold text-orange-600">{selectedItem.underRepair}</div>
                  <div className="text-xs text-muted-foreground">Đang sửa</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50">
                  <div className="text-lg font-bold text-destructive">{selectedItem.broken}</div>
                  <div className="text-xs text-muted-foreground">Hỏng</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-lg font-bold">{selectedItem.lost + selectedItem.disposed}</div>
                  <div className="text-xs text-muted-foreground">Mất/Thanh lý</div>
                </div>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base">Danh sách thiết bị chi tiết</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-4 py-2 font-medium">Mã TB</th>
                          <th className="text-left px-4 py-2 font-medium">Serial</th>
                          <th className="text-left px-4 py-2 font-medium min-w-[200px]">Trạng thái</th>
                          <th className="text-left px-4 py-2 font-medium">Người dùng</th>
                          <th className="text-left px-4 py-2 font-medium">Phòng ban</th>
                          <th className="text-right px-4 py-2 font-medium">Nguyên giá</th>
                          <th className="text-right px-4 py-2 font-medium">GT còn lại</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedEquipments.map(eq => {
                          const dep = calculateDepreciation(eq.originalCost, eq.salvageValue, eq.depreciationMonths, eq.capitalizedDate);
                          return (
                            <tr key={eq.id} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-4 py-2 font-mono font-medium">
                                {formatEquipmentCodeDisplay(eq.equipmentCode)}
                              </td>
                              <td className="px-4 py-2 font-mono text-muted-foreground">{eq.serial}</td>
                              <td className="px-4 py-2">
                                <Select
                                  value={eq.status}
                                  onValueChange={v => void changeEquipmentStatus(eq, v)}
                                  disabled={eqStatusBusy === eq.id}
                                >
                                  <SelectTrigger className="h-8 max-w-[220px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(equipmentStatusLabels).map(([k, l]) => (
                                      <SelectItem key={k} value={k}>{l}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-4 py-2">{eq.assignedTo ? getEmployeeName(eq.assignedTo, employees) : '—'}</td>
                              <td className="px-4 py-2">{eq.assignedDepartment ? getDepartmentName(eq.assignedDepartment, departments) : '—'}</td>
                              <td className="px-4 py-2 text-right">{formatCurrency(eq.originalCost)}</td>
                              <td className="px-4 py-2 text-right font-medium text-primary">{formatCurrency(dep.currentValue)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
