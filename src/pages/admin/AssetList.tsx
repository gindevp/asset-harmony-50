import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Eye, FileDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ApiError, apiPatch } from '@/api/http';
import { mapEquipmentDto } from '@/api/viewModels';
import type { EmployeeDto, EquipmentAssignmentDto } from '@/api/types';
import {
  equipmentStatusLabels,
  getEmployeeName,
  getDepartmentName,
  getLocationName,
  getItemName,
  formatCurrency,
  calculateDepreciation,
} from '@/data/mockData';
import type { AssetItem, ConsumableStock, Equipment } from '@/data/mockData';
import {
  mapAssetItemDto,
  useAssetItems,
  useConsumableStocksView,
  useDepartments,
  useEmployees,
  useEquipment,
  useEquipmentAssignments,
  useLocations,
} from '@/hooks/useEntityApi';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { pickAssignmentForEquipment } from '@/utils/equipmentJoin';

/** Khớp mục 9 tài liệu — tra cứu tài sản (thiết bị) */
interface DeviceListFilters {
  search: string;
  equipmentCode: string;
  serial: string;
  employeeId: string;
  departmentId: string;
  locationId: string;
  status: string;
}

function equipmentDisplayName(eq: Equipment, assetItems: AssetItem[]): string {
  const fromCat = getItemName(eq.itemId, assetItems);
  if (fromCat && fromCat !== eq.itemId) return fromCat;
  const fb = [eq.brandName, eq.modelName].filter(Boolean).join(' ').trim();
  return fb || '—';
}

/** Phòng ban trên phiếu gán, hoặc phòng ban mặc định của nhân viên (xuất kho theo người). */
function effectiveDepartmentId(eq: Equipment, employees: EmployeeDto[]): string | undefined {
  if (eq.assignedDepartment) return eq.assignedDepartment;
  if (!eq.assignedTo) return undefined;
  const emp = employees.find(x => String(x.id) === eq.assignedTo);
  return emp?.department?.id != null ? String(emp.department.id) : undefined;
}

/** Vị trí trên phiếu gán, hoặc vị trí nhân viên (HR). */
function effectiveLocationId(eq: Equipment, employees: EmployeeDto[]): string | undefined {
  if (eq.assignedLocation) return eq.assignedLocation;
  if (!eq.assignedTo) return undefined;
  const emp = employees.find(x => String(x.id) === eq.assignedTo);
  return emp?.location?.id != null ? String(emp.location.id) : undefined;
}

/** Ưu tiên tên từ payload phiếu gán (đã map vào Equipment), không phụ thuộc GET /employees. */
function displayEmployeeName(eq: Equipment, employees: EmployeeDto[]): string {
  const n = eq.assignedToName?.trim();
  if (n) return n;
  if (eq.assignedTo) return getEmployeeName(eq.assignedTo, employees);
  return '—';
}

function displayDepartmentName(
  eq: Equipment,
  employees: EmployeeDto[],
  departments: { id?: number; name?: string }[],
): string {
  const n = eq.assignedDepartmentName?.trim();
  if (n) return n;
  const depId = effectiveDepartmentId(eq, employees);
  return depId ? getDepartmentName(depId, departments) : '—';
}

function displayLocationName(
  eq: Equipment,
  employees: EmployeeDto[],
  locations: { id?: number; name?: string }[],
): string {
  const n = eq.assignedLocationName?.trim();
  if (n) return n;
  const locId = effectiveLocationId(eq, employees);
  return locId ? getLocationName(locId, locations) : '—';
}

/** Một dòng bảng thiết bị: model UI + phiếu gán raw từ API (hiển thị/lọc ưu tiên từ assignment). */
type DeviceTableRow = {
  /** Cho key bảng (DataTable dùng row.id) */
  id: string;
  equipment: Equipment;
  assignment?: EquipmentAssignmentDto;
};

