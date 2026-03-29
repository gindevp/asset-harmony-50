import { Button } from '@/components/ui/button';
import { Check, X, Ban, Printer, FileDown } from 'lucide-react';

interface ApprovalActionBarProps {
  onApprove?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onPrint?: () => void;
  onExport?: () => void;
  approveLabel?: string;
  rejectLabel?: string;
  showApprove?: boolean;
  showReject?: boolean;
  showCancel?: boolean;
  showPrint?: boolean;
  showExport?: boolean;
  disabled?: boolean;
}

export const ApprovalActionBar = ({
  onApprove, onReject, onCancel, onPrint, onExport,
  approveLabel = 'Duyệt', rejectLabel = 'Từ chối',
  showApprove = true, showReject = true, showCancel = false, showPrint = true, showExport = true,
  disabled = false,
}: ApprovalActionBarProps) => (
  <div className="flex items-center gap-2 flex-wrap">
    {showApprove && (
      <Button onClick={onApprove} disabled={disabled} className="bg-emerald-600 hover:bg-emerald-700 text-white">
        <Check className="h-4 w-4 mr-1" /> {approveLabel}
      </Button>
    )}
    {showReject && (
      <Button variant="destructive" onClick={onReject} disabled={disabled}>
        <X className="h-4 w-4 mr-1" /> {rejectLabel}
      </Button>
    )}
    {showCancel && (
      <Button variant="outline" onClick={onCancel} disabled={disabled}>
        <Ban className="h-4 w-4 mr-1" /> Hủy
      </Button>
    )}
    {showPrint && (
      <Button variant="outline" onClick={onPrint} disabled={disabled}>
        <Printer className="h-4 w-4 mr-1" /> In
      </Button>
    )}
    {showExport && (
      <Button variant="outline" onClick={onExport} disabled={disabled}>
        <FileDown className="h-4 w-4 mr-1" /> Xuất
      </Button>
    )}
  </div>
);
