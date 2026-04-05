import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
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

/** Nhãn trục Y ngắn (tránh số VND dài bị cắt trên biểu đồ). */
function formatVndAxisValue(n: number): string {
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)} n`;
  return String(Math.round(n));
}

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
  /** Mua sắm theo tháng — tách thiết bị / vật tư (giá trị dòng phiếu nhập) */
  const procurementByMonthSplit = useMemo(() => {
    const m = new Map<string, { device: number; consumable: number }>();
    for (const doc of stockIns) {
      if (doc.source !== 'PURCHASE') continue;
      const ym = doc.createdAt.slice(0, 7);
      for (const line of doc.lines) {
        const item = assetItems.find(i => i.id === line.itemId);
        const isConsumable = item?.managementType === 'CONSUMABLE';
        const cur = m.get(ym) ?? { device: 0, consumable: 0 };
        if (isConsumable) cur.consumable += line.totalPrice;
        else cur.device += line.totalPrice;
        m.set(ym, cur);
      }
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, device: v.device, consumable: v.consumable }));
  }, [stockIns, assetItems]);

  const totalConsumableInStockQty = useMemo(
    () => consumableStocks.reduce((s, c) => s + c.inStockQuantity, 0),
    [consumableStocks],
  );
  const totalConsumableIssuedQty = useMemo(
    () => consumableStocks.reduce((s, c) => s + c.issuedQuantity, 0),
    [consumableStocks],
  );

  /** Cùng trục nhóm: số thiết bị (cái) + tồn kho vật tư (SL) */
  const byGroupCombined = useMemo(
    () =>
      assetGroups
        .map(g => {
          const equipment = equipments.filter(
            eq => assetItems.find(i => i.id === eq.itemId)?.groupId === g.id,
          ).length;
          const consumableQty = consumableStocks
            .filter(cs => assetItems.find(i => i.id === cs.itemId)?.groupId === g.id)
            .reduce((s, cs) => s + cs.inStockQuantity, 0);
          return { name: g.name, equipment, consumableQty };
        })
        .filter(d => d.equipment > 0 || d.consumableQty > 0),
    [assetGroups, equipments, assetItems, consumableStocks],
  );

  const byStatus = useMemo(
    () =>
      [
        { name: 'Tồn kho', value: equipments.filter(e => e.status === 'IN_STOCK').length, fill: COLORS[0] },
        { name: 'Đang dùng', value: equipments.filter(e => e.status === 'IN_USE').length, fill: COLORS[1] },
        { name: 'Đang sửa', value: equipments.filter(e => e.status === 'UNDER_REPAIR').length, fill: COLORS[2] },
        { name: 'Hỏng', value: equipments.filter(e => e.status === 'BROKEN').length, fill: COLORS[3] },
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
        const header = ['Nhóm', 'Thiết bị (cái)', 'Vật tư tồn kho (SL)'];
        const rows = byGroupCombined.map(r => [r.name, r.equipment, r.consumableQty]);
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
        const header = ['Tháng', 'Thiết bị (VND)', 'Vật tư (VND)', 'Tổng (VND)'];
        const rows = procurementByMonthSplit.map(r => [
          r.month,
          r.device,
          r.consumable,
          r.device + r.consumable,
        ]);
        downloadCsv(reportFilename('bao-cao-mua-sam'), rowsToCsv(header, rows));
      }
      toast.success('Đã tải CSV');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi xuất CSV');
    }
  }, [tab, byGroupCombined, consumableStocks, assetItems, depData, procurementByMonthSplit]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Báo cáo – Thống kê</h1>
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
              <CardHeader>
                <CardTitle className="text-base">Theo nhóm — thiết bị (cái) &amp; vật tư tồn kho (SL)</CardTitle>
              </CardHeader>
              <CardContent>
                {byGroupCombined.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Chưa có dữ liệu</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={byGroupCombined}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="equipment" name="Thiết bị (cái)" fill="hsl(347, 100%, 47%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="consumableQty" name="VT tồn kho (SL)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Thiết bị — phân bổ trạng thái</CardTitle></CardHeader>
              <CardContent>
                {byStatus.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Chưa có dữ liệu thiết bị</p>
                ) : (
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="min-h-[260px] w-full min-w-0 flex-1 lg:max-w-[58%]">
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={byStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={0}
                            outerRadius={100}
                            dataKey="value"
                            nameKey="name"
                            label={false}
                            labelLine={false}
                            paddingAngle={1}
                          >
                            {byStatus.map((d, i) => (
                              <Cell key={i} fill={d.fill} stroke="hsl(var(--background))" strokeWidth={1} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => [v, 'Số lượng']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full flex-1 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phụ lục</p>
                      <ul className="space-y-2.5 text-sm">
                        {byStatus.map((s, i) => (
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
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Thiết bị tồn kho</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{equipments.filter(e => e.status === 'IN_STOCK').length}</div>
                <p className="text-sm text-muted-foreground mt-1">thiết bị sẵn sàng cấp phát</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Vật tư — tồn kho (SL)</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600">{totalConsumableInStockQty}</div>
                <p className="text-sm text-muted-foreground mt-1">{consumableStocks.length} mặt hàng</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Vật tư — đã cấp phát (SL)</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{totalConsumableIssuedQty}</div>
                <p className="text-sm text-muted-foreground mt-1">tổng đã xuất cấp</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-sm text-muted-foreground mt-1">
                Giá trị dòng phiếu: cột thiết bị và vật tư (theo master tài sản).
              </p>
            </CardHeader>
            <CardContent>
              {procurementByMonthSplit.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có dữ liệu phiếu nhập mua.</p>
              ) : (
                <div className="min-w-0 -mx-1 px-1">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={procurementByMonthSplit} margin={{ top: 8, right: 8, left: 4, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickMargin={8} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={formatVndAxisValue}
                        tickMargin={6}
                        width={56}
                        domain={[0, 'auto']}
                      />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                        labelFormatter={label => `Tháng ${label}`}
                      />
                      <Legend />
                      <Bar dataKey="device" name="Thiết bị" fill="hsl(347, 100%, 47%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="consumable" name="Vật tư" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
