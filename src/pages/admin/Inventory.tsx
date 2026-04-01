import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, X, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '@/data/mockData';
import {
  mapAssetItemDto,
  useAssetGroups,
  useAssetItems,
  useAssetLines,
  useConsumableStocksView,
  useEnrichedEquipmentList,
} from '@/hooks/useEntityApi';

interface InventoryRow {
  id: string;
  code: string;
  name: string;
  managementType: 'DEVICE' | 'CONSUMABLE';
  groupName: string;
  unit: string;
  inStock: number;
  inUse: number;
  broken: number;
  total: number;
  totalValue: number;
}

const Inventory = () => {
  const gQ = useAssetGroups();
  const lQ = useAssetLines();
  const iQ = useAssetItems();
  const eqQ = useEnrichedEquipmentList();
  const csQ = useConsumableStocksView();

  const assetTypeLabels: Record<string, string> = { DEVICE: 'Thiết bị', CONSUMABLE: 'Vật tư' };
  const assetGroups = useMemo(
    () =>
      (gQ.data ?? []).map(g => ({
        id: String(g.id),
        code: g.code ?? '',
        name: g.name ?? '',
        typeId: String(g.assetType ?? ''),
      })),
    [gQ.data],
  );
  const assetLines = useMemo(
    () =>
      (lQ.data ?? []).map(l => ({
        id: String(l.id),
        code: l.code ?? '',
        name: l.name ?? '',
        groupId: String(l.assetGroup?.id ?? ''),
      })),
    [lQ.data],
  );
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const equipments = eqQ.data ?? [];
  const consumableStocks = csQ.data ?? [];

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const inventoryData: InventoryRow[] = useMemo(() => {
    return assetItems.map(item => {
      if (item.managementType === 'DEVICE') {
        const eqs = equipments.filter(eq => eq.itemId === item.id);
        const inStock = eqs.filter(e => e.status === 'IN_STOCK').length;
        const inUse = eqs.filter(e => e.status === 'IN_USE' || e.status === 'PENDING_ISSUE').length;
        const broken = eqs.filter(e => e.status === 'BROKEN' || e.status === 'UNDER_REPAIR').length;
        const total = eqs.length;
        const totalValue = eqs.reduce((s, e) => s + e.originalCost, 0);
        const group = assetGroups.find(g => g.id === item.groupId);
        return {
          id: item.id, code: item.code, name: item.name, managementType: item.managementType,
          groupName: group?.name || '', unit: item.unit,
          inStock, inUse, broken, total, totalValue,
        };
      } else {
        const cs = consumableStocks.find(c => c.itemId === item.id);
        const group = assetGroups.find(g => g.id === item.groupId);
        return {
          id: item.id, code: item.code, name: item.name, managementType: item.managementType,
          groupName: group?.name || '', unit: item.unit,
          inStock: cs?.inStockQuantity || 0,
          inUse: cs?.issuedQuantity || 0,
          broken: cs?.brokenQuantity || 0,
          total: cs?.totalQuantity || 0,
          totalValue: 0,
        };
      }
    });
  }, [assetItems, equipments, consumableStocks, assetGroups]);

  const filtered = useMemo(() => {
    return inventoryData.filter(row => {
      if (filters.itemName) {
        const s = filters.itemName.toLowerCase();
        if (!row.name.toLowerCase().includes(s) && !row.code.toLowerCase().includes(s)) return false;
      }
      if (filters.group) {
        const item = assetItems.find(i => i.id === row.id);
        if (item?.groupId !== filters.group) return false;
      }
      if (filters.line) {
        const item = assetItems.find(i => i.id === row.id);
        if (item?.lineId !== filters.line) return false;
      }
      if (filters.managementType) {
        if (row.managementType !== filters.managementType) return false;
      }
      return true;
    });
  }, [inventoryData, filters, assetItems]);

  // Dependent filter options
  const groupOptions = useMemo(() => {
    return assetGroups;
  }, [assetGroups]);

  const lineOptions = useMemo(() => {
    if (filters.group) return assetLines.filter(l => l.groupId === filters.group);
    return assetLines;
  }, [filters.group, assetLines]);

  const resetFilters = () => { setFilters({}); setPage(1); };

  const columns: Column<InventoryRow>[] = [
    { key: 'code', label: 'Mã hàng', render: r => <span className="font-mono text-sm">{r.code}</span> },
    { key: 'name', label: 'Tên hàng', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'unit', label: 'ĐVT', className: 'text-center' },
    { key: 'inStock', label: 'SL còn trong kho', className: 'text-center', render: r => <span className="font-semibold text-green-700">{r.inStock}</span> },
    { key: 'broken', label: 'SL hỏng', className: 'text-center', render: r => <span className={r.broken > 0 ? 'font-semibold text-red-600' : ''}>{r.broken}</span> },
    { key: 'total', label: 'SL tốt', className: 'text-center', render: r => <span>{r.total - r.broken}</span> },
    { key: 'totalValue', label: 'Thành tiền', className: 'text-right', render: r => r.totalValue > 0 ? formatCurrency(r.totalValue) : '—' },
  ];

  const handleExport = () => {
    const headers = ['STT', 'Tên hàng', 'Mã hàng', 'ĐVT', 'SL còn trong kho', 'SL hỏng', 'SL tốt', 'Thành tiền'];
    const rows = filtered.map((r, i) => [
      i + 1, r.name, r.code, r.unit, r.inStock, r.broken, r.total - r.broken,
      r.totalValue > 0 ? r.totalValue : '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ton-kho.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tra cứu tồn kho</h1>
          <p className="page-description">Tra cứu số lượng tồn kho theo từng tài sản</p>
        </div>
      </div>

      {/* Filter area */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-semibold text-sm">Tra cứu tồn kho</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Hàng hóa (item name search) */}
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Hàng hóa:</label>
            <input
              placeholder="Tìm tên / mã tài sản..."
              value={filters.itemName || ''}
              onChange={e => setFilters(p => ({ ...p, itemName: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Nhóm hàng hóa */}
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Nhóm hàng hóa:</label>
            <Select value={filters.group || 'all'} onValueChange={v => setFilters(p => ({ ...p, group: v === 'all' ? '' : v, line: '' }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {groupOptions.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Loại tài sản */}
          {/* (Đã bỏ lọc Loại tài sản theo yêu cầu) */}

          {showAdvanced && (
            <>
              {/* Nhóm tài sản (same as group but hierarchical context) */}
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Nhóm tài sản:</label>
                <Select value={filters.group || 'all'} onValueChange={v => setFilters(p => ({ ...p, group: v === 'all' ? '' : v, line: '' }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    {groupOptions.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Dòng tài sản */}
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Dòng tài sản:</label>
                <Select value={filters.line || 'all'} onValueChange={v => setFilters(p => ({ ...p, line: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    {lineOptions.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Loại quản lý */}
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Phân loại:</label>
                <Select value={filters.managementType || 'all'} onValueChange={v => setFilters(p => ({ ...p, managementType: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="DEVICE">Thiết bị</SelectItem>
                    <SelectItem value="CONSUMABLE">Vật tư</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-1">
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <X className="h-4 w-4 mr-1" /> Xóa lọc
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            {showAdvanced ? 'Thu gọn tìm kiếm' : 'Mở rộng tìm kiếm'}
          </Button>
        </div>
      </div>

      {/* Export button */}
      <div className="flex justify-end">
        <Button variant="destructive" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export
        </Button>
      </div>

      {/* Data table */}
      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />
    </div>
  );
};

export default Inventory;
