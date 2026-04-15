import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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

import { resolveEmployeeIdForRequests } from '@/api/account';
import { apiDelete, apiGet, apiPatch, apiPost, apiPostMultipart, getStoredToken, PAGE_ALL } from '@/api/http';
import { hasAnyAuthority } from '@/auth/jwt';
import { makeBizCode } from '@/api/businessCode';
import { RequiredMark } from '@/components/shared/RequiredMark';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import {
  mapAssetItemDto,
  useAssetItems,
  useAssetLines,
  useDepartments,
  useEmployees,
  useLocations,
} from '@/hooks/useEntityApi';
import { requestsListPath } from './requestNewPaths';
import { PageLoading } from '@/components/shared/page-loading';

type AllocConsumableLine = {
  localId: string;
  lineType: 'CONSUMABLE';
  assetLineId: string;
  /** null = ô trống, người dùng tự nhập (không gán mặc định 1). */
  quantity: number | null;
};

type AllocDeviceLine = {
  localId: string;
  lineType: 'DEVICE';
  assetLineId: string;
  quantity: number | null;
};

const newConsumableLine = (): AllocConsumableLine => ({
  localId: `L-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  lineType: 'CONSUMABLE',
  assetLineId: '',
  quantity: null,
});

const newDeviceLine = (): AllocDeviceLine => ({
  localId: `L-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  lineType: 'DEVICE',
  assetLineId: '',
  quantity: null,
});

