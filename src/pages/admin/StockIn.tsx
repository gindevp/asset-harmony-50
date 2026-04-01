import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterBar, FilterField } from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Eye, Trash2, PlusCircle, MoreHorizontal, Pencil, FileDown } from 'lucide-react';
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
import { apiDelete, apiDownloadBlob, apiGet, apiPatch, apiPost, apiPut, openPdfInBrowserTab, PAGE_ALL } from '@/api/http';
import type { ConsumableStockDto, StockReceiptDto, StockReceiptLineDto } from '@/api/types';
import { makeBizCode } from '@/api/businessCode';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { StockDocumentHistoryBlock } from '@/components/shared/StockDocumentHistoryBlock';
import { buildReceiptNote } from '@/utils/stockReceiptNote';

const FE_SOURCE_TO_API: Record<string, string> = {
  PURCHASE: 'NEW_PURCHASE',
  RETURN: 'RECOVERY',
  ADJUSTMENT: 'MANUAL_ADJUSTMENT',
};

const EQ_CODE_RE = /^EQ\d{6}$/;

function formatDeviceLineNote(equipmentCode: string, serial: string): string {
  return `CODE:${equipmentCode}|SN:${serial}`;
}

// Types for form
interface DeviceLine {
  id: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  depreciationMonths: number;
  salvageValue: number;
  serials: { equipmentCode: string; serial: string }[];
}

interface ConsumableLine {
  id: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
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
  const deviceItems = useMemo(() => assetItems.filter(i => i.managementType === 'DEVICE'), [assetItems]);
  const consumableItems = useMemo(() => assetItems.filter(i => i.managementType === 'CONSUMABLE'), [assetItems]);

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StockIn | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockIn | null>(null);

  // Create form state
  const [createOpen, setCreateOpen] = useState(false);
  const [assetType, setAssetType] = useState<'DEVICE' | 'CONSUMABLE' | ''>('');
  const [source, setSource] = useState<string>('PURCHASE');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [deviceLines, setDeviceLines] = useState<DeviceLine[]>([]);
  const [consumableLines, setConsumableLines] = useState<ConsumableLine[]>([]);
  const [createBusy, setCreateBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [editReceiptOpen, setEditReceiptOpen] = useState(false);
  const [editReceiptDraft, setEditReceiptDraft] = useState<StockIn | null>(null);
  const [editReceiptDate, setEditReceiptDate] = useState('');
  const [editSource, setEditSource] = useState<StockIn['source']>('PURCHASE');
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editUserNotes, setEditUserNotes] = useState('');
  const [editBusy, setEditBusy] = useState(false);

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
        note: buildReceiptNote(editUserNotes, editSupplierId),
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

  // --- Create form helpers ---
  const resetForm = () => {
    setAssetType('');
    setSource('PURCHASE');
    setSupplierId('');
    setNotes('');
    setDeviceLines([]);
    setConsumableLines([]);
  };

  const addDeviceLine = () => {
    setDeviceLines(prev => [
      ...prev,
      {
        id: `dl-${Date.now()}`,
        itemId: '',
        quantity: 1,
        unitPrice: 0,
        depreciationMonths: 60,
        salvageValue: 0,
        serials: [],
      },
    ]);
  };

