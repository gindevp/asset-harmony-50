// Types + formatters + status labels (khớp enum backend). Dữ liệu lấy từ API qua hooks.

// ==================== DEPARTMENTS & EMPLOYEES ====================
export interface Department {
  id: string;
  name: string;
  code: string;
}

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED';

export interface Employee {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  departmentId: string;
  /** Vị trí làm việc (tùy chọn) — khớp employee.location */
  locationId?: string;
  position: string;
  role: 'ADMIN' | 'ASSET_MANAGER' | 'DEPARTMENT_COORDINATOR' | 'EMPLOYEE';
  status: EmployeeStatus;
  createdAt: string;
}

// ==================== LOCATIONS ====================
export interface Location {
  id: string;
  name: string;
  code: string;
  address: string;
}

// ==================== ASSET CATEGORIES ====================
export interface AssetType {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface AssetGroup {
  id: string;
  code: string;
  name: string;
  typeId: string;
}

export interface AssetLine {
  id: string;
  code: string;
  name: string;
  groupId: string;
}

export type ManagementType = 'DEVICE' | 'CONSUMABLE';

export interface AssetItem {
  id: string;
  code: string;
  name: string;
  managementType: ManagementType;
  unit: string;
  lineId: string;
  groupId: string;
  typeId: string;
  enableDepreciation: boolean;
  enableSerial: boolean;
  description: string;
}

// ==================== SUPPLIERS ====================
export interface Supplier {
  id: string;
  code: string;
  name: string;
  taxCode: string;
  phone: string;
  email: string;
  address: string;
  contactPerson: string;
  createdAt: string;
}

// ==================== EQUIPMENT ====================
export type EquipmentStatus =
  | 'IN_STOCK'
  | 'IN_USE'
  | 'PENDING_ISSUE'
  | 'PENDING_RETURN'
  | 'UNDER_REPAIR'
  | 'BROKEN'
  | 'LOST'
  | 'DISPOSED';

export interface Equipment {
  id: string;
  equipmentCode: string;
  itemId: string;
  serial: string;
  /** Model / hãng — đồng bộ từ API */
  modelName?: string;
  brandName?: string;
  status: EquipmentStatus;
  originalCost: number;
  capitalizedDate: string;
  depreciationMonths: number;
  salvageValue: number;
  /** Từ DTO `bookValueSnapshot` (BE) nếu có — có thể dùng thay tính GT còn lại client */
  bookValueSnapshot?: number;
  assignedTo?: string;
  assignedDepartment?: string;
  assignedLocation?: string;
  /** Snapshot từ API equipment-assignments (ưu tiên hiển thị, không phụ thuộc GET employees/departments) */
  assignedToName?: string;
  assignedDepartmentName?: string;
  assignedLocationName?: string;
  supplierId: string;
  stockInCode: string;
  notes: string;
  createdAt: string;
}

// ==================== CONSUMABLE STOCK ====================
export interface ConsumableStock {
  id: string;
  itemId: string;
  /** Từ GET /api/consumable-stocks (assetItem lồng) — fallback khi chưa ghép được danh mục */
  itemCode?: string;
  itemName?: string;
  totalQuantity: number;
  inStockQuantity: number;
  issuedQuantity: number;
  returnedQuantity: number;
  brokenQuantity: number;
}

// ==================== STOCK IN / OUT ====================
export type StockInStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type StockInSource = 'PURCHASE' | 'RETURN' | 'ADJUSTMENT';

export interface StockInLine {
  id: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string;
  /** Parse từ ghi chú dòng nhập thiết bị (CODE:|SN:|MODEL:|BRAND:) */
  equipmentCode?: string;
  serial?: string;
  modelName?: string;
  brandName?: string;
  depreciationMonths?: number;
  salvageValue?: number;
}

export interface StockIn {
  id: string;
  code: string;
  source: StockInSource;
  supplierId?: string;
  status: StockInStatus;
  lines: StockInLine[];
  totalAmount: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  confirmedAt?: string;
}

export type StockOutStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type RecipientType = 'EMPLOYEE' | 'DEPARTMENT' | 'LOCATION' | 'COMPANY';

export interface StockOutLine {
  id: string;
  itemId: string;
  equipmentId?: string;
  quantity: number;
  notes: string;
}

export interface StockOut {
  id: string;
  code: string;
  recipientType: RecipientType;
  recipientId: string;
  requestId?: string;
  status: StockOutStatus;
  lines: StockOutLine[];
  notes: string;
  createdBy: string;
  createdAt: string;
  confirmedAt?: string;
}

// ==================== REQUESTS (backend enum keys) ====================
export type AllocationRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPORT_SLIP_CREATED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface AllocationRequestLine {
  id: string;
  /** Vật tư: mã item; thiết bị theo dòng tài sản có thể để trống */
  itemId: string;
  /** Thiết bị: dòng tài sản (master) trên phiếu yêu cầu */
  assetLineId?: string;
  quantity: number;
  equipmentId?: string;
  notes: string;
}

export type AllocationAssigneeType = 'EMPLOYEE' | 'DEPARTMENT' | 'LOCATION' | 'COMPANY';

export interface AllocationRequest {
  id: string;
  code: string;
  requesterId: string;
  departmentId: string;
  reason: string;
  /** Ghi chú / FILE:url đính kèm */
  attachmentNote?: string;
  /** Đối tượng nhận / ghi chú người hưởng (theo tài liệu) */
  beneficiaryNote?: string;
  assigneeType: AllocationAssigneeType;
  /** Hiển thị nhanh: NV / PB / vị trí / công ty */
  assigneeSummary: string;
  beneficiaryEmployeeId?: string;
  beneficiaryDepartmentId?: string;
  beneficiaryLocationId?: string;
  /** Phiếu xuất kho sinh khi bấm «Đã tạo phiếu xuất» */
  stockIssueId?: string;
  stockIssueCode?: string;
  status: AllocationRequestStatus;
  lines: AllocationRequestLine[];
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
}

export type RepairRequestStatus = 'NEW' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
export type RepairResult = 'RETURN_USER' | 'RETURN_STOCK' | 'MARK_BROKEN';

export interface RepairRequest {
  id: string;
  code: string;
  requesterId: string;
  departmentId: string;
  equipmentId: string;
  issue: string;
  description: string;
  /** Link/ghi chú file đính kèm */
  attachmentNote?: string;
  status: RepairRequestStatus;
  result?: RepairResult;
  resultNotes?: string;
  createdAt: string;
  receivedAt?: string;
  completedAt?: string;
}

export type ReturnRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
export type ReturnDisposition = 'TO_STOCK' | 'TO_REPAIR' | 'BROKEN' | 'LOST';

export interface ReturnRequestLine {
  id: string;
  itemId: string;
  equipmentId?: string;
  quantity: number;
  /** Dòng được chọn thực hiện thu hồi khi QM hoàn tất */
  selected?: boolean;
  disposition?: ReturnDisposition;
  notes: string;
}

export interface ReturnRequest {
  id: string;
  code: string;
  requesterId: string;
  departmentId: string;
  reason: string;
  status: ReturnRequestStatus;
  lines: ReturnRequestLine[];
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

// ==================== SYSTEM LOGS (chưa có API) ====================
export interface SystemLog {
  id: string;
  userId: string;
  action: string;
  module: string;
  objectType: string;
  objectId: string;
  objectCode: string;
  fromStatus?: string;
  toStatus?: string;
  details: string;
  createdAt: string;
}

// ==================== LOOKUP HELPERS (truyền list từ API) ====================
export function employeeName(
  id: string,
  employees: { id?: number; fullName?: string; code?: string }[],
): string {
  if (!Array.isArray(employees)) return id;
  const e = employees.find(x => String(x.id) === id);
  return e?.fullName ?? id;
}

export function departmentName(
  id: string,
  departments: { id?: number; name?: string; code?: string }[],
): string {
  const d = departments.find(x => String(x.id) === id);
  return d?.name ?? id;
}

export function locationName(
  id: string,
  locations: { id?: number; name?: string; code?: string }[],
): string {
  const l = locations.find(x => String(x.id) === id);
  return l?.name ?? id;
}

export function itemName(
  id: string,
  items: { id?: number; name?: string; code?: string }[],
): string {
  const i = items.find(x => String(x.id) === id);
  return i?.name ?? id;
}

export function itemCode(
  id: string,
  items: { id?: number; code?: string }[],
): string {
  const i = items.find(x => String(x.id) === id);
  return i?.code ?? id;
}

/** Hiển thị dòng tài sản (danh mục) theo id */
export function assetLineDisplay(
  id: string,
  lines: { id?: number; code?: string; name?: string }[],
): string {
  if (!id) return '—';
  const l = lines.find(x => String(x.id) === id);
  if (!l) return id;
  const c = (l.code ?? '').trim();
  const n = (l.name ?? '').trim();
  return c && n ? `${c} — ${n}` : n || c || id;
}

export function supplierName(
  id: string,
  suppliers: { id?: number; name?: string }[],
): string {
  const s = suppliers.find(x => String(x.id) === id);
  return s?.name ?? id;
}

// Aliases tương thích import cũ
export const getEmployeeName = employeeName;
export const getDepartmentName = departmentName;
export const getLocationName = locationName;
export const getItemName = itemName;
export const getItemCode = itemCode;
export const getSupplierName = supplierName;
export const getAssetLineDisplay = assetLineDisplay;

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export const formatDate = (date: string) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatDateTime = (date: string) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const equipmentStatusLabels: Record<string, string> = {
  IN_STOCK: 'Tồn kho',
  IN_USE: 'Đang sử dụng',
  PENDING_ISSUE: 'Chờ cấp phát',
  PENDING_RETURN: 'Chờ thu hồi',
  UNDER_REPAIR: 'Đang sửa chữa',
  BROKEN: 'Hỏng',
  LOST: 'Mất',
  DISPOSED: 'Thanh lý',
};

export const allocationStatusLabels: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  EXPORT_SLIP_CREATED: 'Đã tạo phiếu xuất',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Hủy',
};

export const repairStatusLabels: Record<string, string> = {
  NEW: 'Mới tạo',
  ACCEPTED: 'Đã tiếp nhận',
  IN_PROGRESS: 'Đang sửa',
  COMPLETED: 'Hoàn tất',
  REJECTED: 'Từ chối',
};

export const returnStatusLabels: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Hủy',
};

