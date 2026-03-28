import { useState } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { EntityFormModal } from '@/components/shared/EntityFormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
import { assetTypes, assetGroups, assetLines, assetItems, AssetItem } from '@/data/mockData';
import { toast } from 'sonner';

const AssetCategories = () => {
  const [tab, setTab] = useState('items');
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  // Detail / Edit / Delete state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<Record<string, string> | null>(null);
  const [detailTitle, setDetailTitle] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<{ name: string; type: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editFields, setEditFields] = useState<{ label: string; value: string; key: string }[]>([]);

  const openDetail = (title: string, data: Record<string, string>) => {
    setDetailTitle(title);
    setDetailData(data);
    setDetailOpen(true);
  };

  const openEdit = (title: string, fields: { label: string; value: string; key: string }[]) => {
    setEditTitle(title);
    setEditFields(fields);
    setEditOpen(true);
  };

  const openDelete = (name: string, type: string) => {
    setDeleteInfo({ name, type });
    setDeleteOpen(true);
  };

  const handleDelete = () => {
    toast.success(`Đã xóa ${deleteInfo?.type} "${deleteInfo?.name}" (demo)`);
    setDeleteOpen(false);
    setDeleteInfo(null);
  };

  const handleEditSave = () => {
    toast.success('Đã cập nhật thành công (demo)');
    setEditOpen(false);
  };

  // Action menu component
  const ActionsCell = ({ onView, onEdit, onDelete }: { onView: () => void; onEdit: () => void; onDelete: () => void }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}><Eye className="h-4 w-4 mr-2" />Xem chi tiết</DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2" />Sửa</DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Xóa</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const filteredItems = assetItems.filter(item => {
    if (filters.search && !item.name.toLowerCase().includes(filters.search.toLowerCase()) && !item.code.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.type && item.typeId !== filters.type) return false;
    if (filters.managementType && item.managementType !== filters.managementType) return false;
    return true;
  });

  const itemColumns: Column<AssetItem>[] = [
    { key: 'code', label: 'Mã', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'name', label: 'Tên tài sản' },
    { key: 'managementType', label: 'Loại QL', render: r => (
      <span className={`status-badge ${r.managementType === 'DEVICE' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
        {r.managementType === 'DEVICE' ? 'Thiết bị' : 'Vật tư'}
      </span>
    )},
    { key: 'type', label: 'Loại', render: r => assetTypes.find(t => t.id === r.typeId)?.name },
    { key: 'group', label: 'Nhóm', render: r => assetGroups.find(g => g.id === r.groupId)?.name },
    { key: 'unit', label: 'ĐVT' },
    { key: 'depreciation', label: 'Khấu hao', render: r => r.enableDepreciation ? '✓' : '—' },
    { key: 'actions', label: 'Thao tác', render: r => (
      <ActionsCell
        onView={() => openDetail('Chi tiết item tài sản', {
          'Mã': r.code, 'Tên': r.name,
          'Loại QL': r.managementType === 'DEVICE' ? 'Thiết bị' : 'Vật tư',
          'Loại': assetTypes.find(t => t.id === r.typeId)?.name || '',
          'Nhóm': assetGroups.find(g => g.id === r.groupId)?.name || '',
          'ĐVT': r.unit, 'Khấu hao': r.enableDepreciation ? 'Có' : 'Không',
        })}
        onEdit={() => openEdit('Sửa item tài sản', [
          { label: 'Tên', value: r.name, key: 'name' },
          { label: 'ĐVT', value: r.unit, key: 'unit' },
        ])}
        onDelete={() => openDelete(r.name, 'item tài sản')}
      />
    )},
  ];

  const typeColumns: Column<typeof assetTypes[0]>[] = [
    { key: 'code', label: 'Mã', render: r => <span className="font-mono text-sm">{r.code}</span> },
    { key: 'name', label: 'Tên loại' },
    { key: 'description', label: 'Mô tả' },
    { key: 'actions', label: 'Thao tác', render: r => (
      <ActionsCell
        onView={() => openDetail('Chi tiết loại tài sản', { 'Mã': r.code, 'Tên': r.name, 'Mô tả': r.description || '' })}
        onEdit={() => openEdit('Sửa loại tài sản', [
          { label: 'Tên', value: r.name, key: 'name' },
          { label: 'Mô tả', value: r.description || '', key: 'description' },
        ])}
        onDelete={() => openDelete(r.name, 'loại tài sản')}
      />
    )},
  ];

  const groupColumns: Column<typeof assetGroups[0]>[] = [
    { key: 'code', label: 'Mã', render: r => <span className="font-mono text-sm">{r.code}</span> },
    { key: 'name', label: 'Tên nhóm' },
    { key: 'type', label: 'Loại', render: r => assetTypes.find(t => t.id === r.typeId)?.name },
    { key: 'actions', label: 'Thao tác', render: r => (
      <ActionsCell
        onView={() => openDetail('Chi tiết nhóm tài sản', { 'Mã': r.code, 'Tên': r.name, 'Loại': assetTypes.find(t => t.id === r.typeId)?.name || '' })}
        onEdit={() => openEdit('Sửa nhóm tài sản', [{ label: 'Tên', value: r.name, key: 'name' }])}
        onDelete={() => openDelete(r.name, 'nhóm tài sản')}
      />
    )},
  ];

  const lineColumns: Column<typeof assetLines[0]>[] = [
    { key: 'code', label: 'Mã', render: r => <span className="font-mono text-sm">{r.code}</span> },
    { key: 'name', label: 'Tên dòng' },
    { key: 'group', label: 'Nhóm', render: r => assetGroups.find(g => g.id === r.groupId)?.name },
    { key: 'actions', label: 'Thao tác', render: r => (
      <ActionsCell
        onView={() => openDetail('Chi tiết dòng tài sản', { 'Mã': r.code, 'Tên': r.name, 'Nhóm': assetGroups.find(g => g.id === r.groupId)?.name || '' })}
        onEdit={() => openEdit('Sửa dòng tài sản', [{ label: 'Tên', value: r.name, key: 'name' }])}
        onDelete={() => openDelete(r.name, 'dòng tài sản')}
      />
    )},
  ];

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã, tên tài sản...' },
    { key: 'type', label: 'Loại', type: 'select', options: assetTypes.map(t => ({ value: t.id, label: t.name })) },
    { key: 'managementType', label: 'Quản lý', type: 'select', options: [{ value: 'DEVICE', label: 'Thiết bị' }, { value: 'CONSUMABLE', label: 'Vật tư' }] },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Danh mục tài sản</h1>
          <p className="page-description">Quản lý loại, nhóm, dòng và item tài sản</p>
        </div>
        <Button onClick={() => { setShowModal(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Thêm mới
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="items">Item tài sản</TabsTrigger>
          <TabsTrigger value="types">Loại</TabsTrigger>
          <TabsTrigger value="groups">Nhóm</TabsTrigger>
          <TabsTrigger value="lines">Dòng</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4 mt-4">
          <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
          <DataTable columns={itemColumns} data={filteredItems} currentPage={page} onPageChange={setPage} />
        </TabsContent>
        <TabsContent value="types" className="mt-4">
          <DataTable columns={typeColumns} data={assetTypes} />
        </TabsContent>
        <TabsContent value="groups" className="mt-4">
          <DataTable columns={groupColumns} data={assetGroups} />
        </TabsContent>
        <TabsContent value="lines" className="mt-4">
          <DataTable columns={lineColumns} data={assetLines} />
        </TabsContent>
      </Tabs>

      {/* Modal thêm mới */}
      <EntityFormModal open={showModal} onClose={() => setShowModal(false)} title="Thêm item tài sản" size="lg"
        onSubmit={() => { toast.success('Đã lưu thành công (demo)'); setShowModal(false); }}>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Mã tài sản</Label><Input placeholder="Tự sinh" disabled /></div>
          <div><Label>Tên tài sản</Label><Input placeholder="Nhập tên..." /></div>
          <div>
            <Label>Loại quản lý</Label>
            <Select><SelectTrigger><SelectValue placeholder="Chọn..." /></SelectTrigger>
              <SelectContent><SelectItem value="DEVICE">Thiết bị</SelectItem><SelectItem value="CONSUMABLE">Vật tư</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Đơn vị tính</Label><Input placeholder="Chiếc, Cái..." /></div>
          <div>
            <Label>Loại tài sản</Label>
            <Select><SelectTrigger><SelectValue placeholder="Chọn..." /></SelectTrigger>
              <SelectContent>{assetTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nhóm tài sản</Label>
            <Select><SelectTrigger><SelectValue placeholder="Chọn..." /></SelectTrigger>
              <SelectContent>{assetGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </EntityFormModal>

      {/* Dialog xem chi tiết */}
      <Dialog open={detailOpen} onOpenChange={v => !v && setDetailOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {detailData && Object.entries(detailData).map(([label, value]) => (
              <div key={label} className="flex items-start gap-3">
                <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">{label}:</span>
                <span className="text-sm">{value || '—'}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog sửa */}
      <EntityFormModal open={editOpen} onClose={() => setEditOpen(false)} title={editTitle} onSubmit={handleEditSave} submitLabel="Lưu">
        <div className="space-y-4">
          {editFields.map(f => (
            <div key={f.key} className="space-y-2">
              <Label>{f.label}</Label>
              <Input value={f.value} onChange={e => setEditFields(prev => prev.map(p => p.key === f.key ? { ...p, value: e.target.value } : p))} />
            </div>
          ))}
        </div>
      </EntityFormModal>

      {/* Dialog xác nhận xóa */}
      <Dialog open={deleteOpen} onOpenChange={v => !v && setDeleteOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa {deleteInfo?.type} <strong>{deleteInfo?.name}</strong>? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDelete}>Xác nhận xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssetCategories;
