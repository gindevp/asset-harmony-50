import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import type { AssetItem } from '@/data/mockData';
import { toast } from 'sonner';
import {
  mapAssetItemDto,
  useAssetGroups,
  useAssetItems,
  useAssetLines,
  useAssetTypes,
} from '@/hooks/useEntityApi';
import { apiDelete, apiPost, apiPut } from '@/api/http';
import { makeBizCode } from '@/api/businessCode';

type TabKey = 'items' | 'types' | 'groups' | 'lines';

const AssetCategories = () => {
  const qc = useQueryClient();
  const tQ = useAssetTypes();
  const gQ = useAssetGroups();
  const lQ = useAssetLines();
  const iQ = useAssetItems();

  const assetTypes = useMemo(
    () =>
      (tQ.data ?? []).map(t => ({
        id: String(t.id),
        code: t.code ?? '',
        name: t.name ?? '',
        description: t.description ?? '',
        active: t.active !== false,
      })),
    [tQ.data],
  );
  const assetGroups = useMemo(
    () =>
      (gQ.data ?? []).map(g => ({
        id: String(g.id),
        code: g.code ?? '',
        name: g.name ?? '',
        typeId: String(g.assetType?.id ?? ''),
        active: g.active !== false,
      })),
    [gQ.data],
  );
  const assetLines = useMemo(
    () =>
      (lQ.data ?? []).map(l => ({
        id: String(l.id),
        code: l.code ?? '',
        name: l.name ?? '',
        groupId: String(l.assetGroup?.id ?? ''),
        active: l.active !== false,
      })),
    [lQ.data],
  );
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ['api', 'asset-types'] });
    void qc.invalidateQueries({ queryKey: ['api', 'asset-groups'] });
    void qc.invalidateQueries({ queryKey: ['api', 'asset-lines'] });
    void qc.invalidateQueries({ queryKey: ['api', 'asset-items'] });
  };

  const [tab, setTab] = useState<TabKey>('items');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<TabKey>('items');
  const [typeAdd, setTypeAdd] = useState({ name: '', description: '' });
  const [groupAdd, setGroupAdd] = useState({ typeId: '', name: '', description: '' });
  const [lineAdd, setLineAdd] = useState({ groupId: '', name: '', description: '' });
  const [itemAdd, setItemAdd] = useState({
    lineId: '',
    name: '',
    managementType: 'DEVICE' as 'DEVICE' | 'CONSUMABLE',
    unit: 'Cái',
    depreciationEnabled: true,
    serialTrackingRequired: true,
    note: '',
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailData, setDetailData] = useState<Record<string, string> | null>(null);

  const [deleteCtx, setDeleteCtx] = useState<null | { kind: TabKey; id: number; label: string }>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editKind, setEditKind] = useState<TabKey>('items');
  const [editId, setEditId] = useState<number>(0);
  const [editCode, setEditCode] = useState('');
  const [editFields, setEditFields] = useState<{ label: string; value: string; key: string }[]>([]);
  const [editLineId, setEditLineId] = useState('');
  const [editMgmt, setEditMgmt] = useState<'DEVICE' | 'CONSUMABLE'>('DEVICE');
  const [editDep, setEditDep] = useState(false);
  const [editSer, setEditSer] = useState(false);

  const openAdd = () => {
    setAddKind(tab);
    setTypeAdd({ name: '', description: '' });
    setGroupAdd({ typeId: '', name: '', description: '' });
    setLineAdd({ groupId: '', name: '', description: '' });
    setItemAdd({
      lineId: '',
      name: '',
      managementType: 'DEVICE',
      unit: 'Cái',
      depreciationEnabled: true,
      serialTrackingRequired: true,
      note: '',
    });
    setAddOpen(true);
  };

  const submitAdd = async () => {
    setBusy(true);
    try {
      if (addKind === 'types') {
        if (!typeAdd.name.trim()) throw new Error('Nhập tên loại');
        await apiPost('/api/asset-types', {
          code: makeBizCode('LT'),
          name: typeAdd.name.trim(),
          description: typeAdd.description.trim() || undefined,
          active: true,
        });
        toast.success('Đã thêm loại tài sản');
      } else if (addKind === 'groups') {
        if (!groupAdd.typeId || !groupAdd.name.trim()) throw new Error('Chọn loại và nhập tên nhóm');
        await apiPost('/api/asset-groups', {
          code: makeBizCode('NG'),
          name: groupAdd.name.trim(),
          description: groupAdd.description.trim() || undefined,
          active: true,
          assetType: { id: Number(groupAdd.typeId) },
        });
        toast.success('Đã thêm nhóm');
      } else if (addKind === 'lines') {
        if (!lineAdd.groupId || !lineAdd.name.trim()) throw new Error('Chọn nhóm và nhập tên dòng');
        await apiPost('/api/asset-lines', {
          code: makeBizCode('D'),
          name: lineAdd.name.trim(),
          description: lineAdd.description.trim() || undefined,
          active: true,
          assetGroup: { id: Number(lineAdd.groupId) },
        });
        toast.success('Đã thêm dòng');
      } else {
        if (!itemAdd.lineId || !itemAdd.name.trim()) throw new Error('Chọn dòng và nhập tên item');
        await apiPost('/api/asset-items', {
          code: makeBizCode('TS'),
          name: itemAdd.name.trim(),
          managementType: itemAdd.managementType,
          unit: itemAdd.unit.trim() || 'Cái',
          depreciationEnabled: itemAdd.depreciationEnabled,
          serialTrackingRequired: itemAdd.serialTrackingRequired,
          note: itemAdd.note.trim() || undefined,
          active: true,
          assetLine: { id: Number(itemAdd.lineId) },
        });
        toast.success('Đã thêm item');
      }
      setAddOpen(false);
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCtx) return;
    setBusy(true);
    try {
      const path =
        deleteCtx.kind === 'types'
          ? `/api/asset-types/${deleteCtx.id}`
          : deleteCtx.kind === 'groups'
            ? `/api/asset-groups/${deleteCtx.id}`
            : deleteCtx.kind === 'lines'
              ? `/api/asset-lines/${deleteCtx.id}`
              : `/api/asset-items/${deleteCtx.id}`;
      await apiDelete(path);
      toast.success('Đã xóa');
      setDeleteCtx(null);
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API (có thể còn dữ liệu con)');
    } finally {
      setBusy(false);
    }
  };

  const handleEditSave = async () => {
    setBusy(true);
    try {
      if (editKind === 'types') {
        const name = editFields.find(f => f.key === 'name')?.value ?? '';
        const desc = editFields.find(f => f.key === 'description')?.value ?? '';
        await apiPut(`/api/asset-types/${editId}`, {
          id: editId,
          code: editCode,
          name: name.trim(),
          description: desc.trim() || undefined,
          active: true,
        });
      } else if (editKind === 'groups') {
        const name = editFields.find(f => f.key === 'name')?.value ?? '';
        const typeId = editFields.find(f => f.key === 'typeId')?.value ?? '';
        await apiPut(`/api/asset-groups/${editId}`, {
          id: editId,
          code: editCode,
          name: name.trim(),
          active: true,
          assetType: { id: Number(typeId) },
        });
      } else if (editKind === 'lines') {
        const name = editFields.find(f => f.key === 'name')?.value ?? '';
        const groupId = editFields.find(f => f.key === 'groupId')?.value ?? '';
        await apiPut(`/api/asset-lines/${editId}`, {
          id: editId,
          code: editCode,
          name: name.trim(),
          active: true,
          assetGroup: { id: Number(groupId) },
        });
      } else {
        const name = editFields.find(f => f.key === 'name')?.value ?? '';
        const unit = editFields.find(f => f.key === 'unit')?.value ?? 'Cái';
        const note = editFields.find(f => f.key === 'note')?.value ?? '';
        await apiPut(`/api/asset-items/${editId}`, {
          id: editId,
          code: editCode,
          name: name.trim(),
          managementType: editMgmt,
          unit: unit.trim() || 'Cái',
          depreciationEnabled: editDep,
          serialTrackingRequired: editSer,
          note: note.trim() || undefined,
          active: true,
          assetLine: { id: Number(editLineId) },
        });
      }
      toast.success('Đã cập nhật');
      setEditOpen(false);
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setBusy(false);
    }
  };

  const ActionsCell = ({
    onView,
    onEdit,
    onDelete,
  }: {
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }) => (
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
        onView={() => {
          setDetailTitle('Chi tiết item tài sản');
          setDetailData({
            Mã: r.code, Tên: r.name,
            'Loại QL': r.managementType === 'DEVICE' ? 'Thiết bị' : 'Vật tư',
            Loại: assetTypes.find(t => t.id === r.typeId)?.name || '',
            Nhóm: assetGroups.find(g => g.id === r.groupId)?.name || '',
            ĐVT: r.unit, 'Khấu hao': r.enableDepreciation ? 'Có' : 'Không',
            Serial: r.enableSerial ? 'Bắt buộc' : 'Không',
          });
          setDetailOpen(true);
        }}
        onEdit={() => {
          setEditKind('items');
          setEditId(Number(r.id));
          setEditCode(r.code);
          setEditLineId(assetLines.find(l => l.id === r.lineId)?.id ?? r.lineId);
          setEditMgmt(r.managementType);
          setEditDep(r.enableDepreciation);
          setEditSer(r.enableSerial);
          setEditFields([
            { key: 'name', label: 'Tên', value: r.name },
            { key: 'unit', label: 'ĐVT', value: r.unit },
            { key: 'note', label: 'Ghi chú', value: r.description },
          ]);
          setEditTitle('Sửa item tài sản');
          setEditOpen(true);
        }}
        onDelete={() => setDeleteCtx({ kind: 'items', id: Number(r.id), label: r.name })}
      />
    )},
  ];

  const typeColumns: Column<(typeof assetTypes)[0]>[] = [
    { key: 'code', label: 'Mã', render: r => <span className="font-mono text-sm">{r.code}</span> },
    { key: 'name', label: 'Tên loại' },
    { key: 'description', label: 'Mô tả' },
    { key: 'actions', label: 'Thao tác', render: r => (
      <ActionsCell
        onView={() => {
          setDetailTitle('Chi tiết loại tài sản');
          setDetailData({ Mã: r.code, Tên: r.name, 'Mô tả': r.description || '' });
          setDetailOpen(true);
        }}
        onEdit={() => {
          setEditKind('types');
          setEditId(Number(r.id));
          setEditCode(r.code);
          setEditFields([
            { key: 'name', label: 'Tên', value: r.name },
            { key: 'description', label: 'Mô tả', value: r.description || '' },
          ]);
          setEditTitle('Sửa loại tài sản');
          setEditOpen(true);
        }}
        onDelete={() => setDeleteCtx({ kind: 'types', id: Number(r.id), label: r.name })}
      />
    )},
  ];

  const groupColumns: Column<(typeof assetGroups)[0]>[] = [
    { key: 'code', label: 'Mã', render: r => <span className="font-mono text-sm">{r.code}</span> },
    { key: 'name', label: 'Tên nhóm' },
    { key: 'type', label: 'Loại', render: r => assetTypes.find(t => t.id === r.typeId)?.name },
    { key: 'actions', label: 'Thao tác', render: r => (
      <ActionsCell
        onView={() => {
          setDetailTitle('Chi tiết nhóm tài sản');
          setDetailData({ Mã: r.code, Tên: r.name, Loại: assetTypes.find(t => t.id === r.typeId)?.name || '' });
          setDetailOpen(true);
        }}
        onEdit={() => {
          setEditKind('groups');
          setEditId(Number(r.id));
          setEditCode(r.code);
          setEditFields([
            { key: 'name', label: 'Tên', value: r.name },
            { key: 'typeId', label: 'typeId', value: r.typeId },
          ]);
          setEditTitle('Sửa nhóm tài sản');
          setEditOpen(true);
        }}
        onDelete={() => setDeleteCtx({ kind: 'groups', id: Number(r.id), label: r.name })}
      />
    )},
  ];

  const lineColumns: Column<(typeof assetLines)[0]>[] = [
    { key: 'code', label: 'Mã', render: r => <span className="font-mono text-sm">{r.code}</span> },
    { key: 'name', label: 'Tên dòng' },
    { key: 'group', label: 'Nhóm', render: r => assetGroups.find(g => g.id === r.groupId)?.name },
    { key: 'actions', label: 'Thao tác', render: r => (
      <ActionsCell
        onView={() => {
          setDetailTitle('Chi tiết dòng tài sản');
          setDetailData({ Mã: r.code, Tên: r.name, Nhóm: assetGroups.find(g => g.id === r.groupId)?.name || '' });
          setDetailOpen(true);
        }}
        onEdit={() => {
          setEditKind('lines');
          setEditId(Number(r.id));
          setEditCode(r.code);
          setEditFields([
            { key: 'name', label: 'Tên', value: r.name },
            { key: 'groupId', label: 'groupId', value: r.groupId },
          ]);
          setEditTitle('Sửa dòng tài sản');
          setEditOpen(true);
        }}
        onDelete={() => setDeleteCtx({ kind: 'lines', id: Number(r.id), label: r.name })}
      />
    )},
  ];

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã, tên tài sản...' },
    { key: 'type', label: 'Loại', type: 'select', options: assetTypes.map(t => ({ value: t.id, label: t.name })) },
    { key: 'managementType', label: 'Quản lý', type: 'select', options: [{ value: 'DEVICE', label: 'Thiết bị' }, { value: 'CONSUMABLE', label: 'Vật tư' }] },
  ];

  const addFormBody = () => {
    if (addKind === 'types') {
      return (
        <div className="space-y-4">
          <div><Label>Tên loại <span className="text-destructive">*</span></Label><Input value={typeAdd.name} onChange={e => setTypeAdd(p => ({ ...p, name: e.target.value }))} /></div>
          <div><Label>Mô tả</Label><Input value={typeAdd.description} onChange={e => setTypeAdd(p => ({ ...p, description: e.target.value }))} /></div>
          <p className="text-xs text-muted-foreground">Mã loại sinh tự động (LT + 6 số).</p>
        </div>
      );
    }
    if (addKind === 'groups') {
      return (
        <div className="space-y-4">
          <div>
            <Label>Loại tài sản <span className="text-destructive">*</span></Label>
            <Select value={groupAdd.typeId} onValueChange={v => setGroupAdd(p => ({ ...p, typeId: v }))}>
              <SelectTrigger><SelectValue placeholder="Chọn loại" /></SelectTrigger>
              <SelectContent>{assetTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Tên nhóm <span className="text-destructive">*</span></Label><Input value={groupAdd.name} onChange={e => setGroupAdd(p => ({ ...p, name: e.target.value }))} /></div>
          <div><Label>Mô tả</Label><Input value={groupAdd.description} onChange={e => setGroupAdd(p => ({ ...p, description: e.target.value }))} /></div>
        </div>
      );
    }
    if (addKind === 'lines') {
      return (
        <div className="space-y-4">
          <div>
            <Label>Nhóm <span className="text-destructive">*</span></Label>
            <Select value={lineAdd.groupId} onValueChange={v => setLineAdd(p => ({ ...p, groupId: v }))}>
              <SelectTrigger><SelectValue placeholder="Chọn nhóm" /></SelectTrigger>
              <SelectContent>{assetGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Tên dòng <span className="text-destructive">*</span></Label><Input value={lineAdd.name} onChange={e => setLineAdd(p => ({ ...p, name: e.target.value }))} /></div>
          <div><Label>Mô tả</Label><Input value={lineAdd.description} onChange={e => setLineAdd(p => ({ ...p, description: e.target.value }))} /></div>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div>
          <Label>Dòng tài sản <span className="text-destructive">*</span></Label>
          <Select value={itemAdd.lineId} onValueChange={v => setItemAdd(p => ({ ...p, lineId: v }))}>
            <SelectTrigger><SelectValue placeholder="Chọn dòng" /></SelectTrigger>
            <SelectContent>{assetLines.map(l => <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Tên item <span className="text-destructive">*</span></Label><Input value={itemAdd.name} onChange={e => setItemAdd(p => ({ ...p, name: e.target.value }))} /></div>
        <div>
          <Label>Loại quản lý</Label>
          <Select
            value={itemAdd.managementType}
            onValueChange={v => {
              const m = v as 'DEVICE' | 'CONSUMABLE';
              setItemAdd(p => ({
                ...p,
                managementType: m,
                depreciationEnabled: m === 'DEVICE',
                serialTrackingRequired: m === 'DEVICE',
              }));
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="DEVICE">Thiết bị</SelectItem><SelectItem value="CONSUMABLE">Vật tư</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>ĐVT</Label><Input value={itemAdd.unit} onChange={e => setItemAdd(p => ({ ...p, unit: e.target.value }))} /></div>
        {itemAdd.managementType === 'DEVICE' && (
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={itemAdd.depreciationEnabled} onChange={e => setItemAdd(p => ({ ...p, depreciationEnabled: e.target.checked }))} /> Khấu hao</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={itemAdd.serialTrackingRequired} onChange={e => setItemAdd(p => ({ ...p, serialTrackingRequired: e.target.checked }))} /> Theo dõi serial</label>
          </div>
        )}
        <div><Label>Ghi chú</Label><Input value={itemAdd.note} onChange={e => setItemAdd(p => ({ ...p, note: e.target.value }))} /></div>
        <p className="text-xs text-muted-foreground">Mã item sinh tự động (TS + 6 số).</p>
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Danh mục tài sản</h1>
          <p className="page-description">CRUD loại → nhóm → dòng → item (theo tài liệu nghiệp vụ)</p>
        </div>
        <Button onClick={openAdd} disabled={busy}><Plus className="h-4 w-4 mr-1" /> Thêm mới</Button>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as TabKey)}>
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

      <EntityFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={addKind === 'items' ? 'Thêm item' : addKind === 'types' ? 'Thêm loại' : addKind === 'groups' ? 'Thêm nhóm' : 'Thêm dòng'}
        onSubmit={() => void submitAdd()}
        submitLabel={busy ? 'Đang lưu…' : 'Lưu'}
      >
        {addFormBody()}
      </EntityFormModal>

      <Dialog open={detailOpen} onOpenChange={v => !v && setDetailOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detailTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {detailData && Object.entries(detailData).map(([label, value]) => (
              <div key={label} className="flex items-start gap-3">
                <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">{label}:</span>
                <span className="text-sm">{value || '—'}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <EntityFormModal open={editOpen} onClose={() => setEditOpen(false)} title={editTitle} onSubmit={() => void handleEditSave()} submitLabel={busy ? 'Đang lưu…' : 'Lưu'}>
        <div className="space-y-4">
          {editKind === 'groups' && (
            <div>
              <Label>Loại tài sản</Label>
              <Select value={editFields.find(f => f.key === 'typeId')?.value} onValueChange={v => setEditFields(prev => prev.map(x => x.key === 'typeId' ? { ...x, value: v } : x))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{assetTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {editKind === 'lines' && (
            <div>
              <Label>Nhóm</Label>
              <Select value={editFields.find(f => f.key === 'groupId')?.value} onValueChange={v => setEditFields(prev => prev.map(x => x.key === 'groupId' ? { ...x, value: v } : x))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{assetGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {editKind === 'items' && (
            <>
              <div>
                <Label>Dòng tài sản</Label>
                <Select value={editLineId} onValueChange={setEditLineId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{assetLines.map(l => <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Loại quản lý</Label>
                <Select value={editMgmt} onValueChange={v => setEditMgmt(v as 'DEVICE' | 'CONSUMABLE')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="DEVICE">Thiết bị</SelectItem><SelectItem value="CONSUMABLE">Vật tư</SelectItem></SelectContent>
                </Select>
              </div>
              {editMgmt === 'DEVICE' && (
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editDep} onChange={e => setEditDep(e.target.checked)} /> Khấu hao</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editSer} onChange={e => setEditSer(e.target.checked)} /> Theo dõi serial</label>
                </div>
              )}
            </>
          )}
          {editFields.filter(f => !['typeId', 'groupId'].includes(f.key)).map(f => (
            <div key={f.key} className="space-y-2">
              <Label>{f.label}</Label>
              <Input value={f.value} onChange={e => setEditFields(prev => prev.map(p => p.key === f.key ? { ...p, value: e.target.value } : p))} />
            </div>
          ))}
        </div>
      </EntityFormModal>

      <Dialog open={!!deleteCtx} onOpenChange={v => !v && setDeleteCtx(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>
              Xóa <strong>{deleteCtx?.label}</strong>? Có thể thất bại nếu còn bản ghi phụ thuộc.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCtx(null)} disabled={busy}>Hủy</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={busy}>Xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssetCategories;
