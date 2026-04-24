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

/** Khớp ghi chú bàn giao do BE thêm khi YC cấp phát có đối tượng nhận = phòng ban (AllocationRequestService). */
const ASSIGNMENT_NOTE_DEPARTMENT_POOL = 'scoped=DEPT';
const ASSIGNMENT_NOTE_LOCATION_POOL = 'scoped=LOC';
const ASSIGNMENT_NOTE_COMPANY_VI = 'đối tượng: công ty';
const ASSIGNMENT_NOTE_COMPANY_ASCII = 'doi tuong: cong ty';
const STOCK_ISSUE_NOTE_COMPANY_VI = 'đối tượng: công ty';
const STOCK_ISSUE_NOTE_COMPANY_ASCII = 'doi tuong: cong ty';

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
      : (assignment as { departmentId?: number | string })?.departmentId != null
        ? String((assignment as { departmentId?: number | string }).departmentId)
      : assignment?.employee?.department?.id != null
        ? String(assignment.employee.department.id)
        : undefined;
  const locId =
    assignment?.location?.id != null
      ? String(assignment.location.id)
      : (assignment as { locationId?: number | string })?.locationId != null
        ? String((assignment as { locationId?: number | string }).locationId)
      : assignment?.employee?.location?.id != null
        ? String(assignment.employee.location.id)
        : undefined;
  const locationAssignedDirectly =
    assignment?.location?.id != null ||
    (assignment as { locationId?: number | string })?.locationId != null;
  const deptName =
    assignment?.department?.name ??
    assignment?.employee?.department?.name ??
    undefined;
  const locName =
    assignment?.location?.name ?? assignment?.employee?.location?.name ?? undefined;
  const assignNote = typeof assignment?.note === 'string' ? assignment.note : '';
  const departmentPoolFromAllocation =
    assignNote.includes(ASSIGNMENT_NOTE_DEPARTMENT_POOL);
  const noteLower = assignNote.toLowerCase();
  const locationPoolFromAllocation =
    assignNote.includes(ASSIGNMENT_NOTE_LOCATION_POOL) ||
    noteLower.includes(ASSIGNMENT_NOTE_COMPANY_VI) ||
    noteLower.includes(ASSIGNMENT_NOTE_COMPANY_ASCII);
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
    assignedDate: assignment?.assignedDate ?? undefined,
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
    locationAssignedDirectly,
    departmentPoolFromAllocation,
    locationPoolFromAllocation,
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
    .filter(l => !l.startsWith('supplierRef:') && !l.startsWith('returnRequestRef:'))
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
    const noteLower = String(iss.note ?? '').toLowerCase();
    const isCompanyByNote =
      noteLower.includes(STOCK_ISSUE_NOTE_COMPANY_VI) ||
      noteLower.includes(STOCK_ISSUE_NOTE_COMPANY_ASCII);
    if (iss.assigneeType === 'DEPARTMENT') {
      recipientType = 'DEPARTMENT';
      recipientId = String(iss.department?.id ?? '');
    } else if (iss.assigneeType === 'LOCATION') {
      recipientType = isCompanyByNote ? 'COMPANY' : 'LOCATION';
      recipientId = String(iss.location?.id ?? '');
    } else if (iss.assigneeType === 'COMPANY') {
      recipientType = 'COMPANY';
      recipientId = String(iss.location?.id ?? '');
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
      const deptText = d ? `${d.code ?? d.id} — ${d.name ?? ''}` : '—';
      return { type: 'DEPARTMENT', text: deptText };
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
      lineType: (String(l.lineType ?? 'DEVICE').toUpperCase() === 'CONSUMABLE' ? 'CONSUMABLE' : 'DEVICE') as
        | 'DEVICE'
        | 'CONSUMABLE',
      itemId: String(l.assetItem?.id ?? ''),
      itemCode: (l.assetItem?.code ?? '').trim() || undefined,
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
      rejectionReason: req.rejectionReason?.trim() ? req.rejectionReason : undefined,
    };
  });
}

