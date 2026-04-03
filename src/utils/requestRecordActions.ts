/** Quy tắc thao tác theo trạng thái — đồng bộ FE với BE. */

export function canEditAllocationRequestFields(status: string): boolean {
  return status === 'PENDING';
}

export function canDeleteAllocationRequest(status: string): boolean {
  return status === 'PENDING' || status === 'REJECTED' || status === 'CANCELLED';
}

export function canEditRepairRequestFields(status: string): boolean {
  return status === 'NEW';
}

export function canDeleteRepairRequest(status: string): boolean {
  return status === 'NEW' || status === 'REJECTED';
}

export function canEditReturnRequestFields(status: string): boolean {
  return status === 'PENDING';
}

export function canDeleteReturnRequest(status: string): boolean {
  return status === 'PENDING' || status === 'REJECTED' || status === 'CANCELLED';
}

export function canCancelAllocationAsEmployee(status: string): boolean {
  return status === 'PENDING';
}

export function canCancelReturnAsEmployee(status: string): boolean {
  return status === 'PENDING';
}
