import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Shield, Users } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mb-3 shadow-sm">
        <Package className="h-7 w-7 text-primary-foreground" />
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1.5 tracking-tight text-center px-1">
        Hệ thống Quản lý Tài sản Nội bộ
      </h1>
      <p className="text-sm sm:text-base text-muted-foreground mb-8 text-center max-w-md">
        Quản lý vòng đời tài sản: nhập kho, cấp phát, theo dõi, thu hồi, sửa chữa
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
        <Card className="hover:border-primary transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-primary" /> Quản lý tài sản (QLTS)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Cần tài khoản ROLE_ADMIN, ROLE_ASSET_MANAGER hoặc ROLE_GD</p>
            <Button className="mt-3 w-full" onClick={() => navigate('/login', { state: { from: '/admin' } })}>
              Đăng nhập
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" /> Nhân viên / Điều phối
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Yêu cầu cấp phát, sửa chữa, thu hồi, tài sản của tôi</p>
            <Button variant="outline" className="mt-3 w-full" onClick={() => navigate('/login', { state: { from: '/employee/allocation-requests' } })}>
              Đăng nhập
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
