import { useState } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import {
  allocationRequests, repairRequests, returnRequests,
  allocationStatusLabels, repairStatusLabels, returnStatusLabels,
  getItemName, formatDate, equipments
} from '@/data/mockData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const currentUserId = 'emp-2'; // Simulated logged-in employee

const EmployeeRequests = () => {
  const [tab, setTab] = useState('allocation');

  const myAllocations = allocationRequests.filter(r => r.requesterId === currentUserId);
  const myRepairs = repairRequests.filter(r => r.requesterId === currentUserId);
  const myReturns = returnRequests.filter(r => r.requesterId === currentUserId);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Yêu cầu của tôi</h1>
          <p className="page-description">Theo dõi các yêu cầu đã tạo</p>
        </div>
        <Button onClick={() => toast.info('Mở form tạo yêu cầu (demo)')}>
          <Plus className="h-4 w-4 mr-1" /> Tạo yêu cầu
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="allocation">Cấp phát ({myAllocations.length})</TabsTrigger>
          <TabsTrigger value="repair">Sửa chữa ({myRepairs.length})</TabsTrigger>
          <TabsTrigger value="return">Thu hồi ({myReturns.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="allocation" className="mt-4">
          <DataTable columns={[
            { key: 'code', label: 'Mã YC', render: (r: any) => <span className="font-mono text-sm font-medium">{r.code}</span> },
            { key: 'reason', label: 'Lý do' },
            { key: 'lines', label: 'Số dòng', render: (r: any) => r.lines.length },
            { key: 'status', label: 'Trạng thái', render: (r: any) => <StatusBadge status={r.status} label={allocationStatusLabels[r.status]} /> },
            { key: 'createdAt', label: 'Ngày tạo', render: (r: any) => formatDate(r.createdAt) },
          ]} data={myAllocations} emptyMessage="Bạn chưa có yêu cầu cấp phát nào" />
        </TabsContent>
        <TabsContent value="repair" className="mt-4">
          <DataTable columns={[
            { key: 'code', label: 'Mã YC', render: (r: any) => <span className="font-mono text-sm font-medium">{r.code}</span> },
            { key: 'issue', label: 'Vấn đề' },
            { key: 'equipment', label: 'Thiết bị', render: (r: any) => { const eq = equipments.find(e => e.id === r.equipmentId); return eq ? `${eq.equipmentCode}` : ''; } },
            { key: 'status', label: 'Trạng thái', render: (r: any) => <StatusBadge status={r.status} label={repairStatusLabels[r.status]} /> },
            { key: 'createdAt', label: 'Ngày tạo', render: (r: any) => formatDate(r.createdAt) },
          ]} data={myRepairs} emptyMessage="Bạn chưa có yêu cầu sửa chữa nào" />
        </TabsContent>
        <TabsContent value="return" className="mt-4">
          <DataTable columns={[
            { key: 'code', label: 'Mã YC', render: (r: any) => <span className="font-mono text-sm font-medium">{r.code}</span> },
            { key: 'reason', label: 'Lý do' },
            { key: 'status', label: 'Trạng thái', render: (r: any) => <StatusBadge status={r.status} label={returnStatusLabels[r.status]} /> },
            { key: 'createdAt', label: 'Ngày tạo', render: (r: any) => formatDate(r.createdAt) },
          ]} data={myReturns} emptyMessage="Bạn chưa có yêu cầu thu hồi nào" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmployeeRequests;
