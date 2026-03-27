import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { equipments, assetItems, assetGroups, consumableStocks, formatCurrency, calculateDepreciation } from '@/data/mockData';
import { toast } from 'sonner';

const COLORS = ['#ee0033', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const Reports = () => {
  const [tab, setTab] = useState('asset');

  // Asset report data
  const byGroup = assetGroups.map(g => ({
    name: g.name,
    count: equipments.filter(eq => assetItems.find(i => i.id === eq.itemId)?.groupId === g.id).length,
  })).filter(d => d.count > 0);

  const byStatus = [
    { name: 'Tồn kho', value: equipments.filter(e => e.status === 'IN_STOCK').length },
    { name: 'Đang dùng', value: equipments.filter(e => e.status === 'IN_USE').length },
    { name: 'Đang sửa', value: equipments.filter(e => e.status === 'UNDER_REPAIR').length },
    { name: 'Hỏng', value: equipments.filter(e => e.status === 'BROKEN').length },
  ].filter(d => d.value > 0);

  // Depreciation report
  const depData = equipments.map(eq => {
    const item = assetItems.find(i => i.id === eq.itemId);
    const dep = calculateDepreciation(eq.originalCost, eq.salvageValue, eq.depreciationMonths, eq.capitalizedDate);
    return { code: eq.equipmentCode, name: item?.name || '', ...dep, originalCost: eq.originalCost };
  });

  const totalOriginal = depData.reduce((s, d) => s + d.originalCost, 0);
  const totalCurrent = depData.reduce((s, d) => s + d.currentValue, 0);
  const totalAccum = depData.reduce((s, d) => s + d.accumulated, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Báo cáo – Thống kê</h1>
          <p className="page-description">Tổng hợp báo cáo tài sản, tồn kho, khấu hao</p>
        </div>
        <Button variant="outline" onClick={() => toast.info('Xuất báo cáo CSV/Excel (demo)')}>
          <FileDown className="h-4 w-4 mr-1" /> Xuất Excel
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="asset">Tài sản</TabsTrigger>
          <TabsTrigger value="inventory">Tồn kho</TabsTrigger>
          <TabsTrigger value="depreciation">Khấu hao</TabsTrigger>
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
      </Tabs>
    </div>
  );
};

export default Reports;
