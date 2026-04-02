import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function initialsFromDisplayName(label: string): string {
  const t = label.trim();
  if (!t || t === '—') return '?';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? '';
    const b = parts[parts.length - 1][0] ?? '';
    return `${a}${b}`.toUpperCase();
  }
  if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return parts[0][0].toUpperCase();
}

interface SidebarUserPanelProps {
  displayName: string;
  isLoading: boolean;
  onLogout: () => void;
  className?: string;
}

/**
 * Khối người dùng + đăng xuất cuối sidebar (admin / nhân viên).
 */
export function SidebarUserPanel({ displayName, isLoading, onLogout, className }: SidebarUserPanelProps) {
  const show = isLoading ? null : displayName || '—';
  const initials = initialsFromDisplayName(displayName || '');

  return (
    <div className={cn('space-y-2.5', className)}>
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border border-sidebar-border/80',
          'bg-gradient-to-br from-primary/[0.07] via-sidebar-accent/60 to-sidebar-accent/30',
          'p-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]',
        )}
      >
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/[0.12] blur-2xl"
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          {isLoading ? (
            <div
              className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-foreground/12 ring-2 ring-foreground/5"
              aria-hidden
            />
          ) : (
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                'bg-primary text-[13px] font-bold tracking-tight text-primary-foreground shadow-md',
                'ring-2 ring-primary/25 ring-offset-2 ring-offset-[hsl(var(--sidebar-background))]',
              )}
              aria-hidden
            >
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Đang đăng nhập</p>
            {isLoading ? (
              <div className="mt-2 space-y-2">
                <div className="h-4 w-[85%] max-w-[12rem] animate-pulse rounded-md bg-foreground/10" />
                <div className="h-4 w-[55%] max-w-[8rem] animate-pulse rounded-md bg-foreground/8" />
              </div>
            ) : (
              <p
                className="mt-0.5 truncate text-[15px] font-semibold leading-snug tracking-tight text-foreground"
                title={show && show !== '—' ? show : undefined}
              >
                {show}
              </p>
            )}
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className={cn(
          'w-full justify-start gap-2 border-sidebar-border/90 bg-background/50 backdrop-blur-sm',
          'transition-colors hover:border-primary/35 hover:bg-primary/[0.06] hover:text-foreground',
        )}
        onClick={onLogout}
      >
        <LogOut className="h-4 w-4 opacity-80" />
        Đăng xuất
      </Button>
    </div>
  );
}
