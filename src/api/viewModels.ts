import type {
  AllocationRequestDto,
  AllocationRequestLineDto,
  ConsumableStockDto,
  EquipmentAssignmentDto,
  EquipmentDto,
  RepairRequestDto,
  ReturnRequestDto,
  ReturnRequestLineDto,
  StockIssueDto,
  StockIssueLineDto,
  StockReceiptDto,
  StockReceiptLineDto,
} from './types';
import type {
  StockIn,
  StockInLine,
  StockOut,
  StockOutLine,
  Equipment,
  ConsumableStock,
  AllocationRequest,
  AllocationRequestLine,
  RepairRequest,
  ReturnRequest,
  ReturnRequestLine,
} from '@/data/mockData';

function num(v: string | number | undefined | null): number {
  if (v === undefined || v === null) return 0;
  return typeof v === 'number' ? v : parseFloat(v) || 0;
}

/**
 * Gộp 1 bản ghi thiết bị (EquipmentDto) + tối đa 1 phiếu gán đang hiệu lực (EquipmentAssignmentDto).
 * Người dùng / phòng ban / vị trí chỉ đến từ `assignment`, không có trong GET /api/equipment.
 */
export function mapEquipmentDto(
  e: EquipmentDto,
  assignment?: EquipmentAssignmentDto | null,
): Equipment {
  const empId = assignment?.employee?.id != null ? String(assignment.employee.id) : undefined;
  /** Phòng ban / vị trí trên phiếu gán; nếu chỉ có nhân viên (xuất kho theo người) thì lấy từ bản ghi nhân viên trong cùng JSON */
  const deptId =
    assignment?.department?.id != null
      ? String(assignment.department.id)
      : assignment?.employee?.department?.id != null
        ? String(assignment.employee.department.id)
        : undefined;
  const locId =
    assignment?.location?.id != null
      ? String(assignment.location.id)
      : assignment?.employee?.location?.id != null
        ? String(assignment.employee.location.id)
        : undefined;
  const deptName =
    assignment?.department?.name ??
    assignment?.employee?.department?.name ??
    undefined;
  const locName =
    assignment?.location?.name ?? assignment?.employee?.location?.name ?? undefined;
  return {
    id: String(e.id),
    equipmentCode: e.equipmentCode ?? '',
    itemId: String(e.assetItem?.id ?? ''),
    serial: e.serial ?? '',
    modelName: e.modelName ?? undefined,
    brandName: e.brandName ?? undefined,
    status: (e.status ?? 'IN_STOCK') as Equipment['status'],
    originalCost: num(e.purchasePrice),
    capitalizedDate: e.capitalizationDate ?? '',
    depreciationMonths: e.depreciationMonths ?? 0,
    salvageValue: num(e.salvageValue),
    bookValueSnapshot:
      e.bookValueSnapshot !== undefined && e.bookValueSnapshot !== null
        ? num(e.bookValueSnapshot)
        : undefined,
    assignedTo: empId,
    assignedDepartment: deptId,
    assignedLocation: locId,
    assignedToName:
      assignment?.employee?.fullName?.trim() ||
      assignment?.employee?.code?.trim() ||
      undefined,
    assignedDepartmentName: deptName,
    assignedLocationName: locName,
    supplierId: String(e.supplier?.id ?? ''),
    stockInCode: '',
    notes: e.conditionNote ?? '',
    createdAt: e.capitalizationDate ?? '',
  };
}

export function mapConsumableStockDto(cs: ConsumableStockDto): ConsumableStock {
  const onHand = cs.quantityOnHand ?? 0;
  const issued = cs.quantityIssued ?? 0;
  const itemId = cs.assetItem?.id != null ? String(cs.assetItem.id) : '';
  return {
    id: String(cs.id),
    itemId,
    itemCode: cs.assetItem?.code?.trim() || undefined,
    itemName: cs.assetItem?.name?.trim() || undefined,
    totalQuantity: onHand + issued,
    inStockQuantity: onHand,
    issuedQuantity: issued,
    returnedQuantity: 0,
    brokenQuantity: 0,
  };
}

function mapStockReceiptSourceToUi(s: string | undefined): StockIn['source'] {
  if (s === 'NEW_PURCHASE') return 'PURCHASE';
  if (s === 'RECOVERY') return 'RETURN';
  if (s === 'MANUAL_ADJUSTMENT') return 'ADJUSTMENT';
  return 'PURCHASE';
}

function parseSupplierRefFromReceiptNote(note: string | undefined): string | undefined {
  if (!note) return undefined;
  for (const line of note.split('\n')) {
    const m = line.match(/^supplierRef:(\d+)$/);
    if (m) return m[1];
  }
  return undefined;
}