/** Khớp enum backend ReturnDisposition */
export const returnDispositionLabels: Record<string, string> = {
  TO_STOCK: 'Về kho',
  TO_REPAIR: 'Chuyển sửa',
  BROKEN: 'Hỏng',
  LOST: 'Mất',
};

export const stockInSourceLabels: Record<string, string> = {
  PURCHASE: 'Mua mới',
  RETURN: 'Thu hồi',
  ADJUSTMENT: 'Điều chỉnh',
  NEW_PURCHASE: 'Mua mới',
  RECOVERY: 'Thu hồi',
  MANUAL_ADJUSTMENT: 'Điều chỉnh',
};

export const stockInStatusLabels: Record<string, string> = {
  DRAFT: 'Nháp',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
};

export const stockOutStatusLabels: Record<string, string> = {
  DRAFT: 'Nháp',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
};

export const calculateDepreciation = (
  originalCost: number,
  salvageValue: number,
  months: number,
  capitalizedDate: string,
) => {
  const monthlyDep = months > 0 ? (originalCost - salvageValue) / months : 0;
  const start = new Date(capitalizedDate);
  const now = new Date();
  const elapsed =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  const effectiveElapsed = Math.min(Math.max(elapsed, 0), months);
  const accumulated = monthlyDep * effectiveElapsed;
  const currentValue = Math.max(originalCost - accumulated, salvageValue);
  return { monthlyDep, accumulated, currentValue, effectiveElapsed, totalMonths: months };
};
