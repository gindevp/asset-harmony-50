import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import type { Equipment } from '@/data/mockData';
import { resolveEmployeeIdForRequests, resolveEmployeeLocationIdForRequests } from '@/api/account';
import { apiPost, apiPostMultipart, getStoredToken } from '@/api/http';
import { hasAnyAuthority } from '@/auth/jwt';
import { makeBizCode } from '@/api/businessCode';
import { filterEquipmentWithDepartmentPeers } from '@/utils/myEquipment';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import {
  mapAssetItemDto,
  useAssetItems,
  useAssetLines,
  useDepartments,
  useEmployees,
  useEnrichedEquipmentList,
  useLocations,
} from '@/hooks/useEntityApi';

type RequestKind = 'allocation' | 'repair' | 'return';

type AllocLineForm = {
  localId: string;
  lineType: 'CONSUMABLE' | 'DEVICE';
  /** Vật tư: mã item */
  itemId: string;
  /** Thiết bị: dòng tài sản (QLTS chọn thiết bị cụ thể khi duyệt) */
  assetLineId: string;
  quantity: number;
};

const newAllocLine = (): AllocLineForm => ({
  localId: `L-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  lineType: 'CONSUMABLE',
  itemId: '',
  assetLineId: '',
  quantity: 1,
});

function requireEmployeeId(): number | null {
  const id = resolveEmployeeIdForRequests();
  const n = id != null ? Number(id) : NaN;
  if (!Number.isFinite(n)) {
    toast.error('Tài khoản chưa liên kết nhân viên. Admin: Quản lý user → gán nhân viên cho tài khoản đăng nhập.');
    return null;
  }
  return n;
}

export default function RequestNew() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();

  const isAdminArea = location.pathname.startsWith('/admin');

  /** Danh sách yêu cầu đúng nav (cùng loại), không ép về màn cấp phát. */
  const requestsListPath = (forKind: RequestKind): string => {
    if (isAdminArea) {
      return `/admin/request-create?section=${forKind}`;
    }
    if (forKind === 'repair') return '/employee/repair-requests';
    if (forKind === 'return') return '/employee/return-requests';
    return '/employee/allocation-requests';
  };

  const kindFromUrl = (sp.get('kind') ?? '') as RequestKind;
  const [kind, setKind] = useState<RequestKind>(kindFromUrl || 'allocation');

  const eqQ = useEnrichedEquipmentList();
  const iQ = useAssetItems();
  const depQ = useDepartments();
  const locQ = useLocations();
  const allEmpQ = useEmployees();
  const linesQ = useAssetLines();

  const equipments = eqQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const consumableItems = useMemo(() => assetItems.filter(i => i.managementType === 'CONSUMABLE'), [assetItems]);
  /** Dòng tài sản thuộc nhóm loại Thiết bị — chọn trên phiếu yêu cầu thay vì item master */
  const deviceAssetLineOptions = useMemo(() => {
    const raw = linesQ.data ?? [];
    return raw
      .filter(l => (l.assetGroup?.assetType ?? '').toUpperCase() === 'DEVICE' && l.active !== false)
      .map(l => {
        const id = String(l.id ?? '');
        const code = (l.code ?? '').trim() || id;
        const name = (l.name ?? '').trim() || '—';
        return {
          value: id,
          label: `${code} — ${name}`,
          searchText: `${code} ${name} ${(l.description ?? '').trim()}`,
        };
      });
  }, [linesQ.data]);

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

  /** Người gửi yêu cầu cấp phát (chỉ hiển thị, không sửa). */
  const allocationRequesterSummary = useMemo(() => {
    if (!myEmpIdStr) return { state: 'none' as const };
    if (!allEmpQ.data) return { state: 'loading' as const };
    const me = allEmpQ.data.find(x => String(x.id) === myEmpIdStr);
    if (!me) return { state: 'missing' as const };
    const code = (me.code ?? '').trim() || String(me.id ?? '');
    const name = (me.fullName ?? '').trim() || '—';
    return { state: 'ok' as const, code, name };
  }, [myEmpIdStr, allEmpQ.data]);

  const isDeptCoordinator = hasAnyAuthority(getStoredToken(), ['ROLE_DEPARTMENT_COORDINATOR']);
  const canSetExtendedAssignee = hasAnyAuthority(getStoredToken(), [
    'ROLE_ADMIN',
    'ROLE_ASSET_MANAGER',
    'ROLE_DEPARTMENT_COORDINATOR',
  ]);

  const myEquipment: Equipment[] = useMemo(
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

  // ===== Allocation form state =====
  const [allocReason, setAllocReason] = useState('');
  const [assigneeType, setAssigneeType] = useState<'EMPLOYEE' | 'DEPARTMENT' | 'LOCATION' | 'COMPANY'>('EMPLOYEE');
  const [beneficiaryEmployeeId, setBeneficiaryEmployeeId] = useState(myEmpIdStr ?? '');
  const [beneficiaryDepartmentId, setBeneficiaryDepartmentId] = useState('');
  const [beneficiaryLocationId, setBeneficiaryLocationId] = useState('');
  const [allocLines, setAllocLines] = useState<AllocLineForm[]>([newAllocLine()]);
  const [allocAttachmentNote, setAllocAttachmentNote] = useState('');
  const [allocFile, setAllocFile] = useState<File | null>(null);
  const [allocBusy, setAllocBusy] = useState(false);

  const submitAllocation = async () => {
    if (!allocReason.trim()) return toast.error('Nhập lý do');
    if (allocLines.length === 0) return toast.error('Thêm ít nhất một dòng');
    for (const line of allocLines) {
      if (line.lineType === 'CONSUMABLE') {
        if (!line.itemId) return toast.error('Chọn mã vật tư cho mọi dòng vật tư');
        if (line.quantity < 1) return toast.error('Số lượng vật tư không hợp lệ');
      } else if (!line.assetLineId) {
        return toast.error('Chọn dòng tài sản cho mọi dòng thiết bị');
      }
    }
    const reqEid = requireEmployeeId();
    if (reqEid == null) return;
    if (assigneeType === 'EMPLOYEE') {
      const be = canSetExtendedAssignee && beneficiaryEmployeeId ? Number(beneficiaryEmployeeId) : reqEid;
      if (!Number.isFinite(be)) return toast.error('Chọn nhân viên nhận');
    }
    if (assigneeType === 'DEPARTMENT' && !beneficiaryDepartmentId) return toast.error('Chọn phòng ban nhận');
    if (assigneeType === 'LOCATION' && !beneficiaryLocationId) return toast.error('Chọn vị trí / khu vực nhận');

    setAllocBusy(true);
    try {
      let fileUrl: string | undefined;
      if (allocFile) {
        const fd = new FormData();
        fd.append('file', allocFile);
        const up = await apiPostMultipart<{ url?: string }>('/api/allocation-request-attachments', fd);
        fileUrl = up?.url;
        if (!fileUrl) throw new Error('Upload không trả URL');
      }
      const noteParts: string[] = [];
      if (allocAttachmentNote.trim()) noteParts.push(allocAttachmentNote.trim());
      if (fileUrl) noteParts.push(`FILE:${fileUrl}`);

      const body: Record<string, unknown> = {
        code: makeBizCode('AR'),
        requestDate: new Date().toISOString(),
        reason: allocReason.trim(),
        status: 'PENDING',
        assigneeType,
        requester: { id: reqEid },
        attachmentNote: noteParts.length > 0 ? noteParts.join('\n') : undefined,
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
        const payload: Record<string, unknown> = {
          lineNo: lineNo++,
          lineType: line.lineType,
          quantity: line.lineType === 'CONSUMABLE' ? line.quantity : 1,
          request: { id: created.id },
        };
        if (line.lineType === 'CONSUMABLE') {
          payload.assetItem = { id: Number(line.itemId) };
        } else {
          payload.assetLine = { id: Number(line.assetLineId) };
        }
        await apiPost('/api/allocation-request-lines', payload);
      }
      toast.success('Đã gửi yêu cầu cấp phát');
      await qc.invalidateQueries({ queryKey: ['api', 'allocation-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'return-requests-view'] });
      navigate(requestsListPath('allocation'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setAllocBusy(false);
    }
  };

  // ===== Repair form state =====
  const [repairEqId, setRepairEqId] = useState('');
  const [repairIssue, setRepairIssue] = useState('');
  const [repairDesc, setRepairDesc] = useState('');
  const [repairAttachment, setRepairAttachment] = useState('');
  const [repairFile, setRepairFile] = useState<File | null>(null);
  const [repairBusy, setRepairBusy] = useState(false);

  const submitRepair = async () => {
    if (!repairEqId) return toast.error('Chọn thiết bị');
    if (!repairIssue.trim()) return toast.error('Nhập vấn đề / danh mục');
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
      await qc.invalidateQueries({ queryKey: ['api', 'allocation-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'return-requests-view'] });
      navigate(requestsListPath('repair'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setRepairBusy(false);
    }
  };

  // ===== Return form state =====
  const [retNote, setRetNote] = useState('');
  const [retSelected, setRetSelected] = useState<Record<string, boolean>>({});
  const [retBusy, setRetBusy] = useState(false);
  const toggleRet = (id: string) => setRetSelected(p => ({ ...p, [id]: !p[id] }));

  const submitReturn = async () => {
    const ids = Object.entries(retSelected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return toast.error('Chọn ít nhất một thiết bị');
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
      await qc.invalidateQueries({ queryKey: ['api', 'allocation-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'return-requests-view'] });
      navigate(requestsListPath('return'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setRetBusy(false);
    }
  };

  const backTo = requestsListPath(kind);

  return (
    <div className="page-container max-w-none w-full pb-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 min-w-0">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link to={backTo}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Quay lại danh sách
            </Link>
          </Button>
          <h1 className="page-title">Tạo yêu cầu</h1>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(160px,200px)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <Card className="lg:sticky lg:top-6 h-fit shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Loại yêu cầu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs
              value={kind}
              onValueChange={v => {
                const k = v as RequestKind;
                setKind(k);
                setSp(prev => {
                  const next = new URLSearchParams(prev);
                  next.set('kind', k);
                  return next;
                });
              }}
            >
              <TabsList className="flex h-auto w-full flex-col items-stretch gap-1 p-1">
                <TabsTrigger className="w-full justify-start" value="allocation">
                  Cấp phát
                </TabsTrigger>
                <TabsTrigger className="w-full justify-start" value="repair">
                  Sửa chữa
                </TabsTrigger>
                <TabsTrigger className="w-full justify-start" value="return">
                  Thu hồi
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="min-w-0 w-full shadow-sm lg:justify-self-stretch">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <CardTitle className="text-base text-primary">
                {kind === 'allocation' ? 'Yêu cầu cấp phát' : kind === 'repair' ? 'Yêu cầu sửa chữa' : 'Yêu cầu thu hồi'}
              </CardTitle>
              {kind === 'allocation' && (
                <div
                  className="shrink-0 text-right text-sm sm:max-w-[min(100%,20rem)]"
                  aria-readonly
                >
                  {allocationRequesterSummary.state === 'loading' && (
                    <div className="text-muted-foreground">Đang tải…</div>
                  )}
                  {allocationRequesterSummary.state === 'none' && (
                    <div className="text-muted-foreground">Chưa liên kết nhân viên</div>
                  )}
                  {allocationRequesterSummary.state === 'missing' && (
                    <div className="text-muted-foreground">Không tìm thấy nhân viên</div>
                  )}
                  {allocationRequesterSummary.state === 'ok' && (
                    <div className="font-medium text-foreground">
                      <span className="font-mono tabular-nums">{allocationRequesterSummary.code}</span>
                      <span className="mx-1.5 text-muted-foreground">—</span>
                      <span>{allocationRequesterSummary.name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {kind === 'allocation' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Lý do</Label>
                  <Textarea value={allocReason} onChange={e => setAllocReason(e.target.value)} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Link / ghi chú đính kèm (tùy chọn)</Label>
                  <Textarea
                    value={allocAttachmentNote}
                    onChange={e => setAllocAttachmentNote(e.target.value)}
                    rows={2}
                    placeholder="VD: URL ảnh, mô tả file…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tải ảnh, PDF hoặc video (tùy chọn, tối đa ~50 MB)</Label>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                    onChange={e => setAllocFile(e.target.files?.[0] ?? null)}
                  />
                  {allocFile ? <p className="text-xs text-muted-foreground">Đã chọn: {allocFile.name}</p> : null}
                </div>

                {canSetExtendedAssignee ? (
                  <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                    <div className="space-y-2">
                      <Label>Đối tượng được cấp</Label>
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
                            {(allEmpQ.data ?? []).map(e => {
                              const code = (e.code ?? '').trim() || String(e.id ?? '');
                              const name = (e.fullName ?? '').trim() || '—';
                              return (
                                <SelectItem key={e.id} value={String(e.id ?? '')}>
                                  {code} - {name}
                                </SelectItem>
                              );
                            })}
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
                      <p className="text-xs text-muted-foreground">Tài sản dùng chung toàn công ty.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Đối tượng nhận: <strong>bạn</strong>. Điều phối phòng ban / QLTS có thể chọn phòng ban hoặc vị trí.
                  </p>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Các tài sản yêu cầu</Label>
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
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setAllocLines(p => p.filter(l => l.localId !== line.localId))}
                            >
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
                                  ? { ...l, lineType: v as 'CONSUMABLE' | 'DEVICE', itemId: '', assetLineId: '' }
                                  : l,
                              ),
                            )
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CONSUMABLE">Vật tư</SelectItem>
                            <SelectItem value="DEVICE">Thiết bị</SelectItem>
                          </SelectContent>
                        </Select>
                        {line.lineType === 'CONSUMABLE' ? (
                          <Select
                            value={line.itemId || undefined}
                            onValueChange={v =>
                              setAllocLines(p => p.map(l => (l.localId === line.localId ? { ...l, itemId: v } : l)))
                            }
                          >
                            <SelectTrigger><SelectValue placeholder="Chọn mã vật tư" /></SelectTrigger>
                            <SelectContent>
                              {consumableItems.map(i => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.code} — {i.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Dòng tài sản (QLTS sẽ chọn thiết bị cụ thể khi duyệt)</Label>
                            <SearchableSelect
                              value={line.assetLineId}
                              onValueChange={v =>
                                setAllocLines(p => p.map(l => (l.localId === line.localId ? { ...l, assetLineId: v } : l)))
                              }
                              options={deviceAssetLineOptions}
                              placeholder="Chọn dòng tài sản…"
                              searchPlaceholder="Tìm mã, tên dòng…"
                              emptyText="Không có dòng thiết bị phù hợp"
                              triggerClassName="w-full"
                            />
                          </div>
                        )}
                        {line.lineType === 'CONSUMABLE' && (
                          <Input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={e =>
                              setAllocLines(p =>
                                p.map(l => (l.localId === line.localId ? { ...l, quantity: Math.max(1, Number(e.target.value)) } : l)),
                              )
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-end pt-2">
                  <Button variant="outline" asChild disabled={allocBusy}>
                    <Link to={backTo}>Hủy</Link>
                  </Button>
                  <Button onClick={() => void submitAllocation()} disabled={allocBusy}>
                    {allocBusy ? 'Đang gửi…' : 'Gửi'}
                  </Button>
                </div>
              </div>
            )}

            {kind === 'repair' && (
              <div className="space-y-4">
                {myEquipment.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Bạn không có thiết bị đang gán — không thể tạo yêu cầu sửa chữa.</p>
                ) : (
                  <>
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
                      {repairFile ? <p className="text-xs text-muted-foreground">Đã chọn: {repairFile.name}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end pt-2">
                      <Button variant="outline" asChild disabled={repairBusy}>
                        <Link to={backTo}>Hủy</Link>
                      </Button>
                      <Button onClick={() => void submitRepair()} disabled={repairBusy || myEquipment.length === 0}>
                        {repairBusy ? 'Đang gửi…' : 'Gửi'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {kind === 'return' && (
              <div className="space-y-4">
                {myEquipment.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Bạn không có thiết bị đang gán.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Ghi chú</Label>
                      <Textarea value={retNote} onChange={e => setRetNote(e.target.value)} rows={2} />
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto border rounded-md p-2">
                      {myEquipment.map(e => (
                        <label key={e.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                          <input type="checkbox" checked={!!retSelected[e.id]} onChange={() => toggleRet(e.id)} />
                          <span className="font-mono">{formatEquipmentCodeDisplay(e.equipmentCode)}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end pt-2">
                      <Button variant="outline" asChild disabled={retBusy}>
                        <Link to={backTo}>Hủy</Link>
                      </Button>
                      <Button onClick={() => void submitReturn()} disabled={retBusy || myEquipment.length === 0}>
                        {retBusy ? 'Đang gửi…' : 'Gửi'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

