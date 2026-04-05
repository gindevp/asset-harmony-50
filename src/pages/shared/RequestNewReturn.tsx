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
import { apiPost, getApiErrorMessage, getStoredToken } from '@/api/http';
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

export default function RequestNewReturn() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const isAdminArea = location.pathname.startsWith('/admin');
  const backTo = requestsListPath('return', isAdminArea);

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

  const [retNote, setRetNote] = useState('');
  const [retSelected, setRetSelected] = useState<Record<string, boolean>>({});
  const [retConsumableSelected, setRetConsumableSelected] = useState<Record<string, boolean>>({});
  const [retConsumableQty, setRetConsumableQty] = useState<Record<string, string>>({});
  const [retBusy, setRetBusy] = useState(false);
  const toggleRet = (id: string) => setRetSelected(p => ({ ...p, [id]: !p[id] }));
  const toggleRetConsumable = (assignmentId: string) => {
    setRetConsumableSelected(p => {
      const next = { ...p, [assignmentId]: !p[assignmentId] };
      if (next[assignmentId]) {
        setRetConsumableQty(q => ({ ...q, [assignmentId]: q[assignmentId] ?? '1' }));
      }
      return next;
    });
  };

  const submitReturn = async () => {
    const eqIds = Object.entries(retSelected).filter(([, v]) => v).map(([k]) => k);
    const consumableRows: { aid: string; assetItemId: number; qty: number; max: number }[] = [];
    for (const a of myConsumables) {
      const aid = String(a.id ?? '');
      if (!retConsumableSelected[aid]) continue;
      const itemId = a.assetItem?.id;
      if (itemId == null) continue;
      const max = consumableQuantityHeld(a);
      const raw = (retConsumableQty[aid] ?? '1').trim();
      const qty = Number.parseInt(raw, 10);
      if (!Number.isFinite(qty) || qty < 1) {
        toast.error('Số lượng vật tư phải là số nguyên ≥ 1');
        return;
      }
      if (qty > max) {
        toast.error(`Số lượng vật tư không vượt quá SL đang giữ (${max})`);
        return;
      }
      consumableRows.push({ aid, assetItemId: itemId, qty, max });
    }
    if (eqIds.length === 0 && consumableRows.length === 0) return toast.error('Chọn ít nhất một thiết bị hoặc một vật tư');
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
      for (const eqId of eqIds) {
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
      const mergedReturnQty = new Map<number, number>();
      for (const c of consumableRows) {
        mergedReturnQty.set(c.assetItemId, (mergedReturnQty.get(c.assetItemId) ?? 0) + c.qty);
      }
      for (const [assetItemId, qty] of mergedReturnQty) {
        await apiPost('/api/return-request-lines', {
          lineNo: lineNo++,
          lineType: 'CONSUMABLE',
          quantity: qty,
          selected: true,
          request: { id: created.id },
          assetItem: { id: assetItemId },
        });
      }
      toast.success('Đã gửi yêu cầu thu hồi');
      await qc.invalidateQueries({ queryKey: ['api', 'allocation-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'return-requests-view'] });
      navigate(backTo);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setRetBusy(false);
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
          <h1 className="page-title">Tạo yêu cầu thu hồi</h1>
        </div>
      </header>

      <Card className="mt-6 w-full max-w-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary">Phiếu yêu cầu thu hồi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingAssets ? (
            <p className="text-sm text-muted-foreground">Đang tải tài sản…</p>
          ) : !hasAnyAsset ? (
            <p className="text-sm text-muted-foreground">Bạn không có thiết bị hoặc vật tư đang giữ.</p>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-base font-semibold">
                  Tài sản cần thu hồi (thiết bị và/hoặc vật tư)
                  <RequiredMark />
                </Label>
                <p className="text-xs text-muted-foreground">Bắt buộc chọn ít nhất một thiết bị hoặc một vật tư.</p>
              </div>
              <div className="space-y-2">
                <Label>Thiết bị</Label>
                {myEquipment.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                    {myEquipment.map(e => {
                      const deviceName = getItemName(e.itemId, assetItems);
                      const serial = (e.serial ?? '').trim() || '—';
                      return (
                        <label key={e.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                          <input type="checkbox" checked={!!retSelected[e.id]} onChange={() => toggleRet(e.id)} />
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
                <Label>Vật tư (số lượng thu hồi)</Label>
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
                            <input type="checkbox" checked={!!retConsumableSelected[aid]} onChange={() => toggleRetConsumable(aid)} />
                            <span className="truncate">{label}</span>
                            <span className="text-muted-foreground shrink-0">(còn {held})</span>
                          </label>
                          {retConsumableSelected[aid] ? (
                            <Input
                              className="w-20 h-8"
                              type="number"
                              min={1}
                              max={held}
                              value={retConsumableQty[aid] ?? '1'}
                              onChange={e => setRetConsumableQty(q => ({ ...q, [aid]: e.target.value }))}
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
                <Label>Ghi chú</Label>
                <Textarea value={retNote} onChange={e => setRetNote(e.target.value)} rows={2} />
              </div>
              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <Button variant="outline" asChild disabled={retBusy}>
                  <Link to={backTo}>Hủy</Link>
                </Button>
                <Button onClick={() => void submitReturn()} disabled={retBusy || !hasAnyAsset}>
                  {retBusy ? 'Đang gửi…' : 'Gửi'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
