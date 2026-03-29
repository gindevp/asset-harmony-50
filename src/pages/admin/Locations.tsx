import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { EntityFormModal } from '@/components/shared/EntityFormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLocations } from '@/hooks/useEntityApi';
import { apiDelete, apiPost, apiPut } from '@/api/http';
import { makeBizCode } from '@/api/businessCode';
import type { LocationDto } from '@/api/types';

type Row = { id: string; code: string; name: string; address: string; createdAt: string };

const Locations = () => {
  const qc = useQueryClient();
  const locQ = useLocations();
  const data = useMemo<Row[]>(
    () =>
      (locQ.data ?? []).map(l => ({
        id: String(l.id),
        code: l.code ?? '',
        name: l.name ?? '',
        address: l.address ?? '',
        createdAt: '',
      })),
    [locQ.data],
  );

  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', address: '' });
  const [editTarget, setEditTarget] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ name: '', address: '' });
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['api', 'locations'] });

  const handleAdd = async () => {
    if (!addForm.name.trim()) {
      toast.error('Nhập tên vị trí');
      return;
    }
    setBusy(true);
    try {
      await apiPost<LocationDto>('/api/locations', {
        code: makeBizCode('VT'),
        name: addForm.name.trim(),
        address: addForm.address.trim() || undefined,
        active: true,
      });
      toast.success('Đã thêm vị trí');
      setAddOpen(false);
      setAddForm({ name: '', address: '' });
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (r: Row) => {
    setEditTarget(r);
    setEditForm({ name: r.name, address: r.address });
  };

  const handleEdit = async () => {
    if (!editTarget || !editForm.name.trim()) return;
    setBusy(true);
    try {
      await apiPut(`/api/locations/${editTarget.id}`, {
        id: Number(editTarget.id),
        code: editTarget.code,
        name: editForm.name.trim(),
        address: editForm.address.trim() || undefined,
        active: true,
      });
      toast.success('Đã cập nhật');
      setEditTarget(null);
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
      await apiDelete(`/api/locations/${deleteTarget.id}`);
      toast.success('Đã xóa vị trí');
      setDeleteTarget(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Row>[] = [
    { key: 'code', label: 'Mã', render: r => <span className="font-mono text-sm">{r.code}</span> },
    { key: 'name', label: 'Tên vị trí' },
    { key: 'address', label: 'Địa chỉ / mô tả' },
    {
      key: 'act',
      label: '',
      render: r => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(r)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Danh mục vị trí</h1>
          <p className="page-description">Khu vực / vị trí phục vụ xuất kho (Công ty / vị trí) — CRUD /api/locations</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Thêm vị trí
        </Button>
      </div>

      <DataTable columns={columns} data={data} currentPage={page} onPageChange={setPage} emptyMessage="Chưa có vị trí" />

      <EntityFormModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddForm({ name: '', address: '' }); }}
        title="Thêm vị trí"
        onSubmit={() => void handleAdd()}
        submitLabel={busy ? 'Đang lưu…' : 'Thêm'}
        loading={busy}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tên <span className="text-destructive">*</span></Label>
            <Input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Địa chỉ / ghi chú</Label>
            <Input value={addForm.address} onChange={e => setAddForm(p => ({ ...p, address: e.target.value }))} />
          </div>
        </div>
      </EntityFormModal>

      <EntityFormModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Sửa vị trí"
        onSubmit={() => void handleEdit()}
        submitLabel={busy ? 'Đang lưu…' : 'Lưu'}
        loading={busy}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tên <span className="text-destructive">*</span></Label>
            <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Địa chỉ</Label>
            <Input value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} />
          </div>
        </div>
      </EntityFormModal>

      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa vị trí</DialogTitle>
            <DialogDescription>
              Xóa <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code})?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={busy}>Hủy</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={busy}>Xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Locations;
