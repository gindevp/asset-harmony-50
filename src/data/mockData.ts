// ==================== DEPARTMENTS & EMPLOYEES ====================
export interface Department {
  id: string;
  name: string;
  code: string;
}

export const departments: Department[] = [
  { id: 'dept-1', name: 'Phòng Công nghệ thông tin', code: 'IT' },
  { id: 'dept-2', name: 'Phòng Hành chính Nhân sự', code: 'HCNS' },
  { id: 'dept-3', name: 'Phòng Kế toán', code: 'KT' },
  { id: 'dept-4', name: 'Phòng Kinh doanh', code: 'KD' },
  { id: 'dept-5', name: 'Phòng Marketing', code: 'MKT' },
];

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED';

export interface Employee {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  departmentId: string;
  position: string;
  role: 'ADMIN' | 'ASSET_MANAGER' | 'DEPARTMENT_COORDINATOR' | 'EMPLOYEE';
  status: EmployeeStatus;
  createdAt: string;
}

export const employees: Employee[] = [
  { id: 'emp-1', code: 'NV000001', name: 'Nguyễn Văn An', email: 'an.nv@company.vn', phone: '0901234567', departmentId: 'dept-1', position: 'Trưởng phòng IT', role: 'ADMIN', status: 'ACTIVE', createdAt: '2024-01-15' },
  { id: 'emp-2', code: 'NV000002', name: 'Trần Thị Bình', email: 'binh.tt@company.vn', phone: '0901234568', departmentId: 'dept-1', position: 'Kỹ sư phần mềm', role: 'EMPLOYEE', status: 'ACTIVE', createdAt: '2024-02-10' },
  { id: 'emp-3', code: 'NV000003', name: 'Lê Minh Cường', email: 'cuong.lm@company.vn', phone: '0901234569', departmentId: 'dept-2', position: 'Trưởng phòng HCNS', role: 'ASSET_MANAGER', status: 'ACTIVE', createdAt: '2024-01-20' },
  { id: 'emp-4', code: 'NV000004', name: 'Phạm Thị Dung', email: 'dung.pt@company.vn', phone: '0901234570', departmentId: 'dept-2', position: 'Chuyên viên nhân sự', role: 'EMPLOYEE', status: 'INACTIVE', createdAt: '2024-03-05' },
  { id: 'emp-5', code: 'NV000005', name: 'Hoàng Văn Em', email: 'em.hv@company.vn', phone: '0901234571', departmentId: 'dept-3', position: 'Kế toán trưởng', role: 'DEPARTMENT_COORDINATOR', status: 'ACTIVE', createdAt: '2024-01-25' },
  { id: 'emp-6', code: 'NV000006', name: 'Vũ Thị Phương', email: 'phuong.vt@company.vn', phone: '0901234572', departmentId: 'dept-3', position: 'Kế toán viên', role: 'EMPLOYEE', status: 'DELETED', createdAt: '2024-04-12' },
  { id: 'emp-7', code: 'NV000007', name: 'Đỗ Quang Hải', email: 'hai.dq@company.vn', phone: '0901234573', departmentId: 'dept-4', position: 'Nhân viên kinh doanh', role: 'EMPLOYEE', status: 'ACTIVE', createdAt: '2024-05-01' },
  { id: 'emp-8', code: 'NV000008', name: 'Ngô Thanh Hương', email: 'huong.nt@company.vn', phone: '0901234574', departmentId: 'dept-5', position: 'Trưởng phòng Marketing', role: 'DEPARTMENT_COORDINATOR', status: 'ACTIVE', createdAt: '2024-03-18' },
];

// ==================== LOCATIONS ====================
export interface Location {
  id: string;
  name: string;
  code: string;
  address: string;
}

export const locations: Location[] = [
  { id: 'loc-1', name: 'Trụ sở chính - Tầng 1', code: 'HN-T1', address: 'Số 1 Đại Cồ Việt, Hà Nội' },
  { id: 'loc-2', name: 'Trụ sở chính - Tầng 2', code: 'HN-T2', address: 'Số 1 Đại Cồ Việt, Hà Nội' },
  { id: 'loc-3', name: 'Chi nhánh HCM', code: 'HCM-01', address: 'Số 100 Nguyễn Huệ, TP.HCM' },
  { id: 'loc-4', name: 'Kho chính', code: 'KHO-01', address: 'Số 50 Trần Duy Hưng, Hà Nội' },
];

