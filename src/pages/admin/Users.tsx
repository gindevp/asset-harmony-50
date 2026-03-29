import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityFormModal } from '@/components/shared/EntityFormModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { AdminUserDto, EmployeeDto } from '@/api/types';
import { getLocationName, type Employee, type EmployeeStatus } from '@/data/mockData';
import { Download, Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useDepartments, useEmployees, useLocations } from '@/hooks/useEntityApi';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, getStoredToken } from '@/api/http';
import { hasAnyAuthority } from '@/auth/jwt';
import { makeBizCode } from '@/api/businessCode';

function mapEmployeeFromApi(d: EmployeeDto): Employee {
  const id = String(d.id ?? '');
  return {
    id,
    code: d.code ?? id,
    name: d.fullName ?? '',
    email: '',
    phone: '',
    departmentId: String(d.department?.id ?? ''),
    locationId: d.location?.id != null ? String(d.location.id) : undefined,
    position: d.jobTitle ?? '',
    role: 'EMPLOYEE',
    status: (d.active === false ? 'INACTIVE' : 'ACTIVE') as EmployeeStatus,
    createdAt: '',
  };
}

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
});

type EmpForm = { name: string; departmentId: string; position: string; locationId: string };
type EmpEditForm = EmpForm & { id: string; code: string; active: boolean };

const emptyForm: EmpForm = { name: '', departmentId: '', position: '', locationId: '' };
const emptyEditForm = (): EmpEditForm => ({ id: '', code: '', name: '', departmentId: '', position: '', locationId: '', active: true });

const authorityOptions = [
  { value: 'ROLE_EMPLOYEE', label: 'Nhân viên' },
  { value: 'ROLE_DEPARTMENT_COORDINATOR', label: 'Điều phối phòng ban' },
  { value: 'ROLE_ASSET_MANAGER', label: 'Quản lý tài sản' },
  { value: 'ROLE_GD', label: 'Giám đốc' },
  { value: 'ROLE_ADMIN', label: 'Quản trị' },
];

