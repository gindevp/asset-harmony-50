import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Eye, MoreHorizontal, Pencil, Trash2, FileDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { StockOut } from '@/data/mockData';
import {
  stockOutStatusLabels,
  formatDate,
  getItemCode,
  getItemName,
  getEmployeeName,
  getDepartmentName,
  getLocationName,
} from '@/data/mockData';
import { toast } from 'sonner';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';
import { AttachmentNoteView } from '@/components/shared/AttachmentNoteView';
import {
  mapAssetItemDto,
  useAssetItems,
  useDepartments,
  useEmployees,
  useEnrichedEquipmentList,
  useLocations,
  useStockOutsView,
} from '@/hooks/useEntityApi';
import { apiDelete, apiDownloadBlob, apiGet, apiPatch, apiPost, apiPut, openPdfInBrowserTab, PAGE_ALL } from '@/api/http';
import type { ConsumableStockDto, StockDocumentEventDto, StockIssueLineDto } from '@/api/types';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { StockDocumentHistoryBlock } from '@/components/shared/StockDocumentHistoryBlock';

const recipientTypeLabels: Record<string, string> = {
  EMPLOYEE: 'Nhân viên',
  DEPARTMENT: 'Phòng ban',
  LOCATION: 'Vị trí',
  COMPANY: 'Công ty',
};
const selectableRecipientTypeLabels: Record<string, string> = {
  EMPLOYEE: 'Nhân viên',
  DEPARTMENT: 'Phòng ban',
  COMPANY: 'Công ty',
};
const COMPANY_RECIPIENT_MARKER = 'Đối tượng: Công ty';