function stripSupplierRefFromReceiptNote(note: string | undefined): string {
  if (!note) return '';
  return note
    .split('\n')
    .filter(l => !l.startsWith('supplierRef:'))
    .join('\n')
    .trim();
}

/** Ghi chú dòng nhập thiết bị do FE ghi: CODE:eq|SN:serial|MODEL:|BRAND: */
function parseStockReceiptDeviceLineNote(note: string | undefined): {
  equipmentCode?: string;
  serial?: string;
  modelName?: string;
  brandName?: string;
  depreciationMonths?: number;
  salvageValue?: number;
} {
  if (!note) return {};
  const out: {
    equipmentCode?: string;
    serial?: string;
    modelName?: string;
    brandName?: string;
    depreciationMonths?: number;
    salvageValue?: number;
  } = {};
  for (const part of note.split('|')) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const k = part.slice(0, idx);
    const v = part.slice(idx + 1);
    if (k === 'CODE') out.equipmentCode = v;
    if (k === 'SN') out.serial = v;
    if (k === 'MODEL') out.modelName = v;
    if (k === 'BRAND') out.brandName = v;
    if (k === 'DEP') {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) out.depreciationMonths = n;
    }
    if (k === 'SALV') {
      const n = parseFloat(v);
      if (!Number.isNaN(n)) out.salvageValue = n;
    }
  }
  return out;
}

export function buildStockIns(receipts: StockReceiptDto[], lines: StockReceiptLineDto[]): StockIn[] {
  return receipts.map(r => {
    const rlines = lines.filter(l => l.receipt?.id === r.id);
    const mappedLines: StockInLine[] = rlines.map(l => {
      const q = l.quantity ?? 0;
      const up = num(l.unitPrice);
      const dev = parseStockReceiptDeviceLineNote(l.note ?? '');
      return {
        id: String(l.id),
        itemId: String(l.assetItem?.id ?? ''),
        quantity: q,
        unitPrice: up,
        totalPrice: q * up,
        notes: l.note ?? '',
        equipmentCode: dev.equipmentCode,
        serial: dev.serial,
        modelName: dev.modelName,
        brandName: dev.brandName,
        depreciationMonths: dev.depreciationMonths,
        salvageValue: dev.salvageValue,
      };
    });
    const totalAmount = mappedLines.reduce((s, x) => s + x.totalPrice, 0);
    return {
      id: String(r.id),
      code: r.code ?? '',
      source: mapStockReceiptSourceToUi(r.source),
      supplierId: parseSupplierRefFromReceiptNote(r.note),
      status: (r.status ?? 'DRAFT') as StockIn['status'],
      lines: mappedLines,
      totalAmount,
      notes: stripSupplierRefFromReceiptNote(r.note),
      createdBy: '',
      createdAt: r.receiptDate ?? '',
      confirmedAt: r.status === 'CONFIRMED' ? r.receiptDate : undefined,
    };
  });
}

export function buildStockOuts(issues: StockIssueDto[], lines: StockIssueLineDto[]): StockOut[] {
  return issues.map(iss => {
    const ilines = lines.filter(l => l.issue?.id === iss.id);
    const mappedLines: StockOutLine[] = ilines.map(l => ({
      id: String(l.id),
      itemId: String(l.assetItem?.id ?? ''),
      equipmentId: l.equipment?.id != null ? String(l.equipment.id) : undefined,
      quantity: l.quantity ?? 0,
      notes: l.note ?? '',
    }));
    let recipientType: StockOut['recipientType'] = 'EMPLOYEE';
    let recipientId = '';
    if (iss.assigneeType === 'DEPARTMENT') {
      recipientType = 'DEPARTMENT';
      recipientId = String(iss.department?.id ?? '');
    } else if (iss.assigneeType === 'LOCATION') {
      recipientType = 'LOCATION';
      recipientId = String(iss.location?.id ?? '');
    } else if (iss.assigneeType === 'COMPANY') {
      recipientType = 'COMPANY';
      recipientId = '';
    } else {
      recipientId = String(iss.employee?.id ?? '');
    }
    return {
      id: String(iss.id),
      code: iss.code ?? '',
      recipientType,
      recipientId,
      requestId: iss.allocationRequestId != null ? `AR#${iss.allocationRequestId}` : undefined,
      status: (iss.status ?? 'DRAFT') as StockOut['status'],
      lines: mappedLines,
      notes: iss.note ?? '',
      createdBy: '',
      createdAt: iss.issueDate ?? '',
      confirmedAt: iss.status === 'CONFIRMED' ? iss.issueDate : undefined,
    };
  });
}

