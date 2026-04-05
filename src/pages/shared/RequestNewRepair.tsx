import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { RequiredMark } from '@/components/shared/RequiredMark';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { resolveEmployeeIdForRequests, resolveEmployeeLocationIdForRequests } from '@/api/account';
import { apiPost, apiPostMultipart, getApiErrorMessage, getStoredToken } from '@/api/http';
import { hasAnyAuthority } from '@/auth/jwt';
import { makeBizCode } from '@/api/businessCode';
import type { Equipment } from '@/data/mockData';
import { getItemName } from '@/data/mockData';
import {
  consumableQuantityHeld,
  filterConsumableAssignmentsWithDepartmentPeers,
  filterEquipmentWithDepartmentPeers,
} from '@/utils/myEquipment';
import {
  mapAssetItemDto,
  useAssetItems,
  useConsumableAssignments,
  useEmployees,
  useEnrichedEquipmentList,
} from '@/hooks/useEntityApi';
import { requestsListPath } from './requestNewPaths';
import type { ConsumableAssignmentDto } from '@/api/types';

function requireEmployeeId(): number | null {
  const id = resolveEmployeeIdForRequests();
  const n = id != null ? Number(id) : NaN;
  if (!Number.isFinite(n)) {
    toast.error('Tài khoản chưa liên kết nhân viên. Admin: Quản lý user → gán nhân viên cho tài khoản đăng nhập.');
    return null;
  }
  return n;
}

