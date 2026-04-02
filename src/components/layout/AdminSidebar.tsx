import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SidebarUserPanel } from '@/components/layout/SidebarUserPanel';
import { apiGet, getStoredToken, setStoredToken } from '@/api/http';
import { getAccountDisplayLabel } from '@/api/account';
import type { AdminUserDto } from '@/api/types';
import {
  LayoutDashboard, Package, FolderTree, List, Truck, ArrowDownToLine, ArrowUpFromLine,
  ClipboardCheck, FileText, Wrench, RotateCcw, Users, Shield, ScrollText,
  ChevronDown, Menu, X, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface NavItem {
  label: string;
  path?: string;
  icon: any;
  children?: { label: string; path: string }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  {
    label: 'Tài sản', icon: Package, children: [
      { label: 'Danh mục tài sản', path: '/admin/asset-categories' },
      { label: 'Danh sách tài sản', path: '/admin/assets' },
      { label: 'Nhà cung cấp', path: '/admin/suppliers' },
      { label: 'Vị trí / khu vực', path: '/admin/locations' },
    ]
  },
  {
    label: 'Kho', icon: Truck, children: [
      { label: 'Nhập kho', path: '/admin/stock-in' },
      { label: 'Xuất kho', path: '/admin/stock-out' },
      { label: 'Tồn kho', path: '/admin/inventory' },
    ]
  },
  { label: 'Quản lý trạng thái', path: '/admin/asset-tracking', icon: ClipboardCheck },
  {
    label: 'Yêu cầu', icon: FileText, children: [
      { label: 'Yêu cầu cấp phát', path: '/admin/allocation-requests' },
      { label: 'Yêu cầu sửa chữa', path: '/admin/repair-requests' },
      { label: 'Yêu cầu thu hồi', path: '/admin/return-requests' },
    ]
  },
  { label: 'Báo cáo', path: '/admin/reports', icon: BarChart3 },
  {
    label: 'Người dùng & quyền', icon: Users, children: [
      { label: 'Người dùng', path: '/admin/users' },
      { label: 'Vai trò/Quyền', path: '/admin/roles' },
    ]
  },
  { label: 'Nhật ký & lịch sử thao tác', path: '/admin/system-logs', icon: ScrollText },
];

/** Exact match or sub-route (e.g. /admin/stock-in/new highlights Nhập kho). */
function isRouteActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export const AdminSidebar = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const pathname = location.pathname;
  const [collapsed, setCollapsed] = useState(false);

  const accountQ = useQuery({
    queryKey: ['api', 'account'],
    queryFn: () => apiGet<AdminUserDto>('/api/account'),
    enabled: !!getStoredToken(),
    staleTime: 60_000,
  });
  const accountLabel = getAccountDisplayLabel(accountQ.data ?? undefined);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    // Auto-expand group containing current path
    return navItems.filter(item =>
      item.children?.some(c => isRouteActive(location.pathname, c.path))
    ).map(item => item.label);
  });

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev =>
      prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]
    );
  };

  const isActive = (path: string) => pathname === path;
  const isChildActive = (path: string) => isRouteActive(pathname, path);
  const isGroupActive = (item: NavItem) =>
    item.children?.some(c => isRouteActive(pathname, c.path)) ?? false;

  return (
    <aside className={cn(
      'h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 sticky top-0',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Package className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm truncate">Quản lý Tài sản</span>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-md hover:bg-sidebar-accent">
          {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(item => (
          <div key={item.label}>
            {item.path ? (
              <NavLink
                to={item.path}
                end={item.path === '/admin'}
                className={cn(
                  'sidebar-nav-item',
                  isActive(item.path) && 'bg-primary/20 text-primary font-medium',
                  !isActive(item.path) && 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ) : (
              <>
                {collapsed ? (
                  <Popover
                    open={hoveredGroup === item.label}
                    onOpenChange={o => setHoveredGroup(o ? item.label : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          'sidebar-nav-item w-full',
                          isGroupActive(item)
                            ? 'text-primary font-medium'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                        )}
                        onMouseEnter={() => setHoveredGroup(item.label)}
                        onMouseLeave={() => setHoveredGroup(prev => (prev === item.label ? null : prev))}
                        onFocus={() => setHoveredGroup(item.label)}
                        onBlur={() => setHoveredGroup(prev => (prev === item.label ? null : prev))}
                        type="button"
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="right"
                      align="start"
                      sideOffset={8}
                      className="w-60 p-2"
                      onMouseEnter={() => setHoveredGroup(item.label)}
                      onMouseLeave={() => setHoveredGroup(prev => (prev === item.label ? null : prev))}
                    >
                      <div className="px-2 py-1.5 text-sm font-medium">{item.label}</div>
                      <div className="mt-1 space-y-0.5">
                        {item.children?.map(child => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            className={cn(
                              'sidebar-nav-item text-sm',
                              isChildActive(child.path)
                                ? 'bg-primary/20 text-primary font-medium'
                                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                            )}
                            onClick={() => setHoveredGroup(null)}
                          >
                            <span className="truncate">{child.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <button
                    onClick={() => toggleGroup(item.label)}
                    className={cn(
                      'sidebar-nav-item w-full',
                      isGroupActive(item)
                        ? 'text-primary font-medium'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                    )}
                    type="button"
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <>
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform',
                          expandedGroups.includes(item.label) && 'rotate-180',
                        )}
                      />
                    </>
                  </button>
                )}
                {!collapsed && expandedGroups.includes(item.label) && (
                  <div className="ml-4 pl-3 border-l border-sidebar-border space-y-0.5 mt-0.5">
                    {item.children?.map(child => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={cn(
                          'sidebar-nav-item text-sm',
                          isChildActive(child.path) ? 'bg-primary/20 text-primary font-medium' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        )}
                      >
                        <span className="truncate">{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
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
