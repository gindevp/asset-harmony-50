import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Wrench, RotateCcw, ClipboardList, Menu, X } from 'lucide-react';
import { SidebarUserPanel } from '@/components/layout/SidebarUserPanel';
import { apiGet, getStoredToken, setStoredToken } from '@/api/http';
import { getAccountDisplayLabel } from '@/api/account';
import type { AdminUserDto } from '@/api/types';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  { label: 'Yêu cầu cấp phát', path: '/employee/allocation-requests', icon: ClipboardList },
  { label: 'Yêu cầu sửa chữa', path: '/employee/repair-requests', icon: Wrench },
  { label: 'Yêu cầu thu hồi', path: '/employee/return-requests', icon: RotateCcw },
  { label: 'Tài sản của tôi', path: '/employee/my-assets', icon: Package },
];

export const EmployeeSidebar = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const accountQ = useQuery({
    queryKey: ['api', 'account'],
    queryFn: () => apiGet<AdminUserDto>('/api/account'),
    enabled: !!getStoredToken(),
    staleTime: 60_000,
  });
  const accountLabel = getAccountDisplayLabel(accountQ.data ?? undefined);

  return (
    <aside className={cn(
      'h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 sticky top-0',
      collapsed ? 'w-16' : 'w-60'
    )}>
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
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              'sidebar-nav-item',
              location.pathname === item.path
                ? 'bg-primary/20 text-primary font-medium'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
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
            onLogout={() => {
              setStoredToken(null);
              void queryClient.removeQueries({ queryKey: ['api', 'account'] });
              navigate('/login');
            }}
          />
        </div>
      )}
    </aside>
  );
};