export default function RequestNewRepair() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const isAdminArea = location.pathname.startsWith('/admin');
  const backTo = requestsListPath('repair', isAdminArea);

  const eqQ = useEnrichedEquipmentList();
  const caQ = useConsumableAssignments();
  const aiQ = useAssetItems();
  const allEmpQ = useEmployees();
  const equipments = eqQ.data ?? [];
  const assetItems = useMemo(() => (aiQ.data ?? []).map(mapAssetItemDto), [aiQ.data]);
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

  const myConsumables: ConsumableAssignmentDto[] = useMemo(() => {
    const raw = filterConsumableAssignmentsWithDepartmentPeers(
      caQ.data ?? [],
      myEmpIdStr,
      myDeptIdStr,
      myLocIdStr,
      isDeptCoordinator ? deptPeerIds : [],
    );
    return raw.filter(a => consumableQuantityHeld(a) > 0);
  }, [caQ.data, myEmpIdStr, myDeptIdStr, myLocIdStr, isDeptCoordinator, deptPeerIds]);

  const [repairSelected, setRepairSelected] = useState<Record<string, boolean>>({});
  const toggleRepair = (id: string) => setRepairSelected(p => ({ ...p, [id]: !p[id] }));

  const [repairConsumableSelected, setRepairConsumableSelected] = useState<Record<string, boolean>>({});
  const [repairConsumableQty, setRepairConsumableQty] = useState<Record<string, string>>({});
  const toggleRepairConsumable = (assignmentId: string) => {
    setRepairConsumableSelected(p => {
      const next = { ...p, [assignmentId]: !p[assignmentId] };
      if (next[assignmentId]) {
        setRepairConsumableQty(q => ({ ...q, [assignmentId]: q[assignmentId] ?? '1' }));
      }
      return next;
    });
  };

  const [repairIssue, setRepairIssue] = useState('');
  const [repairDesc, setRepairDesc] = useState('');
  const [repairAttachment, setRepairAttachment] = useState('');
  const [repairFile, setRepairFile] = useState<File | null>(null);
  const [repairBusy, setRepairBusy] = useState(false);

  const submitRepair = async () => {
    const eqIds = Object.entries(repairSelected).filter(([, v]) => v).map(([k]) => k);
    const consumableLines: { assignmentId: string; assetItemId: number; qty: number; max: number }[] = [];
    for (const a of myConsumables) {
      const aid = String(a.id ?? '');
      if (!repairConsumableSelected[aid]) continue;
      const itemId = a.assetItem?.id;
      if (itemId == null) continue;
      const max = consumableQuantityHeld(a);
      const raw = (repairConsumableQty[aid] ?? '1').trim();
      const qty = Number.parseInt(raw, 10);
      if (!Number.isFinite(qty) || qty < 1) {
        toast.error('Số lượng vật tư phải là số nguyên ≥ 1');
        return;
      }
      if (qty > max) {
        toast.error(`Số lượng vật tư không vượt quá SL đang giữ (${max})`);
        return;
      }
      consumableLines.push({ assignmentId: aid, assetItemId: itemId, qty, max });
    }
    if (eqIds.length === 0 && consumableLines.length === 0) return toast.error('Chọn ít nhất một thiết bị hoặc một vật tư');
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

      let lineNo = 1;
      const lines: {
        lineNo: number;
        lineType: string;
        equipment?: { id: number };
        assetItem?: { id: number };
        quantity?: number;
      }[] = [];
      for (const eqId of eqIds) {
        lines.push({ lineNo: lineNo++, lineType: 'DEVICE', equipment: { id: Number(eqId) } });
      }
      /** Cùng mặt hàng có thể có nhiều dòng bàn giao — BE chỉ cho 1 dòng CONSUMABLE / assetItemId / phiếu */
      const mergedByItem = new Map<number, number>();
      for (const c of consumableLines) {
        mergedByItem.set(c.assetItemId, (mergedByItem.get(c.assetItemId) ?? 0) + c.qty);
      }
      for (const [assetItemId, qty] of mergedByItem) {
        lines.push({
          lineNo: lineNo++,
          lineType: 'CONSUMABLE',
          assetItem: { id: assetItemId },
          quantity: qty,
        });
      }

      await apiPost('/api/repair-requests', {
        code: makeBizCode('RP'),
        requestDate: new Date().toISOString(),
        problemCategory: repairIssue.trim().slice(0, 100),
        description: repairDesc.trim() || undefined,
        attachmentNote: noteParts.length > 0 ? noteParts.join('\n') : undefined,
        status: 'NEW',
        requester: { id: repEid },
        lines,
      });
      toast.success('Đã gửi yêu cầu sửa chữa');
      await qc.invalidateQueries({ queryKey: ['api', 'allocation-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'return-requests-view'] });
      navigate(backTo);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setRepairBusy(false);
    }
  };

  const hasAnyAsset = myEquipment.length > 0 || myConsumables.length > 0;
  const loadingAssets = eqQ.isLoading || caQ.isLoading;

  return (
    <div className="page-container max-w-none w-full pb-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="space-y-2 min-w-0">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link to={backTo}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Quay lại danh sách
            </Link>
          </Button>
          <h1 className="page-title">Tạo yêu cầu sửa chữa</h1>
        </div>
      </header>

      <Card className="mt-6 w-full max-w-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary">Phiếu yêu cầu sửa chữa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingAssets ? (
            <p className="text-sm text-muted-foreground">Đang tải tài sản…</p>
          ) : !hasAnyAsset ? (
            <p className="text-sm text-muted-foreground">Bạn không có thiết bị hoặc vật tư đang giữ — không thể tạo yêu cầu sửa chữa.</p>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-base font-semibold">
                  Tài sản cần sửa (thiết bị và/hoặc vật tư)
                  <RequiredMark />
                </Label>
                <p className="text-xs text-muted-foreground">
                  Bắt buộc chọn ít nhất một thiết bị hoặc một vật tư. Mỗi thiết bị / mặt hàng vật tư chỉ được một phiếu sửa chữa hoặc thu hồi chưa kết thúc; không chọn trùng trên một phiếu.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Thiết bị (có thể chọn nhiều trên cùng một phiếu)</Label>
                {myEquipment.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto border rounded-md p-2 space-y-1">
                    {myEquipment.map(e => {
                      const deviceName = getItemName(e.itemId, assetItems);
                      const serial = (e.serial ?? '').trim() || '—';
                      return (
                        <label key={e.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                          <input type="checkbox" checked={!!repairSelected[e.id]} onChange={() => toggleRepair(e.id)} />
                          <span className="min-w-0">
                            <span className="font-medium">{deviceName}</span>
                            <span className="text-muted-foreground"> - </span>
                            <span className="font-mono tabular-nums">{serial}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Không có thiết bị đang gán.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Vật tư (theo bàn giao đang giữ)</Label>
                {myConsumables.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto border rounded-md p-2 space-y-2">
                    {myConsumables.map(a => {
                      const aid = String(a.id ?? '');
                      const held = consumableQuantityHeld(a);
                      const itemId = a.assetItem?.id != null ? String(a.assetItem.id) : '';
                      const label = itemId ? getItemName(itemId, assetItems) : '—';
                      return (
                        <div key={aid} className="flex flex-wrap items-center gap-2 text-sm py-1">
                          <label className="flex items-center gap-2 cursor-pointer min-w-0">
                            <input
                              type="checkbox"
                              checked={!!repairConsumableSelected[aid]}
                              onChange={() => toggleRepairConsumable(aid)}
                            />
                            <span className="truncate">{label}</span>
                            <span className="text-muted-foreground shrink-0">(còn {held})</span>
                          </label>
                          {repairConsumableSelected[aid] ? (
                            <Input
                              className="w-20 h-8"
                              type="number"
                              min={1}
                              max={held}
                              value={repairConsumableQty[aid] ?? '1'}
                              onChange={e => setRepairConsumableQty(q => ({ ...q, [aid]: e.target.value }))}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Không có vật tư đang giữ.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Vấn đề (tối đa 100 ký tự)
                  <RequiredMark />
                </Label>
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
                <Label>Tài liệu đính kèm (tối đa 50 MB)</Label>
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
                <Button onClick={() => void submitRepair()} disabled={repairBusy || !hasAnyAsset}>
                  {repairBusy ? 'Đang gửi…' : 'Gửi'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
