import { useState } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { EntityFormModal } from '@/components/shared/EntityFormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { suppliers, Supplier, formatDate } from '@/data/mockData';
import { toast } from 'sonner';

const Suppliers = () => {
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);

  const columns: Column<Supplier>[] = [
    { key: 'code', label: 'Mã NCC', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'name', label: 'Tên nhà cung cấp' },
    { key: 'taxCode', label: 'MST' },
    { key: 'phone', label: 'Điện thoại' },
    { key: 'email', label: 'Email' },
    { key: 'contactPerson', label: 'Người liên hệ' },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhà cung cấp</h1>
          <p className="page-description">Quản lý danh sách nhà cung cấp</p>
        </div>
        <Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4 mr-1" /> Thêm NCC</Button>
      </div>
      <DataTable columns={columns} data={suppliers} currentPage={page} onPageChange={setPage} />

      <EntityFormModal open={showModal} onClose={() => setShowModal(false)} title="Thêm nhà cung cấp"
        onSubmit={() => { toast.success('Đã lưu thành công (demo)'); setShowModal(false); }}>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Mã NCC</Label><Input placeholder="Tự sinh" disabled /></div>
          <div><Label>Tên NCC</Label><Input placeholder="Nhập tên..." /></div>
          <div><Label>Mã số thuế</Label><Input placeholder="MST..." /></div>
          <div><Label>Điện thoại</Label><Input placeholder="SĐT..." /></div>
          <div><Label>Email</Label><Input placeholder="Email..." /></div>
          <div><Label>Người liên hệ</Label><Input placeholder="Tên..." /></div>
          <div className="col-span-2"><Label>Địa chỉ</Label><Input placeholder="Địa chỉ..." /></div>
        </div>
      </EntityFormModal>
    </div>
  );
};

export default Suppliers;
