import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  label: string;
  className?: string;
}

const statusStyleMap: Record<string, string> = {
  // Equipment
  IN_STOCK: 'status-in-stock',
  IN_USE: 'status-in-use',
  PENDING_ISSUE: 'status-pending',
  PENDING_RETURN: 'status-pending',
  UNDER_REPAIR: 'status-repair',
  BROKEN: 'status-broken',
  LOST: 'status-broken',
  DISPOSED: 'status-disposed',
  // Stock In/Out
  DRAFT: 'status-draft',
  CONFIRMED: 'status-confirmed',
  CANCELLED: 'status-cancelled',
  // Allocation
  CHO_DUYET: 'status-waiting',
  DA_DUYET: 'status-approved',
  TU_CHOI: 'status-rejected',
  DA_TAO_PHIEU_XUAT: 'status-in-use',
  HOAN_THANH: 'status-completed',
  HUY: 'status-cancelled',
  // Repair
  MOI_TAO: 'status-waiting',
  DA_TIEP_NHAN: 'status-in-use',
  DANG_SUA: 'status-repair',
  HOAN_TAT: 'status-completed',
};

export const StatusBadge = ({ status, label, className }: StatusBadgeProps) => {
  const styleClass = statusStyleMap[status] || 'status-draft';
  return (
    <span className={cn('status-badge', styleClass, className)}>
      {label}
    </span>
  );
};
