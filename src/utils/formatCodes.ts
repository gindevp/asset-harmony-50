/**
 * Tài liệu: mã dạng viết tắt + 6 số, hiển thị có gạch (vd EQ-000001, TS-000001).
 * Giá trị API/DB thường không gạch — chỉ dùng hàm này khi render.
 */

/** Thiết bị: EQ000001 → EQ-000001 */
export function formatEquipmentCodeDisplay(code: string | undefined | null): string {
  if (code == null || String(code).trim() === '') return '—';
  const s = String(code).trim();
  const m = /^([A-Za-z]{2,8})(\d{6})$/.exec(s);
  if (m) return `${m[1].toUpperCase()}-${m[2]}`;
  return s;
}

/** Mã nghiệp vụ chung: PREFIX + 6 chữ số cuối → PREFIX-000001 */
export function formatBizCodeDisplay(code: string | undefined | null): string {
  if (code == null || String(code).trim() === '') return '—';
  const s = String(code).trim();
  const m = /^([A-Za-z]+)(\d{6})$/.exec(s);
  if (m) return `${m[1].toUpperCase()}-${m[2]}`;
  return s;
}
