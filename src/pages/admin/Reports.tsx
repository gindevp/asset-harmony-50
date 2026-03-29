import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency, calculateDepreciation } from '@/data/mockData';
import { toast } from 'sonner';
import {
  mapAssetItemDto,
  useAssetGroups,
  useAssetItems,
  useConsumableStocksView,
  useEnrichedEquipmentList,
  useStockInsView,
} from '@/hooks/useEntityApi';
import { formatEquipmentCodeDisplay } from '@/utils/formatCodes';
import { downloadCsv, reportFilename, rowsToCsv } from '@/utils/csvExport';

const COLORS = ['#ee0033', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const Reports = () => {
  const [tab, setTab] = useState('asset');
  const gQ = useAssetGroups();
  const iQ = useAssetItems();
  const eqQ = useEnrichedEquipmentList();
  const csQ = useConsumableStocksView();
  const siQ = useStockInsView();

  const assetGroups = useMemo(
    () =>
      (gQ.data ?? []).map(g => ({
        id: String(g.id),
        name: g.name ?? '',
        code: g.code ?? '',
      })),
    [gQ.data],
  );
  const assetItems = useMemo(() => (iQ.data ?? []).map(mapAssetItemDto), [iQ.data]);
  const equipments = eqQ.data ?? [];
  const consumableStocks = csQ.data ?? [];
  const stockIns = siQ.data ?? [];

  /** Giá trị mua sắm (phiếu nhập nguồn mua) theo tháng */
  const procurementByMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const doc of stockIns) {
      if (doc.source !== 'PURCHASE') continue;
      const ym = doc.createdAt.slice(0, 7);
      for (const line of doc.lines) {
        m.set(ym, (m.get(ym) ?? 0) + line.totalPrice);
      }
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({ month, amount }));
  }, [stockIns]);

  const byGroup = useMemo(
    () =>
      assetGroups
        .map(g => ({
          name: g.name,
          count: equipments.filter(eq => assetItems.find(i => i.id === eq.itemId)?.groupId === g.id).length,
        }))
        .filter(d => d.count > 0),
    [assetGroups, equipments, assetItems],
  );

  const byStatus = useMemo(
    () =>
      [
        { name: 'Tồn kho', value: equipments.filter(e => e.status === 'IN_STOCK').length },
        { name: 'Đang dùng', value: equipments.filter(e => e.status === 'IN_USE').length },
        { name: 'Đang sửa', value: equipments.filter(e => e.status === 'UNDER_REPAIR').length },
        { name: 'Hỏng', value: equipments.filter(e => e.status === 'BROKEN').length },
      ].filter(d => d.value > 0),
    [equipments],
  );

  const depData = useMemo(
    () =>
      equipments.map(eq => {
        const item = assetItems.find(i => i.id === eq.itemId);
        const dep = calculateDepreciation(eq.originalCost, eq.salvageValue, eq.depreciationMonths, eq.capitalizedDate);
        return {
          code: formatEquipmentCodeDisplay(eq.equipmentCode),
          name: item?.name || '',
          ...dep,
          originalCost: eq.originalCost,
        };
      }),
    [equipments, assetItems],
  );

  const totalOriginal = depData.reduce((s, d) => s + d.originalCost, 0);
  const totalCurrent = depData.reduce((s, d) => s + d.currentValue, 0);
  const totalAccum = depData.reduce((s, d) => s + d.accumulated, 0);

  const handleExportCsv = useCallback(() => {
    try {
      if (tab === 'asset') {
        const header = ['Nhóm', 'Số lượng'];
        const rows = byGroup.map(r => [r.name, r.count]);
        downloadCsv(reportFilename('bao-cao-tai-san'), rowsToCsv(header, rows));
      } else if (tab === 'inventory') {
        const header = ['Mã tài sản', 'Tên', 'Tồn kho', 'Tổng SL', 'Đã cấp', 'Hỏng'];
        const rows = consumableStocks.map(cs => {
          const item = assetItems.find(i => i.id === cs.itemId);
          return [
            item?.code ?? '',
            item?.name ?? '',
            cs.inStockQuantity,
            cs.totalQuantity,
            cs.issuedQuantity,
            cs.brokenQuantity,
          ];
        });
        downloadCsv(reportFilename('bao-cao-ton-kho'), rowsToCsv(header, rows));
      } else if (tab === 'depreciation') {
        const header = [
          'Mã TB',
          'Tên',
          'Nguyên giá',
          'KH/tháng',
          'KH lũy kế',
          'GT còn lại',
          'Tháng đã KH',
          'Tổng tháng KH',
        ];
        const rows = depData.map(d => [
          d.code,
          d.name,
          d.originalCost,
          d.monthlyDep,
          d.accumulated,
          d.currentValue,
          d.effectiveElapsed,
          d.totalMonths,
        ]);
        downloadCsv(reportFilename('bao-cao-khau-hao'), rowsToCsv(header, rows));
      } else if (tab === 'procurement') {
        const header = ['Tháng', 'Giá trị mua (VND)'];
        const rows = procurementByMonth.map(r => [r.month, r.amount]);
        downloadCsv(reportFilename('bao-cao-mua-sam'), rowsToCsv(header, rows));
      }
      toast.success('Đã tải CSV');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi xuất CSV');
    }
  }, [tab, byGroup, consumableStocks, assetItems, depData, procurementByMonth]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Báo cáo – Thống kê</h1>
          <p className="page-description">
            Tổng hợp tài sản, tồn kho, khấu hao — <strong>Xuất CSV</strong> theo tab đang mở (mở bằng Excel/LibreOffice).
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCsv}
          disabled={eqQ.isLoading || csQ.isLoading || gQ.isLoading || iQ.isLoading || siQ.isLoading}
        >
          <FileDown className="h-4 w-4 mr-1" /> Xuất CSV
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="asset">Tài sản</TabsTrigger>
          <TabsTrigger value="inventory">Tồn kho</TabsTrigger>
          <TabsTrigger value="depreciation">Khấu hao</TabsTrigger>
          <TabsTrigger value="procurement">Mua sắm</TabsTrigger>
        </TabsList>

        <TabsContent value="asset" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Số lượng theo nhóm</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={byGroup}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(347, 100%, 47%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Phân bổ trạng thái</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={byStatus} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Thiết bị tồn kho</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{equipments.filter(e => e.status === 'IN_STOCK').length}</div>
                <p className="text-sm text-muted-foreground mt-1">thiết bị sẵn sàng cấp phát</p>
              </CardContent>
            </Card>
            {consumableStocks.map(cs => {
              const item = assetItems.find(i => i.id === cs.itemId);
              return (
                <Card key={cs.id}>
                  <CardHeader><CardTitle className="text-base">{item?.name}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-emerald-600">{cs.inStockQuantity}</div>
                    <p className="text-sm text-muted-foreground mt-1">/ {cs.totalQuantity} tổng ({cs.issuedQuantity} đã cấp)</p>
                    <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(cs.inStockQuantity / cs.totalQuantity) * 100}%` }} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="depreciation" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Tổng nguyên giá</div>
                <div className="text-2xl font-bold">{formatCurrency(totalOriginal)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">KH lũy kế</div>
                <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalAccum)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">GT còn lại</div>
                <div className="text-2xl font-bold text-primary">{formatCurrency(totalCurrent)}</div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Chi tiết khấu hao thiết bị</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2">Mã TB</th>
                    <th className="text-left p-2">Tên</th>
                    <th className="text-right p-2">Nguyên giá</th>
                    <th className="text-right p-2">KH/tháng</th>
                    <th className="text-right p-2">KH lũy kế</th>
                    <th className="text-right p-2">GT còn lại</th>
                    <th className="text-right p-2">Tiến độ</th>
                  </tr>
                </thead>
                <tbody>
                  {depData.map(d => (
                    <tr key={d.code} className="border-b">
                      <td className="p-2 font-mono">{d.code}</td>
                      <td className="p-2">{d.name}</td>
                      <td className="p-2 text-right">{formatCurrency(d.originalCost)}</td>
                      <td className="p-2 text-right">{formatCurrency(d.monthlyDep)}</td>
                      <td className="p-2 text-right">{formatCurrency(d.accumulated)}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(d.currentValue)}</td>
                      <td className="p-2 text-right">{d.effectiveElapsed}/{d.totalMonths} tháng</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="procurement" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quy mô mua sắm theo tháng (phiếu nhập — nguồn mua)</CardTitle>
            </CardHeader>
            <CardContent>
              {procurementByMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có dữ liệu phiếu nhập mua.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={procurementByMonth.map(r => ({ name: r.month, value: r.amount }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" fill="hsl(347, 100%, 47%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
