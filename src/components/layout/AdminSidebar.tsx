import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, FolderTree, List, Truck, ArrowDownToLine, ArrowUpFromLine,
  ClipboardCheck, FileText, Wrench, RotateCcw, Users, Shield, ScrollText,
  ChevronDown, Menu, X, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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
    ]
  },
  {
    label: 'Kho', icon: Truck, children: [
      { label: 'Nhập kho', path: '/admin/stock-in' },
      { label: 'Xuất kho', path: '/admin/stock-out' },
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
  { label: 'Nhật ký hệ thống', path: '/admin/system-logs', icon: ScrollText },
];

export const AdminSidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    // Auto-expand group containing current path
    return navItems.filter(item =>
      item.children?.some(c => location.pathname === c.path)
    ).map(item => item.label);
  });

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev =>
      prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (item: NavItem) =>
    item.children?.some(c => location.pathname === c.path) ?? false;

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
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    'sidebar-nav-item w-full',
                    isGroupActive(item) ? 'text-primary font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      <ChevronDown className={cn(
                        'h-3.5 w-3.5 transition-transform',
                        expandedGroups.includes(item.label) && 'rotate-180'
                      )} />
                    </>
                  )}
                </button>
                {!collapsed && expandedGroups.includes(item.label) && (
                  <div className="ml-4 pl-3 border-l border-sidebar-border space-y-0.5 mt-0.5">
                    {item.children?.map(child => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={cn(
                          'sidebar-nav-item text-sm',
                          isActive(child.path) ? 'bg-primary/20 text-primary font-medium' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
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
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium">
              NA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">Nguyễn Văn An</p>
              <p className="text-xs text-sidebar-muted truncate">Admin</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
