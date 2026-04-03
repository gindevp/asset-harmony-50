import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { apiGet, getStoredToken } from '@/api/http';
import { hasAnyAuthority } from '@/auth/jwt';
import type { AuthorityDto } from '@/api/types';

const roles = [
  { key: 'EMPLOYEE', label: 'Nhân viên', description: 'Tạo/xem yêu cầu của mình, xem tài sản được cấp' },
  { key: 'DEPARTMENT_COORDINATOR', label: 'Điều phối Phòng ban', description: 'Tạo yêu cầu cho phòng ban' },
  { key: 'ASSET_MANAGER', label: 'Quản lý Tài sản', description: 'Duyệt, nhập/xuất kho, cấp phát, thu hồi, sửa chữa, tra cứu' },
  { key: 'ADMIN', label: 'Quản trị viên', description: 'Quản trị user/quyền/cấu hình + xem toàn bộ' },
];

const permissions = [
  'Tạo yêu cầu cấp phát', 'Tạo yêu cầu sửa chữa', 'Tạo yêu cầu thu hồi',
  'Xem tài sản được cấp', 'Tạo YC cho phòng ban', 'Duyệt yêu cầu',
  'Nhập kho', 'Xuất kho', 'Quản lý danh mục', 'Quản lý NCC',
  'Tra cứu toàn bộ', 'Báo cáo', 'Quản lý user', 'Cấu hình hệ thống',
];

const matrix: Record<string, boolean[]> = {
  EMPLOYEE: [true, true, true, true, false, false, false, false, false, false, false, false, false, false],
  DEPARTMENT_COORDINATOR: [true, true, true, true, true, false, false, false, false, false, false, false, false, false],
  ASSET_MANAGER: [true, true, true, true, true, true, true, true, true, true, true, true, false, false],
  ADMIN: [true, true, true, true, true, true, true, true, true, true, true, true, true, true],
};

const RolesPage = () => {
  const canAdmin = hasAnyAuthority(getStoredToken(), ['ROLE_ADMIN']);
  const authoritiesQ = useQuery({
    queryKey: ['api', 'authorities'],
    queryFn: () => apiGet<AuthorityDto[]>('/api/authorities'),
    enabled: canAdmin,
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vai trò & Quyền</h1>
        </div>
      </div>

      {canAdmin && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Quyền đăng ký trên hệ thống (GET /api/authorities)</CardTitle>
          </CardHeader>
          <CardContent>
            {authoritiesQ.isLoading && <p className="text-sm text-muted-foreground">Đang tải…</p>}
            {authoritiesQ.isError && (
              <p className="text-sm text-destructive">Không tải được (cần ROLE_ADMIN).</p>
            )}
            {authoritiesQ.data && (
              <div className="flex flex-wrap gap-2">
                {(authoritiesQ.data ?? [])
                  .map(a => a.name)
                  .filter(Boolean)
                  .sort()
                  .map(name => (
                    <Badge key={name} variant="secondary" className="font-mono text-xs">
                      {name}
                    </Badge>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map(role => (
          <Card key={role.key}>
            <CardHeader>
              <CardTitle className="text-base">{role.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
              <div className="space-y-1.5">
                {permissions.map((perm, idx) => (
                  <div key={perm} className="flex items-center gap-2 text-sm">
                    {matrix[role.key][idx] ? (
                      <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                    )}
                    <span className={matrix[role.key][idx] ? '' : 'text-muted-foreground/50'}>{perm}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RolesPage;
