import { useState, useMemo, useCallback } from 'react';
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
import { Plus, Eye, MoreHorizontal, Pencil, Trash2, PlusCircle, FileDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { StockOut } from '@/data/mockData';
import {
  stockOutStatusLabels,
  formatDate,
  getItemName,
  getEmployeeName,
  getDepartmentName,
  getLocationName,
} from '@/data/mockData';
import { toast } from 'sonner';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';
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
import type { ConsumableStockDto, StockIssueDto, StockIssueLineDto } from '@/api/types';
import { makeBizCode } from '@/api/businessCode';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { StockDocumentHistoryBlock } from '@/components/shared/StockDocumentHistoryBlock';

const recipientTypeLabels: Record<string, string> = {
  EMPLOYEE: 'Nhân viên',
  DEPARTMENT: 'Phòng ban',
  LOCATION: 'Vị trí',
  COMPANY: 'Công ty',
};

interface DeviceOutLine {
  id: string;
  itemId: string;
  selectedEquipmentIds: string[];
}

interface ConsumableOutLine {
  id: string;
  itemId: string;
  quantity: number;
}

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

  const deviceItems = useMemo(() => assetItems.filter(i => i.managementType === 'DEVICE'), [assetItems]);
  const consumableItems = useMemo(() => assetItems.filter(i => i.managementType === 'CONSUMABLE'), [assetItems]);

  const getRecipientName = (type: string, id: string) => {
    switch (type) {
      case 'EMPLOYEE':
        return getEmployeeName(id, employees);
      case 'DEPARTMENT':
        return getDepartmentName(id, departments);
      case 'LOCATION':
        return getLocationName(id, locations);
      case 'COMPANY':
        return 'Toàn công ty';
      default:
        return id;
    }
  };

  const getAvailableEquipments = (itemId: string) =>
    equipments.filter(e => e.itemId === itemId && e.status === 'IN_STOCK');

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StockOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockOut | null>(null);

  // Create form state
  const [createOpen, setCreateOpen] = useState(false);
  const [assetType, setAssetType] = useState<'DEVICE' | 'CONSUMABLE' | ''>('');
  const [recipientType, setRecipientType] = useState<string>('EMPLOYEE');
  const [recipientId, setRecipientId] = useState('');
  const [notes, setNotes] = useState('');
  const [deviceLines, setDeviceLines] = useState<DeviceOutLine[]>([]);
  const [consumableLines, setConsumableLines] = useState<ConsumableOutLine[]>([]);
  const [createBusy, setCreateBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [editOutOpen, setEditOutOpen] = useState(false);
  const [editOutDraft, setEditOutDraft] = useState<StockOut | null>(null);
  const [editOutDate, setEditOutDate] = useState('');
  const [editOutRecipientType, setEditOutRecipientType] = useState<StockOut['recipientType']>('EMPLOYEE');
  const [editOutRecipientId, setEditOutRecipientId] = useState('');
  const [editOutNotes, setEditOutNotes] = useState('');
  const [editOutBusy, setEditOutBusy] = useState(false);

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
      case 'LOCATION':
        return locations
          .filter(l => l.active !== false)
          .map(l => ({ value: String(l.id), label: `${l.code} - ${l.name}` }));
      case 'COMPANY':
        return [];
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
    if (!editOutRecipientId && editOutRecipientType !== 'COMPANY') {
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
        assigneeType: editOutRecipientType,
        note: editOutNotes.trim() || undefined,
      };
      if (editOutRecipientType === 'EMPLOYEE') body.employee = { id: Number(editOutRecipientId) };
      else if (editOutRecipientType === 'DEPARTMENT') body.department = { id: Number(editOutRecipientId) };
      else if (editOutRecipientType === 'LOCATION') body.location = { id: Number(editOutRecipientId) };
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

  // --- Form helpers ---
  const resetForm = () => {
    setAssetType('');
    setRecipientType('EMPLOYEE');
    setRecipientId('');
    setNotes('');
    setDeviceLines([]);
    setConsumableLines([]);
  };

  const addDeviceLine = () => {
    setDeviceLines(prev => [...prev, { id: `dl-${Date.now()}`, itemId: '', selectedEquipmentIds: [] }]);
  };

  const updateDeviceLineItem = (id: string, itemId: string) => {
    setDeviceLines(prev => prev.map(l => l.id === id ? { ...l, itemId, selectedEquipmentIds: [] } : l));
  };

  const toggleEquipment = (lineId: string, eqId: string) => {
    setDeviceLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const ids = l.selectedEquipmentIds.includes(eqId)
        ? l.selectedEquipmentIds.filter(x => x !== eqId)
        : [...l.selectedEquipmentIds, eqId];
      return { ...l, selectedEquipmentIds: ids };
    }));
  };

  const removeDeviceLine = (id: string) => setDeviceLines(prev => prev.filter(l => l.id !== id));

  const addConsumableLine = () => {
    setConsumableLines(prev => [...prev, { id: `cl-${Date.now()}`, itemId: '', quantity: 1 }]);
  };

  const updateConsumableLine = (id: string, field: string, value: any) => {
    setConsumableLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const removeConsumableLine = (id: string) => setConsumableLines(prev => prev.filter(l => l.id !== id));

  const totalDeviceCount = useMemo(() => deviceLines.reduce((s, l) => s + l.selectedEquipmentIds.length, 0), [deviceLines]);
  const totalConsumableCount = useMemo(() => consumableLines.reduce((s, l) => s + l.quantity, 0), [consumableLines]);

  const recipientOptions = useMemo(() => {
    switch (recipientType) {
      case 'EMPLOYEE':
        return employees
          .filter(e => e.active !== false)
          .map(e => ({ value: String(e.id), label: `${e.code} - ${e.fullName}` }));
      case 'DEPARTMENT':
        return departments
          .filter(d => d.active !== false)
          .map(d => ({ value: String(d.id), label: `${d.code} - ${d.name}` }));
      case 'LOCATION':
        return locations
          .filter(l => l.active !== false)
          .map(l => ({ value: String(l.id), label: `${l.code} - ${l.name}` }));
      case 'COMPANY':
        return [];
      default:
        return [];
    }
  }, [recipientType, employees, departments, locations]);

  const handleCreate = async () => {
    if (!recipientId && recipientType !== 'COMPANY') { toast.error('Vui lòng chọn đối tượng nhận'); return; }
    if (!assetType) { toast.error('Vui lòng chọn loại tài sản xuất'); return; }
    if (assetType === 'DEVICE') {
      if (deviceLines.length === 0) { toast.error('Vui lòng thêm ít nhất 1 dòng thiết bị'); return; }
      if (deviceLines.some(l => !l.itemId)) { toast.error('Vui lòng chọn tài sản cho tất cả các dòng'); return; }
      if (deviceLines.some(l => l.selectedEquipmentIds.length === 0)) { toast.error('Vui lòng chọn ít nhất 1 thiết bị cho mỗi dòng'); return; }
    }
    if (assetType === 'CONSUMABLE') {
      if (consumableLines.length === 0) { toast.error('Vui lòng thêm ít nhất 1 dòng vật tư'); return; }
      if (consumableLines.some(l => !l.itemId)) { toast.error('Vui lòng chọn vật tư cho tất cả các dòng'); return; }
      if (consumableLines.some(l => l.quantity < 1)) { toast.error('Số lượng phải lớn hơn 0'); return; }
    }

    const code = makeBizCode('PX');
    const issueDate = new Date().toISOString().slice(0, 10);
    const body: Record<string, unknown> = {
      code,
      issueDate,
      status: 'DRAFT',
      assigneeType: recipientType,
      note: notes.trim() || undefined,
    };
    if (recipientType === 'EMPLOYEE') body.employee = { id: Number(recipientId) };
    else if (recipientType === 'DEPARTMENT') body.department = { id: Number(recipientId) };
    else if (recipientType === 'LOCATION') body.location = { id: Number(recipientId) };

    setCreateBusy(true);
    try {
      const created = await apiPost<StockIssueDto>('/api/stock-issues', body);
      const issueId = created.id;
      if (issueId == null) throw new Error('API không trả id phiếu');
      let lineNo = 1;
      if (assetType === 'DEVICE') {
        for (const line of deviceLines) {
          for (const eqId of line.selectedEquipmentIds) {
            await apiPost('/api/stock-issue-lines', {
              lineNo: lineNo++,
              quantity: 1,
              issue: { id: issueId },
              assetItem: { id: Number(line.itemId) },
              equipment: { id: Number(eqId) },
            });
          }
        }
      } else {
        for (const line of consumableLines) {
          await apiPost('/api/stock-issue-lines', {
            lineNo: lineNo++,
            quantity: line.quantity,
            issue: { id: issueId },
            assetItem: { id: Number(line.itemId) },
          });
        }
      }
      toast.success('Đã tạo phiếu xuất kho');
      resetForm();
      setCreateOpen(false);
      await qc.invalidateQueries({ queryKey: ['api', 'stock-outs-view'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setCreateBusy(false);
    }
  };

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
          <p className="page-description">Quản lý phiếu xuất kho / cấp phát</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Tạo phiếu xuất</Button>
      </div>

      <FilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onReset={() => setFilters({})} />
      <DataTable columns={columns} data={filtered} currentPage={page} onPageChange={setPage} />

      {/* ===== CREATE DIALOG ===== */}
      <Dialog open={createOpen} onOpenChange={v => { if (!v) { resetForm(); setCreateOpen(false); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo phiếu xuất kho</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* General info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Mã phiếu</Label>
                <Input value="Tự sinh" disabled />
              </div>
              <div className="space-y-2">
                <Label>Loại đối tượng nhận <span className="text-destructive">*</span></Label>
                <Select value={recipientType} onValueChange={v => { setRecipientType(v); setRecipientId(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(recipientTypeLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{recipientTypeLabels[recipientType]} {recipientType !== 'COMPANY' && <span className="text-destructive">*</span>}</Label>
                {recipientType === 'COMPANY' ? (
                  <p className="text-sm text-muted-foreground py-2">Không cần chọn đối tượng — cấp phát mức công ty</p>
                ) : (
                  <Select value={recipientId} onValueChange={setRecipientId}>
                    <SelectTrigger><SelectValue placeholder={`Chọn ${recipientTypeLabels[recipientType]?.toLowerCase()}...`} /></SelectTrigger>
                    <SelectContent>
                      {recipientOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Asset type tabs */}
            <div className="space-y-2">
              <Label>Loại tài sản xuất <span className="text-destructive">*</span></Label>
              <Tabs value={assetType} onValueChange={v => { setAssetType(v as 'DEVICE' | 'CONSUMABLE'); setDeviceLines([]); setConsumableLines([]); }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="DEVICE">🖥 Thiết bị</TabsTrigger>
                  <TabsTrigger value="CONSUMABLE">📦 Vật tư</TabsTrigger>
                </TabsList>

                {/* === DEVICE TAB === */}
                <TabsContent value="DEVICE" className="mt-4 space-y-4">
                  {deviceLines.map((line, idx) => {
                    const available = line.itemId ? getAvailableEquipments(line.itemId) : [];
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
                          <div className="space-y-1">
                            <Label className="text-xs">Thiết bị <span className="text-destructive">*</span></Label>
                            <Select value={line.itemId} onValueChange={v => updateDeviceLineItem(line.id, v)}>
                              <SelectTrigger><SelectValue placeholder="Chọn thiết bị..." /></SelectTrigger>
                              <SelectContent>
                                {deviceItems.map(i => {
                                  const avail = getAvailableEquipments(i.id).length;
                                  return (
                                    <SelectItem key={i.id} value={i.id} disabled={avail === 0}>
                                      {i.code} - {i.name} ({avail} tồn kho)
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>

                          {line.itemId && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">
                                Chọn thiết bị cụ thể ({line.selectedEquipmentIds.length}/{available.length} tồn kho)
                              </Label>
                              {available.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">Không có thiết bị tồn kho</p>
                              ) : (
                                <div className="border rounded-md overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="bg-muted/50 border-b">
                                        <th className="text-left px-3 py-1.5 font-medium text-xs w-10">Chọn</th>
                                        <th className="text-left px-3 py-1.5 font-medium text-xs">Mã TB</th>
                                        <th className="text-left px-3 py-1.5 font-medium text-xs">Serial</th>
                                        <th className="text-left px-3 py-1.5 font-medium text-xs">Ghi chú</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {available.map(eq => (
                                        <tr key={eq.id} className="border-b last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => toggleEquipment(line.id, eq.id)}>
                                          <td className="px-3 py-1.5">
                                            <input
                                              type="checkbox"
                                              checked={line.selectedEquipmentIds.includes(eq.id)}
                                              onChange={() => toggleEquipment(line.id, eq.id)}
                                              className="rounded border-input"
                                            />
                                          </td>
                                          <td className="px-3 py-1.5 font-mono text-xs">
                                            {formatEquipmentCodeDisplay(eq.equipmentCode)}
                                          </td>
                                          <td className="px-3 py-1.5 text-xs">{eq.serial}</td>
                                          <td className="px-3 py-1.5 text-xs text-muted-foreground">{eq.notes || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
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
                                <Input className="h-8 text-xs" type="number" min={1} value={line.quantity} onChange={e => updateConsumableLine(line.id, 'quantity', Math.max(1, Number(e.target.value)))} />
                              </td>
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
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ghi chú phiếu xuất..." rows={2} />
            </div>

            {/* Summary & actions */}
            {assetType && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Tổng: <span className="font-semibold text-foreground">
                    {assetType === 'DEVICE' ? `${totalDeviceCount} thiết bị` : `${totalConsumableCount} vật tư`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { resetForm(); setCreateOpen(false); }} disabled={createBusy}>Hủy</Button>
                  <Button onClick={() => void handleCreate()} disabled={createBusy}>{createBusy ? 'Đang tạo…' : 'Tạo phiếu xuất'}</Button>
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
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Đối tượng nhận:</span> {recipientTypeLabels[selected.recipientType]} – {getRecipientName(selected.recipientType, selected.recipientId)}</div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={stockOutStatusLabels[selected.status]} /></div>
                <div><span className="text-muted-foreground">Người tạo:</span> {getEmployeeName(selected.createdBy)}</div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Ghi chú:</span> {selected.notes}</div>
              </div>
              <DataTable
                columns={[
                  { key: 'item', label: 'Tài sản', render: (r: any) => getItemName(r.itemId, assetItems) },
                  {
                    key: 'equipment',
                    label: 'Mã TB',
                    render: (r: any) => {
                      if (!r.equipmentId) return '—';
                      const eq = equipments.find(e => String(e.id) === String(r.equipmentId));
                      return eq ? formatEquipmentCodeDisplay(eq.equipmentCode) : String(r.equipmentId);
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
              <p className="text-sm text-muted-foreground">
                Chỉnh ngày phiếu, đối tượng nhận và ghi chú. Dòng xuất đã tạo không đổi từ đây — xóa phiếu và tạo lại nếu cần sửa dòng.
              </p>
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
                    {Object.entries(recipientTypeLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editOutRecipientType !== 'COMPANY' && (
                <div className="space-y-2">
                  <Label>{recipientTypeLabels[editOutRecipientType]} <span className="text-destructive">*</span></Label>
                  <Select value={editOutRecipientId} onValueChange={setEditOutRecipientId}>
                    <SelectTrigger><SelectValue placeholder="Chọn..." /></SelectTrigger>
                    <SelectContent>
                      {editRecipientOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