// ==================== ASSET CATEGORIES ====================
export interface AssetType {
  id: string;
  code: string;
  name: string;
  description: string;
}

export const assetTypes: AssetType[] = [
  { id: 'type-1', code: 'CNTT', name: 'Thiết bị CNTT', description: 'Máy tính, thiết bị mạng, linh kiện' },
  { id: 'type-2', code: 'VP', name: 'Thiết bị văn phòng', description: 'Bàn ghế, tủ, kệ' },
  { id: 'type-3', code: 'VT', name: 'Vật tư tiêu hao', description: 'Văn phòng phẩm, linh kiện thay thế' },
];

export interface AssetGroup {
  id: string;
  code: string;
  name: string;
  typeId: string;
}

export const assetGroups: AssetGroup[] = [
  { id: 'grp-1', code: 'MT', name: 'Máy tính', typeId: 'type-1' },
  { id: 'grp-2', code: 'MH', name: 'Màn hình', typeId: 'type-1' },
  { id: 'grp-3', code: 'MI', name: 'Máy in', typeId: 'type-1' },
  { id: 'grp-4', code: 'TB-M', name: 'Thiết bị mạng', typeId: 'type-1' },
  { id: 'grp-5', code: 'BG', name: 'Bàn ghế', typeId: 'type-2' },
  { id: 'grp-6', code: 'VPP', name: 'Văn phòng phẩm', typeId: 'type-3' },
  { id: 'grp-7', code: 'PK', name: 'Phụ kiện', typeId: 'type-3' },
];

export interface AssetLine {
  id: string;
  code: string;
  name: string;
  groupId: string;
}

export const assetLines: AssetLine[] = [
  { id: 'line-1', code: 'DELL-LAP', name: 'Laptop Dell', groupId: 'grp-1' },
  { id: 'line-2', code: 'HP-LAP', name: 'Laptop HP', groupId: 'grp-1' },
  { id: 'line-3', code: 'DELL-MON', name: 'Màn hình Dell', groupId: 'grp-2' },
  { id: 'line-4', code: 'HP-PRT', name: 'Máy in HP', groupId: 'grp-3' },
  { id: 'line-5', code: 'CISCO-SW', name: 'Switch Cisco', groupId: 'grp-4' },
];

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

export const assetItems: AssetItem[] = [
  { id: 'item-1', code: 'TS000001', name: 'Laptop Dell Latitude 5540', managementType: 'DEVICE', unit: 'Chiếc', lineId: 'line-1', groupId: 'grp-1', typeId: 'type-1', enableDepreciation: true, enableSerial: true, description: 'Laptop Dell Latitude 5540 i7/16GB/512GB' },
  { id: 'item-2', code: 'TS000002', name: 'Laptop Dell Latitude 3440', managementType: 'DEVICE', unit: 'Chiếc', lineId: 'line-1', groupId: 'grp-1', typeId: 'type-1', enableDepreciation: true, enableSerial: true, description: 'Laptop Dell Latitude 3440 i5/8GB/256GB' },
  { id: 'item-3', code: 'TS000003', name: 'Màn hình Dell P2422H', managementType: 'DEVICE', unit: 'Chiếc', lineId: 'line-3', groupId: 'grp-2', typeId: 'type-1', enableDepreciation: true, enableSerial: true, description: 'Màn hình Dell P2422H 24 inch FHD IPS' },
  { id: 'item-4', code: 'TS000004', name: 'Máy in HP LaserJet Pro M404dn', managementType: 'DEVICE', unit: 'Chiếc', lineId: 'line-4', groupId: 'grp-3', typeId: 'type-1', enableDepreciation: true, enableSerial: true, description: 'Máy in laser trắng đen HP LaserJet Pro' },
  { id: 'item-5', code: 'TS000005', name: 'Chuột Logitech M330', managementType: 'CONSUMABLE', unit: 'Chiếc', lineId: '', groupId: 'grp-7', typeId: 'type-3', enableDepreciation: false, enableSerial: false, description: 'Chuột không dây Logitech M330 Silent Plus' },
  { id: 'item-6', code: 'TS000006', name: 'Bàn phím Logitech K380', managementType: 'CONSUMABLE', unit: 'Chiếc', lineId: '', groupId: 'grp-7', typeId: 'type-3', enableDepreciation: false, enableSerial: false, description: 'Bàn phím bluetooth Logitech K380' },
  { id: 'item-7', code: 'TS000007', name: 'Adapter sạc Dell 65W Type-C', managementType: 'CONSUMABLE', unit: 'Chiếc', lineId: '', groupId: 'grp-7', typeId: 'type-3', enableDepreciation: false, enableSerial: false, description: 'Adapter sạc Dell 65W USB-C' },
  { id: 'item-8', code: 'TS000008', name: 'Switch Cisco SG350-28', managementType: 'DEVICE', unit: 'Chiếc', lineId: 'line-5', groupId: 'grp-4', typeId: 'type-1', enableDepreciation: true, enableSerial: true, description: 'Switch 28 cổng Gigabit' },
];

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