function matchesTraCuuDeviceRow(
  row: DeviceTableRow,
  f: DeviceListFilters,
  assetItems: AssetItem[],
  employees: EmployeeDto[],
): boolean {
  const eq = row.equipment;
  const a = row.assignment;
  const item = eq.itemId ? assetItems.find(i => i.id === eq.itemId) : undefined;
  if (item != null && item.managementType !== 'DEVICE') return false;
  if (f.search) {
    const s = f.search.toLowerCase();
    const name = (item?.name ?? '').toLowerCase();
    const code = (item?.code ?? '').toLowerCase();
    const model = (eq.modelName || '').toLowerCase();
    const brand = (eq.brandName || '').toLowerCase();
    const eqCode = (eq.equipmentCode || '').toLowerCase();
    if (!name.includes(s) && !code.includes(s) && !model.includes(s) && !brand.includes(s) && !eqCode.includes(s)) {
      return false;
    }
  }
  if (f.equipmentCode) {
    const c = f.equipmentCode.toLowerCase().replace(/\s/g, '');
    const code = (eq.equipmentCode || '').toLowerCase().replace(/\s/g, '');
    if (!code.includes(c)) return false;
  }
  if (f.serial) {
    const c = f.serial.toLowerCase();
    if (!(eq.serial || '').toLowerCase().includes(c)) return false;
  }
  if (f.status && eq.status !== f.status) return false;
  if (f.employeeId) {
    const fromAssign = a?.employee?.id != null ? String(a.employee.id) : '';
    if (fromAssign !== f.employeeId && eq.assignedTo !== f.employeeId) return false;
  }
  if (f.departmentId) {
    const dA = a?.department?.id != null ? String(a.department.id) : '';
    const dEmp = a?.employee?.department?.id != null ? String(a.employee.department.id) : '';
    const dEq = effectiveDepartmentId(eq, employees) ?? '';
    if (f.departmentId !== dA && f.departmentId !== dEmp && f.departmentId !== dEq) return false;
  }
  if (f.locationId) {
    const lA = a?.location?.id != null ? String(a.location.id) : '';
    const lEmp = a?.employee?.location?.id != null ? String(a.employee.location.id) : '';
    const lEq = effectiveLocationId(eq, employees) ?? '';
    if (f.locationId !== lA && f.locationId !== lEmp && f.locationId !== lEq) return false;
  }
  return true;
}

/** Ưu tiên JSON equipment-assignments, fallback model đã map. */
function uiEmployeeName(row: DeviceTableRow, employees: EmployeeDto[]): string {
  const emp = row.assignment?.employee;
  const name = emp?.fullName?.trim();
  if (name) return name;
  const code = emp?.code?.trim();
  if (code) return code;
  return displayEmployeeName(row.equipment, employees);
}

function uiDepartmentName(row: DeviceTableRow, employees: EmployeeDto[], departments: { id?: number; name?: string }[]): string {
  const n = row.assignment?.department?.name ?? row.assignment?.employee?.department?.name;
  if (n?.trim()) return n.trim();
  return displayDepartmentName(row.equipment, employees, departments);
}

function uiLocationName(row: DeviceTableRow, employees: EmployeeDto[], locations: { id?: number; name?: string }[]): string {
  const n = row.assignment?.location?.name ?? row.assignment?.employee?.location?.name;
  if (n?.trim()) return n.trim();
  return displayLocationName(row.equipment, employees, locations);
}

const emptyDeviceFilters: DeviceListFilters = {
  search: '',
  equipmentCode: '',
  serial: '',
  employeeId: '',
  departmentId: '',
  locationId: '',
  status: '',
};

