import { KPICard } from '@/components/shared/KPICard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable, Column } from '@/components/shared/DataTable';
import {
  Package, Warehouse, Monitor, Wrench, AlertTriangle, BarChart3, TrendingUp
} from 'lucide-react';
import {
  equipments, allocationRequests, repairRequests, returnRequests,
  allocationStatusLabels, repairStatusLabels, returnStatusLabels,
  getEmployeeName, getDepartmentName, formatDate, getItemName,
  consumableStocks, assetItems
} from '@/data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard = () => {
  const totalEquipment = equipments.length;
  const inStock = equipments.filter(e => e.status === 'IN_STOCK').length;
  const inUse = equipments.filter(e => e.status === 'IN_USE').length;
  const underRepair = equipments.filter(e => e.status === 'UNDER_REPAIR').length;
  const broken = equipments.filter(e => e.status === 'BROKEN' || e.status === 'LOST').length;
  const totalConsumable = consumableStocks.reduce((s, c) => s + c.totalQuantity, 0);
  const pendingRequests = allocationRequests.filter(r => r.status === 'CHO_DUYET').length;

  const statusChart = [
    { name: 'Tồn kho', value: inStock, fill: '#10b981' },
    { name: 'Đang dùng', value: inUse, fill: '#3b82f6' },
    { name: 'Đang sửa', value: underRepair, fill: '#f59e0b' },
    { name: 'Hỏng/Mất', value: broken, fill: '#ef4444' },
  ];

  const groupChart = [
    { name: 'Laptop', count: equipments.filter(e => ['item-1','item-2'].includes(e.itemId)).length },
    { name: 'Màn hình', count: equipments.filter(e => e.itemId === 'item-3').length },
    { name: 'Máy in', count: equipments.filter(e => e.itemId === 'item-4').length },
    { name: 'Mạng', count: equipments.filter(e => e.itemId === 'item-8').length },
  ];

  const recentRequests = [...allocationRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  const requestColumns: Column<typeof recentRequests[0]>[] = [
    { key: 'code', label: 'Mã YC', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'requester', label: 'Người yêu cầu', render: r => getEmployeeName(r.requesterId) },
    { key: 'department', label: 'Phòng ban', render: r => getDepartmentName(r.departmentId) },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} label={allocationStatusLabels[r.status]} /> },
  ];

  const alerts = [
    ...allocationRequests.filter(r => r.status === 'CHO_DUYET').map(r => ({
      id: r.id, type: 'warning' as const, message: `Yêu cầu cấp phát ${r.code} đang chờ duyệt`
    })),
    ...repairRequests.filter(r => r.status === 'DANG_SUA').map(r => ({
      id: r.id, type: 'repair' as const, message: `Yêu cầu sửa chữa ${r.code} đang xử lý`
    })),
    ...returnRequests.filter(r => r.status === 'CHO_DUYET').map(r => ({
      id: r.id, type: 'warning' as const, message: `Yêu cầu thu hồi ${r.code} đang chờ duyệt`
    })),
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Tổng quan hệ thống quản lý tài sản nội bộ</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard title="Tổng thiết bị" value={totalEquipment} icon={Package} iconClassName="bg-accent" />
        <KPICard title="Tồn kho" value={inStock} icon={Warehouse} iconClassName="bg-emerald-100" />
        <KPICard title="Đang sử dụng" value={inUse} icon={Monitor} iconClassName="bg-blue-100" />
        <KPICard title="Đang sửa chữa" value={underRepair} icon={Wrench} iconClassName="bg-amber-100" />
        <KPICard title="Hỏng / Mất" value={broken} icon={AlertTriangle} iconClassName="bg-red-100" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phân bổ theo trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusChart} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {statusChart.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Số lượng theo nhóm thiết bị</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={groupChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(347, 100%, 47%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Recent Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Cảnh báo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có cảnh báo</p>
            ) : (
              alerts.map(a => (
                <div key={a.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.type === 'warning' ? 'bg-amber-500' : 'bg-orange-500'}`} />
                  <span className="text-sm">{a.message}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Yêu cầu gần đây</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable columns={requestColumns} data={recentRequests} pageSize={5} />
          </CardContent>
        </Card>
      </div>

      {/* Consumable summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tồn kho vật tư</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {consumableStocks.map(cs => {
              const item = assetItems.find(i => i.id === cs.itemId);
              return (
                <div key={cs.id} className="p-4 rounded-lg border space-y-2">
                  <h4 className="font-medium text-sm">{item?.name}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Tổng: </span><span className="font-medium">{cs.totalQuantity}</span></div>
                    <div><span className="text-muted-foreground">Tồn kho: </span><span className="font-medium text-emerald-600">{cs.inStockQuantity}</span></div>
                    <div><span className="text-muted-foreground">Đã cấp: </span><span className="font-medium text-blue-600">{cs.issuedQuantity}</span></div>
                    <div><span className="text-muted-foreground">Thu hồi: </span><span className="font-medium">{cs.returnedQuantity}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
