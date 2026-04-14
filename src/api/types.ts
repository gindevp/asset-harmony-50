/**
 * Types for API responses (DTOs).
 *
 * Lưu ý: Backend là Spring/JHipster, nhiều endpoint có thể trả mảng thuần hoặc Page `{ content: [] }`.
 * Các field đều optional để tương thích dữ liệu seed/phase 1.
 */

export type DepartmentDto = { id?: number; code?: string; name?: string; active?: boolean };
export type LocationDto = { id?: number; code?: string; name?: string; description?: string; active?: boolean };
export type EmployeeDto = {
  id?: number;
  code?: string;
  fullName?: string;
  jobTitle?: string;
  active?: boolean;
  department?: DepartmentDto;
  location?: LocationDto;
};

export type SupplierDto = {
  id?: number;
  code?: string;
  name?: string;
  taxCode?: string;
  phone?: string;
  email?: string;
  address?: string;
  /** Người liên hệ (phase 1) */
  contactPerson?: string;
  /** ISO-8601 từ BE (Instant) */
  createdDate?: string;
  active?: boolean;
};

/** Loại tài sản theo nghiệp vụ Phase 1 */
export type Asssettype = 'DEVICE' | 'CONSUMABLE';

export type AssetGroupDto = {
  id?: number;
  code?: string;
  name?: string;
  description?: string;
  /** Enum/field ở BE (đã bỏ bảng AssetType) */
  assetType?: string;
  active?: boolean;
};

export type AssetLineDto = {
  id?: number;
  code?: string;
  name?: string;
  description?: string;
  active?: boolean;
  /** Thiết bị / Vật tư — nguồn chính (cấp dòng, không phụ thuộc nhóm) */
  assetType?: string;
  assetGroup?: AssetGroupDto;
};

export type AssetItemDto = {
  id?: number;
  code?: string;
  name?: string;
  managementType?: string;
  unit?: string;
  depreciationEnabled?: boolean;
  serialTrackingRequired?: boolean;
  note?: string;
  active?: boolean;
  assetLine?: AssetLineDto;
};

export type EquipmentDto = {
  id?: number;
  equipmentCode?: string;
  serial?: string;
  conditionNote?: string;
  modelName?: string;
  brandName?: string;
  status?: string;
  purchasePrice?: string | number;
  capitalizationDate?: string;
  depreciationMonths?: number;
  salvageValue?: string | number;
  bookValueSnapshot?: string | number;
  assetItem?: AssetItemDto;
  supplier?: SupplierDto;
};

export type ConsumableStockDto = {
  id?: number;
  quantityOnHand?: number;
  quantityIssued?: number;
  note?: string;
  assetItem?: AssetItemDto;
};

export type StockReceiptDto = {
  id?: number;
  code?: string;
  receiptDate?: string;
  source?: string;
  status?: string;
  note?: string;
};

export type StockReceiptLineDto = {
  id?: number;
  lineNo?: number;
  lineType?: string;
  quantity?: number;
  unitPrice?: number;
  note?: string;
  receipt?: StockReceiptDto;
  assetItem?: AssetItemDto;
  equipment?: EquipmentDto;
  supplier?: SupplierDto;
};

export type StockIssueDto = {
  id?: number;
  code?: string;
  issueDate?: string;
  status?: string;
  note?: string;
  /** EMPLOYEE | DEPARTMENT | LOCATION | COMPANY */
  assigneeType?: string;
  employee?: EmployeeDto;
  department?: DepartmentDto;
  location?: LocationDto;
  /** YC cấp phát nếu phiếu xuất được tạo từ luồng YC */
  allocationRequestId?: number;
};

export type StockIssueLineDto = {
  id?: number;
  lineNo?: number;
  lineType?: string;
  quantity?: number;
  note?: string;
  issue?: StockIssueDto;
  assetItem?: AssetItemDto;
  equipment?: EquipmentDto;
};

export type AllocationRequestDto = {
  id?: number;
  code?: string;
  requestDate?: string;
  reason?: string;
  attachmentNote?: string;
  /** Lý do từ chối (khi status = REJECTED) */
  rejectionReason?: string;
  status?: string;
  beneficiaryNote?: string;
  /** EMPLOYEE | DEPARTMENT | LOCATION | COMPANY */
  assigneeType?: string;
  beneficiaryEmployee?: EmployeeDto;
  beneficiaryDepartment?: DepartmentDto;
  beneficiaryLocation?: LocationDto;
  requester?: EmployeeDto;
  stockIssueId?: number;
  stockIssueCode?: string;
};

