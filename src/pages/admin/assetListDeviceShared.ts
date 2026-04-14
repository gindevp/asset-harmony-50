import { mapEquipmentDto } from '@/api/viewModels';
import type { EmployeeDto, EquipmentAssignmentDto, EquipmentDto } from '@/api/types';
import {
  equipmentStatusLabels,
  getEmployeeName,
  getDepartmentName,
  getLocationName,
  getItemName,
} from '@/data/mockData';
import type { AssetItem, Equipment } from '@/data/mockData';
import { pickAssignmentForEquipment } from '@/utils/equipmentJoin';

/** Khớp mục 9 tài liệu — tra cứu tài sản (thiết bị) */
export interface DeviceListFilters {
  search: string;
  equipmentCode: string;
  serial: string;
  employeeId: string;
  departmentId: string;
  locationId: string;
  status: string;
}

/** Một dòng bảng thiết bị: model UI + phiếu gán raw từ API (hiển thị/lọc ưu tiên từ assignment). */
export type DeviceTableRow = {
  id: string;
  equipment: Equipment;
  assignment?: EquipmentAssignmentDto;
};

/** Một dòng gộp theo mặt hàng danh mục (thiết bị), tương tự một dòng vật tư. */
export type DeviceCatalogGroupRow = {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  totalCount: number;
  statusSummary: string;
};

export function buildDeviceTableRows(
  dtos: EquipmentDto[] | undefined,
  assigns: EquipmentAssignmentDto[] | undefined,
): DeviceTableRow[] {
  const list = dtos ?? [];
  const a = assigns ?? [];
  return list.map(dto => {
    const assignment = pickAssignmentForEquipment(dto, a);
    const equipment = mapEquipmentDto(dto, assignment);
    return { id: equipment.id, assignment, equipment };
  });
}

export function equipmentDisplayName(eq: Equipment, assetItems: AssetItem[]): string {
  const fromCat = getItemName(eq.itemId, assetItems);
  if (fromCat && fromCat !== eq.itemId) return fromCat;
  const fb = [eq.brandName, eq.modelName].filter(Boolean).join(' ').trim();
  return fb || '—';
}

export function effectiveDepartmentId(eq: Equipment, employees: EmployeeDto[]): string | undefined {
  if (eq.assignedDepartment) return eq.assignedDepartment;
  if (!eq.assignedTo) return undefined;
  const emp = employees.find(x => String(x.id) === eq.assignedTo);
  return emp?.department?.id != null ? String(emp.department.id) : undefined;
}

export function effectiveLocationId(eq: Equipment, employees: EmployeeDto[]): string | undefined {
  if (eq.assignedLocation) return eq.assignedLocation;
  if (!eq.assignedTo) return undefined;
  const emp = employees.find(x => String(x.id) === eq.assignedTo);
  return emp?.location?.id != null ? String(emp.location.id) : undefined;
}

export function displayEmployeeName(eq: Equipment, employees: EmployeeDto[]): string {
  const n = eq.assignedToName?.trim();
  if (n) return n;
  if (eq.assignedTo) return getEmployeeName(eq.assignedTo, employees);
  return '—';
}

export function displayDepartmentName(
  eq: Equipment,
  employees: EmployeeDto[],
  departments: { id?: number; name?: string }[],
): string {
  const n = eq.assignedDepartmentName?.trim();
  if (n) return n;
  const depId = effectiveDepartmentId(eq, employees);
  return depId ? getDepartmentName(depId, departments) : '—';
}

export function displayLocationName(
  eq: Equipment,
  employees: EmployeeDto[],
  locations: { id?: number; name?: string }[],
): string {
  const n = eq.assignedLocationName?.trim();
  if (n) return n;
  const locId = effectiveLocationId(eq, employees);
  return locId ? getLocationName(locId, locations) : '—';
}

export function uiEmployeeName(row: DeviceTableRow, employees: EmployeeDto[]): string {
  const emp = row.assignment?.employee;
  const name = emp?.fullName?.trim();
  if (name) return name;
  const code = emp?.code?.trim();
  if (code) return code;
  return displayEmployeeName(row.equipment, employees);
}

export function uiDepartmentName(
  row: DeviceTableRow,
  employees: EmployeeDto[],
  departments: { id?: number; name?: string }[],
): string {
  const n = row.assignment?.department?.name ?? row.assignment?.employee?.department?.name;
  if (n?.trim()) return n.trim();
  return displayDepartmentName(row.equipment, employees, departments);
}

export function uiLocationName(
  row: DeviceTableRow,
  employees: EmployeeDto[],
  locations: { id?: number; name?: string }[],
): string {
  const n = row.assignment?.location?.name ?? row.assignment?.employee?.location?.name;
  if (n?.trim()) return n.trim();
  return displayLocationName(row.equipment, employees, locations);
}

const EQUIPMENT_STATUS_ORDER = Object.keys(equipmentStatusLabels);

export function formatDeviceGroupStatusSummary(rows: DeviceTableRow[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const s = r.equipment.status;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const k of EQUIPMENT_STATUS_ORDER) {
    const n = counts.get(k);
    if (n) parts.push(`${equipmentStatusLabels[k] ?? k}: ${n}`);
  }
  for (const [k, n] of counts) {
    if (!equipmentStatusLabels[k]) parts.push(`${k}: ${n}`);
  }
  return parts.join(' · ') || '—';
}

export function statusOrderRank(status: string): number {
  const i = EQUIPMENT_STATUS_ORDER.indexOf(status);
  return i >= 0 ? i : 999;
}

export function matchesTraCuuDeviceRow(
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
