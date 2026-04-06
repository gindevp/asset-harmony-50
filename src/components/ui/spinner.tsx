import type { ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className, ...props }: ComponentProps<typeof Loader2>) {
  return (
    <Loader2
      role="presentation"
      aria-hidden
      className={cn('animate-spin', className)}
      {...props}
    />
  );
}
