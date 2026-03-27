import { useState } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye } from 'lucide-react';
import {
  repairRequests, RepairRequest, repairStatusLabels,
  getEmployeeName, getDepartmentName, formatDate, equipments, getItemName
} from '@/data/mockData';
import { toast } from 'sonner';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';

const RepairRequests = () => {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RepairRequest | null>(null);

  const sorted = [...repairRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<RepairRequest>[] = [
    { key: 'code', label: 'Mã YC', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'requester', label: 'Người yêu cầu', render: r => getEmployeeName(r.requesterId) },
    { key: 'department', label: 'Phòng ban', render: r => getDepartmentName(r.departmentId) },
    { key: 'equipment', label: 'Thiết bị', render: r => {
      const eq = equipments.find(e => e.id === r.equipmentId);
      return eq ? `${eq.equipmentCode} - ${getItemName(eq.itemId)}` : r.equipmentId;
    }},
    { key: 'issue', label: 'Vấn đề' },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={repairStatusLabels[r.status]} /> },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>
        <Eye className="h-4 w-4" />
      </Button>
    )},
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Yêu cầu sửa chữa</h1>
          <p className="page-description">Tiếp nhận và xử lý yêu cầu sửa chữa thiết bị</p>
        </div>
      </div>
      <DataTable columns={columns} data={sorted} currentPage={page} onPageChange={setPage} />

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết yêu cầu sửa chữa {selected?.code}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Người yêu cầu:</span> {getEmployeeName(selected.requesterId)}</div>
                <div><span className="text-muted-foreground">Phòng ban:</span> {getDepartmentName(selected.departmentId)}</div>
                <div><span className="text-muted-foreground">Thiết bị:</span> {(() => { const eq = equipments.find(e => e.id === selected.equipmentId); return eq ? `${eq.equipmentCode} - ${getItemName(eq.itemId)}` : ''; })()}</div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={repairStatusLabels[selected.status]} /></div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                {selected.receivedAt && <div><span className="text-muted-foreground">Ngày tiếp nhận:</span> {formatDate(selected.receivedAt)}</div>}
              </div>
              <div className="p-3 rounded-md bg-muted">
                <p className="text-sm font-medium mb-1">Vấn đề: {selected.issue}</p>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              </div>
              {selected.status === 'MOI_TAO' && (
                <ApprovalActionBar
                  approveLabel="Tiếp nhận" rejectLabel="Từ chối"
                  onApprove={() => toast.success('Đã tiếp nhận (demo)')}
                  onReject={() => toast.info('Đã từ chối (demo)')}
                  onPrint={() => toast.info('In (demo)')}
                  onExport={() => toast.info('Xuất (demo)')}
                />
              )}
              {selected.status === 'DANG_SUA' && (
                <ApprovalActionBar
                  approveLabel="Hoàn tất" showReject={false}
                  onApprove={() => toast.success('Đã hoàn tất sửa chữa (demo)')}
                  onPrint={() => toast.info('In (demo)')}
                  onExport={() => toast.info('Xuất (demo)')}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RepairRequests;