  const updateDeviceLine = (id: string, field: string, value: any) => {
    setDeviceLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      // When quantity changes, regenerate serial rows
      if (field === 'quantity') {
        const qty = Math.max(1, Number(value));
        updated.quantity = qty;
        const existingSerials = l.serials.slice(0, qty);
        const newSerials = Array.from({ length: qty - existingSerials.length }, (_, i) => ({
          equipmentCode: `EQ${String(Date.now() + existingSerials.length + i).slice(-6).padStart(6, '0')}`,
          serial: '',
        }));
        updated.serials = [...existingSerials, ...newSerials];
      }
      // When item changes, regenerate serial codes with proper prefix
      if (field === 'itemId') {
        updated.serials = updated.serials.map((s, i) => ({
          ...s,
          equipmentCode: `EQ${String(i + 1).padStart(6, '0')}`,
          modelName: s.modelName ?? '',
          brandName: s.brandName ?? '',
        }));
      }
      return updated;
    }));
  };

  const updateSerial = (lineId: string, index: number, serial: string) => {
    setDeviceLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const serials = [...l.serials];
      serials[index] = { ...serials[index], serial };
      return { ...l, serials };
    }));
  };

  const removeDeviceLine = (id: string) => setDeviceLines(prev => prev.filter(l => l.id !== id));

  const addConsumableLine = () => {
    setConsumableLines(prev => [...prev, { id: `cl-${Date.now()}`, itemId: '', quantity: 1, unitPrice: 0 }]);
  };

  const updateConsumableLine = (id: string, field: string, value: any) => {
    setConsumableLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const removeConsumableLine = (id: string) => setConsumableLines(prev => prev.filter(l => l.id !== id));

  const totalAmount = useMemo(() => {
    if (assetType === 'DEVICE') return deviceLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    return consumableLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  }, [assetType, deviceLines, consumableLines]);

  const invalidateStock = () => {
    void qc.invalidateQueries({ queryKey: ['api', 'stock-ins-view'] });
    void qc.invalidateQueries({ queryKey: ['api', 'stock-document-events'] });
  };

  const handleCreate = async () => {
    if (!assetType) { toast.error('Vui lòng chọn loại tài sản nhập'); return; }
    if (assetType === 'DEVICE' && deviceLines.length === 0) { toast.error('Vui lòng thêm ít nhất 1 dòng thiết bị'); return; }
    if (assetType === 'CONSUMABLE' && consumableLines.length === 0) { toast.error('Vui lòng thêm ít nhất 1 dòng vật tư'); return; }

    const lines = assetType === 'DEVICE' ? deviceLines : consumableLines;
    const emptyItem = lines.some(l => !l.itemId);
    if (emptyItem) { toast.error('Vui lòng chọn tài sản cho tất cả các dòng'); return; }

    if (assetType === 'DEVICE') {
      const emptySerials = deviceLines.some(l => {
        const item = assetItems.find(i => i.id === l.itemId);
        if (!item?.enableSerial) return false;
        return l.serials.some(s => !s.serial || !String(s.serial).trim());
      });
      if (emptySerials) {
        toast.error('Vui lòng nhập đầy đủ serial cho các thiết bị yêu cầu theo dõi serial');
        return;
      }
      const invalidDep = deviceLines.some(l => {
        const item = assetItems.find(i => i.id === l.itemId);
        if (!item?.enableDepreciation) return false;
        return !Number.isFinite(l.depreciationMonths) || l.depreciationMonths <= 0;
      });
      if (invalidDep) {
        toast.error('Nhập số tháng khấu hao > 0 cho các thiết bị có khấu hao');
        return;
      }
    }

    const apiSource = FE_SOURCE_TO_API[source];
    if (!apiSource) {
      toast.error('Nguồn nhập không hợp lệ');
      return;
    }

    const receiptDate = new Date().toISOString().slice(0, 10);
    const code = makeBizCode('PN');
    const note = buildReceiptNote(notes, supplierId);

    setCreateBusy(true);
    try {
      const created = await apiPost<StockReceiptDto>('/api/stock-receipts', {
        code,
        receiptDate,
        source: apiSource,
        status: 'DRAFT',
        note,
      });
      const rid = created.id;
      if (rid == null) throw new Error('API không trả id phiếu nhập');

      let lineNo = 1;
      if (assetType === 'DEVICE') {
        for (const line of deviceLines) {
          for (const s of line.serials) {
            await apiPost('/api/stock-receipt-lines', {
              lineNo: lineNo++,
              quantity: 1,
              unitPrice: line.unitPrice,
              note: formatDeviceLineNote(s.equipmentCode, s.serial, s.modelName, s.brandName),
              receipt: { id: rid },
              assetItem: { id: Number(line.itemId) },
            });
          }
        }
      } else {
        for (const line of consumableLines) {
          await apiPost('/api/stock-receipt-lines', {
            lineNo: lineNo++,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            receipt: { id: rid },
            assetItem: { id: Number(line.itemId) },
          });
        }
      }

      toast.success('Đã tạo phiếu nhập kho');
      resetForm();
      setCreateOpen(false);
      invalidateStock();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setCreateBusy(false);
    }
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
        await apiPost('/api/equipment', {
          equipmentCode: line.equipmentCode,
          ...(line.serial?.trim() ? { serial: line.serial } : {}),
          ...(line.modelName?.trim() ? { modelName: line.modelName.trim() } : {}),
          ...(line.brandName?.trim() ? { brandName: line.brandName.trim() } : {}),
          status: 'IN_STOCK',
          ...(item.enableDepreciation
            ? {
                purchasePrice: line.unitPrice,
                capitalizationDate: receiptDate,
                depreciationMonths: Number(line.depreciationMonths),
                salvageValue: Number(line.salvageValue ?? 0),
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
      toast.success('Đã xác nhận phiếu — đã ghi nhận thiết bị / tồn vật tư');
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
          <p className="page-description">Quản lý phiếu nhập kho</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Tạo phiếu nhập</Button>
      </div>

      <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />

      {/* ===== CREATE DIALOG ===== */}
      <Dialog open={createOpen} onOpenChange={v => { if (!v) { resetForm(); setCreateOpen(false); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo phiếu nhập kho</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* General info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Mã phiếu</Label>
                <Input value="Tự sinh" disabled />
              </div>
              <div className="space-y-2">
                <Label>Nguồn nhập</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(stockInSourceLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nhà cung cấp</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Chọn NCC..." /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Asset type selection */}
            <div className="space-y-2">
              <Label>Loại tài sản nhập <span className="text-destructive">*</span></Label>
              <Tabs value={assetType} onValueChange={v => { setAssetType(v as 'DEVICE' | 'CONSUMABLE'); setDeviceLines([]); setConsumableLines([]); }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="DEVICE">🖥 Thiết bị</TabsTrigger>
                  <TabsTrigger value="CONSUMABLE">📦 Vật tư</TabsTrigger>
                </TabsList>

                {/* === DEVICE TAB === */}
                <TabsContent value="DEVICE" className="mt-4 space-y-4">
                  {deviceLines.map((line, idx) => {
                    const selectedItem = assetItems.find(i => i.id === line.itemId);
                    return (
                      <Card key={line.id}>
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">Dòng {idx + 1}</CardTitle>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeDeviceLine(line.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Thiết bị <span className="text-destructive">*</span></Label>
                              <Select value={line.itemId} onValueChange={v => updateDeviceLine(line.id, 'itemId', v)}>
                                <SelectTrigger><SelectValue placeholder="Chọn thiết bị..." /></SelectTrigger>
                                <SelectContent>
                                  {deviceItems.map(i => <SelectItem key={i.id} value={i.id}>{i.code} - {i.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Số lượng <span className="text-destructive">*</span></Label>
                              <Input type="number" min={1} value={line.quantity} onChange={e => updateDeviceLine(line.id, 'quantity', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Đơn giá</Label>
                              <Input type="number" min={0} value={line.unitPrice} onChange={e => updateDeviceLine(line.id, 'unitPrice', Number(e.target.value))} />
                            </div>
                          </div>
                          {selectedItem?.enableDepreciation && (
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Số tháng khấu hao <span className="text-destructive">*</span></Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={line.depreciationMonths}
                                  onChange={e => updateDeviceLine(line.id, 'depreciationMonths', Number(e.target.value))}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Giá trị thu hồi cuối kỳ</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={line.salvageValue}
                                  onChange={e => updateDeviceLine(line.id, 'salvageValue', Number(e.target.value))}
                                />
                              </div>
                              <div className="text-xs text-muted-foreground flex items-end">
                                Tính giá trị còn lại theo khấu hao đường thẳng.
                              </div>
                            </div>
                          )}
                          {line.quantity > 0 && line.itemId && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Danh sách thiết bị ({line.serials.length} chiếc)</Label>
                              <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-muted/50 border-b">
                                      <th className="text-left px-3 py-1.5 font-medium text-xs w-12">#</th>
                                      <th className="text-left px-3 py-1.5 font-medium text-xs">Mã TB (tự sinh)</th>
                                      <th className="text-left px-3 py-1.5 font-medium text-xs">
                                        Serial {selectedItem?.enableSerial ? <span className="text-destructive">*</span> : null}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {line.serials.map((s, si) => (
                                      <tr key={si} className="border-b last:border-0">
                                        <td className="px-3 py-1.5 text-muted-foreground text-xs">{si + 1}</td>
                                        <td className="px-3 py-1.5 font-mono text-xs">
                                          {formatEquipmentCodeDisplay(s.equipmentCode)}
                                        </td>
                                        <td className="px-3 py-1.5">
                                          <Input className="h-7 text-xs" value={s.serial} onChange={e => updateDeviceSerialRow(line.id, si, { serial: e.target.value })} placeholder={`Nhập serial #${si + 1}...`} />
                                        </td>
                                        <td className="px-3 py-1.5">
                                          <Input className="h-7 text-xs" value={s.modelName} onChange={e => updateDeviceSerialRow(line.id, si, { modelName: e.target.value })} placeholder="Model" maxLength={150} />
                                        </td>
                                        <td className="px-3 py-1.5">
                                          <Input className="h-7 text-xs" value={s.brandName} onChange={e => updateDeviceSerialRow(line.id, si, { brandName: e.target.value })} placeholder="Hãng" maxLength={150} />
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="text-right text-sm text-muted-foreground">
                                Thành tiền: <span className="font-medium text-foreground">{formatCurrency(line.quantity * line.unitPrice)}</span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  <Button variant="outline" className="w-full" onClick={addDeviceLine}>
                    <PlusCircle className="h-4 w-4 mr-2" /> Thêm dòng thiết bị
                  </Button>
                </TabsContent>

                {/* === CONSUMABLE TAB === */}
                <TabsContent value="CONSUMABLE" className="mt-4 space-y-4">
                  {consumableLines.length > 0 && (
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="text-left px-3 py-2 font-medium text-xs w-12">#</th>
                            <th className="text-left px-3 py-2 font-medium text-xs">Vật tư</th>
                            <th className="text-left px-3 py-2 font-medium text-xs w-28">Số lượng</th>
                            <th className="text-left px-3 py-2 font-medium text-xs w-36">Đơn giá</th>
                            <th className="text-right px-3 py-2 font-medium text-xs w-32">Thành tiền</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {consumableLines.map((line, idx) => (
                            <tr key={line.id} className="border-b last:border-0">
                              <td className="px-3 py-2 text-muted-foreground text-xs">{idx + 1}</td>
                              <td className="px-3 py-2">
                                <Select value={line.itemId} onValueChange={v => updateConsumableLine(line.id, 'itemId', v)}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Chọn vật tư..." /></SelectTrigger>
                                  <SelectContent>
                                    {consumableItems.map(i => <SelectItem key={i.id} value={i.id}>{i.code} - {i.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-3 py-2">
                                <Input className="h-8 text-xs" type="number" min={1} value={line.quantity} onChange={e => updateConsumableLine(line.id, 'quantity', Number(e.target.value))} />
                              </td>
                              <td className="px-3 py-2">
                                <Input className="h-8 text-xs" type="number" min={0} value={line.unitPrice} onChange={e => updateConsumableLine(line.id, 'unitPrice', Number(e.target.value))} />
                              </td>
                              <td className="px-3 py-2 text-right text-xs font-medium">{formatCurrency(line.quantity * line.unitPrice)}</td>
                              <td className="px-3 py-2">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeConsumableLine(line.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Button variant="outline" className="w-full" onClick={addConsumableLine}>
                    <PlusCircle className="h-4 w-4 mr-2" /> Thêm dòng vật tư
                  </Button>
                </TabsContent>
              </Tabs>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ghi chú phiếu nhập..." rows={2} />
            </div>

            {/* Total & actions */}
            {assetType && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-lg font-semibold">
                  Tổng tiền: <span className="text-primary">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { resetForm(); setCreateOpen(false); }} disabled={createBusy}>Hủy</Button>
                  <Button onClick={() => void handleCreate()} disabled={createBusy}>{createBusy ? 'Đang tạo…' : 'Tạo phiếu nhập'}</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== DETAIL DIALOG ===== */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl">
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
                <div><span className="text-muted-foreground">Người tạo:</span> {getEmployeeName(selected.createdBy, employees)}</div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={stockInStatusLabels[selected.status]} /></div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                {selected.confirmedAt && <div><span className="text-muted-foreground">Ngày XN:</span> {formatDate(selected.confirmedAt)}</div>}
                <div className="col-span-2"><span className="text-muted-foreground">Ghi chú:</span> {selected.notes}</div>
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
                  approveLabel="Xác nhận"
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
              <p className="text-sm text-muted-foreground">
                Chỉnh ngày phiếu, nguồn, NCC và ghi chú. Dòng hàng đã tạo không đổi từ đây — xóa phiếu và tạo lại nếu cần sửa dòng.
              </p>
              <div className="space-y-2">
                <Label>Ngày phiếu</Label>
                <Input type="date" value={editReceiptDate} onChange={e => setEditReceiptDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nguồn nhập</Label>
                <Select value={editSource} onValueChange={v => setEditSource(v as StockIn['source'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(stockInSourceLabels).map(([v, l]) => (
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