const UsersPage = () => {
  const qc = useQueryClient();
  const canSysAdmin = hasAnyAuthority(getStoredToken(), ['ROLE_ADMIN']);
  const [empBusy, setEmpBusy] = useState(false);
  const [section, setSection] = useState<'employees' | 'accounts'>('employees');

  const adminUsersQ = useQuery({
    queryKey: ['api', 'admin', 'users'],
    queryFn: () => apiGet<AdminUserDto[]>(`/api/admin/users?page=0&size=1000&sort=login,asc`),
    enabled: section === 'accounts' && canSysAdmin,
  });

  const [accAddOpen, setAccAddOpen] = useState(false);
  const [accBusy, setAccBusy] = useState(false);
  const [accForm, setAccForm] = useState({
    login: '',
    email: '',
    firstName: '',
    lastName: '',
    authority: 'ROLE_EMPLOYEE',
    employeeId: '',
  });
  const [accDeleteLogin, setAccDeleteLogin] = useState<string | null>(null);
  const [accEditOpen, setAccEditOpen] = useState(false);
  const [accEditForm, setAccEditForm] = useState({
    id: '',
    login: '',
    email: '',
    firstName: '',
    lastName: '',
    activated: true,
    langKey: 'en',
    authority: 'ROLE_EMPLOYEE',
    employeeId: '',
  });

  const invalidateAccounts = () => void qc.invalidateQueries({ queryKey: ['api', 'admin', 'users'] });

  const submitAccount = async () => {
    if (!accForm.login.trim() || !accForm.email.trim()) {
      toast.error('Nhập login và email');
      return;
    }
    setAccBusy(true);
    try {
      await apiPost('/api/admin/users', {
        login: accForm.login.trim().toLowerCase(),
        firstName: accForm.firstName.trim() || 'User',
        lastName: accForm.lastName.trim() || '',
        email: accForm.email.trim().toLowerCase(),
        activated: true,
        langKey: 'en',
        authorities: [accForm.authority],
        ...(accForm.employeeId ? { employeeId: Number(accForm.employeeId) } : {}),
      });
      toast.success('Đã tạo tài khoản (mật khẩu gửi email kích hoạt — cấu hình mail server)');
      setAccAddOpen(false);
      setAccForm({ login: '', email: '', firstName: '', lastName: '', authority: 'ROLE_EMPLOYEE', employeeId: '' });
      invalidateAccounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setAccBusy(false);
    }
  };

  const openAccEdit = (r: AdminUserDto) => {
    setAccEditForm({
      id: String(r.id ?? ''),
      login: r.login ?? '',
      email: r.email ?? '',
      firstName: r.firstName ?? '',
      lastName: r.lastName ?? '',
      activated: r.activated !== false,
      langKey: r.langKey ?? 'en',
      authority: (r.authorities && r.authorities.length > 0 ? r.authorities[0] : 'ROLE_EMPLOYEE') as string,
      employeeId: r.employeeId != null && r.employeeId !== undefined ? String(r.employeeId) : '',
    });
    setAccEditOpen(true);
  };

  const submitAccountEdit = async () => {
    if (!accEditForm.id || !accEditForm.login.trim() || !accEditForm.email.trim()) {
      toast.error('Thiếu id, login hoặc email');
      return;
    }
    setAccBusy(true);
    try {
      await apiPut('/api/admin/users', {
        id: Number(accEditForm.id),
        login: accEditForm.login.trim().toLowerCase(),
        firstName: accEditForm.firstName.trim() || 'User',
        lastName: accEditForm.lastName.trim() || '',
        email: accEditForm.email.trim().toLowerCase(),
        activated: accEditForm.activated,
        langKey: accEditForm.langKey || 'en',
        authorities: [accEditForm.authority],
        ...(accEditForm.employeeId ? { employeeId: Number(accEditForm.employeeId) } : { employeeId: null }),
      });
      toast.success('Đã cập nhật tài khoản');
      setAccEditOpen(false);
      invalidateAccounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setAccBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!accDeleteLogin) return;
    setAccBusy(true);
    try {
      await apiDelete(`/api/admin/users/${encodeURIComponent(accDeleteLogin)}`);
      toast.success('Đã xóa tài khoản');
      setAccDeleteLogin(null);
      invalidateAccounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setAccBusy(false);
    }
  };

  const empQ = useEmployees();
  const depQ = useDepartments();
  const locQ = useLocations();
  const data = useMemo(() => (empQ.data ?? []).map(mapEmployeeFromApi), [empQ.data]);
  const departments = useMemo(
    () =>
      (depQ.data ?? []).map(d => ({
        id: String(d.id),
        name: d.name ?? '',
        code: d.code ?? '',
      })),
    [depQ.data],
  );

  const employeeLabelById = useMemo(() => {
    const m = new Map<number, string>();
    for (const e of empQ.data ?? []) {
      if (e.id != null) m.set(e.id, `${e.code ?? e.id} — ${e.fullName ?? ''}`);
    }
    return m;
  }, [empQ.data]);

  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<EmpEditForm>(emptyEditForm());

  const counts = useMemo(() => tabCounts(data), [data]);

  const filtered = useMemo(() => {
    let result = data;
    if (tab !== 'ALL') result = result.filter(e => e.status === tab);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(e => e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s));
    }
    if (filters.department) result = result.filter(e => e.departmentId === filters.department);
    return result;
  }, [data, tab, filters]);

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã NV, họ tên…' },
    { key: 'department', label: 'Phòng ban', type: 'select', options: departments.map(d => ({ value: d.id, label: d.name })) },
  ];

  const handleExportCSV = () => {
    const header = 'Mã NV,Họ tên,Phòng ban,Chức danh,Trạng thái';
    const rows = filtered.map(e => [
      e.code, e.name,
      departments.find(d => d.id === e.departmentId)?.name || '',
      e.position, statusLabels[e.status],
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'nguoi-dung.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file CSV');
  };

  const invalidateEmployees = () => void qc.invalidateQueries({ queryKey: ['api', 'employees'] });

  const handleAdd = async () => {
    if (!form.name.trim() || !form.departmentId) {
      toast.error('Nhập họ tên và chọn phòng ban');
      return;
    }
    setEmpBusy(true);
    try {
      await apiPost<EmployeeDto>('/api/employees', {
        code: makeBizCode('NV'),
        fullName: form.name.trim(),
        jobTitle: form.position.trim() || undefined,
        active: true,
        department: { id: Number(form.departmentId) },
        ...(form.locationId ? { location: { id: Number(form.locationId) } } : {}),
      });
      toast.success('Đã thêm nhân viên');
      setAddOpen(false);
      setForm(emptyForm);
      invalidateEmployees();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setEmpBusy(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!deleteTarget?.id) return;
    setEmpBusy(true);
    try {
      await apiPatch<EmployeeDto>(`/api/employees/${deleteTarget.id}`, {
        id: Number(deleteTarget.id),
        active: false,
      });
      toast.success('Đã vô hiệu hóa nhân viên');
      setDeleteTarget(null);
      invalidateEmployees();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setEmpBusy(false);
    }
  };

  const openEdit = (emp: Employee) => {
    setEditTarget(emp);
    setEditForm({
      id: emp.id,
      code: emp.code,
      name: emp.name,
      departmentId: emp.departmentId,
      locationId: emp.locationId ?? '',
      position: emp.position,
      active: emp.status === 'ACTIVE',
    });
  };

  const handleEdit = async () => {
    if (!editTarget?.id || !editForm.name.trim() || !editForm.departmentId) {
      toast.error('Nhập họ tên và chọn phòng ban');
      return;
    }
    setEmpBusy(true);
    try {
      const empUpdate: EmployeeDto = {
        id: Number(editTarget.id),
        code: editForm.code.trim(),
        fullName: editForm.name.trim(),
        jobTitle: editForm.position.trim() || undefined,
        active: editForm.active,
        department: { id: Number(editForm.departmentId) },
      };
      empUpdate.location = editForm.locationId ? { id: Number(editForm.locationId) } : null;
      await apiPut<EmployeeDto>(`/api/employees/${editTarget.id}`, empUpdate);
      toast.success('Đã cập nhật nhân viên');
      setEditTarget(null);
      setEditForm(emptyEditForm());
      invalidateEmployees();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setEmpBusy(false);
    }
  };

  const columns: Column<Employee>[] = [
    { key: 'code', label: 'Mã NV', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'name', label: 'Họ tên' },
    { key: 'department', label: 'Phòng ban', render: r => departments.find(d => d.id === r.departmentId)?.name },
    {
      key: 'location',
      label: 'Vị trí',
      render: r =>
        r.locationId ? getLocationName(r.locationId, locQ.data ?? []) : '—',
    },
    { key: 'position', label: 'Chức danh' },
    { key: 'status', label: 'Trạng thái', render: r => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass[r.status]}`}>{statusLabels[r.status]}</span>
    )},
    {
      key: 'actions',
      label: '',
      render: r => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" disabled={empBusy} onClick={e => { e.stopPropagation(); openEdit(r); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          {r.status === 'ACTIVE' ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={empBusy} onClick={e => { e.stopPropagation(); setDeleteTarget(r); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const adminUsers = adminUsersQ.data ?? [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Người dùng & phân quyền</h1>
          <p className="page-description">
            {section === 'employees'
              ? 'Nhân viên master (HRM) — đồng bộ qua API /api/employees'
              : 'Tài khoản đăng nhập JHipster — chỉ ROLE_ADMIN quản lý'}
          </p>
        </div>
        {section === 'employees' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" /> Xuất CSV
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Thêm nhân viên
            </Button>
          </div>
        )}
        {section === 'accounts' && canSysAdmin && (
          <Button size="sm" onClick={() => setAccAddOpen(true)} disabled={accBusy}>
            <Plus className="h-4 w-4 mr-1" /> Thêm tài khoản
          </Button>
        )}
      </div>

      {canSysAdmin && (
        <Tabs value={section} onValueChange={v => setSection(v as 'employees' | 'accounts')} className="mb-4">
          <TabsList>
            <TabsTrigger value="employees">Nhân viên (HRM)</TabsTrigger>
            <TabsTrigger value="accounts">Tài khoản đăng nhập</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {section === 'employees' && (
        <>
          <Tabs value={tab} onValueChange={v => { setTab(v as 'ALL' | 'ACTIVE' | 'INACTIVE'); setPage(1); }}>
            <TabsList>
              <TabsTrigger value="ALL">Tất cả ({counts.ALL})</TabsTrigger>
              <TabsTrigger value="ACTIVE">Hoạt động ({counts.ACTIVE})</TabsTrigger>
              <TabsTrigger value="INACTIVE">Không hoạt động ({counts.INACTIVE})</TabsTrigger>
            </TabsList>
          </Tabs>

          <FilterBar fields={filterFields} values={filters} onChange={(k, v) => { setFilters(prev => ({ ...prev, [k]: v })); setPage(1); }} onReset={() => { setFilters({}); setPage(1); }} />

          <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />
        </>
      )}

      {section === 'accounts' && canSysAdmin && (
        <div className="space-y-4">
          {adminUsersQ.isError && (
            <p className="text-sm text-destructive">Không tải được danh sách tài khoản (cần ROLE_ADMIN).</p>
          )}
          {adminUsersQ.isLoading && <p className="text-sm text-muted-foreground">Đang tải…</p>}
          <DataTable
            columns={[
              { key: 'login', label: 'Login', render: (r: AdminUserDto) => <span className="font-mono text-sm">{r.login}</span> },
              { key: 'name', label: 'Họ tên', render: (r: AdminUserDto) => `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || '—' },
              { key: 'email', label: 'Email' },
              { key: 'act', label: 'Kích hoạt', render: (r: AdminUserDto) => (r.activated ? 'Có' : 'Không') },
              {
                key: 'roles',
                label: 'Quyền',
                render: (r: AdminUserDto) => (r.authorities ?? []).join(', '),
              },
              {
                key: 'employee',
                label: 'NV HRM',
                render: (r: AdminUserDto) =>
                  r.employeeId != null && r.employeeId !== undefined
                    ? employeeLabelById.get(r.employeeId) ?? `#${r.employeeId}`
                    : '—',
              },
              {
                key: 'edit',
                label: '',
                render: (r: AdminUserDto) =>
                  r.id != null ? (
                    <Button variant="ghost" size="sm" disabled={accBusy} onClick={() => openAccEdit(r)}>
                      Sửa
                    </Button>
                  ) : null,
              },
              {
                key: 'del',
                label: '',
                render: (r: AdminUserDto) =>
                  r.login ? (
                    <Button variant="ghost" size="sm" className="text-destructive" disabled={accBusy} onClick={() => setAccDeleteLogin(r.login!)}>
                      Xóa
                    </Button>
                  ) : null,
              },
            ]}
            data={adminUsers}
            emptyMessage="Chưa có tài khoản"
          />
        </div>
      )}

      <EntityFormModal
        open={accEditOpen}
        onClose={() => {
          setAccEditOpen(false);
          setAccEditForm({
            id: '',
            login: '',
            email: '',
            firstName: '',
            lastName: '',
            activated: true,
            langKey: 'en',
            authority: 'ROLE_EMPLOYEE',
            employeeId: '',
          });
        }}
        title="Sửa tài khoản đăng nhập"
        onSubmit={() => void submitAccountEdit()}
        submitLabel={accBusy ? 'Đang lưu…' : 'Lưu'}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Login</Label>
            <Input value={accEditForm.login} onChange={e => setAccEditForm(p => ({ ...p, login: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={accEditForm.email} onChange={e => setAccEditForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Tên</Label>
            <Input value={accEditForm.firstName} onChange={e => setAccEditForm(p => ({ ...p, firstName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Họ</Label>
            <Input value={accEditForm.lastName} onChange={e => setAccEditForm(p => ({ ...p, lastName: e.target.value }))} />
          </div>
          <div className="space-y-2 col-span-2 flex items-center gap-2">
            <Checkbox
              id="acc-act"
              checked={accEditForm.activated}
              onCheckedChange={v => setAccEditForm(p => ({ ...p, activated: v === true }))}
            />
            <Label htmlFor="acc-act" className="font-normal cursor-pointer">Kích hoạt</Label>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Vai trò</Label>
            <Select value={accEditForm.authority} onValueChange={v => setAccEditForm(p => ({ ...p, authority: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {authorityOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Liên kết nhân viên HRM</Label>
            <Select
              value={accEditForm.employeeId ? accEditForm.employeeId : '_none_'}
              onValueChange={v => setAccEditForm(p => ({ ...p, employeeId: v === '_none_' ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Không liên kết" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">Không liên kết</SelectItem>
                {(empQ.data ?? []).map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.code ?? e.id} — {e.fullName ?? ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </EntityFormModal>

      <EntityFormModal open={accAddOpen} onClose={() => { setAccAddOpen(false); setAccForm({ login: '', email: '', firstName: '', lastName: '', authority: 'ROLE_EMPLOYEE', employeeId: '' }); }} title="Thêm tài khoản đăng nhập" onSubmit={() => void submitAccount()} submitLabel={accBusy ? 'Đang tạo…' : 'Tạo'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Login <span className="text-destructive">*</span></Label>
            <Input value={accForm.login} onChange={e => setAccForm(p => ({ ...p, login: e.target.value }))} placeholder="user_login" />
          </div>
          <div className="space-y-2">
            <Label>Email <span className="text-destructive">*</span></Label>
            <Input type="email" value={accForm.email} onChange={e => setAccForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Tên</Label>
            <Input value={accForm.firstName} onChange={e => setAccForm(p => ({ ...p, firstName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Họ</Label>
            <Input value={accForm.lastName} onChange={e => setAccForm(p => ({ ...p, lastName: e.target.value }))} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Vai trò</Label>
            <Select value={accForm.authority} onValueChange={v => setAccForm(p => ({ ...p, authority: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {authorityOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Liên kết nhân viên HRM (tuỳ chọn)</Label>
            <Select
              value={accForm.employeeId ? accForm.employeeId : '_none_'}
              onValueChange={v => setAccForm(p => ({ ...p, employeeId: v === '_none_' ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Không liên kết" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">Không liên kết</SelectItem>
                {(empQ.data ?? []).map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.code ?? e.id} — {e.fullName ?? ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Cần liên kết để nhân viên dùng «Yêu cầu của tôi» / «Tài sản của tôi» đúng theo tài khoản.
            </p>
          </div>
        </div>
      </EntityFormModal>

      <Dialog open={!!accDeleteLogin} onOpenChange={v => !v && setAccDeleteLogin(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa tài khoản</DialogTitle>
            <DialogDescription>Xóa vĩnh viễn <strong>{accDeleteLogin}</strong>?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccDeleteLogin(null)} disabled={accBusy}>Hủy</Button>
            <Button variant="destructive" onClick={() => void deleteAccount()} disabled={accBusy}>Xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Thêm nhân viên — POST /api/employees (master HRM, không gồm email/SĐT; quyền đăng nhập ở tab Tài khoản) */}
      <EntityFormModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setForm(emptyForm); }}
        title="Thêm nhân viên"
        onSubmit={() => void handleAdd()}
        submitLabel="Thêm"
        loading={empBusy}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Mã nhân viên tự sinh (NV + 6 chữ số).</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Họ tên <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Họ và tên" />
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
              <Input value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} placeholder="Theo HR" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Vị trí (tuỳ chọn)</Label>
              <Select value={form.locationId || '_none_'} onValueChange={v => setForm(p => ({ ...p, locationId: v === '_none_' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Không chọn" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">— Không chọn —</SelectItem>
                  {(locQ.data ?? []).map(l => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.code ?? l.id} — {l.name ?? ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Dùng khi thu hồi vật tư pool theo vị trí.</p>
            </div>
          </div>
        </div>
      </EntityFormModal>

      <EntityFormModal
        open={!!editTarget}
        onClose={() => { setEditTarget(null); setEditForm(emptyEditForm()); }}
        title="Chỉnh sửa nhân viên"
        onSubmit={() => void handleEdit()}
        submitLabel="Lưu"
        loading={empBusy}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mã NV</Label>
            <Input value={editForm.code} readOnly className="bg-muted/50 font-mono text-sm" />
          </div>
          <div className="space-y-2 flex flex-col justify-end pb-2">
            <div className="flex items-center gap-2">
              <Checkbox id="emp-active" checked={editForm.active} onCheckedChange={v => setEditForm(p => ({ ...p, active: v === true }))} />
              <Label htmlFor="emp-active" className="font-normal cursor-pointer">Đang hoạt động</Label>
            </div>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Họ tên <span className="text-destructive">*</span></Label>
            <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Phòng ban <span className="text-destructive">*</span></Label>
            <Select value={editForm.departmentId} onValueChange={v => setEditForm(p => ({ ...p, departmentId: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Chức danh</Label>
            <Input value={editForm.position} onChange={e => setEditForm(p => ({ ...p, position: e.target.value }))} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Vị trí (tuỳ chọn)</Label>
            <Select
              value={editForm.locationId || '_none_'}
              onValueChange={v => setEditForm(p => ({ ...p, locationId: v === '_none_' ? '' : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Không chọn" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">— Không chọn —</SelectItem>
                {(locQ.data ?? []).map(l => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.code ?? l.id} — {l.name ?? ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </EntityFormModal>

      {/* Dialog xác nhận xóa */}
      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vô hiệu hóa nhân viên</DialogTitle>
            <DialogDescription>
              Đặt trạng thái không hoạt động cho <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code})? Có thể bật lại khi sửa nhân viên.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={empBusy}>Hủy</Button>
            <Button variant="destructive" onClick={() => void handleSoftDelete()} disabled={empBusy}>{empBusy ? 'Đang xử lý…' : 'Vô hiệu hóa'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
