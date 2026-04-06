import { useMemo } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import {
  equipmentStatusLabels,
  getItemCode,
  getItemName,
  getItemUnit,
  formatDate,
} from '@/data/mockData';
import { resolveEmployeeIdForRequests, resolveEmployeeLocationIdForRequests } from '@/api/account';
import {
  mapAssetItemDto,
  useAssetItems,
  useConsumableAssignments,
  useEmployees,
  useEnrichedEquipmentList,
  useLossReportRequests,
  useRepairRequestsView,
  useReturnRequestsView,
} from '@/hooks/useEntityApi';
import {
  filterConsumableAssignmentsForMyAccount,
  filterEquipmentForMyAccount,
  getConsumableAssignmentDisplayStatus,
} from '@/utils/myEquipment';
import {
  groupConsumableAssignmentsByAssetItem,
  sortEquipmentForDisplay,
  totalHeldForConsumableGroup,
  totalReturnedForConsumableGroup,
  type GroupedConsumableRow,
} from '@/utils/myHoldingsAggregate';
import { mapAssetItemIdToConsumablePending } from '@/utils/openAssetRequestBlocks';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import type { Equipment, RepairRequest } from '@/data/mockData';
import type { ConsumableAssignmentDto } from '@/api/types';
import { PageLoading } from '@/components/shared/page-loading';

type MyConsumableGroupRow = GroupedConsumableRow & { id: string };

function getConsumableGroupDisplayStatus(
  g: GroupedConsumableRow,
  repairRequests: RepairRequest[],
  pending: ReturnType<typeof mapAssetItemIdToConsumablePending>,
  approvedLossSet: Set<string>,
): { status: string; label: string } {
  const held = totalHeldForConsumableGroup(g.assignments);
  const pend = pending.get(g.assetItemId);
  if (held <= 0) {
    const anyLost = g.assignments.some(a => approvedLossSet.has(String(a.id ?? '')));
    if (anyLost) return { status: 'LOST', label: equipmentStatusLabels.LOST };
    return { status: 'IN_STOCK', label: equipmentStatusLabels.IN_STOCK };
  }
  if ((pend?.repairQty ?? 0) > 0) {
    return { status: 'UNDER_REPAIR', label: equipmentStatusLabels.UNDER_REPAIR };
  }
  for (const a of g.assignments) {
    const st = getConsumableAssignmentDisplayStatus(a, repairRequests, approvedLossSet);
    if (st.status === 'UNDER_REPAIR') return st;
  }
  return { status: 'IN_USE', label: equipmentStatusLabels.IN_USE };
}