export function mapRepairDto(r: RepairRequestDto): RepairRequest {
  const sortedLines = [...(r.lines ?? [])].sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0));
  const deviceLineIds = sortedLines
    .filter(l => String(l.lineType ?? 'DEVICE').toUpperCase() !== 'CONSUMABLE')
    .map(l => l.equipment?.id)
    .filter((x): x is number => x != null)
    .map(String);
  const equipmentLineIds =
    deviceLineIds.length > 0 ? deviceLineIds : r.equipment?.id != null ? [String(r.equipment.id)] : [];
  const consumableRepairLines = sortedLines
    .filter(l => String(l.lineType ?? '').toUpperCase() === 'CONSUMABLE' && l.assetItem?.id != null)
    .map(l => ({
      assetItemId: String(l.assetItem!.id),
      quantity: l.quantity ?? 1,
    }));
  const equipmentId = equipmentLineIds[0] ?? String(r.equipment?.id ?? '');
  return {
    id: String(r.id),
    code: r.code ?? '',
    requesterId: String(r.requester?.id ?? ''),
    departmentId: String(r.requester?.department?.id ?? ''),
    equipmentId,
    equipmentLineIds: equipmentLineIds.length > 0 ? equipmentLineIds : undefined,
    consumableRepairLines: consumableRepairLines.length > 0 ? consumableRepairLines : undefined,
    companySiteReport: Boolean(r.companySiteReport),
    reportedLocationId: r.reportedLocation?.id != null ? String(r.reportedLocation.id) : undefined,
    reportedLocationName: r.reportedLocation?.name?.trim() ? r.reportedLocation.name.trim() : undefined,
    issue: r.problemCategory ?? '',
    description: r.description ?? '',
    attachmentNote: r.attachmentNote ?? undefined,
    result: (r.repairOutcome as RepairRequest['result']) ?? undefined,
    status: (r.status ?? 'NEW') as RepairRequest['status'],
    rejectionReason: r.rejectionReason?.trim() ? r.rejectionReason : undefined,
    createdAt: r.requestDate ? r.requestDate.slice(0, 10) : '',
    receivedAt: undefined,
    completedAt: undefined,
  };
}

const RETURN_REQUEST_STATUS_KEYS = ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'] as const;

function normalizeReturnRequestStatus(status: string | undefined): ReturnRequest['status'] {
  const u = String(status ?? 'PENDING').trim().toUpperCase();
  return (RETURN_REQUEST_STATUS_KEYS as readonly string[]).includes(u)
    ? (u as ReturnRequest['status'])
    : 'PENDING';
}

export function buildReturnRequests(
  requests: ReturnRequestDto[],
  lines: ReturnRequestLineDto[],
): ReturnRequest[] {
  return requests.map(req => {
    const reqId = String(req.id ?? '');
    const rlines = lines.filter(l => String(l.request?.id ?? '') === reqId);
    const mapped: ReturnRequestLine[] = rlines.map(l => {
      const lineType =
        String(l.lineType ?? 'DEVICE').toUpperCase() === 'CONSUMABLE' ? 'CONSUMABLE' : 'DEVICE';
      const itemFromLine = l.assetItem?.id != null ? String(l.assetItem.id) : '';
      const itemFromEquipment = l.equipment?.assetItem?.id != null ? String(l.equipment.assetItem.id) : '';
      const itemId = itemFromLine || itemFromEquipment;
      return {
        id: String(l.id),
        itemId,
        lineType,
        equipmentId: l.equipment?.id != null ? String(l.equipment.id) : undefined,
        quantity: l.quantity ?? 0,
        selected: l.selected === true,
        disposition: (l.disposition as ReturnRequestLine['disposition']) ?? 'TO_STOCK',
        notes: l.note ?? '',
      };
    });
    return {
      id: String(req.id),
      code: req.code ?? '',
      requesterId: String(req.requester?.id ?? ''),
      departmentId: String(req.requester?.department?.id ?? ''),
      reason: req.note ?? req.reason ?? '',
      status: normalizeReturnRequestStatus(req.status),
      lines: mapped,
      createdAt: req.requestDate ? req.requestDate.slice(0, 10) : '',
    };
  });
}

/**
 * Sau POST phiếu + dòng: refetch đôi khi thiếu dòng (đọc list chưa kịp thấy FK) → cột Loại/Tên trống.
 * Gộp bản build từ body API tạo phiếu để vá cache khi thiếu dòng.
 */
export function mergeReturnRequestViewAfterCreate(
  previous: ReturnRequest[] | undefined,
  header: ReturnRequestDto,
  lineBodies: ReturnRequestLineDto[],
): ReturnRequest[] {
  const [fresh] = buildReturnRequests([header], lineBodies);
  const list = previous ?? [];
  const idx = list.findIndex(r => String(r.id) === String(header.id));
  if (idx === -1) return [fresh, ...list];
  const cur = list[idx];
  if ((cur.lines?.length ?? 0) > 0) return list;
  return list.map((r, i) => (i === idx ? fresh : r));
}

/** Snapshot cache React Query cho `return-requests-view`. */
export type ReturnRequestsViewSnapshot = {
  requests: ReturnRequest[];
  lineDtos: ReturnRequestLineDto[];
};

export function mergeReturnRequestsFullViewAfterCreate(
  previous: ReturnRequestsViewSnapshot | undefined,
  header: ReturnRequestDto,
  lineBodies: ReturnRequestLineDto[],
): ReturnRequestsViewSnapshot {
  const p = previous ?? { requests: [], lineDtos: [] };
  const requests = mergeReturnRequestViewAfterCreate(p.requests, header, lineBodies);
  const existingIds = new Set(p.lineDtos.map(l => String(l.id ?? '')));
  const toAdd = lineBodies.filter(l => l.id != null && !existingIds.has(String(l.id)));
  const lineDtos = [...toAdd, ...p.lineDtos];
  return { requests, lineDtos };
}
