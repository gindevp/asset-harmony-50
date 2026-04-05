import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { makeBizCode } from '@/api/businessCode';
import { ApiError, apiPost, getStoredToken, parseProblemDetailJson } from '@/api/http';
import { resolveEmployeeIdForRequests, resolveEmployeeLocationIdForRequests } from '@/api/account';
import { hasAnyAuthority } from '@/auth/jwt';
import {
  mapAssetItemDto,
  useAssetItems,
  useConsumableAssignments,
  useEmployees,
  useEnrichedEquipmentList,
  useRepairRequestsView,
} from '@/hooks/useEntityApi';
import { getItemCode, getItemName } from '@/data/mockData';
import {
  consumableQuantityHeld,
  filterConsumableAssignmentsWithDepartmentPeers,
  filterEquipmentWithDepartmentPeers,
  getConsumableAssignmentDisplayStatus,
} from '@/utils/myEquipment';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import {
  lossLocationLabelFromConsumableAssignment,
  lossLocationLabelFromEquipment,
  lossOccurredAtFromDatetimeLocal,
  nowDatetimeLocalValue,
} from '@/utils/lossReportForm';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { toast } from 'sonner';

type LossKind = 'EQUIPMENT' | 'CONSUMABLE';

export interface LossReportCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gọi sau khi gửi thành công (vd invalidate list). */
  onSuccess?: () => void;
}

/**
 * Form tạo YC báo mất (thiết bị / vật tư đang giữ) — cùng quy tắc lọc với «Tài sản của tôi».
 */