const StockOutPage = () => {
  const qc = useQueryClient();
  const invalidateStockOutViews = async () => {
    await qc.invalidateQueries({ queryKey: ['api', 'stock-outs-view'] });
    await qc.invalidateQueries({ queryKey: ['api', 'stock-document-events'] });
  };
  const soQ = useStockOutsView();
  const iQ = useAssetItems();
  const eqQ = useEnrichedEquipmentList();
  const empQ = useEmployees();
  const depQ = useDepartments();
  const locQ = useLocations();

  const stockOuts = soQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const equipments = eqQ.data ?? [];
  const employees = empQ.data ?? [];
  const departments = depQ.data ?? [];
  const locations = locQ.data ?? [];

  const getRecipientName = (type: string, id: string) => {
    switch (type) {
      case 'EMPLOYEE':
        return getEmployeeName(id, employees);
      case 'DEPARTMENT':
        return getDepartmentName(id, departments);
      case 'LOCATION':
        return getLocationName(id, locations);
      case 'COMPANY':
        return id ? getLocationName(id, locations) : 'Toàn công ty';
      default:
        return id;
    }
  };

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StockOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockOut | null>(null);

  const [detailBusy, setDetailBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [editOutOpen, setEditOutOpen] = useState(false);
  const [editOutDraft, setEditOutDraft] = useState<StockOut | null>(null);
  const [editOutDate, setEditOutDate] = useState('');
  const [editOutRecipientType, setEditOutRecipientType] = useState<StockOut['recipientType']>('EMPLOYEE');
  const [editOutRecipientId, setEditOutRecipientId] = useState('');
  const [editOutNotes, setEditOutNotes] = useState('');
  const [editOutBusy, setEditOutBusy] = useState(false);

  const selectedIdNum = selected?.id != null && selected.id !== '' ? Number(selected.id) : NaN;
  const issueEventsQ = useQuery({
    queryKey: ['api', 'stock-document-events', 'issue', selectedIdNum],
    queryFn: () => apiGet<StockDocumentEventDto[]>(`/api/stock-issues/${selectedIdNum}/events`),
    enabled: Number.isFinite(selectedIdNum),
  });
  const createdLogin =
    (issueEventsQ.data ?? []).find(e => e.action === 'CREATE')?.login ??
    (issueEventsQ.data ?? [])[0]?.login ??
    '';

  const editRecipientOptions = useMemo(() => {
    switch (editOutRecipientType) {
      case 'EMPLOYEE':
        return employees
          .filter(e => e.active !== false)
          .map(e => ({ value: String(e.id), label: `${e.code} - ${e.fullName}` }));
      case 'DEPARTMENT':
        return departments
          .filter(d => d.active !== false)
          .map(d => ({ value: String(d.id), label: `${d.code} - ${d.name}` }));
      case 'COMPANY':
        return locations
          .filter(l => l.active !== false)
          .map(l => ({ value: String(l.id), label: `${l.code} - ${l.name}` }));
      default:
        return [];
    }
  }, [editOutRecipientType, employees, departments, locations]);

  const openEditStockOut = useCallback((r: StockOut) => {
    if (r.status !== 'DRAFT') {
      toast.error('Chỉ sửa được phiếu ở trạng thái nháp.');
      return;
    }
    setEditOutDraft(r);
    setEditOutDate(r.createdAt.slice(0, 10));
    setEditOutRecipientType(r.recipientType);
    setEditOutRecipientId(r.recipientId);
    setEditOutNotes(r.notes);
    setEditOutOpen(true);
  }, []);

  const saveEditStockOut = async () => {
    if (!editOutDraft) return;
    if (!editOutRecipientId) {
      toast.error('Vui lòng chọn đối tượng nhận');
      return;
    }
    setEditOutBusy(true);
    try {
      const body: Record<string, unknown> = {
        id: Number(editOutDraft.id),
        code: editOutDraft.code,
        issueDate: editOutDate,
        status: 'DRAFT',
        assigneeType: editOutRecipientType === 'COMPANY' ? 'LOCATION' : editOutRecipientType,
        note:
          editOutRecipientType === 'COMPANY'
            ? [editOutNotes.trim(), COMPANY_RECIPIENT_MARKER].filter(Boolean).join(' — ')
            : (editOutNotes.trim() || undefined),
      };
      if (editOutRecipientType === 'EMPLOYEE') body.employee = { id: Number(editOutRecipientId) };
      else if (editOutRecipientType === 'DEPARTMENT') body.department = { id: Number(editOutRecipientId) };
      else if (editOutRecipientType === 'COMPANY') body.location = { id: Number(editOutRecipientId) };
      await apiPatch(`/api/stock-issues/${editOutDraft.id}`, body);
      toast.success('Đã cập nhật phiếu xuất');
      const oid = editOutDraft.id;
      setEditOutOpen(false);
      setEditOutDraft(null);
      await invalidateStockOutViews();
      setSelected(cur => (cur?.id === oid ? null : cur));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setEditOutBusy(false);
    }
  };

  const downloadIssuePdf = async () => {
    if (selected?.id == null) return;
    setPdfBusy(true);
    try {
      const blob = await apiDownloadBlob(`/api/stock-issues/${selected.id}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phieu-xuat-${selected.code ?? selected.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Đã tải PDF');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải được PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const filtered = stockOuts.filter(so => {
    if (filters.search && !so.code.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.status && so.status !== filters.status) return false;
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<StockOut>[] = [
    { key: 'code', label: 'Mã phiếu', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'recipient', label: 'Đối tượng nhận', render: r => (
      <div>
        <span className="text-xs text-muted-foreground">{recipientTypeLabels[r.recipientType]}: </span>
        {getRecipientName(r.recipientType, r.recipientId)}
      </div>
    )},
    { key: 'request', label: 'Yêu cầu', render: r => r.requestId ? <span className="font-mono text-sm">{r.requestId}</span> : '—' },
    { key: 'lines', label: 'Số dòng', render: r => r.lines.length },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={stockOutStatusLabels[r.status]} /> },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
    { key: 'actions', label: '', render: r => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => e.stopPropagation()}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setSelected(r)}><Eye className="h-4 w-4 mr-2" />Xem chi tiết</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openEditStockOut(r)}><Pencil className="h-4 w-4 mr-2" />Sửa</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(r)}><Trash2 className="h-4 w-4 mr-2" />Xóa</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )},
  ];

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã phiếu...' },
    { key: 'status', label: 'Trạng thái', type: 'select', options: Object.entries(stockOutStatusLabels).map(([v, l]) => ({ value: v, label: l })) },
  ];

  const applyStockOutConfirmed = async (doc: StockOut) => {
    const issueDate = doc.createdAt.slice(0, 10);
    const stocks = await apiGet<ConsumableStockDto[]>(`/api/consumable-stocks?${PAGE_ALL}`);

    const consumableTotals = new Map<number, number>();
    for (const line of doc.lines) {
      const item = assetItems.find(i => i.id === line.itemId);
      if (item?.managementType === 'CONSUMABLE') {
        const itemNum = Number(line.itemId);
        consumableTotals.set(itemNum, (consumableTotals.get(itemNum) ?? 0) + line.quantity);
      }
    }

    for (const line of doc.lines) {
      const item = assetItems.find(i => i.id === line.itemId);

      if (item?.managementType === 'DEVICE' && line.equipmentId) {
        const eqId = Number(line.equipmentId);
        await apiPatch(`/api/equipment/${eqId}`, { id: eqId, status: 'IN_USE' });
        const body: Record<string, unknown> = {
          assignedDate: issueDate,
          equipment: { id: eqId },
          note: doc.notes || undefined,
        };
        if (doc.recipientType === 'EMPLOYEE' && doc.recipientId) body.employee = { id: Number(doc.recipientId) };
        else if (doc.recipientType === 'DEPARTMENT' && doc.recipientId) body.department = { id: Number(doc.recipientId) };
        else if (doc.recipientType === 'LOCATION' && doc.recipientId) body.location = { id: Number(doc.recipientId) };
        else if (doc.recipientType === 'COMPANY') {
          if (doc.recipientId) body.location = { id: Number(doc.recipientId) };
          body.note = [doc.notes, 'Đối tượng: Công ty'].filter(Boolean).join(' — ') || 'Đối tượng: Công ty';
        }
        await apiPost('/api/equipment-assignments', body);
      }
    }

    for (const [itemNum, qty] of consumableTotals) {
      const row = stocks.find(s => s.assetItem?.id === itemNum);
      if (row?.id == null) throw new Error(`Không tìm thấy tồn vật tư cho mã ${itemNum}`);
      const onHand = row.quantityOnHand ?? 0;
      if (onHand < qty) throw new Error(`Tồn kho không đủ cho vật tư (id ${itemNum})`);
      await apiPut(`/api/consumable-stocks/${row.id}`, {
        id: row.id,
        quantityOnHand: onHand - qty,
        quantityIssued: (row.quantityIssued ?? 0) + qty,
        note: row.note,
        assetItem: { id: itemNum },
      });
    }
  };

  const handleConfirmOut = async () => {
    if (!selected || selected.status !== 'DRAFT') return;
    setDetailBusy(true);
    try {
      await applyStockOutConfirmed(selected);
      await apiPatch(`/api/stock-issues/${selected.id}`, { id: Number(selected.id), status: 'CONFIRMED' });
      toast.success('Đã xác nhận xuất — cập nhật thiết bị / tồn vật tư');
      setSelected(null);
      await invalidateStockOutViews();
      void qc.invalidateQueries({ queryKey: ['api', 'equipment'] });
      void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks'] });
      void qc.invalidateQueries({ queryKey: ['api', 'equipment-assignments'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setDetailBusy(false);
    }
  };

  const handleCancelOut = async () => {
    if (!selected || selected.status !== 'DRAFT') return;
    setDetailBusy(true);
    try {
      await apiPatch(`/api/stock-issues/${selected.id}`, { id: Number(selected.id), status: 'CANCELLED' });
      toast.success('Đã hủy phiếu xuất');
      setSelected(null);
      await invalidateStockOutViews();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setDetailBusy(false);
    }
  };

  const handleDeleteOut = async () => {
    if (!deleteTarget) return;
    setDetailBusy(true);
    try {
      const allLines = await apiGet<StockIssueLineDto[]>('/api/stock-issue-lines');
      const mine = allLines.filter(l => l.issue?.id === Number(deleteTarget.id));
      for (const l of mine) {
        if (l.id != null) await apiDelete(`/api/stock-issue-lines/${l.id}`);
      }
      await apiDelete(`/api/stock-issues/${deleteTarget.id}`);
      toast.success(`Đã xóa phiếu ${deleteTarget.code}`);
      setDeleteTarget(null);
      setSelected(null);
      await qc.invalidateQueries({ queryKey: ['api', 'stock-outs-view'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setDetailBusy(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Xuất kho</h1>
        </div>
        <Button asChild>
          <Link to="/admin/stock-out/new">
            <Plus className="h-4 w-4 mr-1" /> Tạo phiếu xuất
          </Link>
        </Button>
      </div>

      <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />

      {/* ===== DETAIL DIALOG ===== */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 pr-8">
              <DialogTitle className="flex-1 text-left">Chi tiết phiếu xuất {selected?.code}</DialogTitle>
              {selected?.id != null && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={pdfBusy}
                  onClick={() => void downloadIssuePdf()}
                >
                  <FileDown className="h-4 w-4 mr-1" /> {pdfBusy ? 'Đang tải…' : 'Tải PDF'}
                </Button>
              )}
            </div>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {(() => {
                const recipientName = getRecipientName(selected.recipientType, selected.recipientId);
                const recipientDisplay =
                  selected.recipientType === 'COMPANY'
                    ? 'Công ty'
                    : `${recipientTypeLabels[selected.recipientType]}${recipientName ? ` – ${recipientName}` : ''}`;
                const issuedLocation =
                  selected.recipientId && (selected.recipientType === 'COMPANY' || selected.recipientType === 'LOCATION')
                    ? getLocationName(selected.recipientId, locations)
                    : '—';
                return (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Đối tượng nhận:</span> {recipientDisplay}</div>
                <div><span className="text-muted-foreground">Vị trí được cấp:</span> {issuedLocation}</div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={stockOutStatusLabels[selected.status]} /></div>
                <div><span className="text-muted-foreground">Người tạo:</span> {createdLogin || '—'}</div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Ghi chú:</span>
                  <div className="mt-1 text-foreground break-words">
                    {selected.notes?.trim() ? (
                      <AttachmentNoteView text={selected.notes} showCaption={false} />
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
              </div>
                );
              })()}
              <DataTable
                columns={[
                  { key: 'item', label: 'Tài sản', render: (r: any) => getItemName(r.itemId, assetItems) },
                  {
                    key: 'equipment',
                    label: 'Mã tài sản',
                    render: (r: any) => {
                      if (!r.equipmentId) return getItemCode(r.itemId, assetItems) || '—';
                      const eq = equipments.find(e => String(e.id) === String(r.equipmentId));
                      return eq ? formatEquipmentCodeDisplay(eq.equipmentCode) : String(r.equipmentId);
                    },
                  },
                  {
                    key: 'serial',
                    label: 'Serial',
                    render: (r: any) => {
                      if (!r.equipmentId) return '—';
                      const eq = equipments.find(e => String(e.id) === String(r.equipmentId));
                      return (eq?.serial ?? '').trim() || '—';
                    },
                  },
                  { key: 'quantity', label: 'SL', className: 'text-right' },
                ]}
                data={selected.lines}
              />
              <StockDocumentHistoryBlock kind="issue" docId={selected.id} />
              {selected.status === 'DRAFT' && (
                <ApprovalActionBar
                  disabled={detailBusy || pdfBusy}
                  approveLabel="Xác nhận"
                  onApprove={() => void handleConfirmOut()}
                  onCancel={() => void handleCancelOut()}
                  showReject={false} showCancel={true}
                  onPrint={() => {
                    if (selected?.id == null) return;
                    setPdfBusy(true);
                    void openPdfInBrowserTab(`/api/stock-issues/${selected.id}/pdf`)
                      .then(() => toast.success('Đã mở PDF — dùng In trong trình duyệt (Ctrl+P)'))
                      .catch(e => toast.error(e instanceof Error ? e.message : 'Không mở được PDF'))
                      .finally(() => setPdfBusy(false));
                  }}
                  onExport={() => void downloadIssuePdf()}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== EDIT ISSUE (DRAFT) ===== */}
      <Dialog open={editOutOpen} onOpenChange={v => { if (!v) { setEditOutOpen(false); setEditOutDraft(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sửa phiếu xuất {editOutDraft?.code}</DialogTitle>
          </DialogHeader>
          {editOutDraft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Ngày phiếu</Label>
                <Input type="date" value={editOutDate} onChange={e => setEditOutDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Đối tượng nhận</Label>
                <Select
                  value={editOutRecipientType}
                  onValueChange={v => {
                    setEditOutRecipientType(v as StockOut['recipientType']);
                    setEditOutRecipientId('');
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(selectableRecipientTypeLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{recipientTypeLabels[editOutRecipientType]} <span className="text-destructive">*</span></Label>
                <Select value={editOutRecipientId} onValueChange={setEditOutRecipientId}>
                  <SelectTrigger>
                    <SelectValue placeholder={editOutRecipientType === 'COMPANY' ? 'Chọn vị trí...' : 'Chọn...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {editRecipientOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Textarea value={editOutNotes} onChange={e => setEditOutNotes(e.target.value)} rows={3} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setEditOutOpen(false); setEditOutDraft(null); }} disabled={editOutBusy}>Hủy</Button>
                <Button onClick={() => void saveEditStockOut()} disabled={editOutBusy}>{editOutBusy ? 'Đang lưu…' : 'Lưu'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== DELETE CONFIRM ===== */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa phiếu xuất</AlertDialogTitle>
            <AlertDialogDescription>Bạn có chắc chắn muốn xóa phiếu <strong>{deleteTarget?.code}</strong>? Hành động này không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void handleDeleteOut()} disabled={detailBusy}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StockOutPage;
