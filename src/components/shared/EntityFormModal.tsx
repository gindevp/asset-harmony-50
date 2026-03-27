import { ReactNode, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface EntityFormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSubmit?: () => void;
  submitLabel?: string;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export const EntityFormModal = ({
  open, onClose, title, children, onSubmit, submitLabel = 'Lưu', loading = false, size = 'md',
}: EntityFormModalProps) => (
  <Dialog open={open} onOpenChange={v => !v && onClose()}>
    <DialogContent className={sizeClasses[size]}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {children}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Hủy</Button>
        {onSubmit && (
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? 'Đang xử lý...' : submitLabel}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