const AssetList = () => {
  const qc = useQueryClient();
  const iQ = useAssetItems();
  const csQ = useConsumableStocksView();
  const eqQ = useEquipment();
  const assignQ = useEquipmentAssignments();
  const empQ = useEmployees();
  const depQ = useDepartments();
  const locQ = useLocations();

  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const consumableStocks = csQ.data ?? [];
  const deviceRows = useMemo((): DeviceTableRow[] => {
    const dtos = eqQ.data ?? [];
    const assigns = assignQ.data ?? [];
    return dtos.map(dto => {
      const assignment = pickAssignmentForEquipment(dto, assigns);
      const equipment = mapEquipmentDto(dto, assignment);
      return { id: equipment.id, assignment, equipment };
    });
  }, [eqQ.data, assignQ.data]);
  const employees = empQ.data ?? [];
  const departments = depQ.data ?? [];
  const locations = locQ.data ?? [];

  const [tab, setTab] = useState('devices');
  const [deviceFilters, setDeviceFilters] = useState<DeviceListFilters>(emptyDeviceFilters);
  const [consumableSearch, setConsumableSearch] = useState('');
  const [page, setPage] = useState(1);
  const [consumablePage, setConsumablePage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<DeviceTableRow | null>(null);
  const [eqStatusBusy, setEqStatusBusy] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [deviceFilters]);

  useEffect(() => {
    setConsumablePage(1);
  }, [consumableSearch]);

  const filteredDeviceRows = useMemo(() => {
    const emps = employees;
    const rows = deviceRows.filter(row => matchesTraCuuDeviceRow(row, deviceFilters, assetItems, emps));
    return [...rows].sort((a, b) =>
      (a.equipment.equipmentCode || '').localeCompare(b.equipment.equipmentCode || '', undefined, { numeric: true }),
    );
  }, [deviceRows, deviceFilters, assetItems, employees]);

  const filteredConsumables = useMemo(() => {
    if (!consumableSearch.trim()) return consumableStocks;
    const s = consumableSearch.toLowerCase();
    return consumableStocks.filter(row => {
      const item = assetItems.find(i => i.id === row.itemId);
      const name = (item?.name ?? row.itemName ?? '').toLowerCase();
      const code = (item?.code ?? row.itemCode ?? '').toLowerCase();
      return name.includes(s) || code.includes(s);
    });
  }, [consumableStocks, consumableSearch, assetItems]);

  const changeEquipmentStatus = async (eq: Equipment, newStatus: string) => {
    if (newStatus === eq.status) return;
    if (['DISPOSED', 'LOST', 'BROKEN'].includes(newStatus)) {
      if (!window.confirm(`Xác nhận đổi trạng thái thành «${equipmentStatusLabels[newStatus]}»?`)) return;
    }
    setEqStatusBusy(eq.id);
    try {
      await apiPatch(`/api/equipment/${eq.id}`, { id: Number(eq.id), status: newStatus });
      toast.success('Đã cập nhật trạng thái thiết bị');
      setSelectedRow(prev =>
        prev && prev.equipment.id === eq.id
          ? { ...prev, equipment: { ...prev.equipment, status: newStatus as Equipment['status'] } }
          : prev,
      );
      void qc.invalidateQueries({ queryKey: ['api', 'equipment'] });
      void qc.invalidateQueries({ queryKey: ['api', 'equipment-assignments'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không cập nhật được trạng thái');
    } finally {
      setEqStatusBusy(null);
    }
  };

  const deviceColumns: Column<DeviceTableRow>[] = [
    {
      key: 'equipmentCode',
      label: 'Mã TB',
      render: r => (
        <span className="font-mono text-sm font-medium">{formatEquipmentCodeDisplay(r.equipment.equipmentCode)}</span>
      ),
    },
    {
      key: 'name',
      label: 'Tên thiết bị',
      render: r => <span className="font-medium">{equipmentDisplayName(r.equipment, assetItems)}</span>,
    },
    {
      key: 'serial',
      label: 'Serial',
      render: r => <span className="font-mono text-sm text-muted-foreground">{r.equipment.serial || '—'}</span>,
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: r => (
        <StatusBadge status={r.equipment.status} label={equipmentStatusLabels[r.equipment.status] ?? r.equipment.status} />
      ),
    },
    {
      key: 'user',
      label: 'Người sử dụng',
      render: r => uiEmployeeName(r, employees),
    },
    {
      key: 'dept',
      label: 'Phòng ban',
      render: r => uiDepartmentName(r, employees, departments),
    },
    {
      key: 'originalCost',
      label: 'Nguyên giá',
      className: 'text-right',
      render: r => formatCurrency(r.equipment.originalCost),
    },
    {
      key: 'remain',
      label: 'GT còn lại',
      className: 'text-right',
      render: r => {
        const dep = calculateDepreciation(
          r.equipment.originalCost,
          r.equipment.salvageValue,
          r.equipment.depreciationMonths,
          r.equipment.capitalizedDate,
        );
        return <span className="font-medium text-primary">{formatCurrency(dep.currentValue)}</span>;
      },
    },
    {
      key: 'actions',
      label: '',
      render: r => (
        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setSelectedRow(r); }}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const consumableColumns: Column<ConsumableStock>[] = [
    {
      key: 'item',
      label: 'Mã',
      render: r => (
        <span className="font-mono text-sm font-medium">
          {r.itemCode ?? assetItems.find(i => i.id === r.itemId)?.code ?? '—'}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Tên vật tư',
      render: r => r.itemName ?? (r.itemId ? getItemName(r.itemId, assetItems) : '—'),
    },
    { key: 'total', label: 'Tổng SL', render: r => r.totalQuantity, className: 'text-right' },
    { key: 'inStock', label: 'Tồn kho', render: r => <span className="font-medium text-emerald-600">{r.inStockQuantity}</span>, className: 'text-right' },
    { key: 'issued', label: 'Đã cấp', render: r => r.issuedQuantity, className: 'text-right' },
    { key: 'broken', label: 'Hỏng', render: r => r.brokenQuantity, className: 'text-right' },
  ];

  const consumableFilterFields: FilterField[] = [
    { key: 'q', label: 'Tìm theo mã/tên vật tư', type: 'text', placeholder: 'Mã hoặc tên…' },
  ];

  const exportDevicesCsv = () => {
    const headers = ['Mã TB', 'Tên thiết bị', 'Serial', 'Trạng thái', 'Người sử dụng', 'Phòng ban', 'Nguyên giá', 'GT còn lại'];
    const rows = filteredDeviceRows.map(row => {
      const eq = row.equipment;
      const dep = calculateDepreciation(eq.originalCost, eq.salvageValue, eq.depreciationMonths, eq.capitalizedDate);
      const empCell = uiEmployeeName(row, employees);
      const deptCell = uiDepartmentName(row, employees, departments);
      return [
        eq.equipmentCode,
        equipmentDisplayName(eq, assetItems),
        eq.serial ?? '',
        equipmentStatusLabels[eq.status] ?? eq.status,
        empCell === '—' ? '' : empCell,
        deptCell === '—' ? '' : deptCell,
        eq.originalCost,
        dep.currentValue,
      ];
    });
    const csv = ['\uFEFF' + headers.join(','), ...rows.map(c => c.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'danh-sach-thiet-bi-theo-loc.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã tải CSV thiết bị');
  };

  const exportConsumablesCsv = () => {
    const headers = ['Mã', 'Tên vật tư', 'Tổng SL', 'Tồn kho', 'Đã cấp', 'Hỏng'];
    const rows = filteredConsumables.map(r => {
      const item = assetItems.find(i => i.id === r.itemId);
      return [
        r.itemCode ?? item?.code ?? '',
        r.itemName ?? item?.name ?? '',
        r.totalQuantity,
        r.inStockQuantity,
        r.issuedQuantity,
        r.brokenQuantity,
      ];
    });
    const csv = ['\uFEFF' + headers.join(','), ...rows.map(c => c.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'danh-sach-vat-tu.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã tải CSV vật tư');
  };

  const handleExport = () => {
    if (tab === 'devices') exportDevicesCsv();
    else exportConsumablesCsv();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Danh sách tài sản</h1>
          <p className="page-description">
            Danh sách từng thiết bị (mã TB, serial, trạng thái, người/phòng ban sử dụng, nguyên giá, GT còn lại theo khấu hao đường thẳng).
            Tra cứu thêm theo mục 9: mã item, mã TB, serial, nhân viên, phòng ban, vị trí, trạng thái.
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <FileDown className="h-4 w-4 mr-1" /> Xuất CSV
        </Button>
      </div>

      {eqQ.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {eqQ.error instanceof ApiError && eqQ.error.status === 401
            ? 'API trả 401 — chưa đăng nhập hoặc JWT hết hạn. Mở /login (admin/admin) hoặc bật app.security.api-permit-all=true trong profile dev backend.'
            : 'Không tải được danh sách thiết bị từ API. Kiểm tra backend chạy http://127.0.0.1:8080, proxy Vite /api, và tab Network.'}
          {eqQ.error instanceof Error ? ` ${eqQ.error.message}` : ''}
        </div>
      )}
      {assignQ.isError && !eqQ.isError && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Không tải được phiếu gán thiết bị — danh sách thiết bị vẫn hiển thị nhưng cột người dùng / phòng ban / vị trí có thể trống.
        </div>
      )}
      {eqQ.isLoading && (
        <p className="text-sm text-muted-foreground">Đang tải danh sách thiết bị…</p>
      )}
      {!eqQ.isLoading &&
        !eqQ.isError &&
        tab === 'devices' &&
        deviceRows.length === 0 &&
        filteredDeviceRows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Chưa có thiết bị nào. Tạo thiết bị khi <strong className="font-medium text-foreground">xác nhận phiếu nhập kho</strong> (Nhập kho → thiết bị có serial &amp; mã EQxxxxxx).
        </p>
      )}

      <Tabs value={tab} onValueChange={v => { setTab(v); }}>
        <TabsList>
          <TabsTrigger value="devices">Thiết bị ({filteredDeviceRows.length})</TabsTrigger>
          <TabsTrigger value="consumables">Vật tư ({filteredConsumables.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="devices" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Bộ lọc tra cứu thiết bị</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Mã / tên tài sản (item)</Label>
                  <Input
                    placeholder="TSxxxxxx, tên…"
                    value={deviceFilters.search}
                    onChange={e => setDeviceFilters(p => ({ ...p, search: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Mã thiết bị (equipment_code)</Label>
                  <Input
                    placeholder="EQ000001…"
                    value={deviceFilters.equipmentCode}
                    onChange={e => setDeviceFilters(p => ({ ...p, equipmentCode: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Serial</Label>
                  <Input
                    placeholder="Số serial…"
                    value={deviceFilters.serial}
                    onChange={e => setDeviceFilters(p => ({ ...p, serial: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Trạng thái vận hành</Label>
                  <Select value={deviceFilters.status || 'all'} onValueChange={v => setDeviceFilters(p => ({ ...p, status: v === 'all' ? '' : v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả trạng thái</SelectItem>
                      {Object.entries(equipmentStatusLabels).map(([k, l]) => (
                        <SelectItem key={k} value={k}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Theo nhân viên (đang gán)</Label>
                  <Select value={deviceFilters.employeeId || 'all'} onValueChange={v => setDeviceFilters(p => ({ ...p, employeeId: v === 'all' ? '' : v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      {[...employees]
                        .sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'vi'))
                        .map(e => (
                          <SelectItem key={e.id} value={String(e.id)}>{e.fullName ?? e.code}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Theo phòng ban (đang gán)</Label>
                  <Select value={deviceFilters.departmentId || 'all'} onValueChange={v => setDeviceFilters(p => ({ ...p, departmentId: v === 'all' ? '' : v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      {[...departments]
                        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'vi'))
                        .map(d => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Theo vị trí (đang gán)</Label>
                  <Select value={deviceFilters.locationId || 'all'} onValueChange={v => setDeviceFilters(p => ({ ...p, locationId: v === 'all' ? '' : v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      {[...locations]
                        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'vi'))
                        .map(l => (
                          <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setDeviceFilters(emptyDeviceFilters); setPage(1); }}>
                Xóa bộ lọc thiết bị
              </Button>
            </CardContent>
          </Card>
          <DataTable columns={deviceColumns} data={filteredDeviceRows} currentPage={page} onPageChange={setPage} />
        </TabsContent>
        <TabsContent value="consumables" className="space-y-4 mt-4">
          <FilterBar
            fields={consumableFilterFields}
            values={{ q: consumableSearch }}
            onChange={(k, v) => { if (k === 'q') setConsumableSearch(v); }}
            onReset={() => setConsumableSearch('')}
          />
          <DataTable columns={consumableColumns} data={filteredConsumables} currentPage={consumablePage} onPageChange={setConsumablePage} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedRow} onOpenChange={() => setSelectedRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết thiết bị</DialogTitle>
          </DialogHeader>
          {selectedRow && (() => {
            const eq = selectedRow.equipment;
            const dep = calculateDepreciation(eq.originalCost, eq.salvageValue, eq.depreciationMonths, eq.capitalizedDate);
            return (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-muted-foreground">Mã TB</div>
                  <div className="font-mono font-medium">{formatEquipmentCodeDisplay(eq.equipmentCode)}</div>
                  <div className="text-muted-foreground">Tên thiết bị</div>
                  <div>{equipmentDisplayName(eq, assetItems)}</div>
                  <div className="text-muted-foreground">Serial</div>
                  <div className="font-mono">{eq.serial || '—'}</div>
                  <div className="text-muted-foreground">Trạng thái</div>
                  <div>
                    <Select
                      value={eq.status}
                      onValueChange={v => void changeEquipmentStatus(eq, v)}
                      disabled={eqStatusBusy === eq.id}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(equipmentStatusLabels).map(([k, l]) => (
                          <SelectItem key={k} value={k}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-muted-foreground">Người sử dụng</div>
                  <div>{uiEmployeeName(selectedRow, employees)}</div>
                  <div className="text-muted-foreground">Phòng ban</div>
                  <div>{uiDepartmentName(selectedRow, employees, departments)}</div>
                  <div className="text-muted-foreground">Vị trí</div>
                  <div>{uiLocationName(selectedRow, employees, locations)}</div>
                  <div className="text-muted-foreground">Nguyên giá</div>
                  <div className="text-right">{formatCurrency(eq.originalCost)}</div>
                  <div className="text-muted-foreground">GT còn lại</div>
                  <div className="text-right font-medium text-primary">{formatCurrency(dep.currentValue)}</div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssetList;
