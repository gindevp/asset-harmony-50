import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { resolveEmployeeIdForRequests, resolveEmployeeLocationIdForRequests } from '@/api/account';
import { mergeReturnRequestsFullViewAfterCreate, type ReturnRequestsViewSnapshot } from '@/api/viewModels';
import { apiDelete, apiGet, apiPatch, apiPost, getApiErrorMessage, getStoredToken, PAGE_ALL } from '@/api/http';
import type { ConsumableAssignmentDto, ReturnRequestDto, ReturnRequestLineDto } from '@/api/types';
import { makeBizCode } from '@/api/businessCode';
import { hasAnyAuthority } from '@/auth/jwt';
import type { Equipment } from '@/data/mockData';
import { getItemName } from '@/data/mockData';
import { consumableQuantityHeld, filterConsumableAssignmentsForMyAccount, filterEquipmentForMyAccount } from '@/utils/myEquipment';
import { groupConsumableAssignmentsByAssetItem, sortEquipmentForDisplay, totalHeldForConsumableGroup } from '@/utils/myHoldingsAggregate';
import { hasBackendOpenEquipmentAssignment } from '@/utils/equipmentJoin';
import {
  consumableRemainingForAssetItem,
  mapAssetItemIdToConsumablePending,
  mapEquipmentIdToOpenRequestEntries,
  mapEquipmentIdToOpenRequestHints,
  type OpenRequestAggregationOptions,
} from '@/utils/openAssetRequestBlocks';
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
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const isAdminArea = location.pathname.startsWith('/admin');
  const backTo = requestsListPath('return', isAdminArea);
  const canFullEditRequest = hasAnyAuthority(getStoredToken(), ['ROLE_ADMIN', 'ROLE_ASSET_MANAGER', 'ROLE_GD']);
  const editId = searchParams.get('editId')?.trim() || '';
  const isEditMode = editId.length > 0;

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

  const retSnapshot = returnQ.data;
  const returnRequests = retSnapshot?.requests ?? [];
  const returnLineDtos = retSnapshot?.lineDtos;

  const aggregationOpts = useMemo<OpenRequestAggregationOptions | undefined>(() => {
    if (!isEditMode) return undefined;
    const n = Number(editId);
    return Number.isFinite(n) ? { excludeReturnRequestId: n } : undefined;
  }, [isEditMode, editId]);

  const equipmentOpenHints = useMemo(
    () =>
      mapEquipmentIdToOpenRequestHints(
        myEmpIdStr,
        repairQ.data ?? [],
        returnRequests,
        lossQ.data ?? [],
        returnLineDtos,
        aggregationOpts,
      ),
    [myEmpIdStr, repairQ.data, returnRequests, lossQ.data, returnLineDtos, aggregationOpts],
  );

  const equipmentOpenEntries = useMemo(
    () =>
      mapEquipmentIdToOpenRequestEntries(
        myEmpIdStr,
        repairQ.data ?? [],
        returnRequests,
        lossQ.data ?? [],
        returnLineDtos,
        aggregationOpts,
      ),
    [myEmpIdStr, repairQ.data, returnRequests, lossQ.data, returnLineDtos, aggregationOpts],
  );

  const consumablePendingByAssetItem = useMemo(
    () =>
      mapAssetItemIdToConsumablePending(
        myEmpIdStr,
        repairQ.data ?? [],
        returnRequests,
        lossQ.data ?? [],
        returnLineDtos,
        aggregationOpts,
      ),
    [myEmpIdStr, repairQ.data, returnRequests, lossQ.data, returnLineDtos, aggregationOpts],
  );

  const [retNote, setRetNote] = useState('');
  const [retSelected, setRetSelected] = useState<Record<string, boolean>>({});
  const [retConsumableSelected, setRetConsumableSelected] = useState<Record<string, boolean>>({});
  const [retConsumableQty, setRetConsumableQty] = useState<Record<string, string>>({});
  const [retBusy, setRetBusy] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [editBootstrapLoading, setEditBootstrapLoading] = useState(false);
  const toggleRet = (id: string) => setRetSelected(p => ({ ...p, [id]: !p[id] }));
  const toggleRetConsumable = (assetItemId: string) => {
    setRetConsumableSelected(p => {
      const next = { ...p, [assetItemId]: !p[assetItemId] };
      if (next[assetItemId]) {
        setRetConsumableQty(q => ({ ...q, [assetItemId]: q[assetItemId] ?? '1' }));
      }
      return next;
    });
  };
  const displayEquipmentRows = useMemo(() => {
    const rows = [...equipmentRows];
    if (!isEditMode) return rows;
    const seen = new Set(rows.map(r => String(r.id)));
    for (const [eqId, selected] of Object.entries(retSelected)) {
      if (!selected || seen.has(eqId)) continue;
      const eq = equipments.find(e => String(e.id) === eqId);
      if (!eq) continue;
      rows.push(eq);
      seen.add(eqId);
    }
    return sortEquipmentForDisplay(rows);
  }, [equipmentRows, isEditMode, retSelected, equipments]);

  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;
    (async () => {
      setEditBootstrapLoading(true);
      try {
        const [req, allLines] = await Promise.all([
          apiGet<any>(`/api/return-requests/${editId}`),
          apiGet<any[]>(`/api/return-request-lines?${PAGE_ALL}`),
        ]);
        if (cancelled) return;
        setRetNote(req?.note ?? '');
        const lines = ((req?.lines ?? []) as any[]).length
          ? ((req?.lines ?? []) as any[])
          : (allLines ?? []).filter(l => String(l?.request?.id ?? '') === String(editId));
        const nextEq: Record<string, boolean> = {};
        const nextConsSel: Record<string, boolean> = {};
        const nextConsQty: Record<string, string> = {};
        for (const line of lines) {
          const lt = String(line?.lineType ?? 'DEVICE').toUpperCase();
          if (lt === 'CONSUMABLE') {
            const aid =
              line?.assetItem?.id != null
                ? String(line.assetItem.id)
                : line?.assetItemId != null
                  ? String(line.assetItemId)
                  : line?.itemId != null
                    ? String(line.itemId)
                    : '';
            if (!aid) continue;
            nextConsSel[aid] = true;
            nextConsQty[aid] = String(Number(line?.quantity ?? 1));
          } else {
            const eid = line?.equipment?.id != null ? String(line.equipment.id) : '';
            if (!eid) continue;
            nextEq[eid] = true;
          }
        }
        setRetSelected(nextEq);
        setRetConsumableSelected(nextConsSel);
        setRetConsumableQty(nextConsQty);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Không tải được dữ liệu yêu cầu để sửa');
      } finally {
        if (!cancelled) setEditBootstrapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, editId]);

  const displayConsumableItems = useMemo(() => {
    const rows = consumableGroups.map(g => ({
      itemId: g.assetItemId,
      held: totalHeldForConsumableGroup(g.assignments),
    }));
    if (!isEditMode) return rows;
    const seen = new Set(rows.map(r => r.itemId));
    for (const [itemId, selected] of Object.entries(retConsumableSelected)) {
      if (!selected || seen.has(itemId)) continue;
      const seededQty = Number.parseInt((retConsumableQty[itemId] ?? '1').trim(), 10);
      rows.push({
        itemId,
        // Preserve edit visibility even when current "my holdings" no longer returns this item.
        held: Number.isFinite(seededQty) && seededQty > 0 ? seededQty : 1,
      });
      seen.add(itemId);
    }
    return rows;
  }, [consumableGroups, isEditMode, retConsumableSelected, retConsumableQty]);

  const submitReturn = async () => {
    const noteTrim = retNote.trim();
    if (!noteTrim) {
      toast.error('Vui lòng nhập ghi chú');
      return;
    }
    const eqIds = Object.entries(retSelected).filter(([, v]) => v).map(([k]) => k);
    const mergedReturnQty = new Map<number, number>();
    for (const [assetItemIdStr, selected] of Object.entries(retConsumableSelected)) {
      if (!selected) continue;
      const itemId = Number(assetItemIdStr);
      if (!Number.isFinite(itemId)) continue;
      const g = consumableGroups.find(x => x.assetItemId === assetItemIdStr);
      const max = g ? totalHeldForConsumableGroup(g.assignments) : 0;
      const raw = (retConsumableQty[assetItemIdStr] ?? '1').trim();
      const qty = Number.parseInt(raw, 10);
      if (!Number.isFinite(qty) || qty < 1) {
        toast.error('Số lượng vật tư phải là số nguyên ≥ 1');
        return;
      }
      const pend = consumablePendingByAssetItem.get(String(itemId));
      const remaining = consumableRemainingForAssetItem(max, pend);
      if (qty > remaining) {
        toast.error(
          remaining <= 0
            ? `Mặt hàng không còn SL khả dụng (đã nằm trong phiếu sửa/thu hồi/báo mất chưa xử lý).${pend?.summary ? ` (${pend.summary})` : ''}`
            : `Số lượng vượt phần còn khả dụng (tối đa ${remaining}).${pend?.summary ? ` Đang có: ${pend.summary}.` : ''}`,
        );
        return;
      }
      if (!isEditMode && max <= 0) {
        toast.error('Vật tư đã chọn không còn trong danh sách đang giữ');
        return;
      }
      mergedReturnQty.set(itemId, qty);
    }
    if (eqIds.length === 0 && mergedReturnQty.size === 0) return toast.error('Chọn ít nhất một thiết bị hoặc một vật tư');
    for (const id of eqIds) {
      const hint = equipmentOpenHints.get(id);
      if (hint) {
        toast.error(`Thiết bị đang có yêu cầu sửa/thu hồi/báo mất chưa xử lý — không chọn trùng. (${hint})`);
        return;
      }
    }
    const retEid = isEditMode ? Number.NaN : requireEmployeeId();
    if (!isEditMode && retEid == null) return;
    setRetBusy(true);
    try {
      let requestId: number;
      let createdForCache: ReturnRequestDto | null = null;
      const createdLineBodies: ReturnRequestLineDto[] = [];
      if (isEditMode) {
        requestId = Number(editId);
        await apiPatch(`/api/return-requests/${requestId}`, {
          id: requestId,
          note: noteTrim,
        });
        const oldLines = await apiGet<any[]>(`/api/return-request-lines?${PAGE_ALL}`);
        const mine = oldLines.filter(l => String(l.request?.id ?? '') === String(requestId));
        for (const l of mine) {
          if (l.id != null) await apiDelete(`/api/return-request-lines/${l.id}`);
        }
      } else {
        const created = await apiPost<ReturnRequestDto>('/api/return-requests', {
          code: makeBizCode('RT'),
          requestDate: new Date().toISOString(),
          note: noteTrim,
          status: 'PENDING',
          requester: { id: retEid },
        });
        requestId = Number(created.id);
        createdForCache = created;
      }
      let lineNo = 1;
      for (const eqId of eqIds) {
        const eq = myEquipment.find(e => e.id === eqId);
        if (!eq) continue;
        const lineRes = await apiPost<ReturnRequestLineDto>('/api/return-request-lines', {
          lineNo: lineNo++,
          lineType: 'DEVICE',
          quantity: 1,
          selected: true,
          request: { id: requestId },
          equipment: { id: Number(eqId) },
          assetItem: { id: Number(eq.itemId) },
        });
        createdLineBodies.push(lineRes);
      }
      for (const [assetItemId, qty] of mergedReturnQty) {
        const lineRes = await apiPost<ReturnRequestLineDto>('/api/return-request-lines', {
          lineNo: lineNo++,
          lineType: 'CONSUMABLE',
          quantity: qty,
          selected: true,
          request: { id: requestId },
          assetItem: { id: assetItemId },
        });
        createdLineBodies.push(lineRes);
      }
      toast.success(isEditMode ? 'Đã cập nhật yêu cầu thu hồi' : 'Đã gửi yêu cầu thu hồi');
      await qc.invalidateQueries({ queryKey: ['api', 'allocation-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });
      await qc.invalidateQueries({ queryKey: ['api', 'loss-report-requests'] });
      await qc.refetchQueries({ queryKey: ['api', 'return-requests-view'] });
      if (!isEditMode && createdForCache) {
        qc.setQueryData<ReturnRequestsViewSnapshot>(['api', 'return-requests-view'], prev =>
          mergeReturnRequestsFullViewAfterCreate(prev, createdForCache!, createdLineBodies),
        );
      }
      navigate(backTo);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setRetBusy(false);
    }
  };

  const hasAnyAsset = myEquipment.length > 0 || myConsumables.length > 0;
  const loadingAssets =
    eqQ.isLoading || caQ.isLoading || repairQ.isLoading || returnQ.isLoading || lossQ.isLoading || editBootstrapLoading;

  return (
    <div className="page-container max-w-none w-full pb-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6">
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
          <h1 className="page-title">{isEditMode ? 'Sửa yêu cầu thu hồi' : 'Tạo yêu cầu thu hồi'}</h1>
        </div>
      </header>

      <Card className="mt-6 w-full max-w-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary">Phiếu yêu cầu thu hồi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingAssets ? (
            <PageLoading label="Đang tải tài sản…" minHeight="min-h-[28vh]" />
          ) : !hasAnyAsset && !isEditMode ? (
            <p className="text-sm text-muted-foreground">Bạn không có thiết bị hoặc vật tư đang giữ.</p>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-base font-semibold">
                  Tài sản cần thu hồi (thiết bị và/hoặc vật tư)
                  <RequiredMark />
                </Label>
              </div>
              <AssetPickTwoColumnGrid>
                <AssetPickColumn
                  icon={Monitor}
                  title="Thiết bị"
                >
                  {displayEquipmentRows.length > 0 ? (
                    displayEquipmentRows.map(e => {
                      const deviceName = e.itemId ? getItemName(e.itemId, assetItems) : '—';
                      const serial = (e.serial ?? '').trim() || '—';
                      const hint = equipmentOpenHints.get(e.id);
                      const lockedByOtherRequest = Boolean(hint);
                      const checked = !!retSelected[e.id];
                      const blocked = lockedByOtherRequest && !(isEditMode && checked);
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
                          openEntries={equipmentOpenEntries.get(String(e.id))}
                          checked={checked}
                          onCheckedChange={next => {
                            if (blocked) return;
                            if (next && !retSelected[e.id]) toggleRet(e.id);
                            else if (!next && retSelected[e.id]) toggleRet(e.id);
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
                  title="Vật tư (số lượng thu hồi, gộp theo mặt hàng)"
                >
                  {displayConsumableItems.length > 0 ? (
                    displayConsumableItems.map(g => {
                      const itemId = g.itemId;
                      const held = g.held;
                      const label = itemId ? getItemName(itemId, assetItems) : '—';
                      const pend = itemId ? consumablePendingByAssetItem.get(itemId) : undefined;
                      const remaining = consumableRemainingForAssetItem(held, pend);
                      const checked = !!retConsumableSelected[itemId];
                      const blocked = remaining <= 0 && !(isEditMode && checked);
                      const rowTitle = `${label} · Đang giữ ${held.toLocaleString('vi-VN')} · Khả dụng ${remaining.toLocaleString('vi-VN')}`;
                      return (
                        <AssetPickConsumableRow
                          key={itemId}
                          rowId={itemId}
                          title={rowTitle}
                          itemLabel={label}
                          held={held}
                          blocked={blocked}
                          availableQty={remaining}
                          pendingSummary={pend?.summary}
                          pendingEntries={pend?.entries}
                          checked={checked}
                          onCheckedChange={next => {
                            if (blocked) return;
                            if (next !== !!retConsumableSelected[itemId]) toggleRetConsumable(itemId);
                          }}
                          quantitySlot={
                            !blocked && retConsumableSelected[itemId] ? (
                              <Input
                                className="h-9 w-full font-sans tabular-nums"
                                type="number"
                                min={1}
                                max={Math.max(1, Math.min(held, remaining))}
                                placeholder="SL"
                                value={retConsumableQty[itemId] ?? '1'}
                                onChange={e => setRetConsumableQty(q => ({ ...q, [itemId]: e.target.value }))}
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
                  Ghi chú
                  <RequiredMark />
                </Label>
                <Textarea value={retNote} onChange={e => setRetNote(e.target.value)} rows={2} />
              </div>
              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <Button variant="outline" type="button" onClick={() => setCancelConfirmOpen(true)} disabled={retBusy}>
                  Hủy
                </Button>
                <Button onClick={() => void submitReturn()} disabled={retBusy || (!hasAnyAsset && !isEditMode)}>
                  {retBusy ? 'Đang lưu…' : isEditMode ? 'Lưu thay đổi' : 'Gửi'}
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
                    <AlertDialogAction onClick={() => navigate(backTo)}>Thoát</AlertDialogAction>
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
