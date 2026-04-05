import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  equipmentStatusLabels,
  getItemCode,
  getItemName,
  getItemUnit,
  formatDate,
} from '@/data/mockData';
import { resolveEmployeeIdForRequests, resolveEmployeeLocationIdForRequests } from '@/api/account';
import { makeBizCode } from '@/api/businessCode';
import { ApiError, apiPost, getStoredToken, parseProblemDetailJson } from '@/api/http';
import { hasAnyAuthority } from '@/auth/jwt';
import type { ConsumableAssignmentDto } from '@/api/types';
import {
  mapAssetItemDto,
  useAssetItems,
  useConsumableAssignments,
  useEmployees,
  useEnrichedEquipmentList,
  useRepairRequestsView,
} from '@/hooks/useEntityApi';
import type { Equipment } from '@/data/mockData';
import {
  consumableQuantityHeld,
  filterConsumableAssignmentsWithDepartmentPeers,
  filterEquipmentWithDepartmentPeers,
  myAssetScopeLabel,
  resolveMyAssetScopeWithPeers,
  resolveMyConsumableScopeWithPeers,
  getConsumableAssignmentDisplayStatus,
} from '@/utils/myEquipment';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import {
  lossLocationLabelFromConsumableAssignment,
  lossLocationLabelFromEquipment,
  lossOccurredAtFromDatetimeLocal,
  nowDatetimeLocalValue,
} from '@/utils/lossReportForm';
import { toast } from 'sonner';

type LossDialogState =
  | null
  | { kind: 'equipment'; equipment: Equipment }
  | { kind: 'consumable'; assignment: ConsumableAssignmentDto };

