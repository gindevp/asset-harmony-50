import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Logo ứng dụng — cùng họ với `public/favicon.svg` (icon Package). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Package
      className={cn('shrink-0 text-primary', className)}
      strokeWidth={2}
      aria-hidden
    />
  );
}
