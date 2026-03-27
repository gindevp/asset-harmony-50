import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  iconClassName?: string;
}

export const KPICard = ({ title, value, icon: Icon, trend, trendUp, className, iconClassName }: KPICardProps) => (
  <div className={cn('stat-card animate-fade-in', className)}>
    <div className="flex items-center justify-between">
      <span className="stat-label">{title}</span>
      <div className={cn('p-2 rounded-lg', iconClassName || 'bg-accent')}>
        <Icon className="h-4 w-4 text-accent-foreground" />
      </div>
    </div>
    <div className="stat-value">{value}</div>
    {trend && (
      <span className={cn('text-xs font-medium', trendUp ? 'text-emerald-600' : 'text-red-500')}>
        {trend}
      </span>
    )}
  </div>
);