const MyAssets = () => {
  const eqQ = useEnrichedEquipmentList();
  const caQ = useConsumableAssignments();
  const repairQ = useRepairRequestsView();
  const returnQ = useReturnRequestsView();
  const lossQ = useLossReportRequests();
  const iQ = useAssetItems();
  const empQ = useEmployees();
  const equipments = eqQ.data ?? [];
  const repairRequests = repairQ.data ?? [];
  const returnRequests = returnQ.data ?? [];
  const consumableAssignments = caQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const listLoading =
    eqQ.isLoading || caQ.isLoading || repairQ.isLoading || returnQ.isLoading || lossQ.isLoading;

  const approvedLossConsumableIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of lossQ.data ?? []) {
      if (r.status !== 'APPROVED') continue;
      if (r.lossKind === 'CONSUMABLE' && r.consumableAssignment?.id != null) {
        s.add(String(r.consumableAssignment.id));
      }
      if (r.lossKind === 'COMBINED' && r.lossEntries?.length) {
        for (const line of r.lossEntries) {
          if (String(line.lineType ?? '').toUpperCase() === 'CONSUMABLE' && line.consumableAssignmentId != null) {
            s.add(String(line.consumableAssignmentId));
          }
        }
      }
    }
    return s;
  }, [lossQ.data]);

  const empId = resolveEmployeeIdForRequests();
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
    () =>
      filterConsumableAssignmentsForMyAccount(
        consumableAssignments,
        empId,
        myDeptId,
        myLocId,
        approvedLossConsumableIds,
      ),
    [consumableAssignments, empId, myDeptId, myLocId, approvedLossConsumableIds],
  );

  const equipmentSorted = useMemo(() => sortEquipmentForDisplay(myEquipments), [myEquipments]);

  const consumablePendingByAssetItem = useMemo(
    () => mapAssetItemIdToConsumablePending(empId, repairRequests, returnRequests, lossQ.data ?? []),
    [empId, repairRequests, returnRequests, lossQ.data],
  );

  const consumableGroupRows = useMemo(
    (): MyConsumableGroupRow[] =>
      groupConsumableAssignmentsByAssetItem(myConsumables).map(g => ({ ...g, id: g.assetItemId })),
    [myConsumables],
  );

  const totalConsumableQtyHeld = useMemo(
    () => consumableGroupRows.reduce((s, g) => s + totalHeldForConsumableGroup(g.assignments), 0),
    [consumableGroupRows],
  );

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
      consumableGroupRows.filter(
        g =>
          getConsumableGroupDisplayStatus(
            g,
            repairRequests,
            consumablePendingByAssetItem,
            approvedLossConsumableIds,
          ).status === 'IN_USE',
      ).length,
    [consumableGroupRows, repairRequests, consumablePendingByAssetItem, approvedLossConsumableIds],
  );

  const consumableUnderRepairRowCount = useMemo(
    () =>
      consumableGroupRows.filter(
        g =>
          getConsumableGroupDisplayStatus(
            g,
            repairRequests,
            consumablePendingByAssetItem,
            approvedLossConsumableIds,
          ).status === 'UNDER_REPAIR',
      ).length,
    [consumableGroupRows, repairRequests, consumablePendingByAssetItem, approvedLossConsumableIds],
  );

  const equipmentColumns: Column<Equipment>[] = useMemo(
    () => [
      {
        key: 'equipmentCode',
        label: 'Mã thiết bị',
        render: e => (
          <span className="font-mono text-sm font-medium">{formatEquipmentCodeDisplay(e.equipmentCode)}</span>
        ),
      },
      {
        key: 'itemCode',
        label: 'Mã danh mục',
        render: e => (
          <span className="font-mono text-sm">{e.itemId ? getItemCode(e.itemId, assetItems) : '—'}</span>
        ),
      },
      {
        key: 'name',
        label: 'Tên (danh mục)',
        render: e => (e.itemId ? getItemName(e.itemId, assetItems) : '—'),
      },
      {
        key: 'serial',
        label: 'Serial',
        render: e => (e.serial ?? '').trim() || '—',
      },
      {
        key: 'status',
        label: 'Trạng thái',
        render: e => (
          <StatusBadge status={e.status} label={equipmentStatusLabels[e.status] ?? e.status} />
        ),
      },
      {
        key: 'capitalizedDate',
        label: 'Ngày bàn giao',
        render: e => formatDate(e.capitalizedDate ?? ''),
      },
    ],
    [assetItems],
  );

  const consumableColumns: Column<MyConsumableGroupRow>[] = useMemo(
    () => [
      {
        key: 'code',
        label: 'Mã vật tư',
        render: g => {
          const id = g.assetItemId;
          const first = g.assignments[0];
          const fromApi = first?.assetItem?.code?.trim();
          const fromCatalog = id ? getItemCode(id, assetItems) : '';
          const code = fromApi || fromCatalog;
          return <span className="font-mono text-sm font-medium">{code?.trim() || '—'}</span>;
        },
      },
      {
        key: 'name',
        label: 'Tên (danh mục)',
        render: g => {
          const id = g.assetItemId;
          const first = g.assignments[0];
          return id ? getItemName(id, assetItems) : first?.assetItem?.name?.trim() || '—';
        },
      },
      {
        key: 'unit',
        label: 'ĐVT',
        render: g => {
          const id = g.assetItemId;
          const fromApi = g.assignments[0]?.assetItem?.unit?.trim();
          if (fromApi) return fromApi;
          return id ? getItemUnit(id, assetItems) : '—';
        },
      },
      {
        key: 'status',
        label: 'Trạng thái',
        render: g => {
          const { status, label } = getConsumableGroupDisplayStatus(
            g,
            repairRequests,
            consumablePendingByAssetItem,
            approvedLossConsumableIds,
          );
          return <StatusBadge status={status} label={label} />;
        },
      },
      {
        key: 'qtyHeld',
        label: 'SL còn giữ',
        className: 'text-right font-medium',
        render: g => totalHeldForConsumableGroup(g.assignments).toLocaleString('vi-VN'),
      },
      {
        key: 'repairPending',
        label: 'Đang sửa chữa',
        className: 'text-right tabular-nums',
        render: g => {
          const q = consumablePendingByAssetItem.get(g.assetItemId)?.repairQty ?? 0;
          return <span className="font-medium">{(q > 0 ? q : 0).toLocaleString('vi-VN')}</span>;
        },
      },
      {
        key: 'lossPending',
        label: 'Mất',
        className: 'text-right tabular-nums',
        render: g => {
          const q = consumablePendingByAssetItem.get(g.assetItemId)?.lossQty ?? 0;
          return <span className="font-medium">{(q > 0 ? q : 0).toLocaleString('vi-VN')}</span>;
        },
      },
      {
        key: 'returned',
        label: 'Đã thu hồi',
        className: 'text-right text-muted-foreground',
        render: g => totalReturnedForConsumableGroup(g.assignments).toLocaleString('vi-VN'),
      },
      {
        key: 'assignedDate',
        label: 'Ngày BG (sớm nhất)',
        render: g => {
          const dates = g.assignments
            .map(a => a.assignedDate)
            .filter((d): d is string => Boolean(d))
            .sort();
          return formatDate(dates[0] ?? '');
        },
      },
    ],
    [assetItems, repairRequests, consumablePendingByAssetItem, approvedLossConsumableIds],
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
                <span className="font-semibold tabular-nums">{listLoading ? '—' : consumableGroupRows.length}</span>
                <span className="text-muted-foreground"> mặt hàng</span>
                {!listLoading && consumableGroupRows.length > 0 && (
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

      {listLoading ? (
        <PageLoading minHeight="min-h-[50vh]" />
      ) : (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Số lượng thiết bị</div>
            <div className="text-2xl font-bold tabular-nums">{listLoading ? '—' : myEquipments.length}</div>
            <div className="text-xs text-muted-foreground mt-1">đơn vị: chiếc</div>
            <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/60">
              Vật tư:{' '}
              <span className="font-medium text-foreground tabular-nums">
                {listLoading ? '—' : consumableGroupRows.length}
              </span>{' '}
              mặt hàng
              {!listLoading && consumableGroupRows.length > 0 && (
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
              mặt hàng đang giữ (chưa trong phiếu sửa chữa)
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
              mặt hàng trong phiếu sửa chữa
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Số lượng vật tư</div>
            <div className="text-2xl font-bold text-emerald-800 tabular-nums">
              {listLoading ? '—' : consumableGroupRows.length}
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
                — {myEquipments.length} chiếc (từng dòng một)
              </span>
            )}
          </h2>
        </div>
      <DataTable
        columns={equipmentColumns}
        data={equipmentSorted}
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
                — {consumableGroupRows.length} mặt hàng (gộp theo mã) · tổng SL còn{' '}
                <span className="tabular-nums">{totalConsumableQtyHeld.toLocaleString('vi-VN')}</span>
              </span>
            )}
          </h2>
        </div>
        <DataTable
          columns={consumableColumns}
          data={consumableGroupRows}
          emptyMessage={
            empId
              ? 'Không có vật tư đang gán cho bạn, phòng ban hoặc vị trí (theo phiếu cấp còn hiệu lực).'
              : 'Không thể lọc vật tư — chưa gán nhân viên.'
          }
        />
        {!listLoading && consumableGroupRows.length > 0 && (
          <p className="text-sm text-muted-foreground pt-1">
            Số mặt hàng vật tư (đã gộp theo mã): <span className="font-medium text-foreground tabular-nums">{consumableGroupRows.length}</span> — tổng số
            lượng còn giữ:{' '}
            <span className="font-medium text-foreground tabular-nums">{totalConsumableQtyHeld.toLocaleString('vi-VN')}</span>
          </p>
        )}
      </div>
      </>
      )}

    </div>
  );
};

export default MyAssets;