export type AllocationRequestLineDto = {
  id?: number;
  lineNo?: number;
  lineType?: string;
  quantity?: number;
  note?: string;
  request?: AllocationRequestDto;
  assetItem?: AssetItemDto;
  /** Dòng thiết bị: nhân viên chọn dòng tài sản; QLTS chọn thiết bị cụ thể khi duyệt */
  assetLine?: AssetLineDto;
  equipment?: EquipmentDto;
};

export type RepairRequestLineDto = {
  id?: number;
  lineNo?: number;
  /** DEVICE | CONSUMABLE */
  lineType?: string;
  quantity?: number;
  assetItem?: AssetItemDto;
  equipment?: EquipmentDto;
};

export type RepairRequestDto = {
  id?: number;
  code?: string;
  requestDate?: string;
  problemCategory?: string;
  description?: string;
  attachmentNote?: string;
  status?: string;
  /** Lý do từ chối (khi status = REJECTED) */
  rejectionReason?: string;
  resolutionNote?: string;
  repairOutcome?: string;
  requester?: EmployeeDto;
  equipment?: EquipmentDto;
  lines?: RepairRequestLineDto[];
};

export type ReturnRequestDto = {
  id?: number;
  code?: string;
  requestDate?: string;
  /** API backend (Jackson): note */
  note?: string;
  reason?: string;
  status?: string;
  requester?: EmployeeDto;
};

export type ReturnRequestLineDto = {
  id?: number;
  lineNo?: number;
  lineType?: string;
  quantity?: number;
  selected?: boolean;
  note?: string;
  /** TO_STOCK | TO_REPAIR | BROKEN | LOST */
  disposition?: string;
  request?: ReturnRequestDto;
  assetItem?: AssetItemDto;
  equipment?: EquipmentDto;
};

/**
 * GET /api/equipment-assignments — gán thiết bị (người / phòng ban / vị trí).
 * FE ghép với {@link EquipmentDto} theo `equipmentId` hoặc `equipment.id` / `equipmentCode`.
 */
export type EquipmentAssignmentDto = {
  id?: number;
  /** FK thiết bị (BE map từ equipment.id) — dùng ghép danh sách, không phụ thuộc object equipment lồng nhau */
  equipmentId?: number;
  assignedDate?: string;
  returnedDate?: string;
  note?: string;
  equipment?: EquipmentDto;
  employee?: EmployeeDto;
  department?: DepartmentDto;
  location?: LocationDto;
};

/** GET /api/consumable-assignments — gán vật tư theo SL (cấp phát / xuất kho). */
export type ConsumableAssignmentDto = {
  id?: number;
  quantity?: number;
  assignedDate?: string;
  returnedQuantity?: number;
  note?: string;
  assetItem?: AssetItemDto;
  employee?: EmployeeDto;
  department?: DepartmentDto;
  location?: LocationDto;
};

export type AdminUserDto = {
  id?: number;
  login?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  activated?: boolean;
  langKey?: string;
  authorities?: string[];
  createdDate?: string;
  /** Liên kết bản ghi nhân viên HRM (nullable) */
  employeeId?: number | null;
};

export type AppAuditLogDto = {
  id?: number;
  occurredAt?: string;
  login?: string;
  httpMethod?: string;
  uriPath?: string;
  responseStatus?: number;
  /** Sự kiện nghiệp vụ (khi httpMethod = BIZ) */
  bizEventType?: string;
  bizEntityType?: string;
  bizEntityId?: string;
  message?: string;
  requester?: EmployeeDto;
};

export type AuthorityDto = { name?: string; description?: string };

/** Lịch sử thao tác trên phiếu nhập/xuất (API GET .../events) */
export type StockDocumentEventDto = {
  id?: number;
  occurredAt?: string;
  actor?: string;
  eventType?: string;
  message?: string;
};

/** Dòng trong phiếu báo mất gộp (COMBINED). */
export type LossReportEntryLineDto = {
  lineType: string;
  equipmentId?: number;
  consumableAssignmentId?: number;
  quantity?: number;
  /** BE bổ sung khi GET */
  assetItemId?: number;
};

/** Yêu cầu báo mất — POST/GET /api/loss-report-requests */
export type LossReportRequestDto = {
  id?: number;
  code?: string;
  requestDate?: string;
  status?: string;
  lossKind?: string;
  quantity?: number;
  /** Thời điểm / mô tả thời gian do người báo nhập */
  lossOccurredAt?: string;
  /** Địa điểm do người báo nhập */
  lossLocation?: string;
  /** Lý do báo mất */
  reason?: string;
  /** Mô tả chi tiết */
  lossDescription?: string;
  requester?: EmployeeDto;
  equipment?: EquipmentDto;
  consumableAssignment?: { id?: number; assetItem?: AssetItemDto };
  /** lossKind === COMBINED */
  lossEntries?: LossReportEntryLineDto[];
};

