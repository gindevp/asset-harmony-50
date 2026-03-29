/** Ghi chú phiếu nhập: dòng `supplierRef:<id>` + ghi chú người dùng (đồng bộ với viewModels). */
export function buildReceiptNote(userNotes: string, supplierId: string): string {
  const parts: string[] = [];
  if (supplierId) parts.push(`supplierRef:${supplierId}`);
  if (userNotes.trim()) parts.push(userNotes.trim());
  return parts.join('\n');
}
