type BuildReceiptNoteOptions = {
  returnRequestRefId?: string;
};

/** Ghi chú phiếu nhập: metadata + ghi chú người dùng (đồng bộ với viewModels). */
export function buildReceiptNote(userNotes: string, supplierId: string, options?: BuildReceiptNoteOptions): string {
  const parts: string[] = [];
  if (supplierId) parts.push(`supplierRef:${supplierId}`);
  if (options?.returnRequestRefId) parts.push(`returnRequestRef:${options.returnRequestRefId}`);
  if (userNotes.trim()) parts.push(userNotes.trim());
  return parts.join('\n');
}

/** Nối các dòng `FILE:url` (sau upload) vào cuối ghi chú phiếu nhập / xuất. */
export function appendFileUrlsToNote(note: string, urls: string[]): string {
  const lines = urls.filter(Boolean).map(u => {
    const path = u.startsWith('/') ? u : `/${u}`;
    return `FILE:${path}`;
  });
  if (lines.length === 0) return note;
  const base = note.trim();
  return base ? `${base}\n${lines.join('\n')}` : lines.join('\n');
}
