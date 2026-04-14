import { useState, useMemo } from 'react';
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
import { Plus, Eye, Trash2, MoreHorizontal, Pencil, FileDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { StockIn } from '@/data/mockData';
import {
  stockInStatusLabels,
  stockInSourceLabels,
  formatCurrency,
  formatDate,
  getItemName,
  getSupplierName,
  getEmployeeName,
} from '@/data/mockData';
import { toast } from 'sonner';
import {
  mapAssetItemDto,
  useAssetItems,
  useEmployees,
  useStockInsView,
  useSuppliers,
} from '@/hooks/useEntityApi';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';
import { AttachmentNoteView } from '@/components/shared/AttachmentNoteView';
import { apiDelete, apiDownloadBlob, apiGet, apiPatch, apiPost, apiPut, openPdfInBrowserTab, PAGE_ALL } from '@/api/http';
import type { ConsumableStockDto, StockReceiptLineDto } from '@/api/types';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { StockDocumentHistoryBlock } from '@/components/shared/StockDocumentHistoryBlock';
import { buildReceiptNote } from '@/utils/stockReceiptNote';
import type { StockDocumentEventDto } from '@/api/types';

const FE_SOURCE_TO_API: Record<string, string> = {
  PURCHASE: 'NEW_PURCHASE',
  RETURN: 'RECOVERY',
  ADJUSTMENT: 'MANUAL_ADJUSTMENT',
};

const FE_SOURCE_LABELS: Record<keyof typeof FE_SOURCE_TO_API, string> = {
  PURCHASE: 'Mua mới',
  RETURN: 'Thu hồi',
  ADJUSTMENT: 'Điều chỉnh',
};

const EQ_CODE_RE = /^EQ\d{6}$/;
const RETURN_REF_RE = /^returnRequestRef:(\d+)$/m;

function extractReturnRequestRefId(note: string | undefined): string {
  if (!note) return '';
  const m = note.match(RETURN_REF_RE);
  return m?.[1] ?? '';
}

const StockInPage = () => {
  const qc = useQueryClient();
  const siQ = useStockInsView();
  const iQ = useAssetItems();
  const sQ = useSuppliers();
  const eQ = useEmployees();

  const stockIns = siQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const suppliers = useMemo(
    () =>
      (sQ.data ?? []).map(s => ({
        id: String(s.id),
        name: s.name ?? '',
      })),
    [sQ.data],
  );
  const employees = eQ.data ?? [];
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StockIn | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockIn | null>(null);

  const [detailBusy, setDetailBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [editReceiptOpen, setEditReceiptOpen] = useState(false);
  const [editReceiptDraft, setEditReceiptDraft] = useState<StockIn | null>(null);
  const [editReceiptDate, setEditReceiptDate] = useState('');
  const [editSource, setEditSource] = useState<StockIn['source']>('PURCHASE');
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editUserNotes, setEditUserNotes] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const selectedIdNum = selected?.id != null && selected.id !== '' ? Number(selected.id) : NaN;
  const receiptEventsQ = useQuery({
    queryKey: ['api', 'stock-document-events', 'receipt', selectedIdNum],
    queryFn: () => apiGet<StockDocumentEventDto[]>(`/api/stock-receipts/${selectedIdNum}/events`),
    enabled: Number.isFinite(selectedIdNum),
  });
  const createdLogin =
    (receiptEventsQ.data ?? []).find(e => e.action === 'CREATE')?.login ??
    (receiptEventsQ.data ?? [])[0]?.login ??
    '';

  const downloadReceiptPdf = async () => {
    if (selected?.id == null) return;
    setPdfBusy(true);
    try {
      const blob = await apiDownloadBlob(`/api/stock-receipts/${selected.id}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phieu-nhap-${selected.code ?? selected.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Đã tải PDF');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải được PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const openEditReceipt = (r: StockIn) => {
    if (r.status !== 'DRAFT') {
      toast.error('Chỉ sửa được phiếu ở trạng thái nháp.');
      return;
    }
    setEditReceiptDraft(r);
    setEditReceiptDate(r.createdAt.slice(0, 10));
    setEditSource(r.source);
    setEditSupplierId(r.supplierId ?? '');
    setEditUserNotes(r.notes);
    setEditReceiptOpen(true);
  };

  const saveEditReceipt = async () => {
    if (!editReceiptDraft) return;
    const apiSource = FE_SOURCE_TO_API[editSource];
    if (!apiSource) {
      toast.error('Nguồn nhập không hợp lệ');
      return;
    }
    setEditBusy(true);
    try {
      await apiPatch(`/api/stock-receipts/${editReceiptDraft.id}`, {
        id: Number(editReceiptDraft.id),
        code: editReceiptDraft.code,
        receiptDate: editReceiptDate,
        source: apiSource,
        status: 'DRAFT',
        note: buildReceiptNote(editUserNotes, editSupplierId, {
          returnRequestRefId: extractReturnRequestRefId(editReceiptDraft.notes),
        }),
      });
      toast.success('Đã cập nhật phiếu nhập');
      const rid = editReceiptDraft.id;
      setEditReceiptOpen(false);
      setEditReceiptDraft(null);
      invalidateStock();
      setSelected(cur => (cur?.id === rid ? null : cur));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setEditBusy(false);
    }
  };

  const filtered = stockIns.filter(si => {
    if (filters.search && !si.code.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.status && si.status !== filters.status) return false;
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<StockIn>[] = [
    { key: 'code', label: 'Mã phiếu', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'source', label: 'Nguồn nhập', render: r => stockInSourceLabels[r.source] },
    { key: 'supplier', label: 'NCC', render: r => r.supplierId ? getSupplierName(r.supplierId, suppliers) : '—' },
    { key: 'lines', label: 'Số dòng', render: r => r.lines.length },
    { key: 'totalAmount', label: 'Tổng tiền', render: r => formatCurrency(r.totalAmount), className: 'text-right' },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={stockInStatusLabels[r.status]} /> },
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
          <DropdownMenuItem onClick={() => openEditReceipt(r)}><Pencil className="h-4 w-4 mr-2" />Sửa</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(r)}><Trash2 className="h-4 w-4 mr-2" />Xóa</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )},
  ];

  const filterFields: FilterField[] = [
    { key: 'search', label: 'Tìm kiếm', type: 'text', placeholder: 'Mã phiếu...' },
    { key: 'status', label: 'Trạng thái', type: 'select', options: Object.entries(stockInStatusLabels).map(([v, l]) => ({ value: v, label: l })) },
  ];

  const invalidateStock = () => {
    void qc.invalidateQueries({ queryKey: ['api', 'stock-ins-view'] });
    void qc.invalidateQueries({ queryKey: ['api', 'stock-document-events'] });
  };

  const applyConfirmedInventory = async (doc: StockIn) => {
    const receiptDate = doc.createdAt.slice(0, 10);
    const supplierNum = doc.supplierId ? Number(doc.supplierId) : undefined;
    const stocks = await apiGet<ConsumableStockDto[]>(`/api/consumable-stocks?${PAGE_ALL}`);

    const consumableAdd = new Map<number, number>();
    for (const line of doc.lines) {
      const item = assetItems.find(i => i.id === line.itemId);
      if (item?.managementType === 'CONSUMABLE') {
        const itemNum = Number(line.itemId);
        consumableAdd.set(itemNum, (consumableAdd.get(itemNum) ?? 0) + line.quantity);
      }
    }

    for (const line of doc.lines) {
      const item = assetItems.find(i => i.id === line.itemId);
      const itemNum = Number(line.itemId);

      if (item?.managementType === 'DEVICE' && line.equipmentCode && line.serial) {
        if (!EQ_CODE_RE.test(line.equipmentCode)) {
          toast.error(`Mã thiết bị phải dạng EQ + 6 chữ số (vd EQ000001). Sai: ${line.equipmentCode}`);
          return;
        }
        const depMonths = Number((line as any).depreciationMonths);
        const salv = Number((line as any).salvageValue ?? 0);
        if (item.enableDepreciation && (!Number.isFinite(depMonths) || depMonths <= 0)) {
          toast.error('Thiết bị có khấu hao bắt buộc có số tháng khấu hao. Vui lòng tạo lại phiếu với số tháng khấu hao hợp lệ.');
          return;
        }
        await apiPost('/api/equipment', {
          equipmentCode: line.equipmentCode,
          ...(line.serial?.trim() ? { serial: line.serial } : {}),
          ...(line.modelName?.trim() ? { modelName: line.modelName.trim() } : {}),
          status: 'IN_STOCK',
          ...(item.enableDepreciation
            ? {
                purchasePrice: line.unitPrice,
                capitalizationDate: receiptDate,
                depreciationMonths: depMonths,
                salvageValue: salv,
              }
            : {}),
          assetItem: { id: itemNum },
          ...(supplierNum ? { supplier: { id: supplierNum } } : {}),
        });
      }
    }

    for (const [itemNum, addQty] of consumableAdd) {
      const row = stocks.find(s => s.assetItem?.id === itemNum);
      if (row?.id != null) {
        await apiPut(`/api/consumable-stocks/${row.id}`, {
          id: row.id,
          quantityOnHand: (row.quantityOnHand ?? 0) + addQty,
          quantityIssued: row.quantityIssued ?? 0,
          note: row.note,
          assetItem: { id: itemNum },
        });
      } else {
        await apiPost('/api/consumable-stocks', {
          quantityOnHand: addQty,
          quantityIssued: 0,
          assetItem: { id: itemNum },
        });
      }
    }
  };

  const handleConfirmReceipt = async () => {
    if (!selected || selected.status !== 'DRAFT') return;
    setDetailBusy(true);
    try {
      await applyConfirmedInventory(selected);
      await apiPatch(`/api/stock-receipts/${selected.id}`, {
        id: Number(selected.id),
        status: 'CONFIRMED',
      });
      toast.success('Đã nhập kho — đã ghi nhận thiết bị / tồn vật tư');
      setSelected(null);
      invalidateStock();
      void qc.invalidateQueries({ queryKey: ['api', 'equipment'] });
      void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks'] });
      void qc.invalidateQueries({ queryKey: ['api', 'equipment-assignments'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setDetailBusy(false);
    }
  };

  const handleCancelReceipt = async () => {
    if (!selected || selected.status !== 'DRAFT') return;
    setDetailBusy(true);
    try {
      await apiPatch(`/api/stock-receipts/${selected.id}`, {
        id: Number(selected.id),
        status: 'CANCELLED',
      });
      toast.success('Đã hủy phiếu nhập');
      setSelected(null);
      invalidateStock();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setDetailBusy(false);
    }
  };

  const handleDeleteReceipt = async () => {
    if (!deleteTarget) return;
    setDetailBusy(true);
    try {
      const allLines = await apiGet<StockReceiptLineDto[]>('/api/stock-receipt-lines');
      const mine = allLines.filter(l => l.receipt?.id === Number(deleteTarget.id));
      for (const l of mine) {
        if (l.id != null) await apiDelete(`/api/stock-receipt-lines/${l.id}`);
      }
      await apiDelete(`/api/stock-receipts/${deleteTarget.id}`);
      toast.success(`Đã xóa phiếu ${deleteTarget.code}`);
      setDeleteTarget(null);
      setSelected(null);
      invalidateStock();
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
          <h1 className="page-title">Nhập kho</h1>
        </div>
        <Button asChild>
          <Link to="/admin/stock-in/new"><Plus className="h-4 w-4 mr-1" /> Tạo phiếu nhập</Link>
        </Button>
      </div>

      <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />

      {/* ===== DETAIL DIALOG ===== */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 pr-8">
              <DialogTitle className="flex-1 text-left">Chi tiết phiếu nhập {selected?.code}</DialogTitle>
              {selected?.id != null && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={pdfBusy}
                  onClick={() => void downloadReceiptPdf()}
                >
                  <FileDown className="h-4 w-4 mr-1" /> {pdfBusy ? 'Đang tải…' : 'Tải PDF'}
                </Button>
              )}
            </div>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Nguồn nhập:</span> {stockInSourceLabels[selected.source]}</div>
                <div><span className="text-muted-foreground">NCC:</span> {selected.supplierId ? getSupplierName(selected.supplierId, suppliers) : '—'}</div>
                <div><span className="text-muted-foreground">Người tạo:</span> {createdLogin || '—'}</div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={stockInStatusLabels[selected.status]} /></div>
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
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                {selected.confirmedAt && <div><span className="text-muted-foreground">Ngày nhập kho:</span> {formatDate(selected.confirmedAt)}</div>}
              </div>
              <DataTable
                columns={[
                  { key: 'item', label: 'Tài sản', render: (r: any) => getItemName(r.itemId, assetItems) },
                  {
                    key: 'eq',
                    label: 'Mã TB / Serial',
                    render: (r: any) =>
                      r.equipmentCode || r.serial
                        ? `${formatEquipmentCodeDisplay(r.equipmentCode) || '—'} / ${r.serial ?? ''}`
                        : '—',
                  },
                  { key: 'modelName', label: 'Model', render: (r: any) => (r.modelName ? String(r.modelName) : '—') },
                  { key: 'quantity', label: 'SL', className: 'text-right' },
                  { key: 'unitPrice', label: 'Đơn giá', render: (r: any) => formatCurrency(r.unitPrice), className: 'text-right' },
                  { key: 'totalPrice', label: 'Thành tiền', render: (r: any) => formatCurrency(r.totalPrice), className: 'text-right' },
                ]}
                data={selected.lines}
              />
              <div className="text-right font-semibold text-lg">Tổng: {formatCurrency(selected.totalAmount)}</div>
              <StockDocumentHistoryBlock kind="receipt" docId={selected.id} />
              {selected.status === 'DRAFT' && (
                <ApprovalActionBar
                  disabled={detailBusy || pdfBusy}
                  approveLabel="Xác nhận nhập kho"
                  onApprove={() => void handleConfirmReceipt()}
                  onCancel={() => void handleCancelReceipt()}
                  showReject={false} showCancel={true}
                  onPrint={() => {
                    if (selected?.id == null) return;
                    setPdfBusy(true);
                    void openPdfInBrowserTab(`/api/stock-receipts/${selected.id}/pdf`)
                      .then(() => toast.success('Đã mở PDF — dùng In trong trình duyệt (Ctrl+P)'))
                      .catch(e => toast.error(e instanceof Error ? e.message : 'Không mở được PDF'))
                      .finally(() => setPdfBusy(false));
                  }}
                  onExport={() => void downloadReceiptPdf()}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== EDIT RECEIPT (DRAFT) ===== */}
      <Dialog open={editReceiptOpen} onOpenChange={v => { if (!v) { setEditReceiptOpen(false); setEditReceiptDraft(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sửa phiếu nhập {editReceiptDraft?.code}</DialogTitle>
          </DialogHeader>
          {editReceiptDraft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Ngày phiếu</Label>
                <Input type="date" value={editReceiptDate} onChange={e => setEditReceiptDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nguồn nhập</Label>
                <Select value={editSource} onValueChange={v => setEditSource(v as StockIn['source'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(FE_SOURCE_LABELS) as Array<[keyof typeof FE_SOURCE_LABELS, string]>).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nhà cung cấp</Label>
                <Select value={editSupplierId || '__none__'} onValueChange={v => setEditSupplierId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Chọn NCC..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Không chọn —</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Textarea value={editUserNotes} onChange={e => setEditUserNotes(e.target.value)} rows={3} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setEditReceiptOpen(false); setEditReceiptDraft(null); }} disabled={editBusy}>Hủy</Button>
                <Button onClick={() => void saveEditReceipt()} disabled={editBusy}>{editBusy ? 'Đang lưu…' : 'Lưu'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== DELETE CONFIRM ===== */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa phiếu nhập</AlertDialogTitle>
            <AlertDialogDescription>Bạn có chắc chắn muốn xóa phiếu <strong>{deleteTarget?.code}</strong>? Hành động này không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void handleDeleteReceipt()} disabled={detailBusy}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StockInPage;
