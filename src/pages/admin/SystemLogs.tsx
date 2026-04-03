import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { apiGet } from '@/api/http';
import type { AppAuditLogDto } from '@/api/types';
import { formatDateTime } from '@/data/mockData';
import { toast } from 'sonner';
import { downloadCsv, reportFilename, rowsToCsv } from '@/utils/csvExport';

function statusBadgeClass(code: number | undefined): string {
  if (code == null) return 'text-muted-foreground';
  if (code >= 200 && code < 300) return 'text-emerald-700 font-semibold';
  if (code >= 400 && code < 500) return 'text-amber-700 font-semibold';
  if (code >= 500) return 'text-destructive font-semibold';
  return 'font-mono';
}

const SystemLogs = () => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const q = useQuery({
    queryKey: ['api', 'app-audit-logs'],
    queryFn: () => apiGet<AppAuditLogDto[]>(`/api/app-audit-logs?page=0&size=500&sort=occurredAt,desc`),
  });

  const rows = useMemo(() => {
    return (q.data ?? []).filter(log => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const path = (log.uriPath ?? '').toLowerCase();
        const login = (log.login ?? '').toLowerCase();
        const st = String(log.responseStatus ?? '');
        const detail = (log.detail ?? '').toLowerCase();
        if (!path.includes(s) && !login.includes(s) && !st.includes(s) && !detail.includes(s)) return false;
      }
      if (filters.method && log.httpMethod !== filters.method) return false;
      if (filters.status && String(log.responseStatus ?? '') !== filters.status) return false;
      return true;
    });
  }, [q.data, filters]);

  const exportCsv = () => {
    try {
      const csv = rowsToCsv(
        ['Thời gian (ISO)', 'Đăng nhập', 'Method', 'Đường dẫn', 'HTTP', 'Chi tiết'],
        rows.map(r => [
          r.occurredAt ?? '',
          r.login ?? '',
          r.httpMethod ?? '',
          r.uriPath ?? '',
          r.responseStatus ?? '',
        ]),
      );
      downloadCsv(reportFilename('nhat-ky-he-thong'), csv);
      toast.success(`Đã tải ${rows.length} dòng`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi xuất file');
    }
  };

  const columns: Column<AppAuditLogDto>[] = [
    {
      key: 'occurredAt',
      label: 'Thời gian',
      render: r => <span className="text-sm whitespace-nowrap">{formatDateTime((r.occurredAt ?? '').replace('Z', ''))}</span>,
    },
    { key: 'login', label: 'Người thực hiện', render: r => r.login ?? '—' },
    { key: 'httpMethod', label: 'Method', render: r => <span className="font-mono text-xs">{r.httpMethod}</span> },
    { key: 'uriPath', label: 'Đường dẫn', render: r => <span className="font-mono text-xs break-all">{r.uriPath}</span> },
    {
      key: 'responseStatus',
      label: 'HTTP',
      className: 'text-center',
      render: r => (
        <span className={`font-mono text-sm ${statusBadgeClass(r.responseStatus)}`}>{r.responseStatus ?? '—'}</span>
      ),
    },
  ];

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'path, login, mã HTTP...' },
    {
      key: 'method',
      label: 'Method',
      type: 'select',
      options: [
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
        { value: 'PATCH', label: 'PATCH' },
        { value: 'DELETE', label: 'DELETE' },
        { value: 'BIZ', label: 'BIZ (nghiệp vụ)' },
      ],
    },
    {
      key: 'status',
      label: 'Mã HTTP',
      type: 'select',
      options: [
        { value: '200', label: '200 OK' },
        { value: '201', label: '201 Created' },
        { value: '204', label: '204 No Content' },
      ],
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhật ký hệ thống & lịch sử thao tác</h1>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={q.isLoading || rows.length === 0}>
          <FileDown className="h-4 w-4 mr-1" /> Xuất CSV (đã lọc)
        </Button>
      </div>
      {q.isError && (
        <p className="text-sm text-destructive mb-2">Không tải được nhật ký (cần đăng nhập QLTS/Admin).</p>
      )}
      {q.isLoading && <p className="text-sm text-muted-foreground mb-2">Đang tải nhật ký…</p>}
      <FilterBar fields={filterFields} values={filters} onChange={(k, v) => { setFilters(p => ({ ...p, [k]: v })); setPage(1); }} onReset={() => { setFilters({}); setPage(1); }} />
      <DataTable columns={columns} data={rows} currentPage={page} onPageChange={setPage} />
    </div>
  );
};

export default SystemLogs;