function allocationAssigneeSummary(req: AllocationRequestDto): { type: AllocationRequest['assigneeType']; text: string } {
  const at = (req.assigneeType ?? 'EMPLOYEE') as AllocationRequest['assigneeType'];
  switch (at) {
    case 'DEPARTMENT': {
      const d = req.beneficiaryDepartment;
      return { type: 'DEPARTMENT', text: d ? `${d.code ?? d.id} — ${d.name ?? ''}` : '—' };
    }
    case 'LOCATION': {
      const loc = req.beneficiaryLocation;
      return { type: 'LOCATION', text: loc ? `${loc.code ?? loc.id} — ${loc.name ?? ''}` : '—' };
    }
    case 'COMPANY':
      return { type: 'COMPANY', text: 'Toàn công ty' };
    default: {
      const e = req.beneficiaryEmployee;
      return {
        type: 'EMPLOYEE',
        text: e ? `${e.code ?? e.id} — ${e.fullName ?? ''}` : '—',
      };
    }
  }
}

export function buildAllocationRequests(
  requests: AllocationRequestDto[],
  lines: AllocationRequestLineDto[],
): AllocationRequest[] {
  return requests.map(req => {
    const rlines = lines.filter(l => l.request?.id === req.id);
    const mapped: AllocationRequestLine[] = rlines.map(l => ({
      id: String(l.id),
      itemId: String(l.assetItem?.id ?? ''),
      assetLineId: l.assetLine?.id != null ? String(l.assetLine.id) : undefined,
      quantity: l.quantity ?? 0,
      notes: l.note ?? '',
      equipmentId: l.equipment?.id != null ? String(l.equipment.id) : undefined,
    }));
    const { type: assigneeType, text: assigneeSummary } = allocationAssigneeSummary(req);
    return {
      id: String(req.id),
      code: req.code ?? '',
      requesterId: String(req.requester?.id ?? ''),
      departmentId: String(req.requester?.department?.id ?? ''),
      reason: req.reason ?? '',
      attachmentNote: req.attachmentNote ?? undefined,
      beneficiaryNote: req.beneficiaryNote ?? undefined,
      assigneeType,
      assigneeSummary,
      beneficiaryEmployeeId:
        req.beneficiaryEmployee?.id != null ? String(req.beneficiaryEmployee.id) : undefined,
      beneficiaryDepartmentId:
        req.beneficiaryDepartment?.id != null ? String(req.beneficiaryDepartment.id) : undefined,
      beneficiaryLocationId:
        req.beneficiaryLocation?.id != null ? String(req.beneficiaryLocation.id) : undefined,
      stockIssueId: req.stockIssueId != null ? String(req.stockIssueId) : undefined,
      stockIssueCode: req.stockIssueCode ?? undefined,
      status: (req.status ?? 'PENDING') as AllocationRequest['status'],
      lines: mapped,
      createdAt: req.requestDate ? req.requestDate.slice(0, 10) : '',
      approvedAt: undefined,
      approvedBy: undefined,
      rejectionReason: undefined,
    };
  });
}

export function mapRepairDto(r: RepairRequestDto): RepairRequest {
  return {
    id: String(r.id),
    code: r.code ?? '',
    requesterId: String(r.requester?.id ?? ''),
    departmentId: String(r.requester?.department?.id ?? ''),
    equipmentId: String(r.equipment?.id ?? ''),
    issue: r.problemCategory ?? '',
    description: r.description ?? '',
    attachmentNote: r.attachmentNote ?? undefined,
    result: (r.repairOutcome as RepairRequest['result']) ?? undefined,
    status: (r.status ?? 'NEW') as RepairRequest['status'],
    createdAt: r.requestDate ? r.requestDate.slice(0, 10) : '',
    receivedAt: undefined,
    completedAt: undefined,
  };
}

export function buildReturnRequests(
  requests: ReturnRequestDto[],
  lines: ReturnRequestLineDto[],
): ReturnRequest[] {
  return requests.map(req => {
    const rlines = lines.filter(l => l.request?.id === req.id);
    const mapped: ReturnRequestLine[] = rlines.map(l => ({
      id: String(l.id),
      itemId: String(l.assetItem?.id ?? ''),
      equipmentId: l.equipment?.id != null ? String(l.equipment.id) : undefined,
      quantity: l.quantity ?? 0,
      selected: l.selected === true,
      disposition: (l.disposition as ReturnRequestLine['disposition']) ?? 'TO_STOCK',
      notes: l.note ?? '',
    }));
    return {
      id: String(req.id),
      code: req.code ?? '',
      requesterId: String(req.requester?.id ?? ''),
      departmentId: String(req.requester?.department?.id ?? ''),
      reason: req.note ?? '',
      status: (req.status ?? 'PENDING') as ReturnRequest['status'],
      lines: mapped,
      createdAt: req.requestDate ? req.requestDate.slice(0, 10) : '',
    };
  });
}