export const suppliers: Supplier[] = [
  { id: 'sup-1', code: 'NCC000001', name: 'Công ty TNHH Dell Technologies Việt Nam', taxCode: '0102345678', phone: '024-3456-7890', email: 'sales@dell.vn', address: 'Tầng 12, Tòa Keangnam, Hà Nội', contactPerson: 'Nguyễn Văn Minh', createdAt: '2024-01-15' },
  { id: 'sup-2', code: 'NCC000002', name: 'Công ty CP Phân phối FPT', taxCode: '0103456789', phone: '024-3567-8901', email: 'order@fptdist.com.vn', address: 'Tòa FPT Cầu Giấy, Hà Nội', contactPerson: 'Trần Thu Hà', createdAt: '2024-02-20' },
  { id: 'sup-3', code: 'NCC000003', name: 'Công ty TNHH Thiết bị VP Hòa Phát', taxCode: '0104567890', phone: '024-3678-9012', email: 'info@hoaphat-office.vn', address: 'Số 39 Nguyễn Trãi, Hà Nội', contactPerson: 'Lê Quang Huy', createdAt: '2024-03-10' },
];

// ==================== EQUIPMENT (individual devices) ====================
export type EquipmentStatus = 'IN_STOCK' | 'IN_USE' | 'PENDING_ISSUE' | 'PENDING_RETURN' | 'UNDER_REPAIR' | 'BROKEN' | 'LOST' | 'DISPOSED';

export interface Equipment {
  id: string;
  equipmentCode: string;
  itemId: string;
  serial: string;
  status: EquipmentStatus;
  originalCost: number;
  capitalizedDate: string;
  depreciationMonths: number;
  salvageValue: number;
  assignedTo?: string; // employeeId
  assignedDepartment?: string;
  assignedLocation?: string;
  supplierId: string;
  stockInCode: string;
  notes: string;
  createdAt: string;
}

