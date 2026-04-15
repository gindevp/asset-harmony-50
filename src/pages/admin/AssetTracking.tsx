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
} from '@/hooks/useEntityApi';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { consumableQuantityHeld } from '@/utils/myEquipment';

type LookupType = 'department' | 'employeeCode';
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

const AssetTracking = () => {
  const eqQ = useEnrichedEquipmentList();
  const caQ = useConsumableAssignments();
  const iQ = useAssetItems();
  const empQ = useEmployees();
  const depQ = useDepartments();

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
    if (!isDepartmentScopedEquipment(e)) return false;
    const dep = e.assignedDepartment ? departmentsById.get(e.assignedDepartment) : undefined;
    const text = `${dep?.code ?? ''} ${dep?.name ?? ''} ${e.assignedDepartmentName ?? ''}`.toLowerCase();
    if (matchingDepartmentIds.size > 0) {
      return e.assignedDepartment ? matchingDepartmentIds.has(e.assignedDepartment) : false;
    }
    return text.includes(normalizedKeyword);
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
        if (a.employee?.id != null) continue;
        const dept = a.department;
        if (!dept?.id) continue;
        const idStr = String(dept.id);
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
    }
    return rows.sort((a, b) => a.itemCode.localeCompare(b.itemCode, 'vi'));
  }, [consumableAssignments, normalizedKeyword, searchPayload, matchingDepartmentIds]);

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
            Theo phòng ban: chỉ tài sản gán cho phòng ban (không gồm tài sản cá nhân chỉ trùng phòng ban trên hồ sơ nhân viên).
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