function parseAllocQuantityInput(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Math.floor(Number(t));
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

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
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const isAdminArea = location.pathname.startsWith('/admin');
  const backTo = requestsListPath('allocation', isAdminArea);
  const editId = searchParams.get('editId')?.trim() || '';
  const isEditMode = editId.length > 0;

  const iQ = useAssetItems();
  const depQ = useDepartments();
  const locQ = useLocations();
  const allEmpQ = useEmployees();
  const linesQ = useAssetLines();

  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const consumableAssetLineOptions = useMemo(() => {
    const raw = linesQ.data ?? [];
    const byLineType = raw.filter(
      l => (l.assetType ?? l.assetGroup?.assetType ?? '').toUpperCase() === 'CONSUMABLE' && l.active !== false,
    );
    const consumableLines =
      byLineType.length > 0
        ? byLineType
        : raw.filter(l => {
            if (l.active === false) return false;
            const id = String(l.id ?? '');
            return assetItems.some(i => i.managementType === 'CONSUMABLE' && i.lineId === id);
          });
    return consumableLines.map(l => {
      const id = String(l.id ?? '');
      const code = (l.code ?? '').trim() || id;
      const name = (l.name ?? '').trim() || '—';
      return {
        value: id,
        label: name,
        searchText: `${code} ${name} ${(l.description ?? '').trim()}`,
      };
    });
  }, [linesQ.data, assetItems]);
  const deviceAssetLineOptions = useMemo(() => {
    const raw = linesQ.data ?? [];
    const byLineType = raw.filter(
      l => (l.assetType ?? l.assetGroup?.assetType ?? '').toUpperCase() === 'DEVICE' && l.active !== false,
    );
    /** Fallback: BE cũ / thiếu assetType trên dòng — suy ra từ mã hàng thiết bị gắn dòng */
    const deviceLines =
      byLineType.length > 0
        ? byLineType
        : raw.filter(l => {
            if (l.active === false) return false;
            const id = String(l.id ?? '');
            return assetItems.some(i => i.managementType === 'DEVICE' && i.lineId === id);
          });
    return deviceLines.map(l => {
      const id = String(l.id ?? '');
      const code = (l.code ?? '').trim() || id;
      const name = (l.name ?? '').trim() || '—';
      return {
        value: id,
        label: name,
        searchText: `${code} ${name} ${(l.description ?? '').trim()}`,
      };
    });
  }, [linesQ.data, assetItems]);

  const myEmpIdStr = resolveEmployeeIdForRequests();
  const allocationRequesterSummary = useMemo(() => {
    if (!myEmpIdStr) return { state: 'none' as const };
    if (!allEmpQ.data) return { state: 'loading' as const };
    const me = allEmpQ.data.find(x => String(x.id) === myEmpIdStr);
    if (!me) return { state: 'missing' as const };
    const code = (me.code ?? '').trim() || String(me.id ?? '');
    const name = (me.fullName ?? '').trim() || '—';
    const jobTitle = (me.jobTitle ?? '').trim() || '—';
    const departmentName = (me.department?.name ?? '').trim() || '—';
    return { state: 'ok' as const, code, name, jobTitle, departmentName };
  }, [myEmpIdStr, allEmpQ.data]);

  const token = getStoredToken();
  const isAdminOrAssetMgr = hasAnyAuthority(token, ['ROLE_ADMIN', 'ROLE_ASSET_MANAGER']);
  const canFullEditRequest = hasAnyAuthority(token, ['ROLE_ADMIN', 'ROLE_ASSET_MANAGER', 'ROLE_GD']);
  const isDeptCoordinator = hasAnyAuthority(token, ['ROLE_DEPARTMENT_COORDINATOR']);
  /** Điều phối PB: được chọn đối tượng nhưng chỉ trong phạm vi phòng ban mình (không có quyền QLTS/Admin). */
  const restrictAssigneeToDeptScope = isDeptCoordinator && !isAdminOrAssetMgr;
  const canSetExtendedAssignee = isAdminOrAssetMgr || isDeptCoordinator;

  const myDepartmentIdStr = useMemo(() => {
    if (!myEmpIdStr || !allEmpQ.data) return '';
    const me = allEmpQ.data.find(x => String(x.id) === myEmpIdStr);
    return me?.department?.id != null ? String(me.department.id) : '';
  }, [myEmpIdStr, allEmpQ.data]);

  const myDepartmentLabel = useMemo(() => {
    if (!myDepartmentIdStr || !depQ.data) return '';
    const d = depQ.data.find(x => String(x.id) === myDepartmentIdStr);
    if (!d) return myDepartmentIdStr;
    return `${(d.code ?? '').trim() || d.id} — ${(d.name ?? '').trim() || '—'}`;
  }, [myDepartmentIdStr, depQ.data]);

  const [allocReason, setAllocReason] = useState('');
  const [assigneeType, setAssigneeType] = useState<'EMPLOYEE' | 'DEPARTMENT' | 'LOCATION' | 'COMPANY'>('EMPLOYEE');
  const [beneficiaryEmployeeId, setBeneficiaryEmployeeId] = useState(myEmpIdStr ?? '');
  const [beneficiaryDepartmentId, setBeneficiaryDepartmentId] = useState('');
  const [beneficiaryLocationId, setBeneficiaryLocationId] = useState('');
  const [consumableLines, setConsumableLines] = useState<AllocConsumableLine[]>([]);
  const [deviceLines, setDeviceLines] = useState<AllocDeviceLine[]>([]);
  const [allocFile, setAllocFile] = useState<File | null>(null);
  const [allocBusy, setAllocBusy] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [editBootstrapLoading, setEditBootstrapLoading] = useState(false);

  /** Danh sách chọn «Nhân viên nhận»: không bao gồm chính người tạo YC; điều phối PB thì thêm lọc cùng phòng ban. */
  const employeesForAssigneeSelect = useMemo(() => {
    const all = allEmpQ.data ?? [];
    if (assigneeType !== 'EMPLOYEE') return all;
    let list = all;
    if (restrictAssigneeToDeptScope && myDepartmentIdStr) {
      list = list.filter(e => String(e.department?.id ?? '') === myDepartmentIdStr);
    }
    if (myEmpIdStr && !isEditMode) {
      list = list.filter(e => String(e.id ?? '') !== myEmpIdStr);
    }
    return list;
  }, [allEmpQ.data, restrictAssigneeToDeptScope, myDepartmentIdStr, assigneeType, myEmpIdStr, isEditMode]);

  useEffect(() => {
    if (!restrictAssigneeToDeptScope) return;
    if (assigneeType === 'LOCATION' || assigneeType === 'COMPANY') {
      setAssigneeType('EMPLOYEE');
      setBeneficiaryEmployeeId('');
    }
  }, [restrictAssigneeToDeptScope, assigneeType]);

  useEffect(() => {
    if (!restrictAssigneeToDeptScope || assigneeType !== 'DEPARTMENT') return;
    if (myDepartmentIdStr) setBeneficiaryDepartmentId(myDepartmentIdStr);
  }, [restrictAssigneeToDeptScope, assigneeType, myDepartmentIdStr]);

  useEffect(() => {
    if (!canSetExtendedAssignee || assigneeType !== 'EMPLOYEE') return;
    const ok = employeesForAssigneeSelect.some(e => String(e.id ?? '') === beneficiaryEmployeeId);
    if (!ok) {
      const first = employeesForAssigneeSelect[0];
      setBeneficiaryEmployeeId(first != null && first.id != null ? String(first.id) : '');
    }
  }, [canSetExtendedAssignee, assigneeType, employeesForAssigneeSelect, beneficiaryEmployeeId]);

  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;
    (async () => {
      setEditBootstrapLoading(true);
      try {
        const [req, lines] = await Promise.all([
          apiGet<any>(`/api/allocation-requests/${editId}`),
          apiGet<any[]>(`/api/allocation-request-lines?${PAGE_ALL}`),
        ]);
        if (cancelled) return;
        setAllocReason(req?.reason ?? '');
        setAssigneeType((req?.assigneeType ?? 'EMPLOYEE') as 'EMPLOYEE' | 'DEPARTMENT' | 'LOCATION' | 'COMPANY');
        setBeneficiaryEmployeeId(
          req?.beneficiaryEmployee?.id != null
            ? String(req.beneficiaryEmployee.id)
            : req?.assigneeType === 'EMPLOYEE'
              ? (myEmpIdStr ?? '')
              : '',
        );
        setBeneficiaryDepartmentId(req?.beneficiaryDepartment?.id != null ? String(req.beneficiaryDepartment.id) : '');
        setBeneficiaryLocationId(req?.beneficiaryLocation?.id != null ? String(req.beneficiaryLocation.id) : '');
        const mine = (lines ?? [])
          .filter(l => String(l.request?.id ?? '') === String(editId))
          .sort((a, b) => Number(a.lineNo ?? 0) - Number(b.lineNo ?? 0));
        setConsumableLines(
          mine
            .filter(l => String(l.lineType ?? '').toUpperCase() === 'CONSUMABLE')
            .map(l => ({
              localId: `E-${l.id}-${Math.random().toString(36).slice(2, 7)}`,
              lineType: 'CONSUMABLE' as const,
              assetLineId: l.assetLine?.id != null ? String(l.assetLine.id) : '',
              quantity: Number(l.quantity ?? 1),
            })),
        );
        setDeviceLines(
          mine
            .filter(l => String(l.lineType ?? '').toUpperCase() !== 'CONSUMABLE')
            .map(l => ({
              localId: `E-${l.id}-${Math.random().toString(36).slice(2, 7)}`,
              lineType: 'DEVICE' as const,
              assetLineId: l.assetLine?.id != null ? String(l.assetLine.id) : '',
              quantity: Number(l.quantity ?? 1),
            })),
        );
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Không tải được dữ liệu yêu cầu để sửa');
      } finally {
        if (!cancelled) setEditBootstrapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, editId, myEmpIdStr]);

  const submitAllocation = async () => {
    const isLimitedEdit = isEditMode && !canFullEditRequest;
    if (!allocReason.trim()) return toast.error('Nhập lý do');
    if (consumableLines.length === 0 && deviceLines.length === 0) {
      return toast.error('Thêm ít nhất một dòng vật tư hoặc thiết bị');
    }
    for (const line of consumableLines) {
      if (!line.assetLineId) return toast.error('Chọn tên dòng vật tư cho mọi dòng vật tư');
      if (line.quantity == null || line.quantity < 1) {
        return toast.error('Nhập số lượng vật tư (số nguyên ≥ 1) cho mọi dòng vật tư');
      }
    }
    for (const line of deviceLines) {
      if (!line.assetLineId) return toast.error('Chọn tên dòng thiết bị cho mọi dòng thiết bị');
      if (line.quantity == null || line.quantity < 1) {
        return toast.error('Nhập số lượng thiết bị (số nguyên ≥ 1) cho mọi dòng thiết bị');
      }
    }
    const reqEid = isEditMode ? Number.NaN : requireEmployeeId();
    if (!isEditMode && reqEid == null) return;
    if (!isLimitedEdit && assigneeType === 'EMPLOYEE') {
      if (!isEditMode && canSetExtendedAssignee) {
        if (employeesForAssigneeSelect.length === 0) {
          return toast.error('Không có nhân viên nhận hợp lệ (đã loại trừ tài khoản của bạn).');
        }
        if (!beneficiaryEmployeeId) return toast.error('Chọn nhân viên nhận');
      }
      const be = canSetExtendedAssignee
        ? Number(beneficiaryEmployeeId || (isEditMode ? myEmpIdStr ?? '' : ''))
        : reqEid;
      if (!isEditMode && !Number.isFinite(be)) return toast.error('Chọn nhân viên nhận');
      if (!isEditMode && canSetExtendedAssignee && be === reqEid) {
        return toast.error('Nhân viên nhận không được là chính bạn — chọn đồng nghiệp hoặc đối tượng Phòng ban.');
      }
      if (restrictAssigneeToDeptScope) {
        if (isEditMode && !Number.isFinite(be)) {
          // Keep legacy assignee on edit when beneficiaryEmployee is absent.
        } else {
        if (!myDepartmentIdStr) return toast.error('Tài khoản chưa gán phòng ban.');
        const emp = (allEmpQ.data ?? []).find(x => Number(x.id) === be);
        if (!emp || String(emp.department?.id ?? '') !== myDepartmentIdStr) {
          return toast.error('Chỉ được chọn nhân viên cùng phòng ban.');
        }
        }
      }
    }
    if (!isLimitedEdit && assigneeType === 'DEPARTMENT') {
      if (restrictAssigneeToDeptScope) {
        if (!myDepartmentIdStr) return toast.error('Tài khoản chưa gán phòng ban.');
      } else if (!beneficiaryDepartmentId) {
        return toast.error('Chọn phòng ban nhận');
      }
    }
    if (!isLimitedEdit && assigneeType === 'LOCATION' && !beneficiaryLocationId) return toast.error('Chọn vị trí / khu vực nhận');

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
      const body: Record<string, unknown> = isLimitedEdit
        ? {
            reason: allocReason.trim(),
            attachmentNote: fileUrl ? `FILE:${fileUrl}` : undefined,
          }
        : {
            reason: allocReason.trim(),
            assigneeType,
            attachmentNote: fileUrl ? `FILE:${fileUrl}` : undefined,
          };
      if (!isEditMode) {
        body.code = makeBizCode('AR');
        body.requestDate = new Date().toISOString();
        body.status = 'PENDING';
        body.requester = { id: reqEid };
      }
      if (!isLimitedEdit && assigneeType === 'EMPLOYEE') {
        const be =
          canSetExtendedAssignee || isEditMode
            ? Number(beneficiaryEmployeeId || (isEditMode ? myEmpIdStr ?? '' : ''))
            : reqEid;
        if (!Number.isFinite(be)) {
          if (!isEditMode) return toast.error('Chọn nhân viên nhận');
        } else {
          body.beneficiaryEmployee = { id: be };
        }
      } else if (!isLimitedEdit && assigneeType === 'DEPARTMENT') {
        const deptId = restrictAssigneeToDeptScope ? myDepartmentIdStr : beneficiaryDepartmentId;
        body.beneficiaryDepartment = { id: Number(deptId) };
        if (restrictAssigneeToDeptScope && Number.isFinite(reqEid)) {
          body.beneficiaryEmployee = { id: reqEid };
        }
      } else if (!isLimitedEdit && assigneeType === 'LOCATION') {
        body.beneficiaryLocation = { id: Number(beneficiaryLocationId) };
      }

      let requestId: number;
      if (isEditMode) {
        requestId = Number(editId);
        await apiPatch(`/api/allocation-requests/${requestId}`, { id: requestId, ...body });
        const oldLines = await apiGet<any[]>(`/api/allocation-request-lines?${PAGE_ALL}`);
        const mine = oldLines.filter(l => String(l.request?.id ?? '') === String(requestId));
        for (const l of mine) {
          if (l.id != null) await apiDelete(`/api/allocation-request-lines/${l.id}`);
        }
      } else {
        const created = await apiPost<{ id: number }>('/api/allocation-requests', body);
        requestId = created.id;
      }
      let lineNo = 1;
      for (const line of consumableLines) {
        const payload: Record<string, unknown> = {
          lineNo: lineNo++,
          lineType: 'CONSUMABLE',
          quantity: line.quantity,
          request: { id: requestId },
          assetLine: { id: Number(line.assetLineId) },
        };
        await apiPost('/api/allocation-request-lines', payload);
      }
      for (const line of deviceLines) {
        const payload: Record<string, unknown> = {
          lineNo: lineNo++,
          lineType: 'DEVICE',
          quantity: line.quantity,
          request: { id: requestId },
          assetLine: { id: Number(line.assetLineId) },
        };
        await apiPost('/api/allocation-request-lines', payload);
      }
      toast.success(isEditMode ? 'Đã cập nhật yêu cầu cấp phát' : 'Đã gửi yêu cầu cấp phát');
      await qc.invalidateQueries({ queryKey: ['api', 'allocation-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'return-requests-view'] });
      navigate(backTo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setAllocBusy(false);
    }
  };

  const formBootstrapLoading =
    iQ.isLoading || depQ.isLoading || locQ.isLoading || allEmpQ.isLoading || linesQ.isLoading || editBootstrapLoading;

  return (
    <div className="page-container max-w-none w-full pb-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit"
            type="button"
            onClick={() => setCancelConfirmOpen(true)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Quay lại danh sách
          </Button>
          <h1 className="page-title">{isEditMode ? 'Sửa yêu cầu cấp phát' : 'Tạo yêu cầu cấp phát'}</h1>
        </div>
      </header>

      <Card className="mt-6 w-full max-w-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary">Phiếu yêu cầu cấp phát</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {formBootstrapLoading ? (
            <PageLoading label="Đang tải danh mục và dữ liệu…" minHeight="min-h-[40vh]" />
          ) : (
          <>
          <div
            className="rounded-lg border border-border/80 bg-muted/30 p-4 pointer-events-none select-none opacity-[0.92]"
            aria-readonly
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Mã người dùng</div>
                <div className="mt-0.5 text-sm text-foreground/90 font-mono tabular-nums">
                  {allocationRequesterSummary.state === 'loading' && '…'}
                  {allocationRequesterSummary.state === 'none' && '—'}
                  {allocationRequesterSummary.state === 'missing' && '—'}
                  {allocationRequesterSummary.state === 'ok' && allocationRequesterSummary.code}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Họ và tên</div>
                <div className="mt-0.5 text-sm text-foreground/90">
                  {allocationRequesterSummary.state === 'loading' && '…'}
                  {allocationRequesterSummary.state === 'none' && (
                    <span className="text-muted-foreground">Chưa liên kết nhân viên</span>
                  )}
                  {allocationRequesterSummary.state === 'missing' && (
                    <span className="text-muted-foreground">Không tìm thấy nhân viên</span>
                  )}
                  {allocationRequesterSummary.state === 'ok' && allocationRequesterSummary.name}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Chức danh</div>
                <div className="mt-0.5 text-sm text-foreground/90">
                  {allocationRequesterSummary.state === 'loading' && '…'}
                  {(allocationRequesterSummary.state === 'none' ||
                    allocationRequesterSummary.state === 'missing') &&
                    '—'}
                  {allocationRequesterSummary.state === 'ok' && allocationRequesterSummary.jobTitle}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Phòng ban</div>
                <div className="mt-0.5 text-sm text-foreground/90">
                  {allocationRequesterSummary.state === 'loading' && '…'}
                  {(allocationRequesterSummary.state === 'none' ||
                    allocationRequesterSummary.state === 'missing') &&
                    '—'}
                  {allocationRequesterSummary.state === 'ok' && allocationRequesterSummary.departmentName}
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>
              Lý do
              <RequiredMark />
            </Label>
            <Textarea value={allocReason} onChange={e => setAllocReason(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Tài liệu đính kèm (tối đa 50 MB)</Label>
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
                <Label>
                  Đối tượng được cấp
                  <RequiredMark />
                </Label>
                <Select
                  value={assigneeType}
                  onValueChange={v => {
                    const t = v as typeof assigneeType;
                    setAssigneeType(t);
                    if (t === 'EMPLOYEE') setBeneficiaryEmployeeId('');
                    if (restrictAssigneeToDeptScope && t === 'DEPARTMENT' && myDepartmentIdStr) {
                      setBeneficiaryDepartmentId(myDepartmentIdStr);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Nhân viên</SelectItem>
                    <SelectItem value="DEPARTMENT">Phòng ban</SelectItem>
                    {!restrictAssigneeToDeptScope ? (
                      <>
                        <SelectItem value="LOCATION">Vị trí / khu vực</SelectItem>
                        <SelectItem value="COMPANY">Toàn công ty</SelectItem>
                      </>
                    ) : null}
                  </SelectContent>
                </Select>
                {restrictAssigneeToDeptScope ? (
                  <p className="text-xs text-muted-foreground">
                    Vai trò điều phối phòng ban: chỉ chọn nhân viên hoặc phòng ban (phòng ban nhận cố định là phòng ban của bạn).
                  </p>
                ) : null}
              </div>

              {assigneeType === 'EMPLOYEE' && (
                <div className="space-y-2">
                  <Label>
                    Nhân viên nhận
                    <RequiredMark />
                  </Label>
                  {employeesForAssigneeSelect.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {restrictAssigneeToDeptScope
                        ? 'Không có nhân viên nào khác cùng phòng ban (đã loại trừ bạn).'
                        : 'Không có nhân viên nào khác để chọn (đã loại trừ tài khoản của bạn).'}
                    </p>
                  ) : (
                    <Select value={beneficiaryEmployeeId || undefined} onValueChange={setBeneficiaryEmployeeId}>
                      <SelectTrigger><SelectValue placeholder="Chọn nhân viên" /></SelectTrigger>
                      <SelectContent>
                        {employeesForAssigneeSelect.map(e => {
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
                  )}
                  <p className="text-xs text-muted-foreground">
                    {restrictAssigneeToDeptScope
                      ? 'Chỉ nhân viên cùng phòng ban; không gồm chính bạn.'
                      : 'Danh sách không gồm chính bạn — dùng để cấp cho đồng nghiệp.'}
                  </p>
                </div>
              )}
              {assigneeType === 'DEPARTMENT' && (
                <div className="space-y-2">
                  <Label>
                    Phòng ban nhận
                    <RequiredMark />
                  </Label>
                  {restrictAssigneeToDeptScope ? (
                    <>
                      <p className="text-sm font-medium text-foreground">{myDepartmentLabel || '—'}</p>
                      <p className="text-xs text-muted-foreground">Cố định theo phòng ban của bạn.</p>
                    </>
                  ) : (
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
                  )}
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {restrictAssigneeToDeptScope ? (
                      <>
                        Phòng ban nhận là đơn vị trên chứng từ; <span className="font-medium text-foreground">bạn (điều phối)</span>{' '}
                        là người nhận bàn giao tài sản sau khi duyệt — QLTS không cần chọn thêm người nhận.
                      </>
                    ) : (
                      <>
                        Đối tượng nhận là <span className="font-medium text-foreground">phòng ban</span> trên phiếu xuất;
                        bàn giao có thể gắn phòng ban (hoặc theo cấu hình QLTS).
                      </>
                    )}
                  </p>
                </div>
              )}
              {assigneeType === 'LOCATION' && (
                <div className="space-y-2">
                  <Label>
                    Vị trí / khu vực nhận
                    <RequiredMark />
                  </Label>
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
          ) : null}

          <div className="space-y-6">
            <div className="space-y-1">
              <Label className="text-base font-semibold">
                Các tài sản yêu cầu
                <RequiredMark />
              </Label>
              <p className="text-xs text-muted-foreground">
                Vật tư: tên dòng + số lượng. Thiết bị: tên dòng + số lượng.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Phần 1: Vật tư */}
            <div className="space-y-2 rounded-lg border bg-card p-4 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">Vật tư</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConsumableLines(p => [...p, newConsumableLine()])}
                >
                  <PlusCircle className="h-4 w-4 mr-1" /> Thêm dòng
                </Button>
              </div>
              <div className="space-y-3">
                {consumableLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có dòng vật tư. Nhấn «Thêm dòng» để thêm.</p>
                ) : (
                  consumableLines.map(line => (
                    <div key={line.localId} className="rounded-md border border-dashed p-3 bg-muted/20">
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1 min-w-[min(100%,12rem)] flex-1">
                          <Label className="text-xs">
                            Tên dòng
                            <RequiredMark />
                          </Label>
                          <SearchableSelect
                            value={line.assetLineId}
                            onValueChange={v =>
                              setConsumableLines(p => p.map(l => (l.localId === line.localId ? { ...l, assetLineId: v } : l)))
                            }
                            options={consumableAssetLineOptions}
                            placeholder="Chọn tên dòng…"
                            searchPlaceholder="Tìm tên dòng…"
                            emptyText="Không có dòng vật tư phù hợp"
                            triggerClassName="w-full"
                          />
                        </div>
                        <div className="space-y-1 w-full sm:w-28">
                          <Label className="text-xs">
                            Số lượng
                            <RequiredMark />
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            placeholder="Nhập SL"
                            value={line.quantity === null ? '' : line.quantity}
                            onChange={e => {
                              const q = parseAllocQuantityInput(e.target.value);
                              setConsumableLines(p =>
                                p.map(l =>
                                  l.localId === line.localId ? { ...l, quantity: q } : l,
                                ),
                              );
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                          title="Xóa dòng"
                          onClick={() => setConsumableLines(p => p.filter(l => l.localId !== line.localId))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Phần 2: Thiết bị */}
            <div className="space-y-2 rounded-lg border bg-card p-4 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">Thiết bị</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setDeviceLines(p => [...p, newDeviceLine()])}>
                  <PlusCircle className="h-4 w-4 mr-1" /> Thêm dòng
                </Button>
              </div>
              <div className="space-y-3">
                {deviceLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có dòng thiết bị. Nhấn «Thêm dòng» để thêm.</p>
                ) : (
                  deviceLines.map(line => (
                    <div key={line.localId} className="rounded-md border border-dashed p-3 bg-muted/20 space-y-3">
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1 min-w-[min(100%,12rem)] flex-1">
                          <Label className="text-xs">
                            Tên dòng
                            <RequiredMark />
                          </Label>
                          <SearchableSelect
                            value={line.assetLineId}
                            onValueChange={v =>
                              setDeviceLines(p => p.map(l => (l.localId === line.localId ? { ...l, assetLineId: v } : l)))
                            }
                            options={deviceAssetLineOptions}
                            placeholder="Chọn tên dòng…"
                            searchPlaceholder="Tìm tên dòng…"
                            emptyText="Không có dòng thiết bị phù hợp"
                            triggerClassName="w-full"
                          />
                        </div>
                        <div className="space-y-1 w-full sm:w-28">
                          <Label className="text-xs">
                            Số lượng
                            <RequiredMark />
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            placeholder="Nhập SL"
                            value={line.quantity === null ? '' : line.quantity}
                            onChange={e => {
                              const q = parseAllocQuantityInput(e.target.value);
                              setDeviceLines(p =>
                                p.map(l =>
                                  l.localId === line.localId ? { ...l, quantity: q } : l,
                                ),
                              );
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                          title="Xóa dòng"
                          onClick={() => setDeviceLines(p => p.filter(l => l.localId !== line.localId))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setCancelConfirmOpen(true)} disabled={allocBusy}>
              Hủy
            </Button>
            <Button onClick={() => void submitAllocation()} disabled={allocBusy}>
              {allocBusy ? 'Đang lưu…' : isEditMode ? 'Lưu thay đổi' : 'Gửi'}
            </Button>
          </div>
          <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bạn có chắc chắn không?</AlertDialogTitle>
                <AlertDialogDescription>Mọi thay đổi sẽ mất.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Ở lại</AlertDialogCancel>
                <AlertDialogAction onClick={() => navigate(backTo)}>
                  Thoát
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
