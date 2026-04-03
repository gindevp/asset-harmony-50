import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  mapAssetItemDto,
  useAssetItems,
  useDepartments,
  useEmployees,
  useEnrichedEquipmentList,
  useLocations,
} from '@/hooks/useEntityApi';
import { apiPost } from '@/api/http';
import type { StockIssueDto } from '@/api/types';
import { makeBizCode } from '@/api/businessCode';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';

const recipientTypeLabels: Record<string, string> = {
  EMPLOYEE: 'Nhân viên',
  DEPARTMENT: 'Phòng ban',
  LOCATION: 'Vị trí',
  COMPANY: 'Công ty',
};

type NumMaybeEmpty = number | '';

function numOrZero(v: NumMaybeEmpty): number {
  return v === '' ? 0 : Number(v);
}

interface DeviceOutLine {
  id: string;
  itemId: string;
  selectedEquipmentIds: string[];
}

interface ConsumableOutLine {
  id: string;
  itemId: string;
  quantity: NumMaybeEmpty;
}

const StockOutNewPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const iQ = useAssetItems();
  const eqQ = useEnrichedEquipmentList();
  const empQ = useEmployees();
  const depQ = useDepartments();
  const locQ = useLocations();

  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const equipments = eqQ.data ?? [];
  const employees = empQ.data ?? [];
  const departments = depQ.data ?? [];
  const locations = locQ.data ?? [];

  const deviceItems = useMemo(() => assetItems.filter(i => i.managementType === 'DEVICE'), [assetItems]);
  const consumableItems = useMemo(() => assetItems.filter(i => i.managementType === 'CONSUMABLE'), [assetItems]);

  const getAvailableEquipments = (itemId: string) =>
    equipments.filter(e => e.itemId === itemId && e.status === 'IN_STOCK');

  const [assetType, setAssetType] = useState<'DEVICE' | 'CONSUMABLE'>('DEVICE');
  const [recipientType, setRecipientType] = useState<string>('EMPLOYEE');
  const [recipientId, setRecipientId] = useState('');
  const [notes, setNotes] = useState('');
  const [deviceLines, setDeviceLines] = useState<DeviceOutLine[]>([]);
  const [consumableLines, setConsumableLines] = useState<ConsumableOutLine[]>([]);
  const [createBusy, setCreateBusy] = useState(false);

  const resetForm = () => {
    setAssetType('DEVICE');
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

  const updateConsumableLine = (id: string, field: string, value: unknown) => {
    setConsumableLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      if (field === 'quantity') {
        const raw = String(value ?? '').trim();
        if (raw === '') return { ...l, quantity: '' };
        const n = parseInt(raw, 10);
        if (Number.isNaN(n)) return l;
        return { ...l, quantity: Math.max(1, n) };
      }
      return { ...l, [field]: value } as ConsumableOutLine;
    }));
  };

  const removeConsumableLine = (id: string) => setConsumableLines(prev => prev.filter(l => l.id !== id));

  const totalDeviceCount = useMemo(() => deviceLines.reduce((s, l) => s + l.selectedEquipmentIds.length, 0), [deviceLines]);
  const totalConsumableCount = useMemo(() => consumableLines.reduce((s, l) => s + numOrZero(l.quantity), 0), [consumableLines]);

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
    if (deviceLines.length === 0 && consumableLines.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 dòng thiết bị hoặc vật tư');
      return;
    }
    if (deviceLines.length > 0) {
      if (deviceLines.some(l => !l.itemId)) { toast.error('Vui lòng chọn tài sản cho tất cả các dòng thiết bị'); return; }
      if (deviceLines.some(l => l.selectedEquipmentIds.length === 0)) { toast.error('Vui lòng chọn ít nhất 1 thiết bị cho mỗi dòng'); return; }
    }
    if (consumableLines.length > 0) {
      if (consumableLines.some(l => !l.itemId)) { toast.error('Vui lòng chọn vật tư cho tất cả các dòng'); return; }
      if (consumableLines.some(l => l.quantity === '' || numOrZero(l.quantity) < 1)) {
        toast.error('Nhập số lượng vật tư ≥ 1 cho mọi dòng');
        return;
      }
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
      if (deviceLines.length > 0) {
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
      }
      if (consumableLines.length > 0) {
        for (const line of consumableLines) {
          await apiPost('/api/stock-issue-lines', {
            lineNo: lineNo++,
            quantity: numOrZero(line.quantity),
            issue: { id: issueId },
            assetItem: { id: Number(line.itemId) },
          });
        }
      }
      toast.success('Đã tạo phiếu xuất kho');
      resetForm();
      await qc.invalidateQueries({ queryKey: ['api', 'stock-outs-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'stock-document-events'] });
      navigate('/admin/stock-out');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="page-container max-w-none w-full pb-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 min-w-0">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link to="/admin/stock-out">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Quay lại danh sách
            </Link>
          </Button>
          <h1 className="page-title">Tạo phiếu xuất kho</h1>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] xl:items-start xl:gap-8">
        <Card className="xl:sticky xl:top-6 h-fit shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Đối tượng nhận</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mã phiếu</Label>
              <Input value="Tự sinh khi lưu" disabled className="bg-muted/50" />
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
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ghi chú phiếu xuất..."
                rows={4}
                className="min-h-[100px] resize-y"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Chi tiết hàng xuất</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Loại tài sản xuất <span className="text-destructive">*</span></Label>
              <Tabs value={assetType} onValueChange={v => { setAssetType(v as 'DEVICE' | 'CONSUMABLE'); }}>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="DEVICE">Thiết bị</TabsTrigger>
                  <TabsTrigger value="CONSUMABLE">Vật tư</TabsTrigger>
                </TabsList>

                <TabsContent value="DEVICE" className="mt-4 space-y-4">
              {deviceLines.map((line, idx) => {
                const available = line.itemId ? getAvailableEquipments(line.itemId) : [];
                return (
                  <Card key={line.id}>
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm text-primary">Dòng {idx + 1}</CardTitle>
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
                            <div className="border rounded-md overflow-x-auto">
                              <table className="w-full min-w-[560px] text-sm">
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

            <TabsContent value="CONSUMABLE" className="mt-4 space-y-4">
              {consumableLines.length > 0 && (
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
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
                            <Input
                              className="h-8 text-xs"
                              type="number"
                              min={1}
                              value={line.quantity === '' ? '' : line.quantity}
                              onChange={e => updateConsumableLine(line.id, 'quantity', e.target.value)}
                            />
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
          </CardContent>
        </Card>
      </div>

      {assetType && (
        <div className="sticky bottom-0 z-10 mt-8 flex flex-col gap-4 border-t border-border bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:items-center sm:justify-between shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.08)]">
          <div className="text-sm text-muted-foreground">
            Tổng:{' '}
            <span className="font-semibold text-foreground">{totalDeviceCount} thiết bị</span>
            {' • '}
            <span className="font-semibold text-foreground">{totalConsumableCount} vật tư</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/stock-out')} disabled={createBusy}>Hủy</Button>
            <Button onClick={() => void handleCreate()} disabled={createBusy}>{createBusy ? 'Đang tạo…' : 'Tạo phiếu xuất'}</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockOutNewPage;
