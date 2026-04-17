import { useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import type { ConsumableAssignmentDto } from '@/api/types';
import type { Equipment } from '@/data/mockData';
import { equipmentStatusLabels, getItemCode, getItemName } from '@/data/mockData';
import {
  mapAssetItemDto,
  useAssetItems,
  useConsumableAssignments,
  useDepartments,
  useEmployees,
  useEnrichedEquipmentList,
  useLocations,
} from '@/hooks/useEntityApi';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { consumableQuantityHeld } from '@/utils/myEquipment';

type LookupType = 'department' | 'location' | 'employeeCode';
type SearchPayload = { type: LookupType; keyword: string };

type ConsumableHoldingRow = {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  holderType: 'Nhân viên' | 'Phòng ban';
  holderName: string;
  quantityHeld: number;
  assignedDate: string;
};

const ASSIGNMENT_NOTE_DEPARTMENT_POOL = 'scoped=DEPT';
const ASSIGNMENT_NOTE_LOCATION_POOL = 'scoped=LOC';
const ASSIGNMENT_NOTE_COMPANY_VI = 'đối tượng: công ty';
const ASSIGNMENT_NOTE_COMPANY_ASCII = 'doi tuong: cong ty';

/**
 * Tài sản «của phòng ban»: gán cho phòng ban (pool / không cấp cá nhân),
 * không gồm thiết bị chỉ gán cho nhân viên trong khi PB chỉ lấy từ hồ sơ NV.
 */
function isDepartmentScopedEquipment(e: Equipment): boolean {
  if (!e.assignedDepartment) return false;
  if (e.departmentPoolFromAllocation) return true;
  const noPersonalHolder = !e.assignedTo || String(e.assignedTo).trim() === '';
  return noPersonalHolder;
}

/**
 * Vật tư «của phòng ban»: chấp nhận cả ca department pool có employee nhận hộ
 * (BE ghi note scoped=DEPT), không chỉ ca employee = null.
 */
function consumableDepartmentScope(
  a: ConsumableAssignmentDto,
): { id: string; code: string; name: string } | null {
  const note = typeof a.note === 'string' ? a.note : '';
  const dept = a.department ?? a.employee?.department;
  if (!dept?.id) return null;
  const noPersonalHolder = a.employee?.id == null;
  const departmentPool = note.includes(ASSIGNMENT_NOTE_DEPARTMENT_POOL);
  if (!departmentPool && !noPersonalHolder) return null;
  return {
    id: String(dept.id),
    code: dept.code ?? '',
    name: dept.name ?? '',
  };
}

function hasCompanyLocationHint(note: string): boolean {
  const n = note.toLowerCase();
  return n.includes(ASSIGNMENT_NOTE_LOCATION_POOL.toLowerCase()) || n.includes(ASSIGNMENT_NOTE_COMPANY_VI) || n.includes(ASSIGNMENT_NOTE_COMPANY_ASCII);
}

function consumableLocationScope(
  a: ConsumableAssignmentDto,
): { id: string; code: string; name: string } | null {
  const note = typeof a.note === 'string' ? a.note : '';
  const loc = a.location ?? a.employee?.location;
  if (!loc?.id) return null;
  const noPersonalHolder = a.employee?.id == null && a.department?.id == null;
  const locationPool = note.includes(ASSIGNMENT_NOTE_LOCATION_POOL) || hasCompanyLocationHint(note);
  if (!locationPool && !noPersonalHolder) return null;
  return {
    id: String(loc.id),
    code: loc.code ?? '',
    name: loc.name ?? '',
  };
}

const AssetTracking = () => {
  const eqQ = useEnrichedEquipmentList();
  const caQ = useConsumableAssignments();
  const iQ = useAssetItems();
  const empQ = useEmployees();
  const depQ = useDepartments();
  const locQ = useLocations();

  const equipments = eqQ.data ?? [];
  const consumableAssignments = caQ.data ?? [];
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
    () =>
      (locQ.data ?? []).map(l => ({
        id: String(l.id),
        name: l.name ?? '',
        code: l.code ?? '',
      })),
    [locQ.data],
  );
  const [lookupType, setLookupType] = useState<LookupType>('department');
  const [keywordInput, setKeywordInput] = useState('');
  const [searchPayload, setSearchPayload] = useState<SearchPayload | null>(null);
  const [eqPage, setEqPage] = useState(1);
  const [csPage, setCsPage] = useState(1);

  const employeesById = useMemo(() => {
    const m = new Map<string, { code: string; fullName: string }>();
    for (const e of employees) {
      m.set(String(e.id), { code: e.code ?? '', fullName: e.fullName ?? '' });
    }
    return m;
  }, [employees]);
  const departmentsById = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);
  const locationsById = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);

  const hasSearched = !!searchPayload;
  const normalizedKeyword = (searchPayload?.keyword ?? '').trim().toLowerCase();

  /** Phòng ban khớp từ khóa (mã / tên) — dùng khi tra cứu theo phòng ban */
  const matchingDepartmentIds = useMemo(() => {
    if (!searchPayload || searchPayload.type !== 'department' || !normalizedKeyword) return new Set<string>();
    const ids = new Set<string>();
    for (const d of departments) {
      const code = (d.code ?? '').toLowerCase();
      const name = (d.name ?? '').toLowerCase();
      if (code.includes(normalizedKeyword) || name.includes(normalizedKeyword)) ids.add(d.id);
    }
    return ids;
  }, [departments, normalizedKeyword, searchPayload]);

  const matchingLocationIds = useMemo(() => {
    if (!searchPayload || searchPayload.type !== 'location' || !normalizedKeyword) return new Set<string>();
    const ids = new Set<string>();
    for (const l of locations) {
      const code = (l.code ?? '').toLowerCase();
      const name = (l.name ?? '').toLowerCase();
      if (code.includes(normalizedKeyword) || name.includes(normalizedKeyword)) ids.add(l.id);
    }
    return ids;
  }, [locations, normalizedKeyword, searchPayload]);

  const isEquipmentHolding = (e: Equipment) => {
    if (e.status === 'IN_STOCK' || e.status === 'LOST' || e.status === 'DISPOSED') return false;
    return Boolean(e.assignedTo || e.assignedDepartment || e.assignedLocation);
  };

  const matchEquipment = (e: Equipment) => {
    if (!searchPayload) return false;
    if (!isEquipmentHolding(e)) return false;
    if (searchPayload.type === 'employeeCode') {
      const emp = e.assignedTo ? employeesById.get(e.assignedTo) : undefined;
      return (emp?.code ?? '').toLowerCase().includes(normalizedKeyword);
    }
    if (searchPayload.type === 'department') {
      // Cho phép tra theo phòng ban cả tài sản pool của phòng ban lẫn tài sản cá nhân thuộc phòng ban đó.
      const depId = e.assignedDepartment ?? (e.assignedTo ? (() => {
        const emp = employees.find(x => String(x.id) === e.assignedTo);
        return emp?.department?.id != null ? String(emp.department.id) : undefined;
      })() : undefined);
      if (!depId) return false;
      const dep = departmentsById.get(depId);
      const text = `${dep?.code ?? ''} ${dep?.name ?? ''} ${e.assignedDepartmentName ?? ''}`.toLowerCase();
      if (matchingDepartmentIds.size > 0) {
        return matchingDepartmentIds.has(depId);
      }
      return text.includes(normalizedKeyword);
    }
    if (searchPayload.type === 'location') {
      const locId = e.assignedLocation;
      if (!locId) return false;
      // Tài sản công ty theo vị trí: cấp phát vị trí/pool vị trí hoặc không gán người+phòng ban.
      const isCompanyAtLocation = Boolean(
        e.locationAssignedDirectly || e.locationPoolFromAllocation || (!e.assignedTo && !e.assignedDepartment),
      );
      if (!isCompanyAtLocation) return false;
      const loc = locationsById.get(locId);
      const text = `${loc?.code ?? ''} ${loc?.name ?? ''} ${e.assignedLocationName ?? ''}`.toLowerCase();
      if (matchingLocationIds.size > 0) {
        return matchingLocationIds.has(locId);
      }
      return text.includes(normalizedKeyword);
    }
    return false;
  };

  const filteredEquipments = useMemo(
    () =>
      equipments
        .filter(matchEquipment)
        .sort((a, b) => a.equipmentCode.localeCompare(b.equipmentCode, 'vi', { numeric: true })),
    [equipments, searchPayload, normalizedKeyword, employeesById, departmentsById, matchingDepartmentIds],
  );

  const filteredConsumables = useMemo(() => {
    if (!searchPayload) return [];
    const rows: ConsumableHoldingRow[] = [];
    for (const a of consumableAssignments) {
      const held = consumableQuantityHeld(a);
      if (held <= 0) continue;
      if (searchPayload.type === 'employeeCode') {
        const code = (a.employee?.code ?? '').toLowerCase();
        if (!code.includes(normalizedKeyword)) continue;
        rows.push({
          id: String(a.id ?? ''),
          itemId: String(a.assetItem?.id ?? ''),
          itemCode: a.assetItem?.code ?? '',
          itemName: a.assetItem?.name ?? '',
          holderType: 'Nhân viên',
          holderName: [a.employee?.code, a.employee?.fullName].filter(Boolean).join(' - ') || '—',
          quantityHeld: held,
          assignedDate: a.assignedDate ?? '',
        });
        continue;
      }
      if (searchPayload.type === 'department') {
        const deptPool = consumableDepartmentScope(a);
        const deptFromEmployee =
          a.employee?.department?.id != null
            ? {
                id: String(a.employee.department.id),
                code: a.employee.department.code ?? '',
                name: a.employee.department.name ?? '',
              }
            : null;
        const dept = deptPool ?? deptFromEmployee;
        if (!dept) continue;
        const idStr = dept.id;
        if (matchingDepartmentIds.size > 0) {
          if (!matchingDepartmentIds.has(idStr)) continue;
        } else {
          const text = `${dept.code ?? ''} ${dept.name ?? ''}`.toLowerCase();
          if (!text.includes(normalizedKeyword)) continue;
        }
        rows.push({
          id: String(a.id ?? ''),
          itemId: String(a.assetItem?.id ?? ''),
          itemCode: a.assetItem?.code ?? '',
          itemName: a.assetItem?.name ?? '',
          holderType: 'Phòng ban',
          holderName: [dept.code, dept.name].filter(Boolean).join(' - ') || '—',
          quantityHeld: held,
          assignedDate: a.assignedDate ?? '',
        });
        continue;
      }
      if (searchPayload.type === 'location') {
        const loc = consumableLocationScope(a);
        if (!loc) continue;
        const idStr = loc.id;
        if (matchingLocationIds.size > 0) {
          if (!matchingLocationIds.has(idStr)) continue;
        } else {
          const text = `${loc.code ?? ''} ${loc.name ?? ''}`.toLowerCase();
          if (!text.includes(normalizedKeyword)) continue;
        }
        rows.push({
          id: String(a.id ?? ''),
          itemId: String(a.assetItem?.id ?? ''),
          itemCode: a.assetItem?.code ?? '',
          itemName: a.assetItem?.name ?? '',
          holderType: 'Phòng ban',
          holderName: [loc.code, loc.name].filter(Boolean).join(' - ') || '—',
          quantityHeld: held,
          assignedDate: a.assignedDate ?? '',
        });
        continue;
      }
    }
    return rows.sort((a, b) => a.itemCode.localeCompare(b.itemCode, 'vi'));
  }, [consumableAssignments, normalizedKeyword, searchPayload, matchingDepartmentIds, matchingLocationIds]);

  const locationCompanyAssetCounts = useMemo(() => {
    const byLoc = new Map<string, { locationLabel: string; equipmentCount: number; consumableCount: number }>();
    for (const e of filteredEquipments) {
      if (!e.assignedLocation) continue;
      const loc = locationsById.get(e.assignedLocation);
      const label = [loc?.code ?? '', loc?.name ?? e.assignedLocationName ?? ''].filter(Boolean).join(' - ') || '—';
      const cur = byLoc.get(e.assignedLocation) ?? { locationLabel: label, equipmentCount: 0, consumableCount: 0 };
      cur.equipmentCount += 1;
      byLoc.set(e.assignedLocation, cur);
    }
    for (const c of filteredConsumables) {
      const parts = c.holderName.split(' - ');
      const label = c.holderName || '—';
      const key = parts[0] || label;
      const cur = byLoc.get(key) ?? { locationLabel: label, equipmentCount: 0, consumableCount: 0 };
      cur.consumableCount += 1;
      byLoc.set(key, cur);
    }
    return [...byLoc.values()].sort((a, b) => a.locationLabel.localeCompare(b.locationLabel, 'vi'));
  }, [filteredEquipments, filteredConsumables, locationsById]);

  const eqColumns: Column<Equipment>[] = [
    {
      key: 'equipmentCode',
      label: 'Mã thiết bị',
      render: r => (
        <span className="font-mono text-sm font-medium">{formatEquipmentCodeDisplay(r.equipmentCode)}</span>
      ),
    },
    {
      key: 'itemCode',
      label: 'Mã tài sản',
      render: r => (
        <span className="font-mono text-xs text-muted-foreground">{getItemCode(r.itemId, assetItems) || '—'}</span>
      ),
    },
    { key: 'name', label: 'Tên tài sản', render: r => getItemName(r.itemId, assetItems) },
    { key: 'serial', label: 'Serial' },
    {
      key: 'status',
      label: 'Trạng thái',
      render: r => <StatusBadge status={r.status} label={equipmentStatusLabels[r.status] ?? r.status} />,
    },
    {
      key: 'employee',
      label: 'Nhân viên',
      render: r => {
        if (!r.assignedTo) return '—';
        const e = employeesById.get(r.assignedTo);
        return [e?.code ?? '', r.assignedToName ?? e?.fullName ?? ''].filter(Boolean).join(' - ') || '—';
      },
    },
    {
      key: 'department',
      label: 'Phòng ban',
      render: r => {
        if (!r.assignedDepartment) return '—';
        const d = departmentsById.get(r.assignedDepartment);
        return [d?.code ?? '', r.assignedDepartmentName ?? d?.name ?? ''].filter(Boolean).join(' - ') || '—';
      },
    },
  ];

  const csColumns: Column<ConsumableHoldingRow>[] = [
    {
      key: 'itemCode',
      label: 'Mã tài sản',
      render: r => <span className="font-mono text-sm">{r.itemCode || getItemCode(r.itemId, assetItems) || '—'}</span>,
    },
    { key: 'itemName', label: 'Tên vật tư', render: r => r.itemName || getItemName(r.itemId, assetItems) || '—' },
    { key: 'holderType', label: 'Đối tượng nắm giữ' },
    { key: 'holderName', label: 'Thông tin nắm giữ' },
    { key: 'quantityHeld', label: 'SL đang nắm giữ' },
    { key: 'assignedDate', label: 'Ngày cấp', render: r => (r.assignedDate || '').slice(0, 10) || '—' },
  ];

  const onSearch = () => {
    const kw = keywordInput.trim();
    if (!kw) return;
    setEqPage(1);
    setCsPage(1);
    setSearchPayload({ type: lookupType, keyword: kw });
  };

  const resetSearch = () => {
    setKeywordInput('');
    setSearchPayload(null);
    setEqPage(1);
    setCsPage(1);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tra cứu tài sản đang nắm giữ</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Theo phòng ban: tra cứu tài sản theo phòng ban (gồm pool phòng ban và tài sản nhân viên thuộc phòng ban).
            Theo vị trí: tra cứu tài sản công ty theo vị trí và thống kê theo vị trí.
            Theo mã nhân viên: tài sản đang gán cho nhân viên đó. Kết quả gồm thiết bị và vật tư.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={lookupType} onValueChange={v => setLookupType(v as LookupType)}>
              <SelectTrigger className="w-72 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="department">Tra cứu theo phòng ban</SelectItem>
                <SelectItem value="location">Tra cứu theo vị trí</SelectItem>
                <SelectItem value="employeeCode">Tra cứu theo mã nhân viên</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9"
                placeholder={
                  lookupType === 'employeeCode'
                    ? 'Nhập mã nhân viên...'
                    : lookupType === 'location'
                      ? 'Nhập mã hoặc tên vị trí...'
                      : 'Nhập mã hoặc tên phòng ban...'
                }
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') onSearch();
                }}
              />
            </div>
            <Button onClick={onSearch} size="sm" className="h-9">
              <Search className="h-4 w-4 mr-1" />
              Tìm kiếm
            </Button>
            <Button variant="ghost" size="sm" onClick={resetSearch} className="h-9">
              <X className="h-4 w-4 mr-1" />
              Xóa
            </Button>
          </div>
        </CardContent>
      </Card>

      {!hasSearched ? (
        <div className="text-sm text-muted-foreground">Nhập điều kiện và bấm Tìm kiếm để xem tài sản đang nắm giữ.</div>
      ) : (
        <div className="space-y-6">
          {searchPayload?.type === 'location' ? (
            <div className="rounded-md border p-3 bg-muted/20 space-y-2">
              <p className="text-sm font-medium">Thống kê theo vị trí có tài sản công ty ({locationCompanyAssetCounts.length})</p>
              {locationCompanyAssetCounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Không có dữ liệu tài sản công ty theo vị trí với điều kiện hiện tại.</p>
              ) : (
                <div className="space-y-1">
                  {locationCompanyAssetCounts.map((x, idx) => (
                    <div key={`${x.locationLabel}-${idx}`} className="text-sm">
                      <span className="font-medium">{x.locationLabel}</span>: Thiết bị {x.equipmentCount}, Vật tư {x.consumableCount}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <div>
            <h2 className="text-base font-semibold mb-2">Thiết bị đang nắm giữ ({filteredEquipments.length})</h2>
            <DataTable columns={eqColumns} data={filteredEquipments} currentPage={eqPage} onPageChange={setEqPage} />
          </div>
          <div>
            <h2 className="text-base font-semibold mb-2">Vật tư đang nắm giữ ({filteredConsumables.length})</h2>
            <DataTable columns={csColumns} data={filteredConsumables} currentPage={csPage} onPageChange={setCsPage} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetTracking;
