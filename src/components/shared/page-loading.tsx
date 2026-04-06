import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/** Spinner căn giữa vùng nội dung (màn hình / khối lớn). */
export function PageLoading({
  label = 'Đang tải dữ liệu…',
  className,
  minHeight = 'min-h-[40vh]',
}: {
  label?: string;
  className?: string;
  minHeight?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-muted-foreground',
        minHeight,
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spinner className="h-9 w-9 text-primary" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}

/** Spinner một dòng (dialog, khối phụ, thay cho chữ «Đang tải…»). */
export function LoadingIndicator({
  label = 'Đang tải…',
  className,
  size = 'sm',
}: {
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const sp = size === 'md' ? 'h-6 w-6' : 'h-4 w-4';
  return (
    <div
      className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spinner className={cn(sp, 'shrink-0 text-primary')} />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
