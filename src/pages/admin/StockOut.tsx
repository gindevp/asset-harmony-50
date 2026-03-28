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
import { Plus, Eye, MoreHorizontal, Pencil, Trash2, PlusCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  stockOuts, StockOut, stockOutStatusLabels, formatDate, getItemName,
  getEmployeeName, getDepartmentName, getLocationName,
  assetItems, equipments, employees, departments, locations
} from '@/data/mockData';
import { toast } from 'sonner';
import { ApprovalActionBar } from '@/components/shared/ApprovalActionBar';

const recipientTypeLabels: Record<string, string> = {
  EMPLOYEE: 'Nhân viên', DEPARTMENT: 'Phòng ban', LOCATION: 'Vị trí',
};

const getRecipientName = (type: string, id: string) => {
  switch (type) {
    case 'EMPLOYEE': return getEmployeeName(id);
    case 'DEPARTMENT': return getDepartmentName(id);
    case 'LOCATION': return getLocationName(id);
    default: return id;
  }
};

const deviceItems = assetItems.filter(i => i.managementType === 'DEVICE');
const consumableItems = assetItems.filter(i => i.managementType === 'CONSUMABLE');

// Available equipment (IN_STOCK) grouped by itemId
const getAvailableEquipments = (itemId: string) =>
  equipments.filter(e => e.itemId === itemId && e.status === 'IN_STOCK');

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
          <DropdownMenuItem onClick={() => toast.info('Chức năng sửa phiếu xuất (demo)')}><Pencil className="h-4 w-4 mr-2" />Sửa</DropdownMenuItem>
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
      case 'EMPLOYEE': return employees.filter(e => e.status === 'ACTIVE').map(e => ({ value: e.id, label: `${e.code} - ${e.name}` }));
      case 'DEPARTMENT': return departments.map(d => ({ value: d.id, label: `${d.code} - ${d.name}` }));
      case 'LOCATION': return locations.map(l => ({ value: l.id, label: `${l.code} - ${l.name}` }));
      default: return [];
    }
  }, [recipientType]);

  const handleCreate = () => {
    if (!recipientId) { toast.error('Vui lòng chọn đối tượng nhận'); return; }
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
    toast.success('Đã tạo phiếu xuất kho thành công (demo)');
    resetForm();
    setCreateOpen(false);
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
                <Label>{recipientTypeLabels[recipientType]} <span className="text-destructive">*</span></Label>
                <Select value={recipientId} onValueChange={setRecipientId}>
                  <SelectTrigger><SelectValue placeholder={`Chọn ${recipientTypeLabels[recipientType]?.toLowerCase()}...`} /></SelectTrigger>
                  <SelectContent>
                    {recipientOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                                          <td className="px-3 py-1.5 font-mono text-xs">{eq.equipmentCode}</td>
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
                  <Button variant="outline" onClick={() => { resetForm(); setCreateOpen(false); }}>Hủy</Button>
                  <Button onClick={handleCreate}>Tạo phiếu xuất</Button>
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
            <DialogTitle>Chi tiết phiếu xuất {selected?.code}</DialogTitle>
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
                  { key: 'item', label: 'Tài sản', render: (r: any) => getItemName(r.itemId) },
                  { key: 'equipment', label: 'Mã TB', render: (r: any) => r.equipmentId || '—' },
                  { key: 'quantity', label: 'SL', className: 'text-right' },
                ]}
                data={selected.lines}
              />
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

      {/* ===== DELETE CONFIRM ===== */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa phiếu xuất</AlertDialogTitle>
            <AlertDialogDescription>Bạn có chắc chắn muốn xóa phiếu <strong>{deleteTarget?.code}</strong>? Hành động này không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { toast.success(`Đã xóa phiếu ${deleteTarget?.code} (demo)`); setDeleteTarget(null); }}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StockOutPage;
