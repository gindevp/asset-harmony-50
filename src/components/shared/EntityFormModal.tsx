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
  sm: 'w-[min(100%,28rem)] max-w-md',
  md: 'w-[min(100%,42rem)] max-w-2xl',
  lg: 'w-[min(100%,56rem)] max-w-4xl',
  xl: 'w-[min(100%,72rem)] max-w-6xl',
};

export const EntityFormModal = ({
  open, onClose, title, children, onSubmit, submitLabel = 'Lưu', loading = false, size = 'md',
}: EntityFormModalProps) => (
  <Dialog open={open} onOpenChange={v => !v && onClose()}>
    <DialogContent className={sizeClasses[size]}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="max-h-[70vh] overflow-y-auto px-4 py-4 space-y-4">
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
