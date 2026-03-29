import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { EntityFormModal } from '@/components/shared/EntityFormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
import type { Supplier } from '@/data/mockData';
import { formatDate } from '@/data/mockData';
import { toast } from 'sonner';
import { useSuppliers } from '@/hooks/useEntityApi';
import { apiDelete, apiPost, apiPut } from '@/api/http';
import { makeBizCode } from '@/api/businessCode';
import type { SupplierDto } from '@/api/types';

const Suppliers = () => {
  const qc = useQueryClient();
  const sQ = useSuppliers();
  const data = useMemo<Supplier[]>(
    () =>
      (sQ.data ?? []).map(s => ({
        id: String(s.id),
        code: s.code ?? '',
        name: s.name ?? '',
        taxCode: s.taxCode ?? '',
        phone: s.phone ?? '',
        email: s.email ?? '',
        address: s.address ?? '',
        contactPerson: '—',
        createdAt: '',
      })),
    [sQ.data],
  );
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Supplier | null>(null);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [editForm, setEditForm] = useState({ name: '', taxCode: '', phone: '', email: '', contactPerson: '', address: '' });
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [addForm, setAddForm] = useState({ name: '', taxCode: '', phone: '', email: '', contactPerson: '', address: '' });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['api', 'suppliers'] });

  const openEdit = (s: Supplier) => {
    setEditTarget(s);
    setEditForm({ name: s.name, taxCode: s.taxCode, phone: s.phone, email: s.email, contactPerson: s.contactPerson, address: s.address });
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim()) {
      toast.error('Nhập tên NCC');
      return;
    }
    setBusy(true);
    try {
      await apiPut(`/api/suppliers/${editTarget.id}`, {
        id: Number(editTarget.id),
        code: editTarget.code,
        name: editForm.name.trim(),
        taxCode: editForm.taxCode || undefined,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        address: editForm.address || undefined,
        active: true,
      });
      toast.success('Đã cập nhật NCC');
      setEditTarget(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) {
      toast.error('Nhập tên NCC');
      return;
    }
    setBusy(true);
    try {
      await apiPost<SupplierDto>('/api/suppliers', {
        code: makeBizCode('NCC'),
        name: addForm.name.trim(),
        taxCode: addForm.taxCode || undefined,
        phone: addForm.phone || undefined,
        email: addForm.email || undefined,
        address: addForm.address || undefined,
        active: true,
      });
      toast.success('Đã thêm NCC');
      setShowModal(false);
      setAddForm({ name: '', taxCode: '', phone: '', email: '', contactPerson: '', address: '' });
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiDelete(`/api/suppliers/${deleteTarget.id}`);
      toast.success('Đã xóa NCC');
      setDeleteTarget(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Supplier>[] = [
    { key: 'code', label: 'Mã NCC', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'name', label: 'Tên nhà cung cấp' },
    { key: 'taxCode', label: 'MST' },
    { key: 'phone', label: 'Điện thoại' },
    { key: 'email', label: 'Email' },
    { key: 'contactPerson', label: 'Người liên hệ' },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
    { key: 'actions', label: 'Thao tác', render: r => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setDetailTarget(r)}><Eye className="h-4 w-4 mr-2" />Xem chi tiết</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openEdit(r)}><Pencil className="h-4 w-4 mr-2" />Sửa</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDeleteTarget(r)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Xóa</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )},
  ];

  const supplierFormFields = (form: typeof addForm, setForm: (f: typeof addForm) => void) => (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2"><Label>Tên NCC <span className="text-destructive">*</span></Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nhập tên..." /></div>
      <div><Label>Mã số thuế</Label><Input value={form.taxCode} onChange={e => setForm({ ...form, taxCode: e.target.value })} placeholder="MST..." /></div>
      <div><Label>Điện thoại</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="SĐT..." /></div>
      <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email..." /></div>
      <div><Label>Người liên hệ</Label><Input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} placeholder="Tên..." /></div>
      <div className="col-span-2"><Label>Địa chỉ</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Địa chỉ..." /></div>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhà cung cấp</h1>
          <p className="page-description">Quản lý danh sách nhà cung cấp (CRUD qua API)</p>
        </div>
        <Button onClick={() => setShowModal(true)} disabled={busy}><Plus className="h-4 w-4 mr-1" /> Thêm NCC</Button>
      </div>
      <DataTable columns={columns} data={data} currentPage={page} onPageChange={setPage} />

      <EntityFormModal open={showModal} onClose={() => { setShowModal(false); setAddForm({ name: '', taxCode: '', phone: '', email: '', contactPerson: '', address: '' }); }} title="Thêm nhà cung cấp" onSubmit={() => void handleAdd()} submitLabel={busy ? 'Đang lưu…' : 'Thêm'}>
        {supplierFormFields(addForm, setAddForm)}
      </EntityFormModal>

      <EntityFormModal open={!!editTarget} onClose={() => setEditTarget(null)} title="Sửa nhà cung cấp" onSubmit={() => void handleEdit()} submitLabel={busy ? 'Đang lưu…' : 'Lưu'}>
        {supplierFormFields(editForm, setEditForm)}
      </EntityFormModal>

      <Dialog open={!!detailTarget} onOpenChange={v => !v && setDetailTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Chi tiết nhà cung cấp</DialogTitle></DialogHeader>
          {detailTarget && (
            <div className="space-y-3 py-2">
              {[
                ['Mã NCC', detailTarget.code],
                ['Tên', detailTarget.name],
                ['MST', detailTarget.taxCode],
                ['Điện thoại', detailTarget.phone],
                ['Email', detailTarget.email],
                ['Người liên hệ', detailTarget.contactPerson],
                ['Địa chỉ', detailTarget.address],
                ['Ngày tạo', formatDate(detailTarget.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">{label}:</span>
                  <span className="text-sm">{value || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>Bạn có chắc muốn xóa nhà cung cấp <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code})? Hành động này không thể hoàn tác.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={busy}>Hủy</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={busy}>Xác nhận xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Suppliers;
