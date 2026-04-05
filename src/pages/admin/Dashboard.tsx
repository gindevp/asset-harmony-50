import { useMemo } from 'react';
import { KPICard } from '@/components/shared/KPICard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Package, Warehouse, Monitor, Wrench, AlertTriangle, Boxes, Truck } from 'lucide-react';
import {
  allocationStatusLabels,
  formatDate,
  getEmployeeName,
  getDepartmentName,
  getItemName,
} from '@/data/mockData';
import type { AllocationRequest } from '@/data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  useAllocationRequestsView,
  useAssetItems,
  useConsumableStocksView,
  useDepartments,
  useEmployees,
  useEnrichedEquipmentList,
  useRepairRequestsView,
  useReturnRequestsView,
} from '@/hooks/useEntityApi';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard = () => {
  const eqQ = useEnrichedEquipmentList();
  const allocQ = useAllocationRequestsView();
  const repairQ = useRepairRequestsView();
  const retQ = useReturnRequestsView();
  const csQ = useConsumableStocksView();
  const itemsQ = useAssetItems();
  const empQ = useEmployees();
  const depQ = useDepartments();

  const equipments = eqQ.data ?? [];
  const allocationRequests = allocQ.data ?? [];
  const repairRequests = repairQ.data ?? [];
  const returnRequests = retQ.data ?? [];
  const consumableStocks = csQ.data ?? [];
  const assetItemsRaw = itemsQ.data ?? [];
  const employees = empQ.data ?? [];
  const departments = depQ.data ?? [];

  const loading =
    eqQ.isLoading ||
    allocQ.isLoading ||
    repairQ.isLoading ||
    retQ.isLoading ||
    csQ.isLoading ||
    itemsQ.isLoading ||
    empQ.isLoading ||
    depQ.isLoading;

  const totalEquipment = equipments.length;
  const inStock = equipments.filter(e => e.status === 'IN_STOCK').length;
  const inUse = equipments.filter(e => e.status === 'IN_USE').length;
  const underRepair = equipments.filter(e => e.status === 'UNDER_REPAIR').length;
  const broken = equipments.filter(e => e.status === 'BROKEN' || e.status === 'LOST').length;
  const consumableSkuCount = consumableStocks.length;
  const consumableInStockQty = consumableStocks.reduce((s, c) => s + c.inStockQuantity, 0);
  const consumableIssuedQty = consumableStocks.reduce((s, c) => s + c.issuedQuantity, 0);
  const statusChart = [
    { name: 'Tồn kho', value: inStock, fill: '#10b981' },
    { name: 'Đang dùng', value: inUse, fill: '#3b82f6' },
    { name: 'Đang sửa', value: underRepair, fill: '#f59e0b' },
    { name: 'Hỏng/Mất', value: broken, fill: '#ef4444' },
  ];

  const groupChart = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of equipments) {
      m.set(e.itemId, (m.get(e.itemId) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([itemId, count]) => ({
        name: getItemName(itemId, assetItemsRaw),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [equipments, assetItemsRaw]);

  const consumableStatusChart = useMemo(
    () => [
      { name: 'Tồn kho (SL)', value: consumableInStockQty, fill: '#10b981' },
      { name: 'Đã cấp phát (SL)', value: consumableIssuedQty, fill: '#3b82f6' },
    ],
    [consumableInStockQty, consumableIssuedQty],
  );

  const consumableTopChart = useMemo(
    () =>
      [...consumableStocks]
        .map(cs => ({
          name: getItemName(cs.itemId, assetItemsRaw),
          qty: cs.inStockQuantity,
        }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 8),
    [consumableStocks, assetItemsRaw],
  );

  const recentRequests = useMemo(
    () => [...allocationRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [allocationRequests],
  );

  const requestColumns: Column<AllocationRequest>[] = [
    { key: 'code', label: 'Mã YC', render: r => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: 'requester', label: 'Người yêu cầu', render: r => getEmployeeName(r.requesterId, employees) },
    { key: 'assignee', label: 'Đối tượng nhận', render: r => <span className="max-w-[10rem] truncate block">{r.assigneeSummary}</span> },
    {
      key: 'stockIssue',
      label: 'PX',
      render: r =>
        r.stockIssueCode ? (
          <span className="font-mono text-xs">{r.stockIssueCode}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: 'department', label: 'Phòng ban', render: r => getDepartmentName(r.departmentId, departments) },
    { key: 'createdAt', label: 'Ngày tạo', render: r => formatDate(r.createdAt) },
    {
      key: 'status',
      label: 'Trạng thái',
      render: r => <StatusBadge status={r.status} label={allocationStatusLabels[r.status] ?? r.status} />,
    },
  ];

  const alerts = [
    ...allocationRequests.filter(r => r.status === 'PENDING').map(r => ({
      key: `alloc-${r.id}`,
      type: 'warning' as const,
      message: `Yêu cầu cấp phát ${r.code} đang chờ duyệt`,
    })),
    ...repairRequests.filter(r => r.status === 'IN_PROGRESS').map(r => ({
      key: `repair-${r.id}`,
      type: 'repair' as const,
      message: `Yêu cầu sửa chữa ${r.code} đang xử lý`,
    })),
    ...returnRequests.filter(r => r.status === 'PENDING').map(r => ({
      key: `return-${r.id}`,
      type: 'warning' as const,
      message: `Yêu cầu thu hồi ${r.code} đang chờ duyệt`,
    })),
  ];

  if (loading && !eqQ.data) {
    return (
      <div className="page-container space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
        </div>
      </div>

      <p className="text-sm font-semibold text-muted-foreground">Thiết bị</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard title="Tổng thiết bị" value={totalEquipment} icon={Package} iconClassName="bg-accent" />
        <KPICard title="Tồn kho" value={inStock} icon={Warehouse} iconClassName="bg-emerald-100" />
        <KPICard title="Đang sử dụng" value={inUse} icon={Monitor} iconClassName="bg-blue-100" />
        <KPICard title="Đang sửa chữa" value={underRepair} icon={Wrench} iconClassName="bg-amber-100" />
        <KPICard title="Hỏng / Mất" value={broken} icon={AlertTriangle} iconClassName="bg-red-100" />
      </div>

      <p className="text-sm font-semibold text-muted-foreground mt-6">Vật tư</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Mặt hàng (tồn kho)" value={consumableSkuCount} icon={Boxes} iconClassName="bg-violet-100" />
        <KPICard title="Tồn kho (SL)" value={consumableInStockQty} icon={Warehouse} iconClassName="bg-emerald-100" />
        <KPICard title="Đã cấp phát (SL)" value={consumableIssuedQty} icon={Truck} iconClassName="bg-blue-100" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thiết bị — phân bổ theo trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="min-h-[220px] w-full min-w-0 flex-1 lg:max-w-[58%]">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusChart}
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={88}
                      dataKey="value"
                      nameKey="name"
                      label={false}
                      labelLine={false}
                      paddingAngle={1}
                    >
                      {statusChart.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} stroke="hsl(var(--background))" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, 'Số lượng']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full flex-1 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phụ lục</p>
                <ul className="space-y-2.5 text-sm">
                  {statusChart.map((s, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: s.fill }} aria-hidden />
                        <span className="truncate">{s.name}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{s.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thiết bị — theo master (top số lượng)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={groupChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(347, 100%, 47%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vật tư — tồn kho vs đã cấp phát (tổng SL)</CardTitle>
          </CardHeader>
          <CardContent>
            {consumableInStockQty === 0 && consumableIssuedQty === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chưa có dữ liệu tồn vật tư</p>
            ) : (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="min-h-[220px] w-full min-w-0 flex-1 lg:max-w-[58%]">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={consumableStatusChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={88}
                        dataKey="value"
                        nameKey="name"
                        label={false}
                        labelLine={false}
                        paddingAngle={1}
                      >
                        {consumableStatusChart.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} stroke="hsl(var(--background))" strokeWidth={1} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v, 'Số lượng']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full flex-1 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phụ lục</p>
                  <ul className="space-y-2.5 text-sm">
                    {consumableStatusChart.map((s, i) => (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: s.fill }} aria-hidden />
                          <span className="truncate">{s.name}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{s.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vật tư — top tồn kho theo mặt hàng (SL)</CardTitle>
          </CardHeader>
          <CardContent>
            {consumableTopChart.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chưa có mặt hàng vật tư</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={consumableTopChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

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
                <div key={a.key} className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.type === 'warning' ? 'bg-amber-500' : 'bg-orange-500'}`}
                  />
                  <span className="text-sm">{a.message}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Yêu cầu cấp phát gần đây</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable columns={requestColumns} data={recentRequests} pageSize={5} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tồn kho vật tư — chi tiết theo mặt hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {consumableStocks.map(cs => (
              <div key={cs.id} className="p-4 rounded-lg border space-y-2">
                <h4 className="font-medium text-sm">{getItemName(cs.itemId, assetItemsRaw)}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tổng: </span>
                    <span className="font-medium">{cs.totalQuantity}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tồn kho: </span>
                    <span className="font-medium text-emerald-600">{cs.inStockQuantity}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Đã cấp: </span>
                    <span className="font-medium text-blue-600">{cs.issuedQuantity}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Thu hồi: </span>
                    <span className="font-medium">{cs.returnedQuantity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