export const equipments: Equipment[] = [
  { id: 'eq-1', equipmentCode: 'EQ000001', itemId: 'item-1', serial: 'DL5540-001-2024', status: 'IN_USE', originalCost: 28000000, capitalizedDate: '2024-03-15', depreciationMonths: 36, salvageValue: 2000000, assignedTo: 'emp-2', assignedDepartment: 'dept-1', supplierId: 'sup-1', stockInCode: 'NK000001', notes: '', createdAt: '2024-03-15' },
  { id: 'eq-2', equipmentCode: 'EQ000002', itemId: 'item-1', serial: 'DL5540-002-2024', status: 'IN_USE', originalCost: 28000000, capitalizedDate: '2024-03-15', depreciationMonths: 36, salvageValue: 2000000, assignedTo: 'emp-7', assignedDepartment: 'dept-4', supplierId: 'sup-1', stockInCode: 'NK000001', notes: '', createdAt: '2024-03-15' },
  { id: 'eq-3', equipmentCode: 'EQ000003', itemId: 'item-2', serial: 'DL3440-001-2024', status: 'IN_STOCK', originalCost: 18000000, capitalizedDate: '2024-06-01', depreciationMonths: 36, salvageValue: 1500000, supplierId: 'sup-1', stockInCode: 'NK000002', notes: '', createdAt: '2024-06-01' },
  { id: 'eq-4', equipmentCode: 'EQ000004', itemId: 'item-2', serial: 'DL3440-002-2024', status: 'IN_STOCK', originalCost: 18000000, capitalizedDate: '2024-06-01', depreciationMonths: 36, salvageValue: 1500000, supplierId: 'sup-1', stockInCode: 'NK000002', notes: '', createdAt: '2024-06-01' },
  { id: 'eq-5', equipmentCode: 'EQ000005', itemId: 'item-3', serial: 'DLP2422H-001', status: 'IN_USE', originalCost: 5500000, capitalizedDate: '2024-03-15', depreciationMonths: 48, salvageValue: 500000, assignedTo: 'emp-2', assignedDepartment: 'dept-1', supplierId: 'sup-2', stockInCode: 'NK000001', notes: '', createdAt: '2024-03-15' },
  { id: 'eq-6', equipmentCode: 'EQ000006', itemId: 'item-3', serial: 'DLP2422H-002', status: 'IN_USE', originalCost: 5500000, capitalizedDate: '2024-03-15', depreciationMonths: 48, salvageValue: 500000, assignedTo: 'emp-5', assignedDepartment: 'dept-3', supplierId: 'sup-2', stockInCode: 'NK000001', notes: '', createdAt: '2024-03-15' },
  { id: 'eq-7', equipmentCode: 'EQ000007', itemId: 'item-3', serial: 'DLP2422H-003', status: 'IN_STOCK', originalCost: 5500000, capitalizedDate: '2024-07-01', depreciationMonths: 48, salvageValue: 500000, supplierId: 'sup-2', stockInCode: 'NK000003', notes: '', createdAt: '2024-07-01' },
  { id: 'eq-8', equipmentCode: 'EQ000008', itemId: 'item-4', serial: 'HPM404-001', status: 'UNDER_REPAIR', originalCost: 8000000, capitalizedDate: '2024-01-10', depreciationMonths: 60, salvageValue: 800000, assignedDepartment: 'dept-2', supplierId: 'sup-2', stockInCode: 'NK000001', notes: 'Kẹt giấy thường xuyên', createdAt: '2024-01-10' },
  { id: 'eq-9', equipmentCode: 'EQ000009', itemId: 'item-4', serial: 'HPM404-002', status: 'IN_USE', originalCost: 8000000, capitalizedDate: '2024-01-10', depreciationMonths: 60, salvageValue: 800000, assignedDepartment: 'dept-3', assignedLocation: 'loc-1', supplierId: 'sup-2', stockInCode: 'NK000001', notes: '', createdAt: '2024-01-10' },
  { id: 'eq-10', equipmentCode: 'EQ000010', itemId: 'item-8', serial: 'CSG350-001', status: 'IN_USE', originalCost: 12000000, capitalizedDate: '2024-02-01', depreciationMonths: 60, salvageValue: 1000000, assignedDepartment: 'dept-1', assignedLocation: 'loc-2', supplierId: 'sup-2', stockInCode: 'NK000001', notes: 'Phòng server tầng 2', createdAt: '2024-02-01' },
  { id: 'eq-11', equipmentCode: 'EQ000011', itemId: 'item-1', serial: 'DL5540-003-2024', status: 'BROKEN', originalCost: 28000000, capitalizedDate: '2024-03-15', depreciationMonths: 36, salvageValue: 2000000, supplierId: 'sup-1', stockInCode: 'NK000001', notes: 'Hỏng mainboard', createdAt: '2024-03-15' },
];

// ==================== CONSUMABLE STOCK ====================
export interface ConsumableStock {
  id: string;
  itemId: string;
  totalQuantity: number;
  inStockQuantity: number;
  issuedQuantity: number;
  returnedQuantity: number;
  brokenQuantity: number;
}

export const consumableStocks: ConsumableStock[] = [
  { id: 'cs-1', itemId: 'item-5', totalQuantity: 50, inStockQuantity: 32, issuedQuantity: 15, returnedQuantity: 3, brokenQuantity: 0 },
  { id: 'cs-2', itemId: 'item-6', totalQuantity: 30, inStockQuantity: 18, issuedQuantity: 10, returnedQuantity: 2, brokenQuantity: 0 },
  { id: 'cs-3', itemId: 'item-7', totalQuantity: 40, inStockQuantity: 28, issuedQuantity: 12, returnedQuantity: 0, brokenQuantity: 0 },
];

// ==================== STOCK IN (Phiếu nhập kho) ====================
export type StockInStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type StockInSource = 'PURCHASE' | 'RETURN' | 'ADJUSTMENT';

