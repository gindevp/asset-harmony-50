import type { ComponentType, ReactNode } from 'react';
import {
  Briefcase,
  Building2,
  KeyRound,
  Mail,
  MapPin,
  Shield,
  User,
  UserCircle,
} from 'lucide-react';

import type { AdminUserDto, EmployeeDto } from '@/api/types';
import { getAccountDisplayLabel } from '@/api/account';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function initialsFromAccount(acc: AdminUserDto | undefined): string {
  const label = getAccountDisplayLabel(acc);
  const t = label.trim();
  if (!t || t === '—' || t === 'Người dùng') return '?';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? '';
    const b = parts[parts.length - 1][0] ?? '';
    return `${a}${b}`.toUpperCase();
  }
  if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return parts[0][0].toUpperCase();
}

function InfoRow({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-3 rounded-lg py-2', className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-0.5 break-words text-sm font-medium leading-snug text-foreground">{children}</div>
      </div>
    </div>
  );
}

export interface AccountInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AdminUserDto | undefined;
  accountLoading: boolean;
  employee: EmployeeDto | undefined;
  employeeLoading: boolean;
}

export function AccountInfoDialog({
  open,
  onOpenChange,
  account,
  accountLoading,
  employee,
  employeeLoading,
}: AccountInfoDialogProps) {
  const fullName =
    account != null ? [account.firstName, account.lastName].filter(Boolean).join(' ').trim() || null : null;
  const displayName = account ? getAccountDisplayLabel(account) : '—';
  const hasEmployeeLink = account?.employeeId != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Thông tin tài khoản</DialogTitle>
        </DialogHeader>

        {/* Hero */}
        <div className="relative border-b border-border/80 bg-gradient-to-br from-primary/[0.12] via-primary/[0.04] to-transparent px-6 pb-6 pt-6">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/[0.08] blur-3xl"
            aria-hidden
          />
          <div className="relative flex items-start gap-4">
            {accountLoading ? (
              <Skeleton className="h-16 w-16 shrink-0 rounded-2xl" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-bold tracking-tight text-primary-foreground shadow-lg ring-4 ring-primary/15">
                {initialsFromAccount(account)}
              </div>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              {accountLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48 max-w-full" />
                  <Skeleton className="h-4 w-32 max-w-full" />
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    {fullName || displayName}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {account?.login ?? '—'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Tài khoản */}
          <section
            className="rounded-xl border border-border/80 bg-muted/25 p-4 shadow-sm"
            aria-labelledby="account-section-title"
          >
            <h3 id="account-section-title" className="mb-3 text-sm font-semibold text-primary">
              Tài khoản đăng nhập
            </h3>
            {accountLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                <InfoRow icon={Mail} label="Email">
                  {account?.email ?? '—'}
                </InfoRow>
                <InfoRow icon={KeyRound} label="Tên đăng nhập">
                  <span className="font-mono text-xs font-normal">{account?.login ?? '—'}</span>
                </InfoRow>
                <InfoRow icon={Shield} label="Vai trò">
                  {(account?.authorities ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {(account?.authorities ?? []).map(role => (
                        <Badge
                          key={role}
                          variant="secondary"
                          className="border-0 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                        >
                          {role.replace(/^ROLE_/, '')}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="font-normal text-muted-foreground">—</span>
                  )}
                </InfoRow>
              </div>
            )}
          </section>

          {/* Nhân viên */}
          <section
            className="rounded-xl border border-border/80 bg-muted/25 p-4 shadow-sm"
            aria-labelledby="employee-section-title"
          >
            <h3 id="employee-section-title" className="mb-3 text-sm font-semibold text-primary">
              Liên kết nhân viên
            </h3>
            {accountLoading ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : !hasEmployeeLink ? (
              <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-background/50 px-3 py-3 text-sm text-muted-foreground">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
                <p>Chưa gán nhân viên cho tài khoản. Liên hệ quản trị viên nếu cần.</p>
              </div>
            ) : employeeLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : employee ? (
              <div className="divide-y divide-border/60">
                <InfoRow icon={UserCircle} label="Nhân viên">
                  {(employee.code || '').trim()
                    ? `${employee.code} — ${employee.fullName ?? ''}`.trim()
                    : (employee.fullName ?? '—')}
                </InfoRow>
                <InfoRow icon={Briefcase} label="Chức danh">
                  {employee.jobTitle || '—'}
                </InfoRow>
                <InfoRow icon={Building2} label="Phòng ban">
                  {employee.department?.name || '—'}
                </InfoRow>
                <InfoRow icon={MapPin} label="Vị trí">
                  {employee.location?.name || '—'}
                </InfoRow>
              </div>
            ) : (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm text-destructive">
                Không tải được thông tin nhân viên.
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
