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
import { Eye, Printer, Search, X } from 'lucide-react';
import type { ConsumableStock, Equipment, RepairRequest } from '@/data/mockData';
import {
  equipmentStatusLabels,
  getItemName,
  getItemCode,
  getEmployeeName,
  getDepartmentName,
  getLocationName,
  formatDate,
} from '@/data/mockData';
import {
  mapAssetItemDto,
  useAssetItems,
  useConsumableStocksView,
  useDepartments,
  useEmployees,
  useEnrichedEquipmentList,
  useEquipmentAssignments,
  useLocations,
  useRepairRequestsView,
} from '@/hooks/useEntityApi';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import type { EquipmentAssignmentDto } from '@/api/types';

type AssetTab = 'all' | 'device' | 'consumable';

const AssetTracking = () => {
  const eqQ = useEnrichedEquipmentList();
  const csQ = useConsumableStocksView();
  const iQ = useAssetItems();
  const empQ = useEmployees();
  const depQ = useDepartments();
  const locQ = useLocations();
  const asgQ = useEquipmentAssignments();
  const repQ = useRepairRequestsView();

  const equipments = eqQ.data ?? [];
  const assignmentRows: EquipmentAssignmentDto[] = asgQ.data ?? [];
  const repairRows: RepairRequest[] = repQ.data ?? [];
  const consumableStocks = csQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const employees = empQ.data ?? [];
  const departments = useMemo(
    () =>
      (depQ.data ?? []).map(d => ({
        id: String(d.id),
        name: d.name ?? '',
        code: d.code ?? '',
      })),
    [depQ.data],
  );
  const locations = useMemo(
    () => (locQ.data ?? []).map(l => ({ id: String(l.id), name: l.name ?? '', code: l.code ?? '' })),
    [locQ.data],
  );

  const [tab, setTab] = useState<AssetTab>('all');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [eqPage, setEqPage] = useState(1);
  const [csPage, setCsPage] = useState(1);
  const [eqSort, setEqSort] = useState<'code-asc' | 'code-desc' | 'name-asc' | 'name-desc'>('code-desc');
  const [selected, setSelected] = useState<Equipment | null>(null);

  const resetFilters = () => setFilters({});

  // Filter equipments
  const filteredEquipments = useMemo(() => {
    return equipments.filter(eq => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const iname = getItemName(eq.itemId, assetItems).toLowerCase();
        const codeDisp = formatEquipmentCodeDisplay(eq.equipmentCode).toLowerCase();
        const codeRaw = eq.equipmentCode.toLowerCase();
        if (
          !codeRaw.includes(s) &&
          !codeDisp.includes(s) &&
          !eq.serial.toLowerCase().includes(s) &&
          !iname.includes(s)
        ) {
          return false;
        }
      }
      if (filters.status && eq.status !== filters.status) return false;
      if (filters.department && eq.assignedDepartment !== filters.department) return false;
      if (filters.employee) {
        const s = filters.employee.toLowerCase();
        if (eq.assignedTo) {
          const emp = employees.find(e => String(e.id) === eq.assignedTo);
          if (
            emp &&
            ((emp.fullName ?? '').toLowerCase().includes(s) || (emp.code ?? '').toLowerCase().includes(s))
          ) {
            return true;
          }
        }
        return false;
      }
      return true;
    });
  }, [filters, equipments, assetItems, employees]);

  const sortedFilteredEquipments = useMemo(() => {
    const arr = [...filteredEquipments];
    arr.sort((a, b) => {
      const na = getItemName(a.itemId, assetItems);
      const nb = getItemName(b.itemId, assetItems);
      if (eqSort.startsWith('name')) {
        const c = na.localeCompare(nb, 'vi');
        return eqSort === 'name-asc' ? c : -c;
      }
      const c = a.equipmentCode.localeCompare(b.equipmentCode, 'vi', { numeric: true });
      return eqSort === 'code-asc' ? c : -c;
    });
    return arr;
  }, [filteredEquipments, eqSort, assetItems]);

  const equipmentTimeline = useMemo(() => {
    if (!selected) return [];
    const sid = Number(selected.id);
    const events: { id: string; date: string; title: string; description: string; status: string }[] = [];
    events.push({
      id: 'cap',
      date: selected.capitalizedDate || selected.createdAt,
      title: 'Ghi nhận tài sản',
      description: 'Nhập kho / khởi tạo bản ghi thiết bị',
      status: 'IN_STOCK',
    });
    const forEq = assignmentRows
      .filter(a => a.equipment?.id === sid)
      .sort((x, y) => (x.assignedDate ?? '').localeCompare(y.assignedDate ?? ''));
    for (const a of forEq) {
      const who = a.employee
        ? `${a.employee.fullName ?? ''}`.trim()
        : a.department?.name ?? a.location?.name ?? '—';
      events.push({
        id: `asg-${a.id}`,
        date: (a.assignedDate ?? '').slice(0, 10),
        title: 'Bàn giao / cấp phát',
        description: who,
        status: 'IN_USE',
      });
      if (a.returnedDate) {
        events.push({
          id: `ret-${a.id}`,
          date: a.returnedDate.slice(0, 10),
          title: 'Kết thúc bàn giao',
          description: a.note || 'Thu hồi / hoàn trả',
          status: selected.status,
        });
      }
    }
    const reps = repairRows
      .filter(r => r.equipmentId === selected.id)
      .sort((x, y) => x.createdAt.localeCompare(y.createdAt));
    for (const r of reps) {
      events.push({
        id: `rep-${r.id}`,
        date: r.createdAt,
        title: 'Yêu cầu sửa chữa',
        description: [r.issue, r.description, r.attachmentNote].filter(Boolean).join(' — ') || '—',
        status: 'UNDER_REPAIR',
      });
    }
    return events.sort((x, y) => x.date.localeCompare(y.date));
  }, [selected, assignmentRows, repairRows]);

  // Filter consumables
  const filteredConsumables = useMemo(() => {
    return consumableStocks.filter(cs => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const itemName = getItemName(cs.itemId, assetItems).toLowerCase();
        if (!itemName.includes(s)) return false;
      }
      return true;
    });
  }, [filters, consumableStocks, assetItems]);

  // Status summary for equipments
  const statusSummary = useMemo(
    () =>
      Object.entries(equipmentStatusLabels)
        .map(([status, label]) => ({
          status,
          label,
          count: equipments.filter(e => e.status === status).length,
        }))
        .filter(s => s.count > 0),
    [equipments],
  );

  const eqColumns: Column<Equipment>[] = [
    {
      key: 'equipmentCode',
      label: 'Mã TB',
      render: r => (
        <span className="font-mono text-sm font-medium">{formatEquipmentCodeDisplay(r.equipmentCode)}</span>
      ),
    },
    {
      key: 'itemCode',
      label: 'Mã TS',
      render: r => <span className="font-mono text-xs text-muted-foreground">{getItemCode(r.itemId, assetItems) || '—'}</span>,
    },
    { key: 'name', label: 'Tên tài sản', render: r => getItemName(r.itemId, assetItems) },
    { key: 'serial', label: 'Serial' },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={equipmentStatusLabels[r.status]} /> },
    { key: 'assignedTo', label: 'Người dùng', render: r => r.assignedTo ? getEmployeeName(r.assignedTo, employees) : '—' },
    { key: 'dept', label: 'Phòng ban', render: r => r.assignedDepartment ? getDepartmentName(r.assignedDepartment, departments) : '—' },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={() => setSelected(r)}><Eye className="h-4 w-4" /></Button>
    )},
  ];

  const csColumns: Column<ConsumableStock & { id: string }>[] = [
    { key: 'itemName', label: 'Tên vật tư', render: r => getItemName(r.itemId, assetItems) },
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
      <div className="page-header print:hidden">
        <div>
          <h1 className="page-title">Quản lý trạng thái tài sản</h1>
          <p className="page-description">Theo dõi trạng thái vận hành thiết bị và vật tư</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> In trang
        </Button>
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
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.location || 'all'} onValueChange={v => setFilters(p => ({ ...p, location: v === 'all' ? '' : v }))}>
                <SelectTrigger className="w-44 h-9 flex-shrink-0">
                  <SelectValue placeholder="Vị trí" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả vị trí</SelectItem>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={eqSort} onValueChange={v => setEqSort(v as typeof eqSort)}>
                <SelectTrigger className="w-48 h-9 flex-shrink-0">
                  <SelectValue placeholder="Sắp xếp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="code-asc">Mã TB A→Z</SelectItem>
                  <SelectItem value="code-desc">Mã TB Z→A</SelectItem>
                  <SelectItem value="name-asc">Tên A→Z</SelectItem>
                  <SelectItem value="name-desc">Tên Z→A</SelectItem>
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
              <DataTable columns={eqColumns} data={sortedFilteredEquipments} currentPage={eqPage} onPageChange={setEqPage} />
            </div>
            <div>
              <h2 className="text-base font-semibold mb-2">Vật tư ({filteredConsumables.length})</h2>
              <DataTable columns={csColumns} data={filteredConsumables} currentPage={csPage} onPageChange={setCsPage} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="device">
          <DataTable columns={eqColumns} data={sortedFilteredEquipments} currentPage={eqPage} onPageChange={setEqPage} />
        </TabsContent>

        <TabsContent value="consumable">
          <DataTable columns={csColumns} data={filteredConsumables} currentPage={csPage} onPageChange={setCsPage} />
        </TabsContent>
      </Tabs>

      {/* Equipment detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lịch sử trạng thái – {selected ? formatEquipmentCodeDisplay(selected.equipmentCode) : ''}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Thiết bị:</span> {getItemName(selected.itemId, assetItems)}</div>
                <div><span className="text-muted-foreground">Trạng thái hiện tại:</span> <StatusBadge status={selected.status} label={equipmentStatusLabels[selected.status]} /></div>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
                <CardContent>
                  <Timeline
                    events={equipmentTimeline.map(ev => ({
                      ...ev,
                      date: formatDate(ev.date),
                    }))}
                  />
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
