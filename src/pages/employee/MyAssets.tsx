import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  equipments, Equipment, equipmentStatusLabels, getItemName,
  getDepartmentName, formatDate, formatCurrency, calculateDepreciation
} from '@/data/mockData';

const currentUserId = 'emp-2';

const MyAssets = () => {
  const myEquipments = equipments.filter(e => e.assignedTo === currentUserId);

  const columns: Column<Equipment>[] = [
    { key: 'equipmentCode', label: 'Mã TB', render: r => <span className="font-mono text-sm font-medium">{r.equipmentCode}</span> },
    { key: 'name', label: 'Tên thiết bị', render: r => getItemName(r.itemId) },
    { key: 'serial', label: 'Serial' },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={equipmentStatusLabels[r.status]} /> },
    { key: 'originalCost', label: 'Nguyên giá', render: r => formatCurrency(r.originalCost), className: 'text-right' },
    { key: 'currentValue', label: 'GT còn lại', render: r => {
      const dep = calculateDepreciation(r.originalCost, r.salvageValue, r.depreciationMonths, r.capitalizedDate);
      return formatCurrency(dep.currentValue);
    }, className: 'text-right' },
    { key: 'capitalizedDate', label: 'Ngày cấp', render: r => formatDate(r.capitalizedDate) },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tài sản của tôi</h1>
          <p className="page-description">Danh sách tài sản được cấp phát cho bạn</p>
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
            <div className="text-2xl font-bold text-primary">{formatCurrency(myEquipments.reduce((s, e) => s + e.originalCost, 0))}</div>
          </CardContent>
        </Card>
      </div>

      <DataTable columns={columns} data={myEquipments} emptyMessage="Bạn chưa được cấp phát tài sản nào" />
    </div>
  );
};

export default MyAssets;
