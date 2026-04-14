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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import { resolveEmployeeIdForRequests, resolveEmployeeLocationIdForRequests } from '@/api/account';
import { apiGet, apiPatch, apiPost, apiPostMultipart, getApiErrorMessage } from '@/api/http';
import { makeBizCode } from '@/api/businessCode';
import type { Equipment } from '@/data/mockData';
import { getItemName } from '@/data/mockData';
import {
  consumableQuantityHeld,
  filterConsumableAssignmentsForMyAccount,
  filterEquipmentForMyAccount,
  resolveMyAssetScope,
  resolveMyConsumableScope,
} from '@/utils/myEquipment';
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
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const isAdminArea = location.pathname.startsWith('/admin');
  const backTo = requestsListPath('repair', isAdminArea);
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
  const myLocIdStr = useMemo(() => {
    const fallbackFromContext = resolveEmployeeLocationIdForRequests();
    if (!myEmpIdStr) return fallbackFromContext;
    const fromEquipment = equipments.find(e => e.assignedTo === myEmpIdStr && e.assignedLocation)?.assignedLocation ?? null;
    const fromConsumable =
      (caQ.data ?? []).find(a => {
        const empId =
          a.employee?.id != null
            ? String(a.employee.id)
            : (a as { employeeId?: number | string }).employeeId != null
              ? String((a as { employeeId?: number | string }).employeeId)
              : null;
        if (empId !== myEmpIdStr) return false;
        if (a.location?.id != null) return true;
        return (a as { locationId?: number | string }).locationId != null;
      });
    const fromConsumableLoc =
      fromConsumable?.location?.id != null
        ? String(fromConsumable.location.id)
        : (fromConsumable as { locationId?: number | string } | undefined)?.locationId != null
          ? String((fromConsumable as { locationId?: number | string }).locationId)
          : null;
    if (!allEmpQ.data) return fromEquipment ?? fromConsumableLoc ?? fallbackFromContext;
    const me = allEmpQ.data.find(x => String(x.id) === myEmpIdStr);
    const fromProfile = me?.location?.id != null ? String(me.location.id) : null;
    return fromProfile ?? fromEquipment ?? fromConsumableLoc ?? fallbackFromContext;
  }, [myEmpIdStr, allEmpQ.data, equipments, caQ.data]);

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

  const retSnap = returnQ.data;
  const returnRequests = retSnap?.requests ?? [];
  const returnLineDtos = retSnap?.lineDtos;

  const aggregationOpts = useMemo<OpenRequestAggregationOptions | undefined>(() => {
    if (!isEditMode) return undefined;
    const n = Number(editId);
    return Number.isFinite(n) ? { excludeRepairRequestId: n } : undefined;
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

  const [repairSelected, setRepairSelected] = useState<Record<string, boolean>>({});
  const [assetOwnershipTab, setAssetOwnershipTab] = useState<'MY' | 'COMPANY'>('MY');
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
  const displayEquipmentRows = useMemo(() => {
    const rows = [...equipmentRows];
    if (!isEditMode) return rows;
    const seen = new Set(rows.map(r => String(r.id)));
    for (const [eqId, selected] of Object.entries(repairSelected)) {
      if (!selected || seen.has(eqId)) continue;
      const eq = equipments.find(e => String(e.id) === eqId);
      if (!eq) continue;
      rows.push(eq);
      seen.add(eqId);
    }
    return sortEquipmentForDisplay(rows);
  }, [equipmentRows, isEditMode, repairSelected, equipments]);
  const visibleEquipmentRows = useMemo(() => {
    if (isEditMode) return displayEquipmentRows;
    return displayEquipmentRows.filter(e => {
      const scope = resolveMyAssetScope(e, myEmpIdStr, myDeptIdStr, myLocIdStr);
      if (assetOwnershipTab === 'COMPANY') return scope === 'location';
      return scope !== 'location';
    });
  }, [displayEquipmentRows, isEditMode, assetOwnershipTab, myEmpIdStr, myDeptIdStr, myLocIdStr]);

  const [repairIssue, setRepairIssue] = useState('');
  const [repairDesc, setRepairDesc] = useState('');
  const [repairAttachment, setRepairAttachment] = useState('');
  const [repairFile, setRepairFile] = useState<File | null>(null);
  const [repairBusy, setRepairBusy] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [editBootstrapLoading, setEditBootstrapLoading] = useState(false);

  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;
    (async () => {
      setEditBootstrapLoading(true);
      try {
        const req = await apiGet<any>(`/api/repair-requests/${editId}`);
        if (cancelled) return;
        setRepairIssue(req?.problemCategory ?? '');
        setRepairDesc(req?.description ?? '');
        setRepairAttachment(req?.attachmentNote ?? '');
        const lines = (req?.lines ?? []) as any[];
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
        setRepairSelected(nextEq);
        setRepairConsumableSelected(nextConsSel);
        setRepairConsumableQty(nextConsQty);
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
      isCompanyAsset: g.assignments.some(
        a => resolveMyConsumableScope(a, myEmpIdStr, myDeptIdStr, myLocIdStr) === 'location',
      ),
    }));
    if (!isEditMode) return rows;
    const seen = new Set(rows.map(r => r.itemId));
    for (const [itemId, selected] of Object.entries(repairConsumableSelected)) {
      if (!selected || seen.has(itemId)) continue;
      const seededQty = Number.parseInt((repairConsumableQty[itemId] ?? '1').trim(), 10);
      rows.push({
        itemId,
        held: Number.isFinite(seededQty) && seededQty > 0 ? seededQty : 1,
        isCompanyAsset: false,
      });
      seen.add(itemId);
    }
    return rows;
  }, [
    consumableGroups,
    isEditMode,
    repairConsumableSelected,
    repairConsumableQty,
    myEmpIdStr,
    myDeptIdStr,
    myLocIdStr,
  ]);
  const visibleConsumableItems = useMemo(() => {
    if (isEditMode) return displayConsumableItems;
    return displayConsumableItems.filter(g => (assetOwnershipTab === 'COMPANY' ? g.isCompanyAsset : !g.isCompanyAsset));
  }, [displayConsumableItems, isEditMode, assetOwnershipTab]);

  const submitRepair = async () => {
    const visibleEquipmentIdSet = new Set(visibleEquipmentRows.map(e => String(e.id)));
    const visibleConsumableIdSet = new Set(visibleConsumableItems.map(g => g.itemId));
    const eqIds = Object.entries(repairSelected)
      .filter(([k, v]) => v && (isEditMode || visibleEquipmentIdSet.has(String(k))))
      .map(([k]) => k);
    const consumableLines: { assetItemId: number; qty: number }[] = [];
    for (const [assetItemIdStr, selected] of Object.entries(repairConsumableSelected)) {
      if (!isEditMode && !visibleConsumableIdSet.has(assetItemIdStr)) continue;
      if (!selected) continue;
      const itemId = Number(assetItemIdStr);
      if (!Number.isFinite(itemId)) continue;
      const g = consumableGroups.find(x => x.assetItemId === assetItemIdStr);
      const max = g ? totalHeldForConsumableGroup(g.assignments) : 0;
      const raw = (repairConsumableQty[assetItemIdStr] ?? '1').trim();
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
      consumableLines.push({ assetItemId: itemId, qty });
    }
    if (eqIds.length === 0 && consumableLines.length === 0) return toast.error('Chọn ít nhất một thiết bị hoặc một vật tư');
    for (const id of eqIds) {
      const hint = equipmentOpenHints.get(id);
      if (hint) {
        toast.error(`Thiết bị đang có yêu cầu sửa/thu hồi/báo mất chưa xử lý — không chọn trùng. (${hint})`);
        return;
      }
    }
    if (!repairIssue.trim()) return toast.error('Nhập vấn đề / danh mục');
    const repEid = isEditMode ? Number.NaN : requireEmployeeId();
    if (!isEditMode && repEid == null) return;
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

      if (isEditMode) {
        const requestId = Number(editId);
        await apiPatch(`/api/repair-requests/${requestId}`, {
          id: requestId,
          problemCategory: repairIssue.trim().slice(0, 100),
          description: repairDesc.trim() || undefined,
          attachmentNote: noteParts.length > 0 ? noteParts.join('\n') : undefined,
          lines,
        });
      } else {
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
      }
      toast.success(isEditMode ? 'Đã cập nhật yêu cầu sửa chữa' : 'Đã gửi yêu cầu sửa chữa');
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
  const hasVisibleAsset = visibleEquipmentRows.length > 0 || visibleConsumableItems.length > 0;
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
          <h1 className="page-title">{isEditMode ? 'Sửa yêu cầu sửa chữa' : 'Tạo yêu cầu sửa chữa'}</h1>
        </div>
      </header>

      <Card className="mt-6 w-full max-w-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary">Phiếu yêu cầu sửa chữa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingAssets ? (
            <PageLoading label="Đang tải tài sản…" minHeight="min-h-[28vh]" />
          ) : !hasAnyAsset && !isEditMode ? (
            <p className="text-sm text-muted-foreground">Bạn không có thiết bị hoặc vật tư đang giữ — không thể tạo yêu cầu sửa chữa.</p>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-base font-semibold">
                  Tài sản cần sửa (thiết bị và/hoặc vật tư)
                  <RequiredMark />
                </Label>
                <p className="text-xs text-muted-foreground">
                  Danh sách bao gồm tài sản cá nhân/phòng ban và tài sản công ty theo vị trí làm việc của bạn.
                </p>
              </div>
              {!isEditMode ? (
                <Tabs value={assetOwnershipTab} onValueChange={v => setAssetOwnershipTab(v as 'MY' | 'COMPANY')}>
                  <TabsList className="grid w-full max-w-lg grid-cols-2">
                    <TabsTrigger value="MY">Yêu cầu sửa tài sản của tôi</TabsTrigger>
                    <TabsTrigger value="COMPANY">Yêu cầu sửa tài sản công ty</TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : null}
              {!isEditMode && !hasVisibleAsset ? (
                <p className="text-xs text-muted-foreground">
                  {assetOwnershipTab === 'COMPANY'
                    ? 'Không có tài sản công ty theo vị trí của bạn để tạo yêu cầu sửa chữa.'
                    : 'Không có tài sản cá nhân/phòng ban để tạo yêu cầu sửa chữa.'}
                </p>
              ) : null}
              <AssetPickTwoColumnGrid>
                <AssetPickColumn
                  icon={Monitor}
                  title="Thiết bị"
                >
                  {visibleEquipmentRows.length > 0 ? (
                    visibleEquipmentRows.map(e => {
                      const assetScope = resolveMyAssetScope(e, myEmpIdStr, myDeptIdStr, myLocIdStr);
                      const companyTag = assetScope === 'location' ? 'Công ty' : null;
                      const deviceName = e.itemId ? getItemName(e.itemId, assetItems) : '—';
                      const displayDeviceName = companyTag ? `[${companyTag}] ${deviceName}` : deviceName;
                      const serial = (e.serial ?? '').trim() || '—';
                      const hint = equipmentOpenHints.get(e.id);
                      const lockedByOtherRequest = Boolean(hint);
                      const checked = !!repairSelected[e.id];
                      const blocked = lockedByOtherRequest && !(isEditMode && checked);
                      const lineText = blocked
                        ? `${deviceName} (Đã có yêu cầu sửa/báo mất/thu hồi${hint ? `: ${hint}` : ''})`
                        : `${deviceName} (Serial: ${serial})`;
                      return (
                        <AssetPickEquipmentRow
                          key={e.id}
                          rowId={String(e.id)}
                          title={lineText}
                          deviceName={displayDeviceName}
                          serial={serial}
                          blocked={blocked}
                          hint={hint}
                          openEntries={equipmentOpenEntries.get(String(e.id))}
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
                >
                  {visibleConsumableItems.length > 0 ? (
                    visibleConsumableItems.map(g => {
                      const itemId = g.itemId;
                      const held = g.held;
                      const label = itemId ? getItemName(itemId, assetItems) : '—';
                      const displayLabel = g.isCompanyAsset ? `[Công ty] ${label}` : label;
                      const pend = itemId ? consumablePendingByAssetItem.get(itemId) : undefined;
                      const remaining = consumableRemainingForAssetItem(held, pend);
                      const checked = !!repairConsumableSelected[itemId];
                      const blocked = remaining <= 0 && !(isEditMode && checked);
                      const rowTitle = `${label} · Đang giữ ${held.toLocaleString('vi-VN')} · Khả dụng ${remaining.toLocaleString('vi-VN')}`;
                      return (
                        <AssetPickConsumableRow
                          key={itemId}
                          rowId={itemId}
                          title={rowTitle}
                          itemLabel={displayLabel}
                          held={held}
                          blocked={blocked}
                          availableQty={remaining}
                          pendingSummary={pend?.summary}
                          pendingEntries={pend?.entries}
                          checked={checked}
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
                                max={Math.max(1, Math.min(held, remaining))}
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
                <Button variant="outline" type="button" onClick={() => setCancelConfirmOpen(true)} disabled={repairBusy}>
                  Hủy
                </Button>
                <Button onClick={() => void submitRepair()} disabled={repairBusy || (!hasVisibleAsset && !isEditMode)}>
                  {repairBusy ? 'Đang lưu…' : isEditMode ? 'Lưu thay đổi' : 'Gửi'}
                </Button>
              </div>
              <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hủy yêu cầu sửa chữa?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Dữ liệu đang nhập chưa được lưu. Bạn có chắc muốn quay lại danh sách?
                    </AlertDialogDescription>
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
