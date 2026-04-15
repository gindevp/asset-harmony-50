import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, PlusCircle, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/data/mockData';
import { toast } from 'sonner';
import {
  mapAssetItemDto,
  useAssetItems,
  useConsumableAssignments,
  useDepartments,
  useEmployees,
  useEnrichedEquipmentList,
  useLocations,
  useSuppliers,
} from '@/hooks/useEntityApi';
import { apiPost, apiPostMultipart } from '@/api/http';
import type { StockReceiptDto } from '@/api/types';
import { makeBizCode } from '@/api/businessCode';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { appendFileUrlsToNote, buildReceiptNote } from '@/utils/stockReceiptNote';
import { consumableQuantityHeld } from '@/utils/myEquipment';
import { resolveEmployeeIdForRequests, resolveEmployeeLocationIdForRequests } from '@/api/account';
import { pushInAppNotification } from '@/lib/inAppNotifications';

const FE_SOURCE_TO_API: Record<string, string> = {
  PURCHASE: 'NEW_PURCHASE',
  RETURN: 'RECOVERY',
};

const FE_SOURCE_LABELS: Record<keyof typeof FE_SOURCE_TO_API, string> = {
  PURCHASE: 'Mua mới',
  RETURN: 'Thu hồi',
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

type ReturnOwnerType = 'EMPLOYEE' | 'COMPANY' | 'DEPARTMENT';
type ReturnLookupType = 'EMPLOYEE' | 'LOCATION' | 'DEPARTMENT';

const StockInNewPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const iQ = useAssetItems();
  const sQ = useSuppliers();
  const eqQ = useEnrichedEquipmentList();
  const caQ = useConsumableAssignments();
  const empQ = useEmployees();
  const depQ = useDepartments();
  const locQ = useLocations();

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
  const equipments = eqQ.data ?? [];
  const consumableAssignments = caQ.data ?? [];
  const employees = empQ.data ?? [];
  const departments = depQ.data ?? [];
  const locations = locQ.data ?? [];

  const [assetType, setAssetType] = useState<'DEVICE' | 'CONSUMABLE'>('DEVICE');
  const [source, setSource] = useState<string>('PURCHASE');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [deviceLines, setDeviceLines] = useState<DeviceLine[]>([]);
  const [consumableLines, setConsumableLines] = useState<ConsumableLine[]>([]);
  const [createBusy, setCreateBusy] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [returnOwnerType, setReturnOwnerType] = useState<ReturnOwnerType>('EMPLOYEE');
  const [returnLookupType, setReturnLookupType] = useState<ReturnLookupType>('EMPLOYEE');
  const [returnSearch, setReturnSearch] = useState('');
  const [returnHolderKey, setReturnHolderKey] = useState('');
  const [selectedRecoveryEquipmentIds, setSelectedRecoveryEquipmentIds] = useState<string[]>([]);
  const [selectedRecoveryConsumables, setSelectedRecoveryConsumables] = useState<Record<string, number>>({});
  const myEmployeeId = resolveEmployeeIdForRequests();
  const myLocationId = useMemo(() => {
    const fromAccount = resolveEmployeeLocationIdForRequests();
    if (!myEmployeeId) return fromAccount;
    const me = employees.find(x => String(x.id) === myEmployeeId);
    const fromProfile = me?.location?.id != null ? String(me.location.id) : null;
    return fromProfile ?? fromAccount;
  }, [employees, myEmployeeId]);
  const isReturnSource = source === 'RETURN';

  const resetForm = () => {
    setAssetType('DEVICE');
    setSource('PURCHASE');
    setSupplierId('');
    setNotes('');
    setAttachmentFile(null);
    setDeviceLines([]);
    setConsumableLines([]);
    setReturnOwnerType('EMPLOYEE');
    setReturnLookupType('EMPLOYEE');
    setReturnSearch('');
    setReturnHolderKey('');
    setSelectedRecoveryEquipmentIds([]);
    setSelectedRecoveryConsumables({});
  };

  const holderOptions = useMemo(() => {
    const keys = new Set<string>();
    const out: Array<{ key: string; label: string; kind: 'EMPLOYEE' | 'DEPARTMENT' | 'LOCATION' }> = [];
    const pushIfNew = (key: string, label: string, kind: 'EMPLOYEE' | 'DEPARTMENT' | 'LOCATION') => {
      if (!key || keys.has(key)) return;
      keys.add(key);
      out.push({ key, label, kind });
    };

    for (const e of equipments) {
      if (e.status === 'LOST' || e.status === 'DISPOSED') continue;
      if (returnOwnerType === 'EMPLOYEE' && !e.assignedTo) continue;
      if (returnOwnerType === 'DEPARTMENT' && !e.assignedDepartment) continue;
      if (returnOwnerType === 'COMPANY' && !e.assignedLocation) continue;
      if (returnLookupType === 'EMPLOYEE' && e.assignedTo) {
        const emp = employees.find(x => String(x.id) === e.assignedTo);
        pushIfNew(`EMPLOYEE:${e.assignedTo}`, `${emp?.code ?? ''} - ${emp?.fullName ?? ''}`.trim() || e.assignedTo, 'EMPLOYEE');
      }
      if (returnLookupType === 'DEPARTMENT' && e.assignedDepartment) {
        const dep = departments.find(x => String(x.id) === e.assignedDepartment);
        pushIfNew(
          `DEPARTMENT:${e.assignedDepartment}`,
          `${dep?.code ?? ''} - ${dep?.name ?? ''}`.trim() || e.assignedDepartment,
          'DEPARTMENT',
        );
      }
      if (returnLookupType === 'LOCATION' && e.assignedLocation) {
        const loc = locations.find(x => String(x.id) === e.assignedLocation);
        pushIfNew(
          `LOCATION:${e.assignedLocation}`,
          `${loc?.code ?? ''} - ${loc?.name ?? ''}`.trim() || e.assignedLocation,
          'LOCATION',
        );
      }
    }

    for (const a of consumableAssignments) {
      if (consumableQuantityHeld(a) <= 0) continue;
      if (returnOwnerType === 'EMPLOYEE' && a.employee?.id == null) continue;
      if (returnOwnerType === 'DEPARTMENT' && a.department?.id == null) continue;
      if (returnOwnerType === 'COMPANY' && a.location?.id == null) continue;
      if (returnLookupType === 'EMPLOYEE' && a.employee?.id != null) {
        pushIfNew(
          `EMPLOYEE:${String(a.employee.id)}`,
          `${a.employee.code ?? ''} - ${a.employee.fullName ?? ''}`.trim() || String(a.employee.id),
          'EMPLOYEE',
        );
      }
      if (returnLookupType === 'DEPARTMENT' && a.department?.id != null) {
        pushIfNew(
          `DEPARTMENT:${String(a.department.id)}`,
          `${a.department.code ?? ''} - ${a.department.name ?? ''}`.trim() || String(a.department.id),
          'DEPARTMENT',
        );
      }
      if (returnLookupType === 'LOCATION' && a.location?.id != null) {
        pushIfNew(
          `LOCATION:${String(a.location.id)}`,
          `${a.location.code ?? ''} - ${a.location.name ?? ''}`.trim() || String(a.location.id),
          'LOCATION',
        );
      }
    }

    const kw = returnSearch.trim().toLowerCase();
    return out.filter(o => (o.label || '').toLowerCase().includes(kw)).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [
    consumableAssignments,
    departments,
    employees,
    equipments,
    locations,
    returnLookupType,
    returnOwnerType,
    returnSearch,
  ]);
  const holderOptionsForUi = useMemo(() => {
    if (returnOwnerType !== 'COMPANY') return holderOptions;
    return holderOptions.filter(o => o.kind === 'LOCATION');
  }, [returnOwnerType, holderOptions, locations, returnSearch]);
  const companyLocationHolderOptions = useMemo(
    () => holderOptionsForUi.filter(o => o.kind === 'LOCATION'),
    [holderOptionsForUi],
  );

  useEffect(() => {
    if (returnOwnerType !== 'COMPANY') return;
    setReturnLookupType('LOCATION');
    const preferredKey = myLocationId ? `LOCATION:${myLocationId}` : '';
    if (preferredKey && companyLocationHolderOptions.some(o => o.key === preferredKey)) {
      setReturnHolderKey(preferredKey);
      return;
    }
    if (!returnHolderKey && companyLocationHolderOptions.length > 0) {
      setReturnHolderKey(companyLocationHolderOptions[0].key);
    }
  }, [returnOwnerType, myLocationId, companyLocationHolderOptions, returnHolderKey]);

  const matchHolderBySearchType = (params: {
    employeeId?: string;
    departmentId?: string;
    locationId?: string;
  }): boolean => {
    if (!returnHolderKey) return true;
    const [kind, id] = returnHolderKey.split(':');
    if (kind === 'EMPLOYEE') return params.employeeId === id;
    if (kind === 'DEPARTMENT') return params.departmentId === id;
    return params.locationId === id;
  };

  const recoverableEquipments = useMemo(() => {
    return equipments
      .filter(e => {
        if (e.status === 'LOST' || e.status === 'DISPOSED') return false;
        if (returnOwnerType === 'EMPLOYEE' && !e.assignedTo) return false;
        if (returnOwnerType === 'DEPARTMENT' && !e.assignedDepartment) return false;
        if (returnOwnerType === 'COMPANY' && !e.assignedLocation) return false;
        const emp = employees.find(x => String(x.id) === e.assignedTo);
        const dep = departments.find(x => String(x.id) === e.assignedDepartment);
        const loc = locations.find(x => String(x.id) === e.assignedLocation);
        const searchText =
          returnLookupType === 'EMPLOYEE'
            ? `${emp?.code ?? ''} ${emp?.fullName ?? ''}`
            : returnLookupType === 'DEPARTMENT'
              ? `${dep?.code ?? ''} ${dep?.name ?? ''}`
              : `${loc?.code ?? ''} ${loc?.name ?? ''}`;
        const kw = returnSearch.trim().toLowerCase();
        if (kw && !searchText.toLowerCase().includes(kw)) return false;
        return matchHolderBySearchType({
          employeeId: e.assignedTo,
          departmentId: e.assignedDepartment,
          locationId: e.assignedLocation,
        });
      })
      .sort((a, b) => a.equipmentCode.localeCompare(b.equipmentCode, 'vi', { numeric: true }));
  }, [departments, employees, equipments, locations, returnHolderKey, returnLookupType, returnOwnerType, returnSearch]);

  const recoverableConsumables = useMemo(() => {
    return consumableAssignments
      .filter(a => {
        const held = consumableQuantityHeld(a);
        if (held <= 0) return false;
        if (returnOwnerType === 'EMPLOYEE' && a.employee?.id == null) return false;
        if (returnOwnerType === 'DEPARTMENT' && a.department?.id == null) return false;
        if (returnOwnerType === 'COMPANY' && a.location?.id == null) return false;
        const searchText =
          returnLookupType === 'EMPLOYEE'
            ? `${a.employee?.code ?? ''} ${a.employee?.fullName ?? ''}`
            : returnLookupType === 'DEPARTMENT'
              ? `${a.department?.code ?? ''} ${a.department?.name ?? ''}`
              : `${a.location?.code ?? ''} ${a.location?.name ?? ''}`;
        const kw = returnSearch.trim().toLowerCase();
        if (kw && !searchText.toLowerCase().includes(kw)) return false;
        return matchHolderBySearchType({
          employeeId: String(a.employee?.id ?? ''),
          departmentId: String(a.department?.id ?? ''),
          locationId: String(a.location?.id ?? ''),
        });
      })
      .map(a => ({
        assignmentId: String(a.id ?? ''),
        itemId: String(a.assetItem?.id ?? ''),
        itemCode: a.assetItem?.code ?? '',
        itemName: a.assetItem?.name ?? '',
        held: consumableQuantityHeld(a),
      }))
      .sort((a, b) => a.itemCode.localeCompare(b.itemCode, 'vi'));
  }, [consumableAssignments, returnHolderKey, returnLookupType, returnOwnerType, returnSearch]);

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
    if (isReturnSource) {
      if (!returnHolderKey) {
        toast.error('Vui lòng chọn đối tượng cần thu hồi');
        return;
      }
      const selectedConsumableCount = Object.values(selectedRecoveryConsumables).filter(v => Number(v) > 0).length;
      if (selectedRecoveryEquipmentIds.length === 0 && selectedConsumableCount === 0) {
        toast.error('Vui lòng chọn ít nhất 1 tài sản để thu hồi nhập kho');
        return;
      }
    }

    if (!isReturnSource) {
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
      const note = appendFileUrlsToNote(
        buildReceiptNote(notes, supplierId),
        fileUrls,
      );

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
      const linesToCreateDevice =
        isReturnSource
          ? selectedRecoveryEquipmentIds
              .map(id => recoverableEquipments.find(e => e.id === id))
              .filter((e): e is NonNullable<typeof e> => !!e)
              .map((e, idx) => ({
                id: `ret-eq-${e.id}-${idx}`,
                itemId: e.itemId,
                quantity: 1 as NumMaybeEmpty,
                unitPrice: e.originalCost as NumMaybeEmpty,
                depreciationMonths: e.depreciationMonths as NumMaybeEmpty,
                salvageValue: e.salvageValue as NumMaybeEmpty,
                serials: [
                  {
                    equipmentCode: e.equipmentCode,
                    serial: e.serial ?? '',
                    modelName: e.modelName ?? '',
                  },
                ],
              }))
          : deviceLines;

      if (linesToCreateDevice.length > 0) {
        for (const line of linesToCreateDevice) {
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
      const linesToCreateConsumable =
        isReturnSource
          ? recoverableConsumables
              .map(row => ({
                id: row.assignmentId,
                itemId: row.itemId,
                quantity: (selectedRecoveryConsumables[row.assignmentId] ?? 0) as NumMaybeEmpty,
                unitPrice: 0 as NumMaybeEmpty,
              }))
              .filter(line => numOrZero(line.quantity) > 0)
          : consumableLines;

      if (linesToCreateConsumable.length > 0) {
        for (const line of linesToCreateConsumable) {
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
      pushInAppNotification({
        title: 'Nhập kho',
        message: `Đã tạo phiếu nhập ${code}.`,
        kind: 'success',
        route: '/admin/stock-in',
      });
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
              <Select
                value={source}
                onValueChange={v => {
                  setSource(v);
                  if (v === 'RETURN') {
                    setSupplierId('');
                  }
                  if (v !== 'RETURN') {
                    setReturnHolderKey('');
                    setSelectedRecoveryEquipmentIds([]);
                    setSelectedRecoveryConsumables({});
                  }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(FE_SOURCE_LABELS) as Array<[keyof typeof FE_SOURCE_LABELS, string]>).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isReturnSource && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-2">
                  <Label>Đối tượng thu hồi</Label>
                  <Select
                    value={returnOwnerType}
                    onValueChange={v => {
                      const t = v as ReturnOwnerType;
                      setReturnOwnerType(t);
                      setReturnLookupType(t === 'COMPANY' ? 'LOCATION' : t);
                      setReturnHolderKey('');
                      setSelectedRecoveryEquipmentIds([]);
                      setSelectedRecoveryConsumables({});
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Nhân viên</SelectItem>
                      <SelectItem value="COMPANY">Công ty</SelectItem>
                      <SelectItem value="DEPARTMENT">Phòng ban</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={returnOwnerType === 'COMPANY' ? 'grid grid-cols-1 gap-2 sm:grid-cols-[1fr_200px]' : 'space-y-2'}>
                  <Input
                    value={returnSearch}
                    onChange={e => setReturnSearch(e.target.value)}
                    placeholder="Tìm đối tượng..."
                  />
                  {returnOwnerType === 'COMPANY' ? (
                    <Select
                      value={returnLookupType}
                      onValueChange={v => {
                        setReturnLookupType(v as ReturnLookupType);
                        setReturnHolderKey('');
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOCATION">Theo vị trí</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Chọn đối tượng cụ thể</Label>
                  <Select
                    value={returnHolderKey || '__none__'}
                    onValueChange={v => {
                      const key = v === '__none__' ? '' : v;
                      setReturnHolderKey(key);
                      setSelectedRecoveryEquipmentIds([]);
                      setSelectedRecoveryConsumables({});
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Chọn đối tượng..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Chọn —</SelectItem>
                      {holderOptionsForUi.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {!isReturnSource && (
              <div className="space-y-2">
                <Label>Nhà cung cấp</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Chọn NCC..." /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
            {source === 'RETURN' ? (
              <div className="space-y-4">
                <div className="rounded-md border p-3">
                  <h3 className="font-medium text-sm mb-2">Thiết bị đang nắm giữ</h3>
                  {!returnHolderKey ? (
                    <p className="text-sm text-muted-foreground">Chọn đối tượng để xem danh sách thiết bị có thể thu hồi.</p>
                  ) : recoverableEquipments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Không có thiết bị phù hợp.</p>
                  ) : (
                    <div className="space-y-2">
                      {recoverableEquipments.map(eq => {
                        const checked = selectedRecoveryEquipmentIds.includes(eq.id);
                        return (
                          <label key={eq.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                const on = e.target.checked;
                                setSelectedRecoveryEquipmentIds(prev =>
                                  on ? [...prev, eq.id] : prev.filter(x => x !== eq.id),
                                );
                              }}
                            />
                            <span className="font-mono">{formatEquipmentCodeDisplay(eq.equipmentCode)}</span>
                            <span>— {assetItems.find(i => i.id === eq.itemId)?.name ?? eq.itemId}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-md border p-3">
                  <h3 className="font-medium text-sm mb-2">Vật tư đang nắm giữ</h3>
                  {!returnHolderKey ? (
                    <p className="text-sm text-muted-foreground">Chọn đối tượng để xem danh sách vật tư có thể thu hồi.</p>
                  ) : recoverableConsumables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Không có vật tư phù hợp.</p>
                  ) : (
                    <div className="space-y-2">
                      {recoverableConsumables.map(row => {
                        const currentQty = selectedRecoveryConsumables[row.assignmentId] ?? 0;
                        return (
                          <div key={row.assignmentId} className="grid grid-cols-[1fr_120px] items-center gap-3">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={currentQty > 0}
                                onChange={e => {
                                  const on = e.target.checked;
                                  setSelectedRecoveryConsumables(prev => ({
                                    ...prev,
                                    [row.assignmentId]: on ? row.held : 0,
                                  }));
                                }}
                              />
                              <span className="font-mono">{row.itemCode || '—'}</span>
                              <span>— {row.itemName} (đang giữ: {row.held})</span>
                            </label>
                            <Input
                              type="number"
                              min={0}
                              max={row.held}
                              value={currentQty}
                              onChange={e => {
                                const n = Number(e.target.value);
                                const next = Number.isFinite(n) ? Math.max(0, Math.min(row.held, Math.floor(n))) : 0;
                                setSelectedRecoveryConsumables(prev => ({ ...prev, [row.assignmentId]: next }));
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>
      </div>

      {assetType && (
        <div className="sticky bottom-0 z-10 mt-8 flex flex-col gap-4 border-t border-border bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:items-center sm:justify-between shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.08)]">
          <div className="text-lg font-semibold">
            Tổng tiền: <span className="text-primary">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCancelConfirmOpen(true)} disabled={createBusy}>Hủy</Button>
            <Button onClick={() => void handleCreate()} disabled={createBusy}>{createBusy ? 'Đang tạo…' : 'Tạo phiếu nhập'}</Button>
          </div>
        </div>
      )}

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy tạo phiếu nhập?</AlertDialogTitle>
            <AlertDialogDescription>
              Thông tin phiếu chưa được lưu. Bạn có chắc muốn quay lại danh sách phiếu nhập kho?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ở lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetForm();
                navigate('/admin/stock-in');
              }}
            >
              Thoát
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StockInNewPage;
