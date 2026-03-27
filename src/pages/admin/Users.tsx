import { useState } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { employees, Employee, departments } from '@/data/mockData';

const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị viên', ASSET_MANAGER: 'Quản lý tài sản',
  DEPARTMENT_COORDINATOR: 'Điều phối PB', EMPLOYEE: 'Nhân viên',
};

const roleBadgeClass: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  ASSET_MANAGER: 'bg-blue-100 text-blue-800',
  DEPARTMENT_COORDINATOR: 'bg-purple-100 text-purple-800',
  EMPLOYEE: 'bg-gray-100 text-gray-700',
};

const UsersPage = () => {
  const [page, setPage] = useState(1);

  const columns: Column<Employee>[] = [
    { key: 'code', label: 'Mã NV', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'name', label: 'Họ tên' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'SĐT' },
    { key: 'department', label: 'Phòng ban', render: r => departments.find(d => d.id === r.departmentId)?.name },
    { key: 'position', label: 'Chức danh' },
    { key: 'role', label: 'Vai trò', render: r => (
      <span className={`status-badge ${roleBadgeClass[r.role]}`}>{roleLabels[r.role]}</span>
    )},
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Người dùng</h1>
          <p className="page-description">Danh sách người dùng trong hệ thống</p>
        </div>
      </div>
      <DataTable columns={columns} data={employees} currentPage={page} onPageChange={setPage} />
    </div>
  );
};

export default UsersPage;
