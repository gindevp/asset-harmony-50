import { useState } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { EntityFormModal } from '@/components/shared/EntityFormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { assetTypes, assetGroups, assetLines, assetItems, AssetItem } from '@/data/mockData';
import { toast } from 'sonner';

const AssetCategories = () => {
  const [tab, setTab] = useState('items');
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

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
  ];

  const typeColumns: Column<typeof assetTypes[0]>[] = [
    { key: 'code', label: 'Mã', render: r => <span className="font-mono text-sm">{r.code}</span> },
    { key: 'name', label: 'Tên loại' },
    { key: 'description', label: 'Mô tả' },
  ];

  const groupColumns: Column<typeof assetGroups[0]>[] = [
    { key: 'code', label: 'Mã', render: r => <span className="font-mono text-sm">{r.code}</span> },
    { key: 'name', label: 'Tên nhóm' },
    { key: 'type', label: 'Loại', render: r => assetTypes.find(t => t.id === r.typeId)?.name },
  ];

  const lineColumns: Column<typeof assetLines[0]>[] = [
    { key: 'code', label: 'Mã', render: r => <span className="font-mono text-sm">{r.code}</span> },
    { key: 'name', label: 'Tên dòng' },
    { key: 'group', label: 'Nhóm', render: r => assetGroups.find(g => g.id === r.groupId)?.name },
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
        <Button onClick={() => { setShowModal(true); toast.info('Form tạo mới (demo)'); }}>
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
    </div>
  );
};

export default AssetCategories;
