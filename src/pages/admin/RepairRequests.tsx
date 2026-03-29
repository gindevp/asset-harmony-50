import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar } from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye } from 'lucide-react';
import type { RepairRequest } from '@/data/mockData';
import {
  repairStatusLabels,
  getEmployeeName,
  getDepartmentName,
  formatDate,
  getItemName,
} from '@/data/mockData';
import { toast } from 'sonner';
import { formatBizCodeDisplay, formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';
import {
  mapAssetItemDto,
  useAssetItems,
  useDepartments,
  useEmployees,
  useEnrichedEquipmentList,
  useRepairRequestsView,
} from '@/hooks/useEntityApi';
import { apiPatch } from '@/api/http';

const outcomeLabels: Record<string, string> = {
  RETURN_USER: 'Trả lại người dùng',
  RETURN_STOCK: 'Trả về kho',
  MARK_BROKEN: 'Đánh dấu hỏng',
};

function RepairAttachmentNoteView({ text }: { text: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const textLines: string[] = [];
  const files: string[] = [];
  for (const line of lines) {
    if (line.startsWith('FILE:')) files.push(line.slice(5).trim());
    else textLines.push(line);
  }
  return (
    <div className="space-y-2">
      <span className="text-muted-foreground">Đính kèm / ghi chú:</span>
      {textLines.length > 0 ? (
        <p className="text-sm whitespace-pre-wrap">{textLines.join('\n')}</p>
      ) : null}
      {files.map(u => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline block">
          Mở file đính kèm
        </a>
      ))}
    </div>
  );
}

const RepairRequests = () => {
  const qc = useQueryClient();
  const rrQ = useRepairRequestsView();
  const eqQ = useEnrichedEquipmentList();
  const iQ = useAssetItems();
  const empQ = useEmployees();
  const depQ = useDepartments();

  const repairRequests = rrQ.data ?? [];
  const equipments = eqQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const employees = empQ.data ?? [];
  const departments = depQ.data ?? [];

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RepairRequest | null>(null);
  const [outcome, setOutcome] = useState<string>('RETURN_USER');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selected) return;
    if (selected.result && outcomeLabels[selected.result]) setOutcome(selected.result);
    else setOutcome('RETURN_USER');
  }, [selected?.id, selected?.result]);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });

  const patch = async (body: Record<string, unknown>) => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiPatch(`/api/repair-requests/${selected.id}`, { id: Number(selected.id), ...body });
      toast.success('Đã cập nhật yêu cầu sửa chữa');
      setSelected(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setBusy(false);
    }
  };

  const sorted = repairRequests
    .filter(r => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const eq = equipments.find(e => e.id === r.equipmentId);
        const eqLabel = eq ? `${eq.equipmentCode} ${getItemName(eq.itemId, assetItems)}` : '';
        if (
          !r.code.toLowerCase().includes(s) &&
          !eqLabel.toLowerCase().includes(s) &&
          !getEmployeeName(r.requesterId, employees).toLowerCase().includes(s)
        ) {
          return false;
        }
      }
      if (filters.status && r.status !== filters.status) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<RepairRequest>[] = [
    {
      key: 'code',
      label: 'Mã YC',
      render: r => <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code)}</span>,
    },
    { key: 'requester', label: 'Người yêu cầu', render: r => getEmployeeName(r.requesterId, employees) },
    { key: 'department', label: 'Phòng ban', render: r => getDepartmentName(r.departmentId, departments) },
    {
      key: 'equipment',
      label: 'Thiết bị',
      render: r => {
        const eq = equipments.find(e => e.id === r.equipmentId);
        return eq
          ? `${formatEquipmentCodeDisplay(eq.equipmentCode)} - ${getItemName(eq.itemId, assetItems)}`
          : r.equipmentId;
      },
    },
    { key: 'issue', label: 'Vấn đề' },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={repairStatusLabels[r.status]} /> },
    { key: 'result', label: 'Kết quả', render: r => (r.result ? outcomeLabels[r.result] ?? r.result : '—') },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
    {
      key: 'actions',
      label: '',
      render: r => (
        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setSelected(r); }}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Yêu cầu sửa chữa</h1>
          <p className="page-description">Tiếp nhận và xử lý yêu cầu sửa chữa thiết bị</p>
        </div>
      </div>
      <FilterBar
        fields={[
          { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã YC, thiết bị, người YC...' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: Object.entries(repairStatusLabels).map(([v, l]) => ({ value: v, label: l })) },
        ]}
        values={filters}
        onChange={(k, v) => { setFilters(prev => ({ ...prev, [k]: v })); setPage(1); }}
        onReset={() => { setFilters({}); setPage(1); }}
      />
      <DataTable columns={columns} data={sorted} currentPage={page} onPageChange={setPage} />

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết yêu cầu sửa chữa {selected ? formatBizCodeDisplay(selected.code) : ''}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Người yêu cầu:</span> {getEmployeeName(selected.requesterId, employees)}</div>
                <div><span className="text-muted-foreground">Phòng ban:</span> {getDepartmentName(selected.departmentId, departments)}</div>
                <div>
                  <span className="text-muted-foreground">Thiết bị:</span>{' '}
                  {(() => {
                    const eq = equipments.find(e => e.id === selected.equipmentId);
                    return eq
                      ? `${formatEquipmentCodeDisplay(eq.equipmentCode)} - ${getItemName(eq.itemId, assetItems)}`
                      : '';
                  })()}
                </div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={repairStatusLabels[selected.status]} /></div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                {selected.result && (
                  <div><span className="text-muted-foreground">Kết quả xử lý:</span> {outcomeLabels[selected.result] ?? selected.result}</div>
                )}
              </div>
              <div className="p-3 rounded-md bg-muted">
                <p className="text-sm font-medium mb-1">Vấn đề: {selected.issue}</p>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
                {selected.attachmentNote ? (
                  <div className="mt-2">
                    <RepairAttachmentNoteView text={selected.attachmentNote} />
                  </div>
                ) : null}
              </div>
              {selected.status === 'NEW' && (
                <ApprovalActionBar
                  approveLabel="Tiếp nhận"
                  rejectLabel="Từ chối"
                  onApprove={() => void patch({ status: 'ACCEPTED' })}
                  onReject={() => void patch({ status: 'REJECTED' })}
                  onPrint={() => window.print()}
                  onExport={() => toast.info('Xuất (demo)')}
                />
              )}
              {(selected.status === 'ACCEPTED' || selected.status === 'IN_PROGRESS') && (
                <div className="space-y-3">
                  {selected.status === 'ACCEPTED' && (
                    <Button variant="secondary" disabled={busy} onClick={() => void patch({ status: 'IN_PROGRESS' })}>
                      Chuyển trạng thái: đang sửa
                    </Button>
                  )}
                  <div className="space-y-2">
                    <Label>Kết quả sau sửa chữa</Label>
                    <Select value={outcome} onValueChange={setOutcome} disabled={busy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(outcomeLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ApprovalActionBar
                    approveLabel="Hoàn tất"
                    showReject={false}
                    onApprove={() => void patch({ status: 'COMPLETED', repairOutcome: outcome })}
                    onPrint={() => window.print()}
                    onExport={() => toast.info('Xuất (demo)')}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RepairRequests;
