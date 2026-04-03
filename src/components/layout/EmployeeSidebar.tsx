import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Menu, Package, RotateCcw, Wrench, X } from 'lucide-react';
import { AccountInfoDialog } from '@/components/layout/AccountInfoDialog';
import { SidebarUserPanel } from '@/components/layout/SidebarUserPanel';
import { apiGet, getStoredToken, setStoredToken } from '@/api/http';
import { showEmployeePersonalNavLinks } from '@/auth/jwt';
import { getAccountDisplayLabel } from '@/api/account';
import type { AdminUserDto, EmployeeDto } from '@/api/types';
import { cn } from '@/lib/utils';
import { useState, type ComponentType } from 'react';

interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  /** Highlight khi đang tạo YC tại /employee/request-new (và /repair, /return) */
  requestNewKind?: 'allocation' | 'repair' | 'return';
}

const navItems: NavItem[] = [
  {
    label: 'Yêu cầu cấp phát',
    path: '/employee/allocation-requests',
    icon: ClipboardList,
    requestNewKind: 'allocation',
  },
  {
    label: 'Yêu cầu sửa chữa',
    path: '/employee/repair-requests',
    icon: Wrench,
    requestNewKind: 'repair',
  },
  {
    label: 'Yêu cầu thu hồi',
    path: '/employee/return-requests',
    icon: RotateCcw,
    requestNewKind: 'return',
  },
  { label: 'Tài sản của tôi', path: '/employee/my-assets', icon: Package },
];

export const EmployeeSidebar = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const accountQ = useQuery({
    queryKey: ['api', 'account'],
    queryFn: () => apiGet<AdminUserDto>('/api/account'),
    enabled: !!getStoredToken(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const accountLabel = getAccountDisplayLabel(accountQ.data ?? undefined);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const employeeId = accountQ.data?.employeeId != null ? Number(accountQ.data.employeeId) : NaN;
  const employeeQ = useQuery({
    queryKey: ['api', 'employees', 'me-linked', employeeId],
    queryFn: () => apiGet<EmployeeDto>(`/api/employees/${employeeId}`),
    enabled: Number.isFinite(employeeId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const showPersonalNav = showEmployeePersonalNavLinks(getStoredToken());
  const visibleNavItems = showPersonalNav ? navItems : [];

  /** Loại YC đang tạo theo path (/request-new, /repair, /return) — không dùng ?kind= nữa. */
  const requestNewKindFromPath = (): 'allocation' | 'repair' | 'return' | null => {
    if (!pathname.startsWith('/employee/request-new')) return null;
    if (pathname.startsWith('/employee/request-new/repair')) return 'repair';
    if (pathname.startsWith('/employee/request-new/return')) return 'return';
    return 'allocation';
  };

  const navActive = (item: NavItem) => {
    const creating = requestNewKindFromPath();
    if (creating != null) {
      if (!item.requestNewKind) return false;
      return item.requestNewKind === creating;
    }
    return pathname === item.path || pathname.startsWith(`${item.path}/`);
  };

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 sticky top-0',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Package className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm truncate">Tài sản nội bộ</span>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-md hover:bg-sidebar-accent">
          {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleNavItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              'sidebar-nav-item',
              navActive(item) && 'bg-primary/20 text-primary font-medium',
              !navActive(item) && 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-sidebar-border p-3 pt-3.5">
          <SidebarUserPanel
            displayName={accountLabel}
            isLoading={accountQ.isLoading}
            onOpenDetails={() => {
              void accountQ.refetch();
              void employeeQ.refetch();
              setAccountDialogOpen(true);
            }}
            onLogout={() => {
              setStoredToken(null);
              void queryClient.removeQueries({ queryKey: ['api', 'account'] });
              navigate('/login');
            }}
          />
        </div>
      )}

      <AccountInfoDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        account={accountQ.data}
        accountLoading={accountQ.isLoading}
        employee={employeeQ.data}
        employeeLoading={employeeQ.isLoading}
      />
    </aside>
  );
};
