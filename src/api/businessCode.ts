/**
 * Tài liệu: mã = viết tắt + 6 chữ số (vd TS000001, NCC000001).
 * Sinh mã ngẫu nhiên 6 số, độ dài tối đa 20 ký tự.
 */
export function makeBizCode(prefix: string): string {
  const p = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const n = String(Math.floor(100000 + Math.random() * 900000));
  return `${p}${n}`.slice(0, 20);
}
