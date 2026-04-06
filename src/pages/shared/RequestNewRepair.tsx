import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Monitor, Package } from 'lucide-react';
import { toast } from 'sonner';

import { RequiredMark } from '@/components/shared/RequiredMark';
import {
  AssetPickColumn,
  AssetPickConsumableRow,
  AssetPickEquipmentRow,
  AssetPickTwoColumnGrid,
} from '@/components/shared/RequestAssetPickRows';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { resolveEmployeeIdForRequests, resolveEmployeeLocationIdForRequests } from '@/api/account';
import { apiPost, apiPostMultipart, getApiErrorMessage } from '@/api/http';
import { makeBizCode } from '@/api/businessCode';
import type { Equipment } from '@/data/mockData';
import { getItemName } from '@/data/mockData';
import { consumableQuantityHeld, filterConsumableAssignmentsForMyAccount, filterEquipmentForMyAccount } from '@/utils/myEquipment';
import { groupConsumableAssignmentsByAssetItem, sortEquipmentForDisplay, totalHeldForConsumableGroup } from '@/utils/myHoldingsAggregate';
import { hasBackendOpenEquipmentAssignment } from '@/utils/equipmentJoin';
import { mapEquipmentIdToOpenRequestHints, mapAssetItemIdToConsumablePending } from '@/utils/openAssetRequestBlocks';
import {
  mapAssetItemDto,
  useAssetItems,
  useConsumableAssignments,
  useEmployees,
  useEnrichedEquipmentList,
  useEquipmentAssignments,
  useLossReportRequests,
  useRepairRequestsView,
  useReturnRequestsView,
} from '@/hooks/useEntityApi';
import { requestsListPath } from './requestNewPaths';
import { PageLoading } from '@/components/shared/page-loading';
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
  const eqAssignQ = useEquipmentAssignments();
  const caQ = useConsumableAssignments();
  const aiQ = useAssetItems();
  const allEmpQ = useEmployees();
  const repairQ = useRepairRequestsView();
  const returnQ = useReturnRequestsView();
  const lossQ = useLossReportRequests();
  const equipments = eqQ.data ?? [];
  const assetItems = useMemo(() => (aiQ.data ?? []).map(mapAssetItemDto), [aiQ.data]);
  const myEmpIdStr = resolveEmployeeIdForRequests();
  const myDeptIdStr = useMemo(() => {
    if (!myEmpIdStr || !allEmpQ.data) return null;
    const me = allEmpQ.data.find(x => String(x.id) === myEmpIdStr);
    return me?.department?.id != null ? String(me.department.id) : null;
  }, [myEmpIdStr, allEmpQ.data]);
  const myLocIdStr = resolveEmployeeLocationIdForRequests();

  const myEquipment: Equipment[] = useMemo(
    () =>
      filterEquipmentForMyAccount(equipments, myEmpIdStr, myDeptIdStr, myLocIdStr).filter(e =>
        hasBackendOpenEquipmentAssignment(String(e.id), eqAssignQ.data ?? []),
      ),
    [equipments, myEmpIdStr, myDeptIdStr, myLocIdStr, eqAssignQ.data],
  );

  const myConsumables: ConsumableAssignmentDto[] = useMemo(() => {
    const raw = filterConsumableAssignmentsForMyAccount(caQ.data ?? [], myEmpIdStr, myDeptIdStr, myLocIdStr);
    return raw.filter(a => consumableQuantityHeld(a) > 0);
  }, [caQ.data, myEmpIdStr, myDeptIdStr, myLocIdStr]);

  const consumableGroups = useMemo(
    () => groupConsumableAssignmentsByAssetItem(myConsumables),
    [myConsumables],
  );
  const equipmentRows = useMemo(() => sortEquipmentForDisplay(myEquipment), [myEquipment]);

  const equipmentOpenHints = useMemo(
    () => mapEquipmentIdToOpenRequestHints(myEmpIdStr, repairQ.data ?? [], returnQ.data ?? [], lossQ.data ?? []),
    [myEmpIdStr, repairQ.data, returnQ.data, lossQ.data],
  );

  const consumablePendingByAssetItem = useMemo(
    () => mapAssetItemIdToConsumablePending(myEmpIdStr, repairQ.data ?? [], returnQ.data ?? [], lossQ.data ?? []),
    [myEmpIdStr, repairQ.data, returnQ.data, lossQ.data],
  );

  const [repairSelected, setRepairSelected] = useState<Record<string, boolean>>({});
  const toggleRepair = (id: string) => setRepairSelected(p => ({ ...p, [id]: !p[id] }));

  /** Theo mã mặt hàng vật tư (gộp các dòng bàn giao). */
  const [repairConsumableSelected, setRepairConsumableSelected] = useState<Record<string, boolean>>({});
  const [repairConsumableQty, setRepairConsumableQty] = useState<Record<string, string>>({});
  const toggleRepairConsumable = (assetItemId: string) => {
    setRepairConsumableSelected(p => {
      const next = { ...p, [assetItemId]: !p[assetItemId] };
      if (next[assetItemId]) {
        setRepairConsumableQty(q => ({ ...q, [assetItemId]: q[assetItemId] ?? '1' }));
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
    const consumableLines: { assetItemId: number; qty: number }[] = [];
    for (const g of consumableGroups) {
      const assetItemIdStr = g.assetItemId;
      if (!repairConsumableSelected[assetItemIdStr]) continue;
      const itemId = Number(assetItemIdStr);
      if (!Number.isFinite(itemId)) continue;
      const max = totalHeldForConsumableGroup(g.assignments);
      const raw = (repairConsumableQty[assetItemIdStr] ?? '1').trim();
      const qty = Number.parseInt(raw, 10);
      if (!Number.isFinite(qty) || qty < 1) {
        toast.error('Số lượng vật tư phải là số nguyên ≥ 1');
        return;
      }
      if (qty > max) {
        toast.error(`Số lượng không vượt quá tổng SL đang giữ của mặt hàng (${max})`);
        return;
      }
      consumableLines.push({ assetItemId: itemId, qty });
    }
    if (eqIds.length === 0 && consumableLines.length === 0) return toast.error('Chọn ít nhất một thiết bị hoặc một vật tư');
    for (const id of eqIds) {
      const hint = equipmentOpenHints.get(id);
      if (hint) {
        toast.error(
          `Thiết bị đang có yêu cầu sửa/thu hồi/báo mất chưa xử lý — không tạo phiếu mới trùng. (${hint})`,
        );
        return;
      }
    }
    for (const c of consumableLines) {
      const pend = consumablePendingByAssetItem.get(String(c.assetItemId));
      const blocked = pend && (pend.repairQty + pend.returnQty + pend.lossQty) > 0;
      if (blocked) {
        toast.error(
          `Mặt hàng vật tư đang có SL nằm trong phiếu sửa/thu hồi/báo mất chưa xử lý — không chọn trùng. (${pend!.summary})`,
        );
        return;
      }
    }
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
      for (const c of consumableLines) {
        lines.push({
          lineNo: lineNo++,
          lineType: 'CONSUMABLE',
          assetItem: { id: c.assetItemId },
          quantity: c.qty,
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
      await qc.invalidateQueries({ queryKey: ['api', 'loss-report-requests'] });
      navigate(backTo);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setRepairBusy(false);
    }
  };

  const hasAnyAsset = myEquipment.length > 0 || myConsumables.length > 0;
  const loadingAssets =
    eqQ.isLoading || caQ.isLoading || repairQ.isLoading || returnQ.isLoading || lossQ.isLoading;

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
            <PageLoading label="Đang tải tài sản…" minHeight="min-h-[28vh]" />
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
                  Bắt buộc chọn ít nhất một thiết bị hoặc một vật tư. Mỗi thiết bị / mặt hàng chỉ được một yêu cầu sửa, thu hồi hoặc báo mất ở trạng thái chờ duyệt / đang xử lý — dòng gạch mờ là tài sản đã có phiếu như vậy.
                </p>
              </div>
              <AssetPickTwoColumnGrid>
                <AssetPickColumn
                  icon={Monitor}
                  title="Thiết bị"
                  description={
                    <>
                      Có thể chọn nhiều serial trên cùng phiếu. Mỗi serial = 1 chiếc. Dòng tô vàng là đã có phiếu chờ xử
                      lý.
                    </>
                  }
                >
                  {myEquipment.length > 0 ? (
                    equipmentRows.map(e => {
                      const deviceName = e.itemId ? getItemName(e.itemId, assetItems) : '—';
                      const serial = (e.serial ?? '').trim() || '—';
                      const hint = equipmentOpenHints.get(e.id);
                      const blocked = Boolean(hint);
                      const checked = !blocked && !!repairSelected[e.id];
                      const lineText = blocked
                        ? `${deviceName} (Đã có yêu cầu sửa/báo mất/thu hồi${hint ? `: ${hint}` : ''})`
                        : `${deviceName} (Serial: ${serial})`;
                      return (
                        <AssetPickEquipmentRow
                          key={e.id}
                          rowId={String(e.id)}
                          title={lineText}
                          deviceName={deviceName}
                          serial={serial}
                          blocked={blocked}
                          hint={hint}
                          checked={checked}
                          onCheckedChange={next => {
                            if (blocked) return;
                            if (next && !repairSelected[e.id]) toggleRepair(e.id);
                            else if (!next && repairSelected[e.id]) toggleRepair(e.id);
                          }}
                        />
                      );
                    })
                  ) : (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">Không có thiết bị đang gán.</p>
                  )}
                </AssetPickColumn>

                <AssetPickColumn
                  icon={Package}
                  title="Vật tư (gộp theo mặt hàng)"
                  description={<>Theo mặt hàng đang giữ — nhập SL không vượt quá tổng còn.</>}
                >
                  {consumableGroups.length > 0 ? (
                    consumableGroups.map(g => {
                      const itemId = g.assetItemId;
                      const held = totalHeldForConsumableGroup(g.assignments);
                      const label = itemId ? getItemName(itemId, assetItems) : '—';
                      const pend = itemId ? consumablePendingByAssetItem.get(itemId) : undefined;
                      const blocked = pend != null && pend.repairQty + pend.returnQty + pend.lossQty > 0;
                      const rowTitle = `${label} · Còn ${held.toLocaleString('vi-VN')}`;
                      return (
                        <AssetPickConsumableRow
                          key={itemId}
                          rowId={itemId}
                          title={rowTitle}
                          itemLabel={label}
                          held={held}
                          blocked={blocked}
                          pendingSummary={pend?.summary}
                          checked={blocked ? false : !!repairConsumableSelected[itemId]}
                          onCheckedChange={next => {
                            if (blocked) return;
                            if (next !== !!repairConsumableSelected[itemId]) toggleRepairConsumable(itemId);
                          }}
                          quantitySlot={
                            !blocked && repairConsumableSelected[itemId] ? (
                              <Input
                                className="h-9 w-full font-sans tabular-nums"
                                type="number"
                                min={1}
                                max={held}
                                placeholder="SL"
                                value={repairConsumableQty[itemId] ?? '1'}
                                onChange={e => setRepairConsumableQty(q => ({ ...q, [itemId]: e.target.value }))}
                              />
                            ) : null
                          }
                        />
                      );
                    })
                  ) : (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">Không có vật tư đang giữ.</p>
                  )}
                </AssetPickColumn>
              </AssetPickTwoColumnGrid>

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
