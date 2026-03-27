import { useState } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { systemLogs, SystemLog, getEmployeeName, formatDateTime } from '@/data/mockData';

const moduleLabels: Record<string, string> = {
  STOCK_IN: 'Nhập kho', STOCK_OUT: 'Xuất kho', REQUEST: 'Yêu cầu CP',
  REPAIR: 'Sửa chữa', RETURN: 'Thu hồi',
};

const actionLabels: Record<string, string> = {
  CREATE: 'Tạo mới', CONFIRM: 'Xác nhận', APPROVE: 'Duyệt',
  REJECT: 'Từ chối', CANCEL: 'Hủy', RECEIVE: 'Tiếp nhận',
};

const SystemLogs = () => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const filtered = systemLogs.filter(log => {
    if (filters.search && !log.objectCode.toLowerCase().includes(filters.search.toLowerCase()) && !log.details.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.module && log.module !== filters.module) return false;
    if (filters.action && log.action !== filters.action) return false;
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<SystemLog>[] = [
    { key: 'createdAt', label: 'Thời gian', render: r => <span className="text-sm whitespace-nowrap">{formatDateTime(r.createdAt)}</span> },
    { key: 'user', label: 'Người thực hiện', render: r => getEmployeeName(r.userId) },
    { key: 'action', label: 'Hành động', render: r => (
      <span className="status-badge bg-muted text-muted-foreground">{actionLabels[r.action] || r.action}</span>
    )},
    { key: 'module', label: 'Module', render: r => moduleLabels[r.module] || r.module },
    { key: 'objectCode', label: 'Mã đối tượng', render: r => <span className="font-mono text-sm">{r.objectCode}</span> },
    { key: 'transition', label: 'Chuyển TT', render: r => r.fromStatus && r.toStatus ? `${r.fromStatus} → ${r.toStatus}` : '—' },
    { key: 'details', label: 'Chi tiết', render: r => <span className="max-w-xs truncate block text-sm">{r.details}</span> },
  ];

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã, chi tiết...' },
    { key: 'module', label: 'Module', type: 'select', options: Object.entries(moduleLabels).map(([v, l]) => ({ value: v, label: l })) },
    { key: 'action', label: 'Hành động', type: 'select', options: Object.entries(actionLabels).map(([v, l]) => ({ value: v, label: l })) },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhật ký hệ thống</h1>
          <p className="page-description">Lịch sử thao tác trên hệ thống</p>
        </div>
      </div>
      <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />
    </div>
  );
};

export default SystemLogs;
