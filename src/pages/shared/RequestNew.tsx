import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { resolveEmployeeIdForRequests } from '@/api/account';
import { apiPost, apiPostMultipart, getStoredToken } from '@/api/http';
import { hasAnyAuthority } from '@/auth/jwt';
import { makeBizCode } from '@/api/businessCode';
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

type AllocLineForm = {
  localId: string;
  lineType: 'CONSUMABLE' | 'DEVICE';
  itemId: string;
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
  const isAdminArea = location.pathname.startsWith('/admin');
  const backTo = requestsListPath('allocation', isAdminArea);

  const iQ = useAssetItems();
  const depQ = useDepartments();
  const locQ = useLocations();
  const allEmpQ = useEmployees();
  const linesQ = useAssetLines();

  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const consumableItems = useMemo(() => assetItems.filter(i => i.managementType === 'CONSUMABLE'), [assetItems]);
  const deviceAssetLineOptions = useMemo(() => {
    const raw = linesQ.data ?? [];
    const byGroupType = raw.filter(
      l => (l.assetGroup?.assetType ?? '').toUpperCase() === 'DEVICE' && l.active !== false,
    );
    /** BE từng chỉ map assetGroup { id, name } (thiếu assetType) — suy ra dòng DEVICE từ master mã hàng */
    const deviceLines =
      byGroupType.length > 0
        ? byGroupType
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
        label: `${code} — ${name}`,
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
    return { state: 'ok' as const, code, name };
  }, [myEmpIdStr, allEmpQ.data]);

  const canSetExtendedAssignee = hasAnyAuthority(getStoredToken(), [
    'ROLE_ADMIN',
    'ROLE_ASSET_MANAGER',
    'ROLE_DEPARTMENT_COORDINATOR',
  ]);

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
      navigate(backTo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi API');
    } finally {
      setAllocBusy(false);
    }
  };

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
          <h1 className="page-title">Tạo yêu cầu cấp phát</h1>
        </div>
      </header>

      <Card className="mt-6 w-full max-w-5xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <CardTitle className="text-base text-primary">Phiếu yêu cầu cấp phát</CardTitle>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
