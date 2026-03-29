/**
 * Xuất CSV UTF-8 (có BOM) để Excel nhận đúng tiếng Việt.
 */

function escapeCell(value: string | number | boolean | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const lines = [header.map(escapeCell).join(','), ...rows.map(row => row.map(escapeCell).join(','))];
  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function reportFilename(prefix: string): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${prefix}-${y}${m}${day}.csv`;
}
