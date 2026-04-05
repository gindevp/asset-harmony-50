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

type AllocLineForm = {
  localId: string;
  lineType: 'CONSUMABLE' | 'DEVICE';
  assetLineId: string;
  quantity: number;
};

const newConsumableLine = (): AllocLineForm => ({
  localId: `L-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  lineType: 'CONSUMABLE',
  assetLineId: '',
  quantity: 1,
});

const newDeviceLine = (): AllocLineForm => ({
  localId: `L-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  lineType: 'DEVICE',
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
  const [consumableLines, setConsumableLines] = useState<AllocLineForm[]>([newConsumableLine()]);
  const [deviceLines, setDeviceLines] = useState<AllocLineForm[]>([newDeviceLine()]);
  const [allocAttachmentNote, setAllocAttachmentNote] = useState('');
  const [allocFile, setAllocFile] = useState<File | null>(null);
  const [allocBusy, setAllocBusy] = useState(false);

  const submitAllocation = async () => {
    if (!allocReason.trim()) return toast.error('Nhập lý do');
    if (consumableLines.length === 0 && deviceLines.length === 0) {
      return toast.error('Thêm ít nhất một dòng vật tư hoặc thiết bị');
    }
    for (const line of consumableLines) {
      if (!line.assetLineId) return toast.error('Chọn tên dòng vật tư cho mọi dòng vật tư');
      if (line.quantity < 1) return toast.error('Số lượng vật tư không hợp lệ');
    }
    for (const line of deviceLines) {
      if (!line.assetLineId) return toast.error('Chọn tên dòng thiết bị cho mọi dòng thiết bị');
      if (line.quantity < 1) return toast.error('Số lượng thiết bị không hợp lệ');
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
      for (const line of consumableLines) {
        const payload: Record<string, unknown> = {
          lineNo: lineNo++,
          lineType: 'CONSUMABLE',
          quantity: line.quantity,
          request: { id: created.id },
          assetLine: { id: Number(line.assetLineId) },
        };
        await apiPost('/api/allocation-request-lines', payload);
      }
      for (const line of deviceLines) {
        const n = Math.max(1, Math.floor(Number(line.quantity)));
        for (let i = 0; i < n; i++) {
          const payload: Record<string, unknown> = {
            lineNo: lineNo++,
            lineType: 'DEVICE',
            quantity: 1,
            request: { id: created.id },
            assetLine: { id: Number(line.assetLineId) },
          };
          await apiPost('/api/allocation-request-lines', payload);
        }
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

      <Card className="mt-6 w-full max-w-none shadow-sm">
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
            <Label>
              Lý do
              <RequiredMark />
            </Label>
            <Textarea value={allocReason} onChange={e => setAllocReason(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Ghi chú</Label>
            <Textarea
              value={allocAttachmentNote}
              onChange={e => setAllocAttachmentNote(e.target.value)}
              rows={2}
              placeholder="VD: URL ảnh, mô tả file…"
            />
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
                  <Label>
                    Nhân viên nhận
                    <RequiredMark />
                  </Label>
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
                  <Label>
                    Phòng ban nhận
                    <RequiredMark />
                  </Label>
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
              <p className="text-xs text-muted-foreground">Cần ít nhất một dòng vật tư hoặc thiết bị hợp lệ (tên dòng và số lượng).</p>
            </div>

            {/* Phần 1: Vật tư */}
            <div className="space-y-2 rounded-lg border bg-card p-4">
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
                  consumableLines.map((line, idx) => (
                    <div key={line.localId} className="space-y-2 rounded-md border border-dashed p-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Dòng {idx + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                          title="Xóa dòng"
                          onClick={() => setConsumableLines(p => p.filter(l => l.localId !== line.localId))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
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
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Số lượng
                            <RequiredMark />
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={e =>
                              setConsumableLines(p =>
                                p.map(l =>
                                  l.localId === line.localId
                                    ? { ...l, quantity: Math.max(1, Number(e.target.value) || 1) }
                                    : l,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Phần 2: Thiết bị văn phòng */}
            <div className="space-y-2 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">Thiết bị văn phòng</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setDeviceLines(p => [...p, newDeviceLine()])}>
                  <PlusCircle className="h-4 w-4 mr-1" /> Thêm dòng
                </Button>
              </div>
              <div className="space-y-3">
                {deviceLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có dòng thiết bị. Nhấn «Thêm dòng» để thêm.</p>
                ) : (
                  deviceLines.map((line, idx) => (
                    <div key={line.localId} className="space-y-2 rounded-md border border-dashed p-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Dòng {idx + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                          title="Xóa dòng"
                          onClick={() => setDeviceLines(p => p.filter(l => l.localId !== line.localId))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
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
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Số lượng
                            <RequiredMark />
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={e =>
                              setDeviceLines(p =>
                                p.map(l =>
                                  l.localId === line.localId
                                    ? { ...l, quantity: Math.max(1, Number(e.target.value) || 1) }
                                    : l,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
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
