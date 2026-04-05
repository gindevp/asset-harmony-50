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
import { formatCurrency } from '@/data/mockData';
import { toast } from 'sonner';
import { mapAssetItemDto, useAssetItems, useSuppliers } from '@/hooks/useEntityApi';
import { apiPost, apiPostMultipart } from '@/api/http';
import type { StockReceiptDto } from '@/api/types';
import { makeBizCode } from '@/api/businessCode';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { appendFileUrlsToNote, buildReceiptNote } from '@/utils/stockReceiptNote';

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

type NumMaybeEmpty = number | '';

function numOrZero(v: NumMaybeEmpty): number {
  return v === '' ? 0 : Number(v);
}

function formatDeviceLineNote(
  equipmentCode: string,
  serial: string,
  modelName?: string,
  depreciationMonths?: number,
  salvageValue?: number,
): string {
  const parts = [`CODE:${equipmentCode}`, `SN:${serial}`];
  const m = (modelName ?? '').trim();
  if (m) parts.push(`MODEL:${m}`);
  if (Number.isFinite(depreciationMonths) && (depreciationMonths ?? 0) > 0) parts.push(`DEP:${depreciationMonths}`);
  if (Number.isFinite(salvageValue) && (salvageValue ?? 0) >= 0) parts.push(`SALV:${salvageValue}`);
  return parts.join('|');
}

function genEquipmentCode(seed: number): string {
  const n = Math.abs(seed) % 1_000_000;
  return `EQ${String(n).padStart(6, '0')}`;
}

interface DeviceLine {
  id: string;
  itemId: string;
  quantity: NumMaybeEmpty;
  unitPrice: NumMaybeEmpty;
  depreciationMonths: NumMaybeEmpty;
  salvageValue: NumMaybeEmpty;
  serials: { equipmentCode: string; serial: string; modelName: string }[];
}

interface ConsumableLine {
  id: string;
  itemId: string;
  quantity: NumMaybeEmpty;
  unitPrice: NumMaybeEmpty;
}

const StockInNewPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const iQ = useAssetItems();
  const sQ = useSuppliers();

  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const suppliers = useMemo(
    () =>
      (sQ.data ?? []).map(s => ({
        id: String(s.id),
        name: s.name ?? '',
      })),
    [sQ.data],
  );
  const deviceItems = useMemo(() => assetItems.filter(i => i.managementType === 'DEVICE'), [assetItems]);
  const consumableItems = useMemo(() => assetItems.filter(i => i.managementType === 'CONSUMABLE'), [assetItems]);

  const [assetType, setAssetType] = useState<'DEVICE' | 'CONSUMABLE'>('DEVICE');
  const [source, setSource] = useState<string>('PURCHASE');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [deviceLines, setDeviceLines] = useState<DeviceLine[]>([]);
  const [consumableLines, setConsumableLines] = useState<ConsumableLine[]>([]);
  const [createBusy, setCreateBusy] = useState(false);

  const resetForm = () => {
    setAssetType('DEVICE');
    setSource('PURCHASE');
    setSupplierId('');
    setNotes('');
    setAttachmentFile(null);
    setDeviceLines([]);
    setConsumableLines([]);
  };

  const addDeviceLine = () => {
    const now = Date.now();
    setDeviceLines(prev => [
      ...prev,
      {
        id: `dl-${Date.now()}`,
        itemId: '',
        quantity: 1,
        unitPrice: 0,
        depreciationMonths: 60,
        salvageValue: 0,
        serials: [{ equipmentCode: genEquipmentCode(now), serial: '', modelName: '' }],
      },
    ]);
  };

  const updateDeviceLine = (id: string, field: string, value: unknown) => {
    setDeviceLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      if (field === 'quantity') {
        const raw = String(value ?? '').trim();
        if (raw === '') {
          return { ...l, quantity: '' };
        }
        const n = parseInt(raw, 10);
        if (Number.isNaN(n)) return l;
        const qty = Math.max(1, n);
        const existingSerials = l.serials.slice(0, qty);
        const newSerials = Array.from({ length: qty - existingSerials.length }, (_, i) => ({
          equipmentCode: genEquipmentCode(Date.now() + existingSerials.length + i),
          serial: '',
          modelName: '',
        }));
        return {
          ...l,
          quantity: qty,
          serials: [...existingSerials, ...newSerials],
        };
      }
      if (field === 'unitPrice' || field === 'depreciationMonths' || field === 'salvageValue') {
        const raw = String(value ?? '').trim();
        if (raw === '') {
          return { ...l, [field]: '' as NumMaybeEmpty };
        }
        const n = Number(raw.replace(',', '.'));
        if (Number.isNaN(n)) return l;
        return { ...l, [field]: n };
      }
      const updated = { ...l, [field]: value } as DeviceLine;
      if (field === 'itemId') {
        if (!Array.isArray(updated.serials) || updated.serials.length === 0) {
          const qty = Math.max(1, numOrZero(updated.quantity) || 1);
          updated.serials = Array.from({ length: qty }, (_, i) => ({
            equipmentCode: genEquipmentCode(Date.now() + i),
            serial: '',
            modelName: '',
          }));
        } else {
          updated.serials = updated.serials.map(s => ({
            ...s,
            modelName: s.modelName ?? '',
          }));
        }
      }
      return updated;
    }));
  };

  const updateDeviceSerialRow = (
    lineId: string,
    index: number,
    patch: Partial<{ serial: string; modelName: string }>,
  ) => {
    setDeviceLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const serials = [...l.serials];
      serials[index] = { ...serials[index], ...patch };
      return { ...l, serials };
    }));
  };

  const removeDeviceLine = (id: string) => setDeviceLines(prev => prev.filter(l => l.id !== id));

  const addConsumableLine = () => {
    setConsumableLines(prev => [...prev, { id: `cl-${Date.now()}`, itemId: '', quantity: 1, unitPrice: 0 }]);
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
      if (field === 'unitPrice') {
        const raw = String(value ?? '').trim();
        if (raw === '') return { ...l, unitPrice: '' };
        const n = Number(raw.replace(',', '.'));
        if (Number.isNaN(n)) return l;
        return { ...l, unitPrice: n };
      }
      return { ...l, [field]: value } as ConsumableLine;
    }));
  };

  const removeConsumableLine = (id: string) => setConsumableLines(prev => prev.filter(l => l.id !== id));

  const totalAmount = useMemo(() => {
    const dev = deviceLines.reduce((sum, l) => sum + numOrZero(l.quantity) * numOrZero(l.unitPrice), 0);
    const con = consumableLines.reduce((sum, l) => sum + numOrZero(l.quantity) * numOrZero(l.unitPrice), 0);
    return dev + con;
  }, [deviceLines, consumableLines]);

  const invalidateStock = () => {
    void qc.invalidateQueries({ queryKey: ['api', 'stock-ins-view'] });
    void qc.invalidateQueries({ queryKey: ['api', 'stock-document-events'] });
  };

  const handleCreate = async () => {
    if (deviceLines.length === 0 && consumableLines.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 dòng thiết bị hoặc vật tư');
      return;
    }

    const emptyDeviceItem = deviceLines.some(l => !l.itemId);
    const emptyConsumableItem = consumableLines.some(l => !l.itemId);
    if (emptyDeviceItem || emptyConsumableItem) {
      toast.error('Vui lòng chọn tài sản cho tất cả các dòng');
      return;
    }

    if (deviceLines.length > 0) {
      if (deviceLines.some(l => l.quantity === '' || numOrZero(l.quantity) < 1)) {
        toast.error('Nhập số lượng thiết bị ≥ 1 cho mọi dòng');
        return;
      }
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
        const m = numOrZero(l.depreciationMonths);
        return !Number.isFinite(m) || m <= 0;
      });
      if (invalidDep) {
        toast.error('Nhập số tháng khấu hao > 0 cho các thiết bị có khấu hao');
        return;
      }
    }
    if (consumableLines.length > 0) {
      if (consumableLines.some(l => l.quantity === '' || numOrZero(l.quantity) < 1)) {
        toast.error('Nhập số lượng vật tư ≥ 1 cho mọi dòng');
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

    setCreateBusy(true);
    try {
      let fileUrls: string[] = [];
      if (attachmentFile) {
        const fd = new FormData();
        fd.append('file', attachmentFile);
        const up = await apiPostMultipart<{ url?: string }>('/api/allocation-request-attachments', fd);
        if (!up?.url) throw new Error('Upload không trả URL');
        fileUrls = [up.url];
      }
      const note = appendFileUrlsToNote(buildReceiptNote(notes, supplierId), fileUrls);

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
      if (deviceLines.length > 0) {
        for (const line of deviceLines) {
          const serialRows =
            Array.isArray(line.serials) && line.serials.length > 0
              ? line.serials
              : Array.from({ length: Math.max(1, numOrZero(line.quantity) || 1) }, (_, i) => ({
                  equipmentCode: genEquipmentCode(Date.now() + i),
                  serial: '',
                  modelName: '',
                }));
          const unitPriceLine = numOrZero(line.unitPrice);
          const depM = numOrZero(line.depreciationMonths);
          const salv = numOrZero(line.salvageValue);
          for (const s of serialRows) {
            await apiPost('/api/stock-receipt-lines', {
              lineNo: lineNo++,
              quantity: 1,
              unitPrice: unitPriceLine,
              note: formatDeviceLineNote(
                s.equipmentCode,
                s.serial,
                s.modelName,
                depM || undefined,
                salv,
              ),
              receipt: { id: rid },
              assetItem: { id: Number(line.itemId) },
            });
          }
        }
      }
      if (consumableLines.length > 0) {
        for (const line of consumableLines) {
          await apiPost('/api/stock-receipt-lines', {
            lineNo: lineNo++,
            quantity: numOrZero(line.quantity),
            unitPrice: numOrZero(line.unitPrice),
            receipt: { id: rid },
            assetItem: { id: Number(line.itemId) },
          });
        }
      }

      toast.success('Đã tạo phiếu nhập kho');
      resetForm();
      invalidateStock();
      navigate('/admin/stock-in');
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
            <Link to="/admin/stock-in">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Quay lại danh sách
            </Link>
          </Button>
          <h1 className="page-title">Tạo phiếu nhập kho</h1>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] xl:items-start xl:gap-8">
        <Card className="xl:sticky xl:top-6 h-fit shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Thông tin phiếu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mã phiếu</Label>
              <Input value="Tự sinh khi lưu" disabled className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label>Nguồn nhập</Label>
              <Select value={source} onValueChange={setSource}>
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
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Chọn NCC..." /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ghi chú phiếu nhập..."
                rows={4}
                className="min-h-[100px] resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label>Tệp đính kèm (tuỳ chọn)</Label>
              <Input
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.mp4,.webm,.mov"
                className="cursor-pointer"
                onChange={e => setAttachmentFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Ảnh, PDF hoặc video ngắn — cùng quy tắc upload với yêu cầu cấp phát.
              </p>
              {attachmentFile ? (
                <p className="text-xs text-foreground truncate" title={attachmentFile.name}>
                  Đã chọn: {attachmentFile.name}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Chi tiết hàng nhập</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Loại tài sản nhập <span className="text-destructive">*</span></Label>
              <Tabs value={assetType} onValueChange={v => { setAssetType(v as 'DEVICE' | 'CONSUMABLE'); }}>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="DEVICE">Thiết bị</TabsTrigger>
                  <TabsTrigger value="CONSUMABLE">Vật tư</TabsTrigger>
                </TabsList>

                <TabsContent value="DEVICE" className="mt-4 space-y-4">
              {deviceLines.map((line, idx) => {
                const selectedItem = assetItems.find(i => i.id === line.itemId);
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
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                          <Input
                            type="number"
                            min={1}
                            value={line.quantity === '' ? '' : line.quantity}
                            onChange={e => updateDeviceLine(line.id, 'quantity', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Đơn giá</Label>
                          <Input
                            type="number"
                            min={0}
                            value={line.unitPrice === '' ? '' : line.unitPrice}
                            onChange={e => updateDeviceLine(line.id, 'unitPrice', e.target.value)}
                          />
                        </div>
                      </div>
                      {selectedItem?.enableDepreciation && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Số tháng khấu hao <span className="text-destructive">*</span></Label>
                            <Input
                              type="number"
                              min={1}
                              value={line.depreciationMonths === '' ? '' : line.depreciationMonths}
                              onChange={e => updateDeviceLine(line.id, 'depreciationMonths', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Giá trị thu hồi cuối kỳ</Label>
                            <Input
                              type="number"
                              min={0}
                              value={line.salvageValue === '' ? '' : line.salvageValue}
                              onChange={e => updateDeviceLine(line.id, 'salvageValue', e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                      {line.quantity > 0 && line.itemId && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Danh sách thiết bị ({line.serials.length} chiếc)</Label>
                          <div className="border rounded-md overflow-x-auto">
                            <table className="w-full min-w-[520px] text-sm">
                              <thead>
                                <tr className="bg-muted/50 border-b">
                                  <th className="text-left px-3 py-1.5 font-medium text-xs w-12">#</th>
                                  <th className="text-left px-3 py-1.5 font-medium text-xs">Mã TB</th>
                                  <th className="text-left px-3 py-1.5 font-medium text-xs">
                                    Serial {selectedItem?.enableSerial ? <span className="text-destructive">*</span> : null}
                                  </th>
                                  <th className="text-left px-3 py-1.5 font-medium text-xs">Model</th>
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
                                      <Input
                                        className="h-7 text-xs"
                                        value={s.serial}
                                        onChange={e => updateDeviceSerialRow(line.id, si, { serial: e.target.value })}
                                        placeholder={`Nhập serial #${si + 1}...`}
                                      />
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <Input
                                        className="h-7 text-xs"
                                        value={s.modelName}
                                        onChange={e => updateDeviceSerialRow(line.id, si, { modelName: e.target.value })}
                                        placeholder="Model"
                                        maxLength={150}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            Thành tiền: <span className="font-medium text-foreground">{formatCurrency(numOrZero(line.quantity) * numOrZero(line.unitPrice))}</span>
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

            <TabsContent value="CONSUMABLE" className="mt-4 space-y-4">
              {consumableLines.length > 0 && (
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
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
                            <Input
                              className="h-8 text-xs"
                              type="number"
                              min={1}
                              value={line.quantity === '' ? '' : line.quantity}
                              onChange={e => updateConsumableLine(line.id, 'quantity', e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              className="h-8 text-xs"
                              type="number"
                              min={0}
                              value={line.unitPrice === '' ? '' : line.unitPrice}
                              onChange={e => updateConsumableLine(line.id, 'unitPrice', e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-medium">{formatCurrency(numOrZero(line.quantity) * numOrZero(line.unitPrice))}</td>
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
          <div className="text-lg font-semibold">
            Tổng tiền: <span className="text-primary">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/stock-in')} disabled={createBusy}>Hủy</Button>
            <Button onClick={() => void handleCreate()} disabled={createBusy}>{createBusy ? 'Đang tạo…' : 'Tạo phiếu nhập'}</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockInNewPage;
