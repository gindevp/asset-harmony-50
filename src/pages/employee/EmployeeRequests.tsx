import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus, PlusCircle, Trash2 } from 'lucide-react';
import {
  allocationStatusLabels,
  repairStatusLabels,
  returnStatusLabels,
  formatDate,
} from '@/data/mockData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { resolveEmployeeIdForRequests, resolveEmployeeLocationIdForRequests } from '@/api/account';
import { filterEquipmentWithDepartmentPeers } from '@/utils/myEquipment';
import {
  mapAssetItemDto,
  useAllocationRequestsView,
  useAssetItems,
  useDepartments,
  useEnrichedEquipmentList,
  useLocations,
  useRepairRequestsView,
  useReturnRequestsView,
  useEmployees,
} from '@/hooks/useEntityApi';
import { apiPatch, apiPost, apiPostMultipart, getStoredToken } from '@/api/http';
import { hasAnyAuthority } from '@/auth/jwt';
import { makeBizCode } from '@/api/businessCode';
import { formatBizCodeDisplay, formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const employeeIdNum = () => {
  const id = resolveEmployeeIdForRequests();
  return id != null ? Number(id) : NaN;
};

function requireEmployeeId(): number | null {
  const n = employeeIdNum();
  if (!Number.isFinite(n)) {
    toast.error('Tài khoản chưa liên kết nhân viên. Admin: Quản lý user → gán nhân viên cho tài khoản đăng nhập.');
    return null;
  }
  return n;
}

type AllocLineForm = {
  localId: string;
  lineType: 'CONSUMABLE' | 'DEVICE';
  itemId: string;
  quantity: number;
};

const newAllocLine = (): AllocLineForm => ({
  localId: `L-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  lineType: 'CONSUMABLE',
  itemId: '',
  quantity: 1,
});

const EmployeeRequests = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState('allocation');
  const arQ = useAllocationRequestsView();
  const rrQ = useRepairRequestsView();
  const retQ = useReturnRequestsView();
  const eqQ = useEnrichedEquipmentList();
  const iQ = useAssetItems();
  const depQ = useDepartments();
  const locQ = useLocations();
  const allEmpQ = useEmployees();

  const allocationRequests = arQ.data ?? [];
  const repairRequests = rrQ.data ?? [];
  const returnRequests = retQ.data ?? [];
  const equipments = eqQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);

  const myEmpIdStr = resolveEmployeeIdForRequests();
  const myDeptIdStr = useMemo(() => {
    if (!myEmpIdStr || !allEmpQ.data) return null;
    const me = allEmpQ.data.find(x => String(x.id) === myEmpIdStr);
    return me?.department?.id != null ? String(me.department.id) : null;
  }, [myEmpIdStr, allEmpQ.data]);
  const myLocIdStr = resolveEmployeeLocationIdForRequests();

  const deptPeerIds = useMemo(() => {
    if (!myDeptIdStr || !allEmpQ.data) return [] as string[];
    return allEmpQ.data
      .filter(e => String(e.department?.id ?? '') === myDeptIdStr)
      .map(e => String(e.id ?? ''));
  }, [myDeptIdStr, allEmpQ.data]);

  const isDeptCoordinator = hasAnyAuthority(getStoredToken(), ['ROLE_DEPARTMENT_COORDINATOR']);

  const myEquipment = useMemo(
    () =>
      filterEquipmentWithDepartmentPeers(
        equipments,
        myEmpIdStr,
        myDeptIdStr,
        myLocIdStr,
        isDeptCoordinator ? deptPeerIds : [],
      ),
    [equipments, myEmpIdStr, myDeptIdStr, myLocIdStr, isDeptCoordinator, deptPeerIds],
  );
  const deviceItems = useMemo(() => assetItems.filter(i => i.managementType === 'DEVICE'), [assetItems]);
  const consumableItems = useMemo(() => assetItems.filter(i => i.managementType === 'CONSUMABLE'), [assetItems]);

  const canSetExtendedAssignee = hasAnyAuthority(getStoredToken(), [
    'ROLE_ADMIN',
    'ROLE_ASSET_MANAGER',
    'ROLE_DEPARTMENT_COORDINATOR',
  ]);

  const myAllocations = useMemo(
    () => (myEmpIdStr ? allocationRequests.filter(r => r.requesterId === myEmpIdStr) : []),
    [allocationRequests, myEmpIdStr],
  );
  const myRepairs = useMemo(
    () => (myEmpIdStr ? repairRequests.filter(r => r.requesterId === myEmpIdStr) : []),
    [repairRequests, myEmpIdStr],
  );
  const myReturns = useMemo(
    () => (myEmpIdStr ? returnRequests.filter(r => r.requesterId === myEmpIdStr) : []),
    [returnRequests, myEmpIdStr],
  );

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['api', 'allocation-requests-view'] });
    await qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });
    await qc.invalidateQueries({ queryKey: ['api', 'return-requests-view'] });
  };

  const [allocOpen, setAllocOpen] = useState(false);
  const [allocReason, setAllocReason] = useState('');
  const [beneficiaryNote, setBeneficiaryNote] = useState('');
  const [assigneeType, setAssigneeType] = useState<'EMPLOYEE' | 'DEPARTMENT' | 'LOCATION' | 'COMPANY'>('EMPLOYEE');
  const [beneficiaryEmployeeId, setBeneficiaryEmployeeId] = useState('');
  const [beneficiaryDepartmentId, setBeneficiaryDepartmentId] = useState('');
  const [beneficiaryLocationId, setBeneficiaryLocationId] = useState('');
  const [allocLines, setAllocLines] = useState<AllocLineForm[]>([newAllocLine()]);
  const [allocBusy, setAllocBusy] = useState(false);

  const openAlloc = () => {
    setAllocReason('');
    setBeneficiaryNote('');
    setAssigneeType('EMPLOYEE');
    setBeneficiaryEmployeeId(myEmpIdStr ?? '');
    setBeneficiaryDepartmentId('');
    setBeneficiaryLocationId('');
    setAllocLines([newAllocLine()]);
    setAllocOpen(true);
  };

  const [repairOpen, setRepairOpen] = useState(false);
  const [repairEqId, setRepairEqId] = useState('');
  const [repairIssue, setRepairIssue] = useState('');
  const [repairDesc, setRepairDesc] = useState('');
  const [repairAttachment, setRepairAttachment] = useState('');
  const [repairFile, setRepairFile] = useState<File | null>(null);
  const [repairBusy, setRepairBusy] = useState(false);

  const [retOpen, setRetOpen] = useState(false);
  const [retNote, setRetNote] = useState('');
  const [retSelected, setRetSelected] = useState<Record<string, boolean>>({});
  const [retBusy, setRetBusy] = useState(false);

  const [cancelBusy, setCancelBusy] = useState<string | null>(null);

  const submitAllocation = async () => {
    if (!allocReason.trim()) {
      toast.error('Nhập lý do');
      return;
    }
    if (allocLines.length === 0) {
      toast.error('Thêm ít nhất một dòng');
      return;
    }
    for (const line of allocLines) {
      if (!line.itemId) {
        toast.error('Chọn tài sản cho mọi dòng');
        return;
      }
      if (line.lineType === 'CONSUMABLE' && line.quantity < 1) {
        toast.error('Số lượng vật tư không hợp lệ');
        return;
      }
    }
    const reqEid = requireEmployeeId();
    if (reqEid == null) return;
    if (assigneeType === 'EMPLOYEE') {
      const be = canSetExtendedAssignee && beneficiaryEmployeeId ? Number(beneficiaryEmployeeId) : reqEid;
      if (!Number.isFinite(be)) {
        toast.error('Chọn nhân viên nhận');
        return;
      }
    }
    if (assigneeType === 'DEPARTMENT' && !beneficiaryDepartmentId) {
      toast.error('Chọn phòng ban nhận');
      return;
    }
    if (assigneeType === 'LOCATION' && !beneficiaryLocationId) {
      toast.error('Chọn vị trí / khu vực nhận');
      return;
    }
    setAllocBusy(true);
    try {
      const body: Record<string, unknown> = {
        code: makeBizCode('AR'),
        requestDate: new Date().toISOString(),
        reason: allocReason.trim(),
        beneficiaryNote: beneficiaryNote.trim() || undefined,
        status: 'PENDING',
        assigneeType,
        requester: { id: reqEid },
      };
      if (assigneeType === 'EMPLOYEE') {
        const be = canSetExtendedAssignee && beneficiaryEmployeeId ? Number(beneficiaryEmployeeId) : reqEid;
        body.beneficiaryEmployee = { id: be };
      } else if (assigneeType === 'DEPARTMENT') {
        body.beneficiaryDepartment = { id: Number(beneficiaryDepartmentId) };
      } else if (assigneeType === 'LOCATION') {
        body.beneficiaryLocation = { id: Number(beneficiaryLocationId) };
      }
      const created = await apiPost<{ id: number }>('/api/allocation-requests', body);
      let lineNo = 1;
      for (const line of allocLines) {
        await apiPost('/api/allocation-request-lines', {
          lineNo: lineNo++,
          lineType: line.lineType,
          quantity: line.lineType === 'CONSUMABLE' ? line.quantity : 1,
          request: { id: created.id },
          assetItem: { id: Number(line.itemId) },
        });
      }
      toast.success('Đã gửi yêu cầu cấp phát');
      setAllocOpen(false);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setAllocBusy(false);
    }
  };

  const cancelAllocation = async (id: string) => {
    setCancelBusy(id);
    try {
      await apiPatch(`/api/allocation-requests/${id}`, { id: Number(id), status: 'CANCELLED' });
      toast.success('Đã hủy yêu cầu');
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setCancelBusy(null);
    }
  };

  const cancelReturn = async (id: string) => {
    setCancelBusy(id);
    try {
      await apiPatch(`/api/return-requests/${id}`, { id: Number(id), status: 'CANCELLED' });
      toast.success('Đã hủy yêu cầu thu hồi');
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setCancelBusy(null);
    }
  };

  const submitRepair = async () => {
    if (!repairEqId) {
      toast.error('Chọn thiết bị');
      return;
    }
    if (!repairIssue.trim()) {
      toast.error('Nhập vấn đề / danh mục');
      return;
    }
    const repEid = requireEmployeeId();
    if (repEid == null) return;
    setRepairBusy(true);
    try {
      let fileUrl: string | undefined;
      if (repairFile) {
        const fd = new FormData();
        fd.append('file', repairFile);
        const up = await apiPostMultipart<{ url?: string }>('/api/repair-request-attachments', fd);
        fileUrl = up?.url;
        if (!fileUrl) throw new Error('Upload không trả URL');
      }
      const noteParts: string[] = [];
      if (repairAttachment.trim()) noteParts.push(repairAttachment.trim());
      if (fileUrl) noteParts.push(`FILE:${fileUrl}`);
      await apiPost('/api/repair-requests', {
        code: makeBizCode('RP'),
        requestDate: new Date().toISOString(),
        problemCategory: repairIssue.trim().slice(0, 100),
        description: repairDesc.trim() || undefined,
        attachmentNote: noteParts.length > 0 ? noteParts.join('\n') : undefined,
        status: 'NEW',
        requester: { id: repEid },
        equipment: { id: Number(repairEqId) },
      });
      toast.success('Đã gửi yêu cầu sửa chữa');
      setRepairOpen(false);
      setRepairEqId('');
      setRepairIssue('');
      setRepairDesc('');
      setRepairAttachment('');
      setRepairFile(null);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setRepairBusy(false);
    }
  };

  const toggleRet = (id: string) => setRetSelected(p => ({ ...p, [id]: !p[id] }));

  const submitReturn = async () => {
    const ids = Object.entries(retSelected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) {
      toast.error('Chọn ít nhất một thiết bị');
      return;
    }
    const retEid = requireEmployeeId();
    if (retEid == null) return;
    setRetBusy(true);
    try {
      const created = await apiPost<{ id: number }>('/api/return-requests', {
        code: makeBizCode('RT'),
        requestDate: new Date().toISOString(),
        note: retNote.trim() || undefined,
        status: 'PENDING',
        requester: { id: retEid },
      });
      let lineNo = 1;
      for (const eqId of ids) {
        const eq = myEquipment.find(e => e.id === eqId);
        if (!eq) continue;
        await apiPost('/api/return-request-lines', {
          lineNo: lineNo++,
          lineType: 'DEVICE',
          quantity: 1,
          selected: true,
          request: { id: created.id },
          equipment: { id: Number(eqId) },
          assetItem: { id: Number(eq.itemId) },
        });
      }
      toast.success('Đã gửi yêu cầu thu hồi');
      setRetOpen(false);
      setRetNote('');
      setRetSelected({});
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setRetBusy(false);
    }
  };

  const itemsForLine = (lt: 'CONSUMABLE' | 'DEVICE') => (lt === 'CONSUMABLE' ? consumableItems : deviceItems);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Yêu cầu của tôi</h1>
          <p className="page-description">
            {myEmpIdStr
              ? <>Nhân viên liên kết: <span className="font-mono">{myEmpIdStr}</span> (từ tài khoản đăng nhập)</>
              : <>Chưa liên kết nhân viên — đăng nhập lại sau khi Admin gán nhân viên cho tài khoản.</>}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button">
              <Plus className="h-4 w-4 mr-1" /> Tạo yêu cầu
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={openAlloc}>Yêu cầu cấp phát</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setRepairOpen(true)}>Yêu cầu sửa chữa</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { setRetSelected({}); setRetOpen(true); }}>Yêu cầu thu hồi</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={allocOpen} onOpenChange={setAllocOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo yêu cầu cấp phát</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Lý do</Label>
              <Textarea value={allocReason} onChange={e => setAllocReason(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Đối tượng nhận / ghi chú (tuỳ chọn)</Label>
              <Textarea
                value={beneficiaryNote}
                onChange={e => setBeneficiaryNote(e.target.value)}
                rows={2}
                placeholder="VD: Ghi chú thêm cho QLTS (lý do cấp cho PB/vị trí…)"
              />
            </div>
            {canSetExtendedAssignee ? (
              <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                <div className="space-y-2">
                  <Label>Đối tượng được cấp (theo tài liệu nghiệp vụ)</Label>
                  <Select
                    value={assigneeType}
                    onValueChange={v => {
                      const t = v as typeof assigneeType;
                      setAssigneeType(t);
                      if (t === 'EMPLOYEE') setBeneficiaryEmployeeId(myEmpIdStr ?? '');
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Nhân viên</SelectItem>
                      <SelectItem value="DEPARTMENT">Phòng ban</SelectItem>
                      <SelectItem value="LOCATION">Vị trí / khu vực</SelectItem>
                      <SelectItem value="COMPANY">Toàn công ty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {assigneeType === 'EMPLOYEE' && (
                  <div className="space-y-2">
                    <Label>Nhân viên nhận</Label>
                    <Select value={beneficiaryEmployeeId || undefined} onValueChange={setBeneficiaryEmployeeId}>
                      <SelectTrigger><SelectValue placeholder="Chọn nhân viên" /></SelectTrigger>
                      <SelectContent>
                        {(allEmpQ.data ?? []).map(e => (
                          <SelectItem key={e.id} value={String(e.id ?? '')}>
                            {e.code ?? e.id} — {e.fullName ?? ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {assigneeType === 'DEPARTMENT' && (
                  <div className="space-y-2">
                    <Label>Phòng ban nhận</Label>
                    <Select value={beneficiaryDepartmentId || undefined} onValueChange={setBeneficiaryDepartmentId}>
                      <SelectTrigger><SelectValue placeholder="Chọn phòng ban" /></SelectTrigger>
                      <SelectContent>
                        {(depQ.data ?? []).map(d => (
                          <SelectItem key={d.id} value={String(d.id ?? '')}>
                            {d.code ?? d.id} — {d.name ?? ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {assigneeType === 'LOCATION' && (
                  <div className="space-y-2">
                    <Label>Vị trí / khu vực nhận</Label>
                    <Select value={beneficiaryLocationId || undefined} onValueChange={setBeneficiaryLocationId}>
                      <SelectTrigger><SelectValue placeholder="Chọn vị trí" /></SelectTrigger>
                      <SelectContent>
                        {(locQ.data ?? []).map(loc => (
                          <SelectItem key={loc.id} value={String(loc.id ?? '')}>
                            {loc.code ?? loc.id} — {loc.name ?? ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {assigneeType === 'COMPANY' && (
                  <p className="text-xs text-muted-foreground">Tài sản ghi nhận dùng chung toàn công ty (không gắn NV/PB cụ thể).</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Đối tượng nhận tài sản: <strong>bạn</strong> (nhân viên liên kết tài khoản). Điều phối phòng ban / QLTS có thể chọn phòng ban hoặc vị trí.
              </p>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Các dòng yêu cầu</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setAllocLines(p => [...p, newAllocLine()])}>
                  <PlusCircle className="h-4 w-4 mr-1" /> Thêm dòng
                </Button>
              </div>
              <div className="space-y-3 border rounded-md p-3">
                {allocLines.map((line, idx) => (
                  <div key={line.localId} className="space-y-2 pb-3 border-b last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Dòng {idx + 1}</span>
                      {allocLines.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAllocLines(p => p.filter(l => l.localId !== line.localId))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Select
                      value={line.lineType}
                      onValueChange={v =>
                        setAllocLines(p =>
                          p.map(l =>
                            l.localId === line.localId
                              ? { ...l, lineType: v as 'CONSUMABLE' | 'DEVICE', itemId: '' }
                              : l,
                          ),
                        )
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CONSUMABLE">Vật tư tiêu hao</SelectItem>
                        <SelectItem value="DEVICE">Thiết bị</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={line.itemId || undefined} onValueChange={v => setAllocLines(p => p.map(l => (l.localId === line.localId ? { ...l, itemId: v } : l)))}>
                      <SelectTrigger><SelectValue placeholder="Chọn tài sản" /></SelectTrigger>
                      <SelectContent>
                        {itemsForLine(line.lineType).map(i => (
                          <SelectItem key={i.id} value={i.id}>{i.code} — {i.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {line.lineType === 'CONSUMABLE' && (
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={e =>
                          setAllocLines(p =>
                            p.map(l =>
                              l.localId === line.localId ? { ...l, quantity: Math.max(1, Number(e.target.value)) } : l,
                            ),
                          )
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocOpen(false)} disabled={allocBusy}>Đóng</Button>
            <Button onClick={() => void submitAllocation()} disabled={allocBusy}>{allocBusy ? 'Đang gửi…' : 'Gửi'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={repairOpen}
        onOpenChange={open => {
          setRepairOpen(open);
          if (!open) setRepairFile(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo yêu cầu sửa chữa</DialogTitle>
          </DialogHeader>
          {myEquipment.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bạn không có thiết bị đang gán — không thể tạo yêu cầu sửa chữa.</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Thiết bị</Label>
                <Select value={repairEqId} onValueChange={setRepairEqId}>
                  <SelectTrigger><SelectValue placeholder="Chọn thiết bị..." /></SelectTrigger>
                  <SelectContent>
                    {myEquipment.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {formatEquipmentCodeDisplay(e.equipmentCode)} — serial {e.serial || '—'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vấn đề (tối đa 100 ký tự)</Label>
                <Input value={repairIssue} onChange={e => setRepairIssue(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label>Mô tả chi tiết</Label>
                <Textarea value={repairDesc} onChange={e => setRepairDesc(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Link / ghi chú ảnh đính kèm (tùy chọn)</Label>
                <Textarea
                  value={repairAttachment}
                  onChange={e => setRepairAttachment(e.target.value)}
                  rows={2}
                  placeholder="VD: URL ảnh lỗi, mô tả file đính kèm..."
                />
              </div>
              <div className="space-y-2">
                <Label>Tải ảnh, PDF hoặc video (tùy chọn, tối đa ~50 MB)</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  onChange={e => setRepairFile(e.target.files?.[0] ?? null)}
                />
                {repairFile ? (
                  <p className="text-xs text-muted-foreground">Đã chọn: {repairFile.name}</p>
                ) : null}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepairOpen(false)} disabled={repairBusy}>Hủy</Button>
            <Button onClick={() => void submitRepair()} disabled={repairBusy || myEquipment.length === 0}>
              {repairBusy ? 'Đang gửi…' : 'Gửi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={retOpen} onOpenChange={setRetOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo yêu cầu thu hồi</DialogTitle>
          </DialogHeader>
          {myEquipment.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bạn không có thiết bị đang gán.</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Textarea value={retNote} onChange={e => setRetNote(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto border rounded-md p-2">
                {myEquipment.map(e => (
                  <label key={e.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                    <input type="checkbox" checked={!!retSelected[e.id]} onChange={() => toggleRet(e.id)} />
                    <span className="font-mono">{formatEquipmentCodeDisplay(e.equipmentCode)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetOpen(false)} disabled={retBusy}>Hủy</Button>
            <Button onClick={() => void submitReturn()} disabled={retBusy || myEquipment.length === 0}>
              {retBusy ? 'Đang gửi…' : 'Gửi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="allocation">Cấp phát ({myAllocations.length})</TabsTrigger>
          <TabsTrigger value="repair">Sửa chữa ({myRepairs.length})</TabsTrigger>
          <TabsTrigger value="return">Thu hồi ({myReturns.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="allocation" className="mt-4">
          <DataTable
            columns={[
              {
                key: 'code',
                label: 'Mã YC',
                render: (r: any) => (
                  <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code)}</span>
                ),
              },
              { key: 'reason', label: 'Lý do' },
              {
                key: 'assignee',
                label: 'Đối tượng nhận',
                render: (r: any) => (
                  <span className="max-w-[14rem] truncate block" title={r.assigneeSummary}>
                    {r.assigneeSummary}
                  </span>
                ),
              },
              {
                key: 'benNote',
                label: 'Ghi chú',
                render: (r: any) => <span className="max-w-[8rem] truncate block">{r.beneficiaryNote || '—'}</span>,
              },
              { key: 'lines', label: 'Số dòng', render: (r: any) => r.lines.length },
              {
                key: 'status',
                label: 'Trạng thái',
                render: (r: any) => (
                  <StatusBadge status={r.status} label={allocationStatusLabels[r.status] ?? r.status} />
                ),
              },
              { key: 'createdAt', label: 'Ngày tạo', render: (r: any) => formatDate(r.createdAt) },
              {
                key: 'act',
                label: '',
                render: (r: any) =>
                  r.status === 'PENDING' ? (
                    <Button type="button" variant="outline" size="sm" disabled={cancelBusy === r.id} onClick={() => void cancelAllocation(r.id)}>
                      {cancelBusy === r.id ? '…' : 'Hủy YC'}
                    </Button>
                  ) : null,
              },
            ]}
            data={myAllocations}
            emptyMessage="Bạn chưa có yêu cầu cấp phát nào"
          />
        </TabsContent>
        <TabsContent value="repair" className="mt-4">
          <DataTable
            columns={[
              {
                key: 'code',
                label: 'Mã YC',
                render: (r: any) => (
                  <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code)}</span>
                ),
              },
              { key: 'issue', label: 'Vấn đề' },
              {
                key: 'equipment',
                label: 'Thiết bị',
                render: (r: any) => {
                  const eq = equipments.find(e => e.id === r.equipmentId);
                  return eq ? formatEquipmentCodeDisplay(eq.equipmentCode) : '';
                },
              },
              {
                key: 'status',
                label: 'Trạng thái',
                render: (r: any) => <StatusBadge status={r.status} label={repairStatusLabels[r.status] ?? r.status} />,
              },
              { key: 'createdAt', label: 'Ngày tạo', render: (r: any) => formatDate(r.createdAt) },
            ]}
            data={myRepairs}
            emptyMessage="Bạn chưa có yêu cầu sửa chữa nào"
          />
        </TabsContent>
        <TabsContent value="return" className="mt-4">
          <DataTable
            columns={[
              {
                key: 'code',
                label: 'Mã YC',
                render: (r: any) => (
                  <span className="font-mono text-sm font-medium">{formatBizCodeDisplay(r.code)}</span>
                ),
              },
              { key: 'reason', label: 'Lý do' },
              {
                key: 'status',
                label: 'Trạng thái',
                render: (r: any) => <StatusBadge status={r.status} label={returnStatusLabels[r.status] ?? r.status} />,
              },
              { key: 'createdAt', label: 'Ngày tạo', render: (r: any) => formatDate(r.createdAt) },
              {
                key: 'act',
                label: '',
                render: (r: any) =>
                  r.status === 'PENDING' ? (
                    <Button type="button" variant="outline" size="sm" disabled={cancelBusy === r.id} onClick={() => void cancelReturn(r.id)}>
                      {cancelBusy === r.id ? '…' : 'Hủy YC'}
                    </Button>
                  ) : null,
              },
            ]}
            data={myReturns}
            emptyMessage="Bạn chưa có yêu cầu thu hồi nào"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmployeeRequests;
