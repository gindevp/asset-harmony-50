/* Loose shapes matching Spring/Jackson JSON (camelCase). */

/** Spring Security authority name, e.g. ROLE_ADMIN */
export type AuthorityDto = { name?: string };

export type DepartmentDto = { id?: number; code?: string; name?: string; active?: boolean };
export type LocationDto = { id?: number; code?: string; name?: string; address?: string; active?: boolean };
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
  active?: boolean;
};
export type AssetTypeDto = { id?: number; code?: string; name?: string; description?: string; active?: boolean };
export type AssetGroupDto = { id?: number; code?: string; name?: string; active?: boolean; assetType?: AssetTypeDto };
export type AssetLineDto = { id?: number; code?: string; name?: string; active?: boolean; assetGroup?: AssetGroupDto };
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

/** Lịch sử thao tác trên phiếu nhập/xuất (API GET .../events) */
export type StockDocumentEventDto = {
  id?: number;
  occurredAt?: string;
  login?: string;
  docType?: string;
  docId?: number;
  action?: string;
  summary?: string;
  detail?: string | null;
};
export type StockReceiptLineDto = {
  id?: number;
  lineNo?: number;
  quantity?: number;
  unitPrice?: string | number;
  note?: string;
  receipt?: StockReceiptDto;
  assetItem?: AssetItemDto;
};
export type StockIssueDto = {
  id?: number;
  code?: string;
  issueDate?: string;
  status?: string;
  assigneeType?: string;
  note?: string;
  employee?: EmployeeDto;
  department?: DepartmentDto;
  location?: LocationDto;
};
export type StockIssueLineDto = {
  id?: number;
  lineNo?: number;
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
  resolutionNote?: string;
  repairOutcome?: string;
  requester?: EmployeeDto;
  equipment?: EquipmentDto;
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
  detail?: string | null;
};
export type ReturnRequestDto = {
  id?: number;
  code?: string;
  requestDate?: string;
  note?: string;
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
export type EquipmentAssignmentDto = {
  id?: number;
  assignedDate?: string;
  returnedDate?: string;
  note?: string;
  equipment?: EquipmentDto;
  employee?: EmployeeDto;
  department?: DepartmentDto;
  location?: LocationDto;
};
