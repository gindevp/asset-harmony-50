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
  // Allocation (AllocationRequest)
  PENDING: 'status-waiting',
  APPROVED: 'status-approved',
  REJECTED: 'status-rejected',
  EXPORT_SLIP_CREATED: 'status-confirmed',
  COMPLETED: 'status-completed',
  // ReturnRequest
  // (dùng chung PENDING/APPROVED/REJECTED/COMPLETED/CANCELLED)
  // RepairRequest
  NEW: 'status-waiting',
  ACCEPTED: 'status-approved',
  IN_PROGRESS: 'status-repair',
  // Completed/rejected/cancelled dùng chung (đã cover ở trên: CANCELLED/COMPLETED/REJECTED)
};

export const StatusBadge = ({ status, label, className }: StatusBadgeProps) => {
  const styleClass = statusStyleMap[status] || 'status-draft';
  return (
    <span className={cn('status-badge', styleClass, className)}>
      {label}
    </span>
  );
};
