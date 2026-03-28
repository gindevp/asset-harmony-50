import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityFormModal } from '@/components/shared/EntityFormModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { employees as initialEmployees, Employee, EmployeeStatus, departments } from '@/data/mockData';
import { Download, Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

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

const statusLabels: Record<EmployeeStatus, string> = {
  ACTIVE: 'Hoạt động', INACTIVE: 'Không hoạt động', DELETED: 'Tạm xóa',
};

const statusBadgeClass: Record<EmployeeStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-yellow-100 text-yellow-800',
  DELETED: 'bg-red-100 text-red-600',
};

const tabCounts = (data: Employee[]) => ({
  ALL: data.length,
  ACTIVE: data.filter(e => e.status === 'ACTIVE').length,
  INACTIVE: data.filter(e => e.status === 'INACTIVE').length,
  DELETED: data.filter(e => e.status === 'DELETED').length,
});

const emptyForm = { name: '', email: '', phone: '', departmentId: '', position: '', role: 'EMPLOYEE' as Employee['role'] };

const UsersPage = () => {
  const [data, setData] = useState<Employee[]>(initialEmployees);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'ALL' | EmployeeStatus>('ALL');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const counts = useMemo(() => tabCounts(data), [data]);

  const filtered = useMemo(() => {
    let result = data;
    if (tab !== 'ALL') result = result.filter(e => e.status === tab);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(e => e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s) || e.email.toLowerCase().includes(s));
    }
    if (filters.role) result = result.filter(e => e.role === filters.role);
    if (filters.department) result = result.filter(e => e.departmentId === filters.department);
    return result;
  }, [data, tab, filters]);

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã NV, họ tên, email...' },
    { key: 'role', label: 'Vai trò', type: 'select', options: Object.entries(roleLabels).map(([v, l]) => ({ value: v, label: l })) },
    { key: 'department', label: 'Phòng ban', type: 'select', options: departments.map(d => ({ value: d.id, label: d.name })) },
  ];

  const handleExportCSV = () => {
    const header = 'Mã NV,Họ tên,Email,SĐT,Phòng ban,Chức danh,Vai trò,Trạng thái';
    const rows = filtered.map(e => [
      e.code, e.name, e.email, e.phone,
      departments.find(d => d.id === e.departmentId)?.name || '',
      e.position, roleLabels[e.role], statusLabels[e.status],
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'nguoi-dung.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file CSV');
  };

  const handleAdd = () => {
    if (!form.name || !form.email || !form.departmentId) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    const nextCode = `NV${String(data.length + 1).padStart(6, '0')}`;
    const newEmp: Employee = {
      id: `emp-${Date.now()}`, code: nextCode,
      ...form, status: 'ACTIVE', createdAt: new Date().toISOString().split('T')[0],
    };
    setData(prev => [newEmp, ...prev]);
    setForm(emptyForm);
    setAddOpen(false);
    toast.success('Đã thêm người dùng mới');
  };

  const handleSoftDelete = () => {
    if (!deleteTarget) return;
    setData(prev => prev.map(e => e.id === deleteTarget.id ? { ...e, status: 'DELETED' as EmployeeStatus } : e));
    setDeleteTarget(null);
    toast.success('Đã tạm xóa người dùng');
  };

  const openEdit = (emp: Employee) => {
    setEditTarget(emp);
    setEditForm({ name: emp.name, email: emp.email, phone: emp.phone, departmentId: emp.departmentId, position: emp.position, role: emp.role });
  };

  const handleEdit = () => {
    if (!editTarget) return;
    if (!editForm.name || !editForm.email || !editForm.departmentId) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    setData(prev => prev.map(e => e.id === editTarget.id ? { ...e, ...editForm } : e));
    setEditTarget(null);
    toast.success('Đã cập nhật người dùng');
  };

  const columns: Column<Employee>[] = [
    { key: 'code', label: 'Mã NV', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'name', label: 'Họ tên' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'SĐT' },
    { key: 'department', label: 'Phòng ban', render: r => departments.find(d => d.id === r.departmentId)?.name },
    { key: 'position', label: 'Chức danh' },
    { key: 'role', label: 'Vai trò', render: r => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass[r.role]}`}>{roleLabels[r.role]}</span>
    )},
    { key: 'status', label: 'Trạng thái', render: r => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass[r.status]}`}>{statusLabels[r.status]}</span>
    )},
    { key: 'actions', label: '', render: r => r.status !== 'DELETED' ? (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ) : null },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Người dùng</h1>
          <p className="page-description">Danh sách người dùng trong hệ thống</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" /> Xuất CSV
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Thêm người dùng
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v as any); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="ALL">Tất cả ({counts.ALL})</TabsTrigger>
          <TabsTrigger value="ACTIVE">Hoạt động ({counts.ACTIVE})</TabsTrigger>
          <TabsTrigger value="INACTIVE">Không hoạt động ({counts.INACTIVE})</TabsTrigger>
          <TabsTrigger value="DELETED">Tạm xóa ({counts.DELETED})</TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar fields={filterFields} values={filters} onChange={(k, v) => { setFilters(prev => ({ ...prev, [k]: v })); setPage(1); }} onReset={() => { setFilters({}); setPage(1); }} />

      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />

      {/* Dialog thêm người dùng */}
      <EntityFormModal open={addOpen} onClose={() => { setAddOpen(false); setForm(emptyForm); }} title="Thêm người dùng mới" onSubmit={handleAdd} submitLabel="Thêm" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Họ tên <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nhập họ tên" />
          </div>
          <div className="space-y-2">
            <Label>Email <span className="text-destructive">*</span></Label>
            <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@company.vn" />
          </div>
          <div className="space-y-2">
            <Label>Số điện thoại</Label>
            <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="09xxxxxxxx" />
          </div>
          <div className="space-y-2">
            <Label>Phòng ban <span className="text-destructive">*</span></Label>
            <Select value={form.departmentId} onValueChange={v => setForm(p => ({ ...p, departmentId: v }))}>
              <SelectTrigger><SelectValue placeholder="Chọn phòng ban" /></SelectTrigger>
              <SelectContent>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Chức danh</Label>
            <Input value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} placeholder="Nhập chức danh" />
          </div>
          <div className="space-y-2">
            <Label>Vai trò</Label>
            <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v as Employee['role'] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(roleLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </EntityFormModal>

      {/* Dialog xác nhận xóa */}
      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận tạm xóa</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn tạm xóa người dùng <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code})? Người dùng sẽ bị vô hiệu hóa nhưng dữ liệu vẫn được giữ lại.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleSoftDelete}>Xác nhận xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
