import { useMemo } from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import {
  equipmentStatusLabels,
  getItemName,
  formatDate,
  formatCurrency,
  calculateDepreciation,
} from '@/data/mockData';
import { resolveEmployeeIdForRequests, resolveEmployeeLocationIdForRequests } from '@/api/account';
import { getStoredToken } from '@/api/http';
import { hasAnyAuthority } from '@/auth/jwt';
import { mapAssetItemDto, useAssetItems, useEmployees, useEnrichedEquipmentList } from '@/hooks/useEntityApi';
import type { Equipment } from '@/data/mockData';
import {
  filterEquipmentWithDepartmentPeers,
  myAssetScopeLabel,
  resolveMyAssetScopeWithPeers,
} from '@/utils/myEquipment';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';

const MyAssets = () => {
  const eqQ = useEnrichedEquipmentList();
  const iQ = useAssetItems();
  const empQ = useEmployees();
  const equipments = eqQ.data ?? [];
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);

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

  const columns: Column<Equipment>[] = [
    {
      key: 'equipmentCode',
      label: 'Mã TB',
      render: r => (
        <span className="font-mono text-sm font-medium">{formatEquipmentCodeDisplay(r.equipmentCode)}</span>
      ),
    },
    {
      key: 'scope',
      label: 'Phạm vi',
      render: r => (
        <span className="text-sm text-muted-foreground">
          {myAssetScopeLabel(resolveMyAssetScopeWithPeers(r, empId, myDeptId, myLocId, peerIdsForScope))}
        </span>
      ),
    },
    { key: 'name', label: 'Tên thiết bị', render: r => getItemName(r.itemId, assetItems) },
    { key: 'serial', label: 'Serial' },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={equipmentStatusLabels[r.status]} /> },
    { key: 'originalCost', label: 'Nguyên giá', render: r => formatCurrency(r.originalCost), className: 'text-right' },
    {
      key: 'currentValue',
      label: 'GT còn lại',
      render: r => {
        const dep = calculateDepreciation(r.originalCost, r.salvageValue, r.depreciationMonths, r.capitalizedDate);
        return formatCurrency(dep.currentValue);
      },
      className: 'text-right',
    },
    { key: 'capitalizedDate', label: 'Ngày cấp', render: r => formatDate(r.capitalizedDate) },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tài sản của tôi</h1>
          <p className="page-description">
            {empId
              ? <>
                  Thiết bị đang gán <strong>cá nhân</strong>, <strong>phòng ban</strong> của bạn (theo HRM), hoặc{' '}
                  <strong>vị trí</strong> nếu đã cấu hình (dev: <code className="text-xs">VITE_DEV_LOCATION_ID</code>).
                  {isDeptCoordinator && (
                    <> Với vai trò <strong>điều phối phòng ban</strong>, bạn còn xem thiết bị đang gán cho đồng nghiệp cùng phòng.</>
                  )}
                </>
              : <>Chưa liên kết nhân viên với tài khoản — liên hệ Admin.</>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Tổng thiết bị</div>
            <div className="text-2xl font-bold">{myEquipments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Đang sử dụng</div>
            <div className="text-2xl font-bold text-blue-600">{myEquipments.filter(e => e.status === 'IN_USE').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Tổng giá trị</div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(myEquipments.reduce((s, e) => s + e.originalCost, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={myEquipments}
        emptyMessage={
          empId
            ? 'Không có thiết bị gán cho bạn, phòng ban hoặc vị trí của bạn (theo bàn giao đang hiệu lực).'
            : 'Chưa xác định nhân viên — đăng nhập lại sau khi Admin gán liên kết.'
        }
      />
    </div>
  );
};

export default MyAssets;
