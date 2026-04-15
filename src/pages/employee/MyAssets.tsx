import { useMemo } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import {
  getItemCode,
  getItemName,
  getItemUnit,
  formatDateTime,
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
  equipmentIdsOnOpenReturnForRequester,
  filterConsumableAssignmentsForMyAccount,
  filterEquipmentForMyAccount,
  getEquipmentDisplayStatusForMyAssets,
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
import type { Equipment } from '@/data/mockData';
import type { ConsumableAssignmentDto } from '@/api/types';
import { PageLoading } from '@/components/shared/page-loading';

type MyConsumableGroupRow = GroupedConsumableRow & { id: string };

function consumableGroupHasApprovedLoss(g: GroupedConsumableRow, approvedLossIds: Set<string>): boolean {
  return g.assignments.some(a => approvedLossIds.has(String(a.id ?? '')));
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
  const returnRequests = returnQ.data?.requests ?? [];
  const returnLineDtos = returnQ.data?.lineDtos;
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
    () => mapAssetItemIdToConsumablePending(empId, repairRequests, returnRequests, lossQ.data ?? [], returnLineDtos),
    [empId, repairRequests, returnRequests, lossQ.data, returnLineDtos],
  );

  const consumableGroupRows = useMemo((): MyConsumableGroupRow[] => {
    const rows = groupConsumableAssignmentsByAssetItem(myConsumables).map(g => ({ ...g, id: g.assetItemId }));
    return rows.filter(g => {
      const held = totalHeldForConsumableGroup(g.assignments);
      const pend = consumablePendingByAssetItem.get(g.assetItemId);
      const hasPending =
        (pend?.returnQty ?? 0) > 0 || (pend?.repairQty ?? 0) > 0 || (pend?.lossQty ?? 0) > 0;
      const showLossOnly = held <= 0 && consumableGroupHasApprovedLoss(g, approvedLossConsumableIds);
      return held > 0 || hasPending || showLossOnly;
    });
  }, [myConsumables, consumablePendingByAssetItem, approvedLossConsumableIds]);

  const totalConsumableQtyHeld = useMemo(
    () => consumableGroupRows.reduce((s, g) => s + totalHeldForConsumableGroup(g.assignments), 0),
    [consumableGroupRows],
  );

  const equipmentOnOpenReturnIds = useMemo(
    () => equipmentIdsOnOpenReturnForRequester(empId, returnRequests),
    [empId, returnRequests],
  );

  /** Đang sử dụng thực sự — không tính thiết bị đã gửi thu hồi (hiển thị «Chờ thu hồi»). */
  const equipmentInUseCount = useMemo(
    () =>
      myEquipments.filter(
        e => e.status === 'IN_USE' && !equipmentOnOpenReturnIds.has(String(e.id)),
      ).length,
    [myEquipments, equipmentOnOpenReturnIds],
  );

  const equipmentUnderRepairCount = useMemo(
    () => myEquipments.filter(e => e.status === 'UNDER_REPAIR').length,
    [myEquipments],
  );

  const equipmentLostCount = useMemo(
    () => myEquipments.filter(e => e.status === 'LOST').length,
    [myEquipments],
  );

  const consumableInUseRowCount = useMemo(
    () => consumableGroupRows.filter(g => totalHeldForConsumableGroup(g.assignments) > 0).length,
    [consumableGroupRows],
  );

  const consumableUnderRepairRowCount = useMemo(
    () =>
      consumableGroupRows.filter(g => (consumablePendingByAssetItem.get(g.assetItemId)?.repairQty ?? 0) > 0).length,
    [consumableGroupRows, consumablePendingByAssetItem],
  );

  const consumableLostRowCount = useMemo(
    () =>
      consumableGroupRows.filter(
        g =>
          totalHeldForConsumableGroup(g.assignments) <= 0 &&
          consumableGroupHasApprovedLoss(g, approvedLossConsumableIds),
      ).length,
    [consumableGroupRows, approvedLossConsumableIds],
  );

  /** Phiếu thu hồi mở (chờ duyệt / đã duyệt chưa hoàn tất) — thiết bị nằm trong phiếu của tôi. */
  const equipmentInReturnCount = useMemo(
    () => myEquipments.filter(e => equipmentOnOpenReturnIds.has(String(e.id))).length,
    [myEquipments, equipmentOnOpenReturnIds],
  );

  /** Mặt hàng vật tư có SL đang trong phiếu thu hồi mở. */
  const consumableInReturnRowCount = useMemo(
    () =>
      consumableGroupRows.filter(
        g => (consumablePendingByAssetItem.get(g.assetItemId)?.returnQty ?? 0) > 0,
      ).length,
    [consumableGroupRows, consumablePendingByAssetItem],
  );

  /** Mặt hàng vật tư — tổng SL đang trong phiếu thu hồi mở (theo assetItem). */
  const consumableReturnQtyPending = useMemo(() => {
    let s = 0;
    for (const g of consumableGroupRows) {
      s += consumablePendingByAssetItem.get(g.assetItemId)?.returnQty ?? 0;
    }
    return s;
  }, [consumableGroupRows, consumablePendingByAssetItem]);

  /** Một «đơn vị» danh sách: 1 thiết bị hoặc 1 mặt hàng vật tư (gộp). */
  const totalAssetLineCount = useMemo(
    () => myEquipments.length + consumableGroupRows.length,
    [myEquipments, consumableGroupRows],
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
        render: e => {
          const { status, label } = getEquipmentDisplayStatusForMyAssets(e, empId, returnRequests);
          return <StatusBadge status={status} label={label} />;
        },
      },
      {
        key: 'capitalizedDate',
        label: 'Thời điểm bàn giao',
        render: e => formatDateTime(e.capitalizedDate ?? ''),
      },
    ],
    [assetItems, empId, returnRequests],
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
        key: 'inUseQty',
        label: 'Đang sử dụng',
        className: 'text-right font-medium tabular-nums',
        render: g => {
          const held = totalHeldForConsumableGroup(g.assignments);
          return held.toLocaleString('vi-VN');
        },
      },
      {
        key: 'returned',
        label: 'Đã thu hồi',
        className: 'text-right text-muted-foreground tabular-nums',
        render: g => {
          const pend = consumablePendingByAssetItem.get(g.assetItemId)?.returnQty ?? 0;
          const done = totalReturnedForConsumableGroup(g.assignments);
          const total = done + pend;
          return (
            <span className="font-medium">
              {total.toLocaleString('vi-VN')}
              {pend > 0 ? <span className="text-xs text-muted-foreground"> ({pend.toLocaleString('vi-VN')} chờ)</span> : null}
            </span>
          );
        },
      },
      {
        key: 'lost',
        label: 'Đã mất',
        className: 'text-right text-muted-foreground tabular-nums',
        render: g => {
          const pend = consumablePendingByAssetItem.get(g.assetItemId)?.lossQty ?? 0;
          let approved = 0;
          for (const a of g.assignments) {
            if (!approvedLossConsumableIds.has(String(a.id ?? ''))) continue;
            const q = a.quantity ?? 0;
            const r = a.returnedQuantity ?? 0;
            approved += Math.max(0, q - r);
          }
          const total = pend + approved;
          return (
            <span className="font-medium">
              {total.toLocaleString('vi-VN')}
              {pend > 0 ? <span className="text-xs text-muted-foreground"> ({pend.toLocaleString('vi-VN')} chờ)</span> : null}
            </span>
          );
        },
      },
      {
        key: 'assignedDate',
        label: 'BG sớm nhất (ngày giờ)',
        render: g => {
          const dates = g.assignments
            .map(a => a.assignedDate)
            .filter((d): d is string => Boolean(d))
            .sort();
          return formatDateTime(dates[0] ?? '');
        },
      },
    ],
    [assetItems, consumablePendingByAssetItem, approvedLossConsumableIds],
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
                <span className="text-muted-foreground">Tổng tài sản (dòng danh sách):</span>{' '}
                <span className="font-semibold tabular-nums text-fuchsia-600 dark:text-fuchsia-300">
                  {listLoading ? '—' : totalAssetLineCount}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  —{' '}
                  {listLoading
                    ? '…'
                    : `${myEquipments.length} thiết bị · ${consumableGroupRows.length} mặt hàng vật tư`}
                </span>
              </span>
              {!listLoading && consumableGroupRows.length > 0 && (
                <>
                  <span className="text-muted-foreground hidden sm:inline">·</span>
                  <span>
                    <span className="text-muted-foreground">Tổng vật tư đang sử dụng:</span>{' '}
                    <span className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                      {totalConsumableQtyHeld.toLocaleString('vi-VN')}
                    </span>
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {listLoading ? (
        <PageLoading minHeight="min-h-[50vh]" />
      ) : (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-950/20 border-fuchsia-100/80 dark:border-fuchsia-900/50 shadow-sm">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-fuchsia-800 dark:text-fuchsia-200">Tổng tài sản</div>
            <div className="text-2xl font-bold tabular-nums text-fuchsia-600 dark:text-fuchsia-300">
              {listLoading ? '—' : totalAssetLineCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">thiết bị + mặt hàng vật tư (số dòng danh sách)</div>
            <div className="text-xs mt-2 pt-2 border-t border-fuchsia-200/90 dark:border-fuchsia-800/50 space-y-0.5">
              <div>
                <span className="text-muted-foreground">Thiết bị:</span>{' '}
                <span className="font-semibold tabular-nums text-foreground">{listLoading ? '—' : myEquipments.length}</span>{' '}
                <span className="text-muted-foreground">chiếc</span>
              </div>
              <div>
                <span className="text-muted-foreground">Vật tư:</span>{' '}
                <span className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                  {listLoading ? '—' : consumableGroupRows.length}
                </span>{' '}
                <span className="text-muted-foreground">mặt hàng</span>
                {!listLoading && consumableGroupRows.length > 0 && (
                  <>
                    {' '}
                    <span className="text-muted-foreground">· đang sử dụng</span>{' '}
                    <span className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                      {totalConsumableQtyHeld.toLocaleString('vi-VN')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-sky-400 bg-sky-50 dark:bg-sky-950/20 border-sky-100/80 dark:border-sky-900/50 shadow-sm">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-sky-800 dark:text-sky-200">Đang sử dụng</div>
            <div className="text-2xl font-bold text-sky-500 dark:text-sky-300 tabular-nums">
              {listLoading ? '—' : equipmentInUseCount + consumableInUseRowCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">tổng dòng đang dùng (TB + VT)</div>
            <div className="text-xs mt-2 pt-2 border-t border-sky-200/90 dark:border-sky-800/50 space-y-0.5">
              <div>
                <span className="text-muted-foreground">Thiết bị:</span>{' '}
                <span className="font-semibold tabular-nums">{listLoading ? '—' : equipmentInUseCount}</span>{' '}
                <span className="text-muted-foreground">chiếc</span>
              </div>
              <div>
                <span className="text-muted-foreground">Vật tư:</span>{' '}
                <span className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                  {listLoading ? '—' : consumableInUseRowCount}
                </span>{' '}
                <span className="text-muted-foreground">mặt hàng đang giữ</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-100/80 dark:border-amber-900/50 shadow-sm">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-amber-800 dark:text-amber-200">Đang sửa chữa</div>
            <div className="text-2xl font-bold text-amber-500 dark:text-amber-300 tabular-nums">
              {listLoading ? '—' : equipmentUnderRepairCount + consumableUnderRepairRowCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">tổng dòng trong phiếu sửa chữa</div>
            <div className="text-xs mt-2 pt-2 border-t border-amber-200/90 dark:border-amber-800/50 space-y-0.5">
              <div>
                <span className="text-muted-foreground">Thiết bị:</span>{' '}
                <span className="font-semibold tabular-nums">{listLoading ? '—' : equipmentUnderRepairCount}</span>{' '}
                <span className="text-muted-foreground">chiếc</span>
              </div>
              <div>
                <span className="text-muted-foreground">Vật tư:</span>{' '}
                <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                  {listLoading ? '—' : consumableUnderRepairRowCount}
                </span>{' '}
                <span className="text-muted-foreground">mặt hàng</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-400 bg-teal-50 dark:bg-teal-950/20 border-teal-100/80 dark:border-teal-900/50 shadow-sm">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-teal-800 dark:text-teal-200">Thu hồi</div>
            <div className="text-2xl font-bold text-teal-500 dark:text-teal-300 tabular-nums">
              {listLoading ? '—' : equipmentInReturnCount + consumableInReturnRowCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">phiếu thu hồi chờ / đang xử lý (chưa hoàn tất)</div>
            <div className="text-xs mt-2 pt-2 border-t border-teal-200/90 dark:border-teal-800/50 space-y-0.5">
              <div>
                <span className="text-muted-foreground">Thiết bị:</span>{' '}
                <span className="font-semibold tabular-nums">{listLoading ? '—' : equipmentInReturnCount}</span>{' '}
                <span className="text-muted-foreground">chiếc trong phiếu</span>
              </div>
              <div>
                <span className="text-muted-foreground">Vật tư:</span>{' '}
                <span className="font-semibold tabular-nums text-teal-800 dark:text-teal-300">
                  {listLoading ? '—' : consumableInReturnRowCount}
                </span>{' '}
                <span className="text-muted-foreground">mặt hàng</span>
                {!listLoading && consumableInReturnRowCount > 0 && (
                  <>
                    {' '}
                    <span className="text-muted-foreground">· SL yêu cầu</span>{' '}
                    <span className="font-semibold tabular-nums text-teal-800 dark:text-teal-300">
                      {consumableReturnQtyPending.toLocaleString('vi-VN')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-400 bg-rose-50 dark:bg-rose-950/20 border-rose-100/80 dark:border-rose-900/50 shadow-sm">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-rose-800 dark:text-rose-200">Mất</div>
            <div className="text-2xl font-bold text-rose-500 dark:text-rose-300 tabular-nums">
              {listLoading ? '—' : equipmentLostCount + consumableLostRowCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">đã xác nhận mất (thiết bị + mặt hàng vật tư)</div>
            <div className="text-xs mt-2 pt-2 border-t border-rose-200/90 dark:border-rose-800/50 space-y-0.5">
              <div>
                <span className="text-muted-foreground">Thiết bị:</span>{' '}
                <span className="font-semibold tabular-nums">{listLoading ? '—' : equipmentLostCount}</span>{' '}
                <span className="text-muted-foreground">chiếc</span>
              </div>
              <div>
                <span className="text-muted-foreground">Vật tư:</span>{' '}
                <span className="font-semibold tabular-nums text-rose-800 dark:text-rose-300">
                  {listLoading ? '—' : consumableLostRowCount}
                </span>{' '}
                <span className="text-muted-foreground">mặt hàng (đã báo mất, duyệt)</span>
              </div>
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
                — {consumableGroupRows.length} mặt hàng (gộp theo mã) · tổng đang sử dụng{' '}
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
            lượng đang sử dụng:{' '}
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
