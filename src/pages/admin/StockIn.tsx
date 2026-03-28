import { useState, useMemo } from 'react';
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
import { Plus, Eye, Trash2, PlusCircle } from 'lucide-react';
import {
  stockIns, StockIn, stockInStatusLabels, stockInSourceLabels,
  formatCurrency, formatDate, getItemName, getSupplierName, getEmployeeName,
  assetItems, suppliers
} from '@/data/mockData';
import { toast } from 'sonner';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';

// Types for form
interface DeviceLine {
  id: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  serials: { equipmentCode: string; serial: string }[];
}

interface ConsumableLine {
  id: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
}

const deviceItems = assetItems.filter(i => i.managementType === 'DEVICE');
const consumableItems = assetItems.filter(i => i.managementType === 'CONSUMABLE');

const StockInPage = () => {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StockIn | null>(null);

  // Create form state
  const [createOpen, setCreateOpen] = useState(false);
  const [assetType, setAssetType] = useState<'DEVICE' | 'CONSUMABLE' | ''>('');
  const [source, setSource] = useState<string>('PURCHASE');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [deviceLines, setDeviceLines] = useState<DeviceLine[]>([]);
  const [consumableLines, setConsumableLines] = useState<ConsumableLine[]>([]);

  const filtered = stockIns.filter(si => {
    if (filters.search && !si.code.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.status && si.status !== filters.status) return false;
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<StockIn>[] = [
    { key: 'code', label: 'Mã phiếu', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'source', label: 'Nguồn nhập', render: r => stockInSourceLabels[r.source] },
    { key: 'supplier', label: 'NCC', render: r => r.supplierId ? getSupplierName(r.supplierId) : '—' },
    { key: 'lines', label: 'Số dòng', render: r => r.lines.length },
    { key: 'totalAmount', label: 'Tổng tiền', render: r => formatCurrency(r.totalAmount), className: 'text-right' },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={stockInStatusLabels[r.status]} /> },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>
        <Eye className="h-4 w-4" />
      </Button>
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
    setDeviceLines(prev => [...prev, { id: `dl-${Date.now()}`, itemId: '', quantity: 1, unitPrice: 0, serials: [] }]);
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

  const handleCreate = () => {
    if (!assetType) { toast.error('Vui lòng chọn loại tài sản nhập'); return; }
    if (assetType === 'DEVICE' && deviceLines.length === 0) { toast.error('Vui lòng thêm ít nhất 1 dòng thiết bị'); return; }
    if (assetType === 'CONSUMABLE' && consumableLines.length === 0) { toast.error('Vui lòng thêm ít nhất 1 dòng vật tư'); return; }

    const lines = assetType === 'DEVICE' ? deviceLines : consumableLines;
    const emptyItem = lines.some(l => !l.itemId);
    if (emptyItem) { toast.error('Vui lòng chọn tài sản cho tất cả các dòng'); return; }

    if (assetType === 'DEVICE') {
      const emptySerials = deviceLines.some(l => l.serials.some(s => !s.serial));
      if (emptySerials) { toast.error('Vui lòng nhập đầy đủ serial cho thiết bị'); return; }
    }

    toast.success('Đã tạo phiếu nhập kho thành công (demo)');
    resetForm();
    setCreateOpen(false);
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
                          {line.quantity > 0 && line.itemId && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Danh sách thiết bị ({line.serials.length} chiếc)</Label>
                              <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-muted/50 border-b">
                                      <th className="text-left px-3 py-1.5 font-medium text-xs w-12">#</th>
                                      <th className="text-left px-3 py-1.5 font-medium text-xs">Mã TB (tự sinh)</th>
                                      <th className="text-left px-3 py-1.5 font-medium text-xs">Serial <span className="text-destructive">*</span></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {line.serials.map((s, si) => (
                                      <tr key={si} className="border-b last:border-0">
                                        <td className="px-3 py-1.5 text-muted-foreground text-xs">{si + 1}</td>
                                        <td className="px-3 py-1.5 font-mono text-xs">{s.equipmentCode}</td>
                                        <td className="px-3 py-1.5">
                                          <Input className="h-7 text-xs" value={s.serial} onChange={e => updateSerial(line.id, si, e.target.value)} placeholder={`Nhập serial #${si + 1}...`} />
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
                  <Button variant="outline" onClick={() => { resetForm(); setCreateOpen(false); }}>Hủy</Button>
                  <Button onClick={handleCreate}>Tạo phiếu nhập</Button>
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
            <DialogTitle>Chi tiết phiếu nhập {selected?.code}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Nguồn nhập:</span> {stockInSourceLabels[selected.source]}</div>
                <div><span className="text-muted-foreground">NCC:</span> {selected.supplierId ? getSupplierName(selected.supplierId) : '—'}</div>
                <div><span className="text-muted-foreground">Người tạo:</span> {getEmployeeName(selected.createdBy)}</div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <StatusBadge status={selected.status} label={stockInStatusLabels[selected.status]} /></div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> {formatDate(selected.createdAt)}</div>
                {selected.confirmedAt && <div><span className="text-muted-foreground">Ngày XN:</span> {formatDate(selected.confirmedAt)}</div>}
                <div className="col-span-2"><span className="text-muted-foreground">Ghi chú:</span> {selected.notes}</div>
              </div>
              <DataTable
                columns={[
                  { key: 'item', label: 'Tài sản', render: (r: any) => getItemName(r.itemId) },
                  { key: 'quantity', label: 'SL', className: 'text-right' },
                  { key: 'unitPrice', label: 'Đơn giá', render: (r: any) => formatCurrency(r.unitPrice), className: 'text-right' },
                  { key: 'totalPrice', label: 'Thành tiền', render: (r: any) => formatCurrency(r.totalPrice), className: 'text-right' },
                ]}
                data={selected.lines}
              />
              <div className="text-right font-semibold text-lg">Tổng: {formatCurrency(selected.totalAmount)}</div>
              {selected.status === 'DRAFT' && (
                <ApprovalActionBar
                  approveLabel="Xác nhận"
                  onApprove={() => toast.success('Đã xác nhận phiếu (demo)')}
                  onCancel={() => toast.info('Đã hủy phiếu (demo)')}
                  showReject={false} showCancel={true}
                  onPrint={() => toast.info('In phiếu (demo)')}
                  onExport={() => toast.info('Xuất phiếu (demo)')}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockInPage;