export function LossReportCreateModal({ open, onOpenChange, onSuccess }: LossReportCreateModalProps) {
  const qc = useQueryClient();
  const eqQ = useEnrichedEquipmentList();
  const caQ = useConsumableAssignments();
  const repairQ = useRepairRequestsView();
  const iQ = useAssetItems();
  const empQ = useEmployees();
  const repairRequests = repairQ.data ?? [];
  const equipments = eqQ.data ?? [];
  const consumableAssignments = caQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const loading = eqQ.isLoading || caQ.isLoading;

  const empId = resolveEmployeeIdForRequests();
  const myDeptId = useMemo(() => {
    if (!empId || !empQ.data) return null;
    const me = empQ.data.find(x => String(x.id) === empId);
    return me?.department?.id != null ? String(me.department.id) : null;
  }, [empId, empQ.data]);
  const myLocId = resolveEmployeeLocationIdForRequests();

  const deptPeerIds = useMemo(() => {
    if (!myDeptId || !empQ.data) return [] as string[];
    return empQ.data.filter(e => String(e.department?.id ?? '') === myDeptId).map(e => String(e.id ?? ''));
  }, [myDeptId, empQ.data]);

  const isDeptCoordinator = hasAnyAuthority(getStoredToken(), ['ROLE_DEPARTMENT_COORDINATOR']);

  const myEquipments = useMemo(
    () =>
      filterEquipmentWithDepartmentPeers(
        equipments,
        empId,
        myDeptId,
        myLocId,
        isDeptCoordinator ? deptPeerIds : [],
      ),
    [equipments, empId, myDeptId, myLocId, isDeptCoordinator, deptPeerIds],
  );

  const myConsumables = useMemo(
    () =>
      filterConsumableAssignmentsWithDepartmentPeers(
        consumableAssignments,
        empId,
        myDeptId,
        myLocId,
        isDeptCoordinator ? deptPeerIds : [],
      ),
    [consumableAssignments, empId, myDeptId, myLocId, isDeptCoordinator, deptPeerIds],
  );

  const equipmentChoices = useMemo(() => myEquipments.filter(e => e.status === 'IN_USE'), [myEquipments]);

  const consumableChoices = useMemo(
    () =>
      myConsumables.filter(
        a => consumableQuantityHeld(a) > 0 && getConsumableAssignmentDisplayStatus(a, repairRequests).status === 'IN_USE',
      ),
    [myConsumables, repairRequests],
  );

  const [kind, setKind] = useState<LossKind>('EQUIPMENT');
  const [equipmentId, setEquipmentId] = useState('');
  const [consumableAssignmentId, setConsumableAssignmentId] = useState('');
  const [lossQty, setLossQty] = useState(1);
  const [lossOccurredAt, setLossOccurredAt] = useState('');
  const [lossLocation, setLossLocation] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [lossDescription, setLossDescription] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setKind('EQUIPMENT');
      setEquipmentId('');
      setConsumableAssignmentId('');
      setLossQty(1);
      setLossOccurredAt('');
      setLossLocation('');
      setLossReason('');
      setLossDescription('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLossOccurredAt(nowDatetimeLocalValue());
  }, [open]);

  const selectedEquipment = useMemo(
    () => equipmentChoices.find(e => String(e.id) === equipmentId),
    [equipmentChoices, equipmentId],
  );

  const selectedConsumable = useMemo(
    () => consumableChoices.find(a => String(a.id) === consumableAssignmentId),
    [consumableChoices, consumableAssignmentId],
  );

  const held = selectedConsumable ? consumableQuantityHeld(selectedConsumable) : 0;

  useEffect(() => {
    if (kind !== 'CONSUMABLE' || !selectedConsumable) return;
    setLossQty(q => Math.min(Math.max(1, q), Math.max(1, held)));
  }, [kind, selectedConsumable, held]);

  useEffect(() => {
    if (!open) return;
    if (kind === 'EQUIPMENT' && selectedEquipment) {
      setLossLocation(lossLocationLabelFromEquipment(selectedEquipment));
    } else if (kind === 'CONSUMABLE' && selectedConsumable) {
      setLossLocation(lossLocationLabelFromConsumableAssignment(selectedConsumable));
    } else {
      setLossLocation('');
    }
  }, [open, kind, selectedEquipment, selectedConsumable]);

  const equipmentOptions = useMemo(() => {
    return equipmentChoices.map(e => ({
      value: String(e.id),
      label: `${formatEquipmentCodeDisplay(e.equipmentCode)} — ${e.itemId ? getItemName(e.itemId, assetItems) : '—'}`,
      searchText: `${e.equipmentCode} ${e.itemId ? getItemName(e.itemId, assetItems) : ''}`,
    }));
  }, [equipmentChoices, assetItems]);

  const consumableOptions = useMemo(() => {
    return consumableChoices.map(a => {
      const id = a.assetItem?.id != null ? String(a.assetItem.id) : '';
      const code = a.assetItem?.code?.trim() || (id ? getItemCode(id, assetItems) : '');
      const name = id ? getItemName(id, assetItems) : a.assetItem?.name?.trim() || '—';
      const h = consumableQuantityHeld(a);
      return {
        value: String(a.id),
        label: `${code || name} — còn ${h.toLocaleString('vi-VN')}`,
        searchText: `${code} ${name} ${h}`,
      };
    });
  }, [consumableChoices, assetItems]);

  const invalidateAfterLoss = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['api', 'loss-report-requests'] });
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
      if (kind === 'EQUIPMENT') {
        if (!equipmentId.trim()) {
          toast.error('Chọn thiết bị.');
          setBusy(false);
          return;
        }
        await apiPost('/api/loss-report-requests', {
          code: makeBizCode('BM'),
          requestDate: new Date().toISOString(),
          status: 'PENDING',
          lossKind: 'EQUIPMENT',
          lossOccurredAt: ltIso,
          lossLocation: ll,
          reason: lr,
          lossDescription: ld,
          requester: { id: eid },
          equipment: { id: Number(equipmentId) },
        });
      } else {
        if (!consumableAssignmentId.trim()) {
          toast.error('Chọn dòng vật tư.');
          setBusy(false);
          return;
        }
        const ca = consumableChoices.find(a => String(a.id) === consumableAssignmentId);
        if (!ca) {
          toast.error('Không tìm thấy bàn giao vật tư.');
          setBusy(false);
          return;
        }
        const h = consumableQuantityHeld(ca);
        const q = Math.min(Math.max(1, lossQty), h);
        if (q < 1 || q > h) {
          toast.error(`Số lượng từ 1 đến ${h}`);
          setBusy(false);
          return;
        }
        await apiPost('/api/loss-report-requests', {
          code: makeBizCode('BM'),
          requestDate: new Date().toISOString(),
          status: 'PENDING',
          lossKind: 'CONSUMABLE',
          quantity: q,
          lossOccurredAt: ltIso,
          lossLocation: ll,
          reason: lr,
          lossDescription: ld,
          requester: { id: eid },
          consumableAssignment: { id: Number(consumableAssignmentId) },
        });
      }
      toast.success('Đã gửi yêu cầu báo mất — chờ QLTS xác nhận');
      onOpenChange(false);
      invalidateAfterLoss();
      onSuccess?.();
    } catch (e) {
      const body = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(body ?? '') || (e instanceof Error ? e.message : 'Lỗi API'));
    } finally {
      setBusy(false);
    }
  };

  const noAssets =
    !loading && equipmentChoices.length === 0 && consumableChoices.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo yêu cầu báo mất</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Đang tải tài sản đang giữ…</p>
        ) : noAssets ? (
          <p className="text-sm text-muted-foreground">
            Không có thiết bị hoặc vật tư nào đủ điều kiện báo mất. Kiểm tra «Tài sản của tôi» hoặc liên hệ QLTS.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={kind === 'EQUIPMENT' ? 'default' : 'outline'}
                disabled={equipmentChoices.length === 0}
                onClick={() => setKind('EQUIPMENT')}
              >
                Thiết bị
              </Button>
              <Button
                type="button"
                size="sm"
                variant={kind === 'CONSUMABLE' ? 'default' : 'outline'}
                disabled={consumableChoices.length === 0}
                onClick={() => setKind('CONSUMABLE')}
              >
                Vật tư
              </Button>
            </div>

            {kind === 'EQUIPMENT' && (
              <div className="space-y-2">
                <Label>Chọn thiết bị</Label>
                <SearchableSelect
                  value={equipmentId}
                  onValueChange={setEquipmentId}
                  options={equipmentOptions}
                  placeholder="Chọn mã thiết bị…"
                  searchPlaceholder="Tìm mã, tên…"
                  emptyText={equipmentOptions.length === 0 ? 'Không có thiết bị đủ điều kiện' : 'Không khớp'}
                  disabled={busy}
                  triggerClassName="w-full"
                />
              </div>
            )}

            {kind === 'CONSUMABLE' && (
              <>
                <div className="space-y-2">
                  <Label>Chọn vật tư (bàn giao)</Label>
                  <SearchableSelect
                    value={consumableAssignmentId}
                    onValueChange={setConsumableAssignmentId}
                    options={consumableOptions}
                    placeholder="Chọn dòng vật tư…"
                    searchPlaceholder="Tìm mã, tên…"
                    emptyText={consumableOptions.length === 0 ? 'Không có vật tư còn giữ' : 'Không khớp'}
                    disabled={busy}
                    triggerClassName="w-full"
                  />
                </div>
                {selectedConsumable && held > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="loss-qty-modal">Số lượng báo mất (tối đa {held.toLocaleString('vi-VN')})</Label>
                    <Input
                      id="loss-qty-modal"
                      type="number"
                      min={1}
                      max={held}
                      value={lossQty}
                      onChange={e => setLossQty(Number(e.target.value))}
                      disabled={busy}
                    />
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="loss-time-modal">
                Thời gian <span className="text-destructive">*</span>
              </Label>
              <Input
                id="loss-time-modal"
                type="datetime-local"
                value={lossOccurredAt}
                onChange={e => setLossOccurredAt(e.target.value)}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">Chọn ngày giờ (giờ địa phương).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="loss-place-modal">
                Địa điểm <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="loss-place-modal"
                placeholder="Điền từ vị trí / phòng ban bàn giao — có thể sửa…"
                value={lossLocation}
                onChange={e => setLossLocation(e.target.value)}
                rows={2}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loss-reason-modal">
                Lý do <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="loss-reason-modal"
                placeholder="Nêu lý do báo mất…"
                value={lossReason}
                onChange={e => setLossReason(e.target.value)}
                rows={2}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loss-desc-modal">
                Mô tả mất <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="loss-desc-modal"
                placeholder="Mô tả chi tiết…"
                value={lossDescription}
                onChange={e => setLossDescription(e.target.value)}
                rows={3}
                disabled={busy}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            type="button"
            disabled={busy || loading || noAssets}
            onClick={() => void submit()}
          >
            Gửi yêu cầu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
