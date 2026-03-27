import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Shield, Users } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
        <Package className="h-6 w-6 text-primary-foreground" />
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-2">Hệ thống Quản lý Tài sản Nội bộ</h1>
      <p className="text-muted-foreground mb-8 text-center max-w-md">Quản lý vòng đời tài sản: nhập kho, cấp phát, theo dõi, thu hồi, sửa chữa</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate('/admin')}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-primary" /> Quản trị viên
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Dashboard, quản lý tài sản, kho, yêu cầu, báo cáo</p>
            <Button className="mt-3 w-full" onClick={(e) => { e.stopPropagation(); navigate('/admin'); }}>
              Truy cập
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate('/employee/allocation-requests')}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" /> Nhân viên
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Yêu cầu cấp phát, sửa chữa, thu hồi, xem tài sản</p>
            <Button variant="outline" className="mt-3 w-full" onClick={(e) => { e.stopPropagation(); navigate('/employee/allocation-requests'); }}>
              Truy cập
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
