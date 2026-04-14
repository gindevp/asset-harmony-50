import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RequiredMark } from '@/components/shared/RequiredMark';
import { makeBizCode } from '@/api/businessCode';
import { ApiError, apiPost, parseProblemDetailJson } from '@/api/http';
import { resolveEmployeeIdForRequests, resolveEmployeeLocationIdForRequests } from '@/api/account';
import {
  mapAssetItemDto,
  useAssetItems,
  useConsumableAssignments,
  useEmployees,
  useEnrichedEquipmentList,
  useLossReportRequests,
  useEquipmentAssignments,
  useRepairRequestsView,
  useReturnRequestsView,
} from '@/hooks/useEntityApi';
import type { Equipment } from '@/data/mockData';
import { getItemName } from '@/data/mockData';
import {
  consumableQuantityHeld,
  filterConsumableAssignmentsForMyAccount,
  filterEquipmentForMyAccount,
  getConsumableAssignmentDisplayStatus,
} from '@/utils/myEquipment';
import { hasBackendOpenEquipmentAssignment } from '@/utils/equipmentJoin';
import {
  groupConsumableAssignmentsByAssetItem,
  sortEquipmentForDisplay,
  splitConsumableLossAcrossAssignments,
  totalHeldForConsumableGroup,
} from '@/utils/myHoldingsAggregate';
import {
  consumableRemainingForAssetItem,
  mapAssetItemIdToConsumablePending,
  mapEquipmentIdToOpenRequestEntries,
  mapEquipmentIdToOpenRequestHints,
} from '@/utils/openAssetRequestBlocks';
import { lossOccurredAtFromDatetimeLocal, nowDatetimeLocalValue } from '@/utils/lossReportForm';
import { PageLoading } from '@/components/shared/page-loading';
import {
  AssetPickColumn,
  AssetPickConsumableRow,
  AssetPickEquipmentRow,
  AssetPickTwoColumnGrid,
} from '@/components/shared/RequestAssetPickRows';
import { Monitor, Package } from 'lucide-react';
import { toast } from 'sonner';

export interface LossReportCreateFormProps {
  backTo: string;
  /** Mở dialog xác nhận trước khi thoát (do trang cha quản lý `AlertDialog`). */
  onCancelClick?: () => void;
  onSuccess?: () => void;
  /** Từ «Tài sản của tôi» — chọn sẵn nếu dòng còn hợp lệ */
  initialKind?: 'EQUIPMENT' | 'CONSUMABLE';
  initialEquipmentId?: string;
  initialConsumableAssetItemId?: string;
}

/**
 * Form tạo YC báo mất — **một phiếu duy nhất** (COMBINED): nhiều thiết bị + vật tư trong cùng yêu cầu.
 */