const MyAssets = () => {
  const qc = useQueryClient();
  const eqQ = useEnrichedEquipmentList();
  const caQ = useConsumableAssignments();
  const repairQ = useRepairRequestsView();
  const iQ = useAssetItems();
  const empQ = useEmployees();
  const equipments = eqQ.data ?? [];
  const repairRequests = repairQ.data ?? [];
  const consumableAssignments = caQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const listLoading = eqQ.isLoading || caQ.isLoading || repairQ.isLoading;

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

  const peerIdsForScope =
    isDeptCoordinator && deptPeerIds.length > 0 ? deptPeerIds : undefined;

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

  const totalConsumableQtyHeld = useMemo(
    () => myConsumables.reduce((s, a) => s + consumableQuantityHeld(a), 0),
    [myConsumables],
  );

  const [lossDialog, setLossDialog] = useState<LossDialogState>(null);
  const [lossContextAt, setLossContextAt] = useState('');
  const [lossContextLocation, setLossContextLocation] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [lossDescription, setLossDescription] = useState('');
  const [lossQty, setLossQty] = useState(1);
  const [lossBusy, setLossBusy] = useState(false);

  useEffect(() => {
    if (!lossDialog) {
      setLossContextAt('');
      setLossContextLocation('');
      return;
    }
    setLossContextAt(nowDatetimeLocalValue());
    if (lossDialog.kind === 'equipment') {
      setLossContextLocation(lossLocationLabelFromEquipment(lossDialog.equipment));
    } else {
      setLossContextLocation(lossLocationLabelFromConsumableAssignment(lossDialog.assignment));
    }
    setLossReason('');
    setLossDescription('');
  }, [lossDialog]);

  useEffect(() => {
    if (!lossDialog || lossDialog.kind !== 'consumable') return;
    const held = consumableQuantityHeld(lossDialog.assignment);
    setLossQty(h => Math.min(Math.max(1, h), Math.max(1, held)));
  }, [lossDialog]);

  const invalidateAfterLoss = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['api', 'loss-report-requests'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment'] });
    void qc.invalidateQueries({ queryKey: ['api', 'equipment-assignments'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-assignments'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks'] });
    void qc.invalidateQueries({ queryKey: ['api', 'consumable-stocks-view'] });
  }, [qc]);

  const submitLossReport = async () => {
    const eid = empId != null ? Number(empId) : NaN;
    if (!Number.isFinite(eid)) {
      toast.error('Chưa liên kết nhân viên.');
      return;
    }
    if (!lossDialog) return;
    const ltIso = lossOccurredAtFromDatetimeLocal(lossContextAt);
    const ll = lossContextLocation.trim();
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
    setLossBusy(true);
    try {
      if (lossDialog.kind === 'equipment') {
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
          equipment: { id: Number(lossDialog.equipment.id) },
        });
      } else {
        const held = consumableQuantityHeld(lossDialog.assignment);
        const q = Math.min(Math.max(1, lossQty), held);
        if (q < 1 || q > held) {
          toast.error(`Số lượng từ 1 đến ${held}`);
          setLossBusy(false);
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
          consumableAssignment: { id: Number(lossDialog.assignment.id) },
        });
      }
      toast.success('Đã gửi yêu cầu báo mất — chờ QLTS xác nhận');
      setLossDialog(null);
      setLossContextAt('');
      setLossContextLocation('');
      setLossReason('');
      setLossDescription('');
      setLossQty(1);
      invalidateAfterLoss();
    } catch (e) {
      const body = e instanceof ApiError ? e.body : undefined;
      toast.error(parseProblemDetailJson(body ?? '') || (e instanceof Error ? e.message : 'Lỗi API'));
    } finally {
      setLossBusy(false);
    }
  };

  const equipmentInUseCount = useMemo(
    () => myEquipments.filter(e => e.status === 'IN_USE').length,
    [myEquipments],
  );

  const equipmentUnderRepairCount = useMemo(
    () => myEquipments.filter(e => e.status === 'UNDER_REPAIR').length,
    [myEquipments],
  );

  const consumableInUseRowCount = useMemo(
    () =>
      myConsumables.filter(
        a => getConsumableAssignmentDisplayStatus(a, repairRequests).status === 'IN_USE',
      ).length,
    [myConsumables, repairRequests],
  );

  const consumableUnderRepairRowCount = useMemo(
    () =>
      myConsumables.filter(
        a => getConsumableAssignmentDisplayStatus(a, repairRequests).status === 'UNDER_REPAIR',
      ).length,
    [myConsumables, repairRequests],
  );

  const columns: Column<Equipment>[] = useMemo(
    () => [
      {
        key: 'qty',
        label: 'SL (chiếc)',
        className: 'text-right w-[6.5rem]',
        render: () => <span className="tabular-nums">1</span>,
      },
      {
        key: 'equipmentCode',
        label: 'Mã thiết bị',
        render: r => (
          <span className="font-mono text-sm font-medium">{formatEquipmentCodeDisplay(r.equipmentCode)}</span>
        ),
      },
      {
        key: 'itemCode',
        label: 'Mã danh mục',
        render: r => (
          <span className="font-mono text-sm">
            {r.itemId ? getItemCode(r.itemId, assetItems) : '—'}
          </span>
        ),
      },
      {
        key: 'name',
        label: 'Tên (danh mục)',
        render: r => (r.itemId ? getItemName(r.itemId, assetItems) : '—'),
      },
      { key: 'serial', label: 'Serial' },
      {
        key: 'scope',
        label: 'Phạm vi',
        render: r => (
          <span className="text-sm text-muted-foreground">
            {myAssetScopeLabel(resolveMyAssetScopeWithPeers(r, empId, myDeptId, myLocId, peerIdsForScope))}
          </span>
        ),
      },
      { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={equipmentStatusLabels[r.status]} /> },
      { key: 'capitalizedDate', label: 'Ngày bàn giao', render: r => formatDate(r.capitalizedDate) },
      {
        key: 'loss',
        label: 'Báo mất',
        className: 'w-[7rem]',
        render: r => {
          const can = empId && r.status === 'IN_USE';
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={!can || lossBusy}
              onClick={() => setLossDialog({ kind: 'equipment', equipment: r })}
            >
              Báo mất
            </Button>
          );
        },
      },
    ],
    [assetItems, empId, myDeptId, myLocId, peerIdsForScope, lossBusy],
  );

  const consumableColumns: Column<ConsumableAssignmentDto>[] = useMemo(
    () => [
    {
      key: 'code',
      label: 'Mã vật tư',
      render: r => {
        const id = r.assetItem?.id != null ? String(r.assetItem.id) : '';
        const fromApi = r.assetItem?.code?.trim();
        const fromCatalog = id ? getItemCode(id, assetItems) : '';
        const code = fromApi || fromCatalog;
        return <span className="font-mono text-sm font-medium">{code?.trim() || '—'}</span>;
      },
    },
    {
      key: 'name',
      label: 'Tên (danh mục)',
      render: r =>
        r.assetItem?.id != null ? getItemName(String(r.assetItem.id), assetItems) : (r.assetItem?.name?.trim() || '—'),
    },
    {
      key: 'unit',
      label: 'ĐVT',
      render: r => {
        const id = r.assetItem?.id != null ? String(r.assetItem.id) : '';
        const fromApi = r.assetItem?.unit?.trim();
        if (fromApi) return fromApi;
        return id ? getItemUnit(id, assetItems) : '—';
      },
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: r => {
        const { status, label } = getConsumableAssignmentDisplayStatus(r, repairRequests);
        return <StatusBadge status={status} label={label} />;
      },
    },
    {
      key: 'scope',
      label: 'Phạm vi',
      render: r => (
        <span className="text-sm text-muted-foreground">
          {myAssetScopeLabel(
            resolveMyConsumableScopeWithPeers(r, empId, myDeptId, myLocId, isDeptCoordinator ? deptPeerIds : undefined),
          )}
        </span>
      ),
    },
    {
      key: 'qtyHeld',
      label: 'SL còn giữ',
      className: 'text-right font-medium',
      render: r => consumableQuantityHeld(r).toLocaleString('vi-VN'),
    },
    {
      key: 'returned',
      label: 'Đã thu hồi',
      className: 'text-right text-muted-foreground',
      render: r => (r.returnedQuantity ?? 0).toLocaleString('vi-VN'),
    },
    { key: 'assignedDate', label: 'Ngày bàn giao', render: r => formatDate(r.assignedDate ?? '') },
      {
        key: 'loss',
        label: 'Báo mất',
        className: 'w-[7rem]',
        render: r => {
          const held = consumableQuantityHeld(r);
          const st = getConsumableAssignmentDisplayStatus(r, repairRequests).status;
          const can = empId && held > 0 && st === 'IN_USE';
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={!can || lossBusy}
              onClick={() => {
                setLossQty(Math.min(held, 1));
                setLossDialog({ kind: 'consumable', assignment: r });
              }}
            >
              Báo mất
            </Button>
          );
        },
      },
    ],
    [assetItems, empId, myDeptId, myLocId, isDeptCoordinator, deptPeerIds, lossBusy, repairRequests],
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="space-y-2">
          <h1 className="page-title">Tài sản của tôi</h1>
          {!empId ? (
            <p className="text-sm text-muted-foreground max-w-3xl">
              Chưa xác định nhân viên — đăng nhập lại sau khi Admin gán liên kết tài khoản với hồ sơ nhân viên.
            </p>
          ) : null}
          {empId && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                <span className="text-muted-foreground">Số lượng thiết bị:</span>{' '}
                <span className="font-semibold tabular-nums">{listLoading ? '—' : myEquipments.length}</span>
                <span className="text-muted-foreground"> chiếc</span>
                {!listLoading && myEquipments.length > 0 && (
                  <span className="text-muted-foreground">
                    {' '}
                    (đang dùng: {equipmentInUseCount})
                  </span>
                )}
              </span>
              <span className="text-muted-foreground hidden sm:inline">·</span>
              <span>
                <span className="text-muted-foreground">Số lượng vật tư:</span>{' '}
                <span className="font-semibold tabular-nums">{listLoading ? '—' : myConsumables.length}</span>
                <span className="text-muted-foreground"> dòng</span>
                {!listLoading && myConsumables.length > 0 && (
                  <>
                    <span className="text-muted-foreground"> — tổng SL còn giữ: </span>
                    <span className="font-semibold tabular-nums text-emerald-800">
                      {totalConsumableQtyHeld.toLocaleString('vi-VN')}
                    </span>
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Số lượng thiết bị</div>
            <div className="text-2xl font-bold tabular-nums">{listLoading ? '—' : myEquipments.length}</div>
            <div className="text-xs text-muted-foreground mt-1">đơn vị: chiếc</div>
            <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/60">
              Vật tư:{' '}
              <span className="font-medium text-foreground tabular-nums">
                {listLoading ? '—' : myConsumables.length}
              </span>{' '}
              dòng
              {!listLoading && myConsumables.length > 0 && (
                <>
                  {' '}
                  · tổng SL còn giữ{' '}
                  <span className="font-medium text-emerald-800 tabular-nums">
                    {totalConsumableQtyHeld.toLocaleString('vi-VN')}
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Đang sử dụng</div>
            <div className="text-2xl font-bold text-blue-600 tabular-nums">
              {listLoading ? '—' : equipmentInUseCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">thiết bị · trên tổng {listLoading ? '—' : myEquipments.length} chiếc</div>
            <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/60">
              Vật tư:{' '}
              <span className="font-medium text-emerald-800 tabular-nums">
                {listLoading ? '—' : consumableInUseRowCount}
              </span>{' '}
              dòng đang giữ (chưa trong phiếu sửa chữa)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Đang sửa chữa</div>
            <div className="text-2xl font-bold text-amber-600 tabular-nums">
              {listLoading ? '—' : equipmentUnderRepairCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">thiết bị</div>
            <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/60">
              Vật tư:{' '}
              <span className="font-medium text-amber-700 tabular-nums">
                {listLoading ? '—' : consumableUnderRepairRowCount}
              </span>{' '}
              dòng trong phiếu sửa chữa
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Số lượng vật tư</div>
            <div className="text-2xl font-bold text-emerald-800 tabular-nums">
              {listLoading ? '—' : myConsumables.length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {listLoading ? '—' : `${totalConsumableQtyHeld.toLocaleString('vi-VN')} SL còn giữ (tổng)`}
            </div>
            <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/60">
              Thiết bị:{' '}
              <span className="font-medium text-foreground tabular-nums">
                {listLoading ? '—' : myEquipments.length}
              </span>{' '}
              chiếc (danh sách phía trên)
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-10 space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Thiết bị
            {!listLoading && (
              <span className="font-normal text-muted-foreground">
                {' '}
                — {myEquipments.length} chiếc
              </span>
            )}
          </h2>
        </div>
        <DataTable
          columns={columns}
          data={myEquipments}
          emptyMessage={
            empId
              ? 'Không có thiết bị gán cho bạn, phòng ban hoặc vị trí của bạn (theo bàn giao đang hiệu lực).'
              : 'Không thể lọc thiết bị — chưa gán nhân viên.'
          }
        />
        {!listLoading && myEquipments.length > 0 && (
          <p className="text-sm text-muted-foreground pt-1">
            Tổng số lượng thiết bị: <span className="font-medium text-foreground tabular-nums">{myEquipments.length}</span> chiếc
            {equipmentInUseCount > 0 && (
              <>
                {' '}
                (đang sử dụng:{' '}
                <span className="font-medium text-foreground tabular-nums">{equipmentInUseCount}</span>)
              </>
            )}
          </p>
        )}
      </div>

      <div className="mt-10 space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Vật tư đang giữ
            {!listLoading && (
              <span className="font-normal text-muted-foreground">
                {' '}
                — {myConsumables.length} dòng · tổng SL còn{' '}
                <span className="tabular-nums">{totalConsumableQtyHeld.toLocaleString('vi-VN')}</span>
              </span>
            )}
          </h2>
        </div>
        <DataTable
          columns={consumableColumns}
          data={myConsumables}
          emptyMessage={
            empId
              ? 'Không có vật tư đang gán cho bạn, phòng ban hoặc vị trí (theo phiếu cấp còn hiệu lực).'
              : 'Không thể lọc vật tư — chưa gán nhân viên.'
          }
        />
        {!listLoading && myConsumables.length > 0 && (
          <p className="text-sm text-muted-foreground pt-1">
            Tổng số dòng vật tư: <span className="font-medium text-foreground tabular-nums">{myConsumables.length}</span> — tổng số
            lượng còn giữ:{' '}
            <span className="font-medium text-foreground tabular-nums">{totalConsumableQtyHeld.toLocaleString('vi-VN')}</span>
          </p>
        )}
      </div>

      <Dialog
        open={!!lossDialog}
        onOpenChange={open => {
          if (!open) setLossDialog(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Báo mất tài sản</DialogTitle>
          </DialogHeader>
          {lossDialog?.kind === 'equipment' && (
            <p className="text-sm text-muted-foreground">
              Thiết bị:{' '}
              <span className="font-mono font-medium text-foreground">
                {formatEquipmentCodeDisplay(lossDialog.equipment.equipmentCode)}
              </span>
            </p>
          )}
          {lossDialog?.kind === 'consumable' && (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Vật tư:{' '}
                <span className="font-medium text-foreground">
                  {lossDialog.assignment.assetItem?.id != null
                    ? getItemName(String(lossDialog.assignment.assetItem.id), assetItems)
                    : (lossDialog.assignment.assetItem?.name ?? '—')}
                </span>
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="loss-qty">Số lượng báo mất (còn giữ tối đa {consumableQuantityHeld(lossDialog.assignment)})</Label>
                <Input
                  id="loss-qty"
                  type="number"
                  min={1}
                  max={consumableQuantityHeld(lossDialog.assignment)}
                  value={lossQty}
                  onChange={e => setLossQty(Number(e.target.value))}
                  disabled={lossBusy}
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="loss-time">Thời gian <span className="text-destructive">*</span></Label>
            <Input
              id="loss-time"
              type="datetime-local"
              value={lossContextAt}
              onChange={e => setLossContextAt(e.target.value)}
              disabled={lossBusy}
            />
            <p className="text-xs text-muted-foreground">Chọn ngày giờ (giờ địa phương). Có thể chỉnh sau khi điền mặc định.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loss-place">Địa điểm <span className="text-destructive">*</span></Label>
            <Textarea
              id="loss-place"
              placeholder="Điền từ vị trí / phòng ban bàn giao — có thể sửa…"
              value={lossContextLocation}
              onChange={e => setLossContextLocation(e.target.value)}
              rows={2}
              disabled={lossBusy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loss-reason">Lý do <span className="text-destructive">*</span></Label>
            <Textarea
              id="loss-reason"
              placeholder="Nêu lý do báo mất…"
              value={lossReason}
              onChange={e => setLossReason(e.target.value)}
              rows={2}
              disabled={lossBusy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loss-desc">Mô tả mất <span className="text-destructive">*</span></Label>
            <Textarea
              id="loss-desc"
              placeholder="Mô tả chi tiết tình huống mất…"
              value={lossDescription}
              onChange={e => setLossDescription(e.target.value)}
              rows={3}
              disabled={lossBusy}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={lossBusy} onClick={() => setLossDialog(null)}>
              Hủy
            </Button>
            <Button type="button" disabled={lossBusy} onClick={() => void submitLossReport()}>
              Gửi yêu cầu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyAssets;