export interface StockInLine {
  id: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string;
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

export const stockIns: StockIn[] = [
  {
    id: 'si-1', code: 'NK000001', source: 'PURCHASE', supplierId: 'sup-1', status: 'CONFIRMED',
    lines: [
      { id: 'sil-1', itemId: 'item-1', quantity: 3, unitPrice: 28000000, totalPrice: 84000000, notes: '' },
      { id: 'sil-2', itemId: 'item-3', quantity: 3, unitPrice: 5500000, totalPrice: 16500000, notes: '' },
      { id: 'sil-3', itemId: 'item-4', quantity: 2, unitPrice: 8000000, totalPrice: 16000000, notes: '' },
      { id: 'sil-4', itemId: 'item-8', quantity: 1, unitPrice: 12000000, totalPrice: 12000000, notes: '' },
    ],
    totalAmount: 128500000, notes: 'Mua sắm đợt 1/2024', createdBy: 'emp-3', createdAt: '2024-03-10', confirmedAt: '2024-03-12'
  },
  {
    id: 'si-2', code: 'NK000002', source: 'PURCHASE', supplierId: 'sup-1', status: 'CONFIRMED',
    lines: [
      { id: 'sil-5', itemId: 'item-2', quantity: 2, unitPrice: 18000000, totalPrice: 36000000, notes: '' },
    ],
    totalAmount: 36000000, notes: 'Bổ sung laptop cho phòng KD', createdBy: 'emp-3', createdAt: '2024-05-28', confirmedAt: '2024-06-01'
  },
  {
    id: 'si-3', code: 'NK000003', source: 'PURCHASE', supplierId: 'sup-2', status: 'CONFIRMED',
    lines: [
      { id: 'sil-6', itemId: 'item-3', quantity: 1, unitPrice: 5500000, totalPrice: 5500000, notes: '' },
      { id: 'sil-7', itemId: 'item-5', quantity: 50, unitPrice: 350000, totalPrice: 17500000, notes: '' },
      { id: 'sil-8', itemId: 'item-6', quantity: 30, unitPrice: 700000, totalPrice: 21000000, notes: '' },
      { id: 'sil-9', itemId: 'item-7', quantity: 40, unitPrice: 450000, totalPrice: 18000000, notes: '' },
    ],
    totalAmount: 62000000, notes: 'Nhập vật tư + màn hình bổ sung', createdBy: 'emp-3', createdAt: '2024-06-25', confirmedAt: '2024-07-01'
  },
  {
    id: 'si-4', code: 'NK000004', source: 'PURCHASE', supplierId: 'sup-1', status: 'DRAFT',
    lines: [
      { id: 'sil-10', itemId: 'item-1', quantity: 5, unitPrice: 28000000, totalPrice: 140000000, notes: '' },
    ],
    totalAmount: 140000000, notes: 'Dự kiến mua thêm laptop Q1/2025', createdBy: 'emp-3', createdAt: '2025-01-05'
  },
];

// ==================== STOCK OUT (Phiếu xuất kho) ====================
export type StockOutStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type RecipientType = 'EMPLOYEE' | 'DEPARTMENT' | 'LOCATION';

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

export const stockOuts: StockOut[] = [
  {
    id: 'so-1', code: 'XK000001', recipientType: 'EMPLOYEE', recipientId: 'emp-2', status: 'CONFIRMED',
    lines: [
      { id: 'sol-1', itemId: 'item-1', equipmentId: 'eq-1', quantity: 1, notes: '' },
      { id: 'sol-2', itemId: 'item-3', equipmentId: 'eq-5', quantity: 1, notes: '' },
      { id: 'sol-3', itemId: 'item-5', quantity: 1, notes: '' },
      { id: 'sol-4', itemId: 'item-6', quantity: 1, notes: '' },
    ],
    notes: 'Cấp thiết bị cho nhân viên mới', createdBy: 'emp-3', createdAt: '2024-03-16', confirmedAt: '2024-03-16'
  },
  {
    id: 'so-2', code: 'XK000002', recipientType: 'DEPARTMENT', recipientId: 'dept-3', status: 'CONFIRMED',
    lines: [
      { id: 'sol-5', itemId: 'item-3', equipmentId: 'eq-6', quantity: 1, notes: '' },
      { id: 'sol-6', itemId: 'item-4', equipmentId: 'eq-9', quantity: 1, notes: '' },
    ],
    notes: 'Cấp thiết bị phòng Kế toán', createdBy: 'emp-3', createdAt: '2024-03-20', confirmedAt: '2024-03-20'
  },
  {
    id: 'so-3', code: 'XK000003', recipientType: 'EMPLOYEE', recipientId: 'emp-7', requestId: 'req-1', status: 'CONFIRMED',
    lines: [
      { id: 'sol-7', itemId: 'item-1', equipmentId: 'eq-2', quantity: 1, notes: '' },
      { id: 'sol-8', itemId: 'item-5', quantity: 1, notes: '' },
    ],
    notes: 'Cấp phát theo YC000001', createdBy: 'emp-3', createdAt: '2024-04-05', confirmedAt: '2024-04-05'
  },
];

// ==================== REQUESTS ====================
export type AllocationRequestStatus = 'CHO_DUYET' | 'DA_DUYET' | 'TU_CHOI' | 'DA_TAO_PHIEU_XUAT' | 'HOAN_THANH' | 'HUY';

export interface AllocationRequestLine {
  id: string;
  itemId: string;
  quantity: number;
  equipmentId?: string; // selected during approval for devices
  notes: string;
}

export interface AllocationRequest {
  id: string;
  code: string;
  requesterId: string;
  departmentId: string;
  reason: string;
  status: AllocationRequestStatus;
  lines: AllocationRequestLine[];
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
}

export const allocationRequests: AllocationRequest[] = [
  {
    id: 'req-1', code: 'YC000001', requesterId: 'emp-7', departmentId: 'dept-4',
    reason: 'Nhân viên mới cần laptop và phụ kiện để làm việc', status: 'HOAN_THANH',
    lines: [
      { id: 'rl-1', itemId: 'item-1', quantity: 1, equipmentId: 'eq-2', notes: '' },
      { id: 'rl-2', itemId: 'item-5', quantity: 1, notes: '' },
    ],
    createdAt: '2024-04-01', approvedAt: '2024-04-03', approvedBy: 'emp-3'
  },
  {
    id: 'req-2', code: 'YC000002', requesterId: 'emp-4', departmentId: 'dept-2',
    reason: 'Cần bổ sung bàn phím cho bộ phận hành chính', status: 'CHO_DUYET',
    lines: [
      { id: 'rl-3', itemId: 'item-6', quantity: 3, notes: '' },
      { id: 'rl-4', itemId: 'item-5', quantity: 3, notes: '' },
    ],
    createdAt: '2025-03-20'
  },
  {
    id: 'req-3', code: 'YC000003', requesterId: 'emp-8', departmentId: 'dept-5',
    reason: 'Cần laptop cho nhân viên thiết kế mới', status: 'DA_DUYET',
    lines: [
      { id: 'rl-5', itemId: 'item-1', quantity: 1, notes: 'Cần cấu hình cao' },
    ],
    createdAt: '2025-03-22', approvedAt: '2025-03-24', approvedBy: 'emp-3'
  },
  {
    id: 'req-4', code: 'YC000004', requesterId: 'emp-6', departmentId: 'dept-3',
    reason: 'Thay adapter sạc bị hỏng', status: 'TU_CHOI',
    lines: [
      { id: 'rl-6', itemId: 'item-7', quantity: 1, notes: '' },
    ],
    createdAt: '2025-03-10', approvedBy: 'emp-3', rejectionReason: 'Vui lòng tạo yêu cầu sửa chữa thay vì yêu cầu cấp phát'
  },
];

// ==================== REPAIR REQUESTS ====================
export type RepairRequestStatus = 'MOI_TAO' | 'DA_TIEP_NHAN' | 'DANG_SUA' | 'HOAN_TAT' | 'TU_CHOI';
export type RepairResult = 'RETURN_USER' | 'RETURN_STOCK' | 'MARK_BROKEN';

export interface RepairRequest {
  id: string;
  code: string;
  requesterId: string;
  departmentId: string;
  equipmentId: string;
  issue: string;
  description: string;
  status: RepairRequestStatus;
  result?: RepairResult;
  resultNotes?: string;
  createdAt: string;
  receivedAt?: string;
  completedAt?: string;
}

export const repairRequests: RepairRequest[] = [
  {
    id: 'rr-1', code: 'YC-SC000001', requesterId: 'emp-4', departmentId: 'dept-2',
    equipmentId: 'eq-8', issue: 'Máy in kẹt giấy', description: 'Máy in HP phòng HCNS bị kẹt giấy liên tục, đã thử gỡ nhiều lần không được. Cần kỹ thuật kiểm tra.',
    status: 'DANG_SUA', createdAt: '2025-03-15', receivedAt: '2025-03-16'
  },
  {
    id: 'rr-2', code: 'YC-SC000002', requesterId: 'emp-2', departmentId: 'dept-1',
    equipmentId: 'eq-1', issue: 'Laptop chạy chậm', description: 'Laptop Dell 5540 chạy rất chậm, khởi động mất 5 phút. Có thể cần nâng cấp RAM hoặc cài lại hệ điều hành.',
    status: 'MOI_TAO', createdAt: '2025-03-25'
  },
];

// ==================== RETURN REQUESTS ====================
export type ReturnRequestStatus = 'CHO_DUYET' | 'DA_DUYET' | 'TU_CHOI' | 'HOAN_THANH' | 'HUY';
export type ReturnDisposition = 'TO_STOCK' | 'BROKEN' | 'UNDER_REPAIR' | 'LOST';

export interface ReturnRequestLine {
  id: string;
  itemId: string;
  equipmentId?: string;
  quantity: number;
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

export const returnRequests: ReturnRequest[] = [
  {
    id: 'ret-1', code: 'YC-TH000001', requesterId: 'emp-5', departmentId: 'dept-3',
    reason: 'Nhân viên nghỉ việc, trả lại thiết bị', status: 'CHO_DUYET',
    lines: [
      { id: 'retl-1', itemId: 'item-3', equipmentId: 'eq-6', quantity: 1, notes: 'Màn hình còn tốt' },
    ],
    createdAt: '2025-03-26'
  },
];

// ==================== SYSTEM LOGS ====================
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

export const systemLogs: SystemLog[] = [
  { id: 'log-1', userId: 'emp-3', action: 'CREATE', module: 'STOCK_IN', objectType: 'StockIn', objectId: 'si-1', objectCode: 'NK000001', details: 'Tạo phiếu nhập kho NK000001', createdAt: '2024-03-10T08:30:00' },
  { id: 'log-2', userId: 'emp-3', action: 'CONFIRM', module: 'STOCK_IN', objectType: 'StockIn', objectId: 'si-1', objectCode: 'NK000001', fromStatus: 'DRAFT', toStatus: 'CONFIRMED', details: 'Xác nhận phiếu nhập kho NK000001', createdAt: '2024-03-12T09:00:00' },
  { id: 'log-3', userId: 'emp-3', action: 'CREATE', module: 'STOCK_OUT', objectType: 'StockOut', objectId: 'so-1', objectCode: 'XK000001', details: 'Tạo phiếu xuất kho XK000001', createdAt: '2024-03-16T10:15:00' },
  { id: 'log-4', userId: 'emp-3', action: 'CONFIRM', module: 'STOCK_OUT', objectType: 'StockOut', objectId: 'so-1', objectCode: 'XK000001', fromStatus: 'DRAFT', toStatus: 'CONFIRMED', details: 'Xác nhận phiếu xuất kho XK000001 - Cấp cho Trần Thị Bình', createdAt: '2024-03-16T10:20:00' },
  { id: 'log-5', userId: 'emp-7', action: 'CREATE', module: 'REQUEST', objectType: 'AllocationRequest', objectId: 'req-1', objectCode: 'YC000001', details: 'Tạo yêu cầu cấp phát YC000001', createdAt: '2024-04-01T14:00:00' },
  { id: 'log-6', userId: 'emp-3', action: 'APPROVE', module: 'REQUEST', objectType: 'AllocationRequest', objectId: 'req-1', objectCode: 'YC000001', fromStatus: 'CHO_DUYET', toStatus: 'DA_DUYET', details: 'Duyệt yêu cầu cấp phát YC000001', createdAt: '2024-04-03T09:30:00' },
  { id: 'log-7', userId: 'emp-4', action: 'CREATE', module: 'REPAIR', objectType: 'RepairRequest', objectId: 'rr-1', objectCode: 'YC-SC000001', details: 'Tạo yêu cầu sửa chữa máy in HP', createdAt: '2025-03-15T11:00:00' },
  { id: 'log-8', userId: 'emp-3', action: 'RECEIVE', module: 'REPAIR', objectType: 'RepairRequest', objectId: 'rr-1', objectCode: 'YC-SC000001', fromStatus: 'MOI_TAO', toStatus: 'DA_TIEP_NHAN', details: 'Tiếp nhận yêu cầu sửa chữa YC-SC000001', createdAt: '2025-03-16T08:00:00' },
  { id: 'log-9', userId: 'emp-4', action: 'CREATE', module: 'REQUEST', objectType: 'AllocationRequest', objectId: 'req-2', objectCode: 'YC000002', details: 'Tạo yêu cầu cấp phát YC000002', createdAt: '2025-03-20T09:00:00' },
  { id: 'log-10', userId: 'emp-2', action: 'CREATE', module: 'REPAIR', objectType: 'RepairRequest', objectId: 'rr-2', objectCode: 'YC-SC000002', details: 'Tạo yêu cầu sửa chữa laptop Dell', createdAt: '2025-03-25T16:00:00' },
  { id: 'log-11', userId: 'emp-5', action: 'CREATE', module: 'RETURN', objectType: 'ReturnRequest', objectId: 'ret-1', objectCode: 'YC-TH000001', details: 'Tạo yêu cầu thu hồi YC-TH000001', createdAt: '2025-03-26T10:00:00' },
];

// ==================== HELPERS ====================
export const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name ?? id;
export const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name ?? id;
export const getLocationName = (id: string) => locations.find(l => l.id === id)?.name ?? id;
export const getItemName = (id: string) => assetItems.find(i => i.id === id)?.name ?? id;
export const getItemCode = (id: string) => assetItems.find(i => i.id === id)?.code ?? id;
export const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name ?? id;

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export const formatDate = (date: string) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatDateTime = (date: string) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Status labels
export const equipmentStatusLabels: Record<EquipmentStatus, string> = {
  IN_STOCK: 'Tồn kho', IN_USE: 'Đang sử dụng', PENDING_ISSUE: 'Chờ cấp phát',
  PENDING_RETURN: 'Chờ thu hồi', UNDER_REPAIR: 'Đang sửa chữa', BROKEN: 'Hỏng',
  LOST: 'Mất', DISPOSED: 'Thanh lý',
};

export const allocationStatusLabels: Record<AllocationRequestStatus, string> = {
  CHO_DUYET: 'Chờ duyệt', DA_DUYET: 'Đã duyệt', TU_CHOI: 'Từ chối',
  DA_TAO_PHIEU_XUAT: 'Đã tạo phiếu xuất', HOAN_THANH: 'Hoàn thành', HUY: 'Hủy',
};

export const repairStatusLabels: Record<RepairRequestStatus, string> = {
  MOI_TAO: 'Mới tạo', DA_TIEP_NHAN: 'Đã tiếp nhận', DANG_SUA: 'Đang sửa',
  HOAN_TAT: 'Hoàn tất', TU_CHOI: 'Từ chối',
};

export const returnStatusLabels: Record<ReturnRequestStatus, string> = {
  CHO_DUYET: 'Chờ duyệt', DA_DUYET: 'Đã duyệt', TU_CHOI: 'Từ chối',
  HOAN_THANH: 'Hoàn thành', HUY: 'Hủy',
};

export const stockInSourceLabels: Record<StockInSource, string> = {
  PURCHASE: 'Mua mới', RETURN: 'Thu hồi', ADJUSTMENT: 'Điều chỉnh',
};

export const stockInStatusLabels: Record<StockInStatus, string> = {
  DRAFT: 'Nháp', CONFIRMED: 'Đã xác nhận', CANCELLED: 'Đã hủy',
};

export const stockOutStatusLabels: Record<StockOutStatus, string> = {
  DRAFT: 'Nháp', CONFIRMED: 'Đã xác nhận', CANCELLED: 'Đã hủy',
};

// Depreciation calculator
export const calculateDepreciation = (originalCost: number, salvageValue: number, months: number, capitalizedDate: string) => {
  const monthlyDep = (originalCost - salvageValue) / months;
  const start = new Date(capitalizedDate);
  const now = new Date();
  const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  const effectiveElapsed = Math.min(Math.max(elapsed, 0), months);
  const accumulated = monthlyDep * effectiveElapsed;
  const currentValue = Math.max(originalCost - accumulated, salvageValue);
  return { monthlyDep, accumulated, currentValue, effectiveElapsed, totalMonths: months };
};