export function LossReportCreateForm({
  backTo,
  onCancelClick,
  onSuccess,
  initialKind,
  initialEquipmentId,
  initialConsumableAssetItemId,
}: LossReportCreateFormProps) {
  const qc = useQueryClient();
  const eqQ = useEnrichedEquipmentList();
  const eqAssignQ = useEquipmentAssignments();
  const caQ = useConsumableAssignments();
  const repairQ = useRepairRequestsView();
  const returnQ = useReturnRequestsView();
  const lossQ = useLossReportRequests();
  const iQ = useAssetItems();
  const empQ = useEmployees();
  const repairRequests = repairQ.data ?? [];
  const equipments = eqQ.data ?? [];
  const consumableAssignments = caQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const empId = resolveEmployeeIdForRequests();
  const loading =
    eqQ.isLoading ||
    eqAssignQ.isLoading ||
    caQ.isLoading ||
    repairQ.isLoading ||
    returnQ.isLoading ||
    lossQ.isLoading;

  const retSnap = returnQ.data;
  const returnRequests = retSnap?.requests ?? [];
  const returnLineDtos = retSnap?.lineDtos;

  const equipmentOpenHints = useMemo(
    () =>
      mapEquipmentIdToOpenRequestHints(empId, repairQ.data ?? [], returnRequests, lossQ.data ?? [], returnLineDtos),
    [empId, repairQ.data, returnRequests, lossQ.data, returnLineDtos],
  );

  const equipmentOpenEntries = useMemo(
    () =>
      mapEquipmentIdToOpenRequestEntries(empId, repairQ.data ?? [], returnRequests, lossQ.data ?? [], returnLineDtos),
    [empId, repairQ.data, returnRequests, lossQ.data, returnLineDtos],
  );

  const consumablePendingByAssetItem = useMemo(
    () =>
      mapAssetItemIdToConsumablePending(empId, repairQ.data ?? [], returnRequests, lossQ.data ?? [], returnLineDtos),
    [empId, repairQ.data, returnRequests, lossQ.data, returnLineDtos],
  );
  const myDeptId = useMemo(() => {
    if (!empId || !empQ.data) return null;
    const me = empQ.data.find(x => String(x.id) === empId);
    return me?.department?.id != null ? String(me.department.id) : null;
  }, [empId, empQ.data]);
  const myLocId = resolveEmployeeLocationIdForRequests();

  const myEquipments = useMemo(
    () => filterEquipmentForMyAccount(equipments, empId, myDeptId, myLocId),
    [equipments, empId, myDeptId, myLocId],
  );

  const myConsumables = useMemo(
    () => filterConsumableAssignmentsForMyAccount(consumableAssignments, empId, myDeptId, myLocId),
    [consumableAssignments, empId, myDeptId, myLocId],
  );

  const equipmentAssignments = eqAssignQ.data ?? [];

  /** Chỉ thiết bị có bàn giao mở (returnedDate null) — khớp BE báo mất, tránh chọn nhầm khi `pickAssignment` coi «active» theo rule khác. */
  const equipmentChoices = useMemo(
    () =>
      myEquipments.filter(
        e =>
          e.status === 'IN_USE' && hasBackendOpenEquipmentAssignment(String(e.id), equipmentAssignments),
      ),
    [myEquipments, equipmentAssignments],
  );

  const consumableChoices = useMemo(
    () =>
      myConsumables.filter(
        a => consumableQuantityHeld(a) > 0 && getConsumableAssignmentDisplayStatus(a, repairRequests).status === 'IN_USE',
      ),
    [myConsumables, repairRequests],
  );

  const consumableGroups = useMemo(
    () => groupConsumableAssignmentsByAssetItem(consumableChoices),
    [consumableChoices],
  );

  const equipmentRows = useMemo(
    () => sortEquipmentForDisplay(equipmentChoices as Equipment[]),
    [equipmentChoices],
  );

  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  /** Mã mặt hàng vật tư → số lượng (chuỗi) — gộp theo mặt hàng. */
  const [selectedConsumables, setSelectedConsumables] = useState<Record<string, string>>({});

  const selectionCount = useMemo(
    () => selectedEquipmentIds.length + Object.keys(selectedConsumables).length,
    [selectedEquipmentIds, selectedConsumables],
  );

  const [lossOccurredAt, setLossOccurredAt] = useState('');
  const [lossLocation, setLossLocation] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [lossDescription, setLossDescription] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLossOccurredAt(nowDatetimeLocalValue());
  }, []);

  const initialAppliedRef = useRef(false);
  useEffect(() => {
    if (loading || initialAppliedRef.current) return;
    const eqId = initialEquipmentId?.trim();
    const aiId = initialConsumableAssetItemId?.trim();
    let k: 'EQUIPMENT' | 'CONSUMABLE' | undefined = initialKind;
    if (!k && aiId) k = 'CONSUMABLE';
    if (!k && eqId) k = 'EQUIPMENT';
    if (!k) return;

    initialAppliedRef.current = true;

    if (k === 'EQUIPMENT' && eqId) {
      const eq = equipmentChoices.find(e => String(e.id) === eqId);
      const hint = eq ? equipmentOpenHints.get(String(eq.id)) : undefined;
      if (eq && !hint) {
        setSelectedEquipmentIds([String(eq.id)]);
      }
    } else if (k === 'CONSUMABLE' && aiId) {
      const g = consumableGroups.find(x => x.assetItemId === aiId);
      const held = g ? totalHeldForConsumableGroup(g.assignments) : 0;
      const pend = consumablePendingByAssetItem.get(aiId);
      const remaining = consumableRemainingForAssetItem(held, pend);
      if (g && remaining > 0) {
        setSelectedConsumables({ [aiId]: '1' });
      }
    }
  }, [
    loading,
    initialKind,
    initialEquipmentId,
    initialConsumableAssetItemId,
    equipmentChoices,
    consumableGroups,
    equipmentOpenHints,
    consumablePendingByAssetItem,
  ]);

  const invalidateAfterLoss = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['api', 'loss-report-requests'] });
    void qc.invalidateQueries({ queryKey: ['api', 'repair-requests-view'] });
    void qc.invalidateQueries({ queryKey: ['api', 'return-requests-view'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment-assignments'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-assignments'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks-view'] });
  }, [qc]);

  const submit = async () => {
    const eid = empId != null ? Number(empId) : NaN;
    if (!Number.isFinite(eid)) {
      toast.error('Chưa liên kết nhân viên.');
      return;
    }
    if (selectedEquipmentIds.length === 0 && Object.keys(selectedConsumables).length === 0) {
      toast.error('Chọn ít nhất một thiết bị hoặc một mặt hàng vật tư.');
      return;
    }
    const ltIso = lossOccurredAtFromDatetimeLocal(lossOccurredAt);
    const ll = lossLocation.trim();
    const lr = lossReason.trim();
    const ld = lossDescription.trim();
    if (!ltIso) {
      toast.error('Chọn thời gian xảy ra / phát hiện mất.');
      return;
    }
    if (!ll) {
      toast.error('Nhập địa điểm.');
      return;
    }
    if (!lr) {
      toast.error('Nhập lý do.');
      return;
    }
    if (!ld) {
      toast.error('Nhập mô tả mất.');
      return;
    }

    setBusy(true);
    try {
      const lossEntries: {
        lineType: string;
        equipmentId?: number;
        consumableAssignmentId?: number;
        quantity?: number;
      }[] = [];

      for (const id of selectedEquipmentIds) {
        if (!hasBackendOpenEquipmentAssignment(id, equipmentAssignments)) {
          toast.error(
            'Thiết bị không còn bàn giao mở (đã thu hồi hoặc dữ liệu lệch). Làm mới trang và chọn lại.',
          );
          setBusy(false);
          return;
        }
        const eqHint = equipmentOpenHints.get(id);
        if (eqHint) {
          toast.error(`Thiết bị đang có yêu cầu sửa/thu hồi/báo mất chưa xử lý — không tạo trùng. (${eqHint})`);
          setBusy(false);
          return;
        }
        lossEntries.push({ lineType: 'EQUIPMENT', equipmentId: Number(id) });
      }

      for (const assetItemId of Object.keys(selectedConsumables)) {
        const grp = consumableGroups.find(g => g.assetItemId === assetItemId);
        if (!grp) {
          toast.error('Không tìm thấy bàn giao vật tư.');
          setBusy(false);
          return;
        }
        const h = totalHeldForConsumableGroup(grp.assignments);
        const pend = consumablePendingByAssetItem.get(assetItemId);
        const remaining = consumableRemainingForAssetItem(h, pend);
        const qtyStr = selectedConsumables[assetItemId] ?? '1';
        const q = Math.min(Math.max(1, Number.parseInt(qtyStr, 10) || 1), Math.min(h, remaining));
        if (q > remaining) {
          toast.error(
            remaining <= 0
              ? `Mặt hàng không còn SL khả dụng.${pend?.summary ? ` (${pend.summary})` : ''}`
              : `Số lượng vượt phần còn khả dụng (tối đa ${remaining}).${pend?.summary ? ` ${pend.summary}` : ''}`,
          );
          setBusy(false);
          return;
        }
        if (q < 1 || q > h) {
          toast.error(`Số lượng từ 1 đến ${h}`);
          setBusy(false);
          return;
        }
        const splits = splitConsumableLossAcrossAssignments(grp.assignments, q);
        if (splits.length === 0) {
          toast.error('Không phân bổ được số lượng trên các dòng bàn giao.');
          setBusy(false);
          return;
        }
        for (const part of splits) {
          lossEntries.push({
            lineType: 'CONSUMABLE',
            consumableAssignmentId: part.assignmentId,
            quantity: part.qty,
          });
        }
      }

      await apiPost('/api/loss-report-requests', {
        code: makeBizCode('BM'),
        requestDate: new Date().toISOString(),
        status: 'PENDING',
        lossKind: 'COMBINED',
        lossEntries,
        lossOccurredAt: ltIso,
        lossLocation: ll,
        reason: lr,
        lossDescription: ld,
        requester: { id: eid },
      });

      toast.success('Đã gửi yêu cầu báo mất — chờ QLTS xác nhận');
      invalidateAfterLoss();
      onSuccess?.();
    } catch (e) {
      const body = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(body ?? '') || (e instanceof Error ? e.message : 'Lỗi API'));
    } finally {
      setBusy(false);
    }
  };

  const noAssets = !loading && equipmentChoices.length === 0 && consumableChoices.length === 0;

  return (
    <>
      {loading ? (
        <PageLoading label="Đang tải tài sản đang giữ…" minHeight="min-h-[32vh]" />
      ) : noAssets ? (
        <p className="text-sm text-muted-foreground">
          Không có thiết bị hoặc vật tư nào đủ điều kiện báo mất. Kiểm tra «Tài sản của tôi» hoặc liên hệ QLTS.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-base font-semibold">
              Tài sản báo mất (thiết bị hoặc vật tư)
              <RequiredMark />
            </Label>
          </div>

          <AssetPickTwoColumnGrid>
            <AssetPickColumn
              icon={Monitor}
              title="Thiết bị"
            >
              {equipmentRows.length > 0 ? (
                equipmentRows.map(e => {
                  const eid = String(e.id);
                  const deviceName = e.itemId ? getItemName(e.itemId, assetItems) : '—';
                  const serial = (e.serial ?? '').trim() || '—';
                  const hint = equipmentOpenHints.get(eid);
                  const blocked = Boolean(hint);
                  const checked = !blocked && selectedEquipmentIds.includes(eid);
                  const lineText = blocked
                    ? `${deviceName} (Đã có yêu cầu sửa/báo mất/thu hồi${hint ? `: ${hint}` : ''})`
                    : `${deviceName} (Serial: ${serial})`;
                  return (
                    <AssetPickEquipmentRow
                      key={eid}
                      rowId={eid}
                      title={lineText}
                      deviceName={deviceName}
                      serial={serial}
                      blocked={blocked}
                      hint={hint}
                      openEntries={equipmentOpenEntries.get(eid)}
                      checked={checked}
                      onCheckedChange={next => {
                        setSelectedEquipmentIds(prev =>
                          next ? (prev.includes(eid) ? prev : [...prev, eid]) : prev.filter(x => x !== eid),
                        );
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
              {consumableGroups.length > 0 ? (
                consumableGroups.map(g => {
                  const itemId = g.assetItemId;
                  const held = totalHeldForConsumableGroup(g.assignments);
                  const label = itemId ? getItemName(itemId, assetItems) : '—';
                  const pend = itemId ? consumablePendingByAssetItem.get(itemId) : undefined;
                  const remaining = consumableRemainingForAssetItem(held, pend);
                  const blocked = remaining <= 0;
                  const selCo = !blocked && itemId in selectedConsumables;
                  const meta =
                    pend?.summary && pend.summary.length > 0
                      ? `(Đang giữ ${held.toLocaleString('vi-VN')} · Khả dụng ${remaining.toLocaleString('vi-VN')} | Đang có: ${pend.summary})`
                      : `(Đang giữ ${held.toLocaleString('vi-VN')} · Khả dụng ${remaining.toLocaleString('vi-VN')})`;
                  const rowTitle = `${label} ${meta}${selCo ? ` — tối đa ${Math.min(held, remaining)}` : ''}`;
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
                      checked={selCo}
                      onCheckedChange={next => {
                        if (blocked) return;
                        setSelectedConsumables(prev => {
                          const n = { ...prev };
                          if (next) n[itemId] = '1';
                          else delete n[itemId];
                          return n;
                        });
                      }}
                      quantitySlot={
                        !blocked && selCo ? (
                          <Input
                            id={`loss-qty-${itemId}`}
                            className="h-9 w-full font-sans tabular-nums"
                            type="number"
                            min={1}
                            max={Math.max(1, Math.min(held, remaining))}
                            inputMode="numeric"
                            placeholder="SL"
                            aria-label={`Nhập số lượng — tối đa ${Math.min(held, remaining)}`}
                            value={selectedConsumables[itemId] ?? '1'}
                            onChange={e =>
                              setSelectedConsumables(prev => ({
                                ...prev,
                                [itemId]: e.target.value,
                              }))
                            }
                            disabled={busy}
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
            <Label htmlFor="loss-time-page">
              Thời gian <span className="text-destructive">*</span>
            </Label>
            <Input
              id="loss-time-page"
              type="datetime-local"
              value={lossOccurredAt}
              onChange={e => setLossOccurredAt(e.target.value)}
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">Chọn ngày giờ (giờ địa phương).</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loss-place-page">
              Địa điểm <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="loss-place-page"
              placeholder="Nhập địa điểm xảy ra / phát hiện mất…"
              value={lossLocation}
              onChange={e => setLossLocation(e.target.value)}
              rows={2}
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">Địa điểm do bạn tự nhập, không lấy từ bàn giao.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loss-reason-page">
              Lý do <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="loss-reason-page"
              placeholder="Nêu lý do báo mất…"
              value={lossReason}
              onChange={e => setLossReason(e.target.value)}
              rows={2}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loss-desc-page">
              Mô tả mất <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="loss-desc-page"
              placeholder="Mô tả chi tiết…"
              value={lossDescription}
              onChange={e => setLossDescription(e.target.value)}
              rows={3}
              disabled={busy}
            />
          </div>
        </div>
      )}

      {!loading && !noAssets ? (
        <div className="flex flex-wrap gap-2 justify-end pt-2">
          {onCancelClick ? (
            <Button variant="outline" type="button" disabled={busy} onClick={onCancelClick}>
              Hủy
            </Button>
          ) : (
            <Button variant="outline" asChild disabled={busy}>
              <Link to={backTo}>Hủy</Link>
            </Button>
          )}
          <Button
            type="button"
            disabled={busy || loading || noAssets || selectionCount === 0}
            onClick={() => void submit()}
          >
            {busy ? 'Đang gửi…' : selectionCount > 1 ? `Gửi (${selectionCount})` : 'Gửi'}
          </Button>
        </div>
      ) : null}
    </>
  );
}
