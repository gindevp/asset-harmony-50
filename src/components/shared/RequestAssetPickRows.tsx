import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatBizCodeDisplay } from '@/utils/formatCodes';
import type { ConsumableOpenRequestEntry, EquipmentOpenRequestEntry } from '@/utils/openAssetRequestBlocks';

/** Hai cột Thiết bị | Vật tư — dùng chung phiếu sửa / thu hồi / báo mất */
export function AssetPickTwoColumnGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">{children}</div>;
}

export function AssetPickColumn({
  icon: Icon,
  title,
  description,
  children,
  maxHeightClass = 'max-h-56',
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  maxHeightClass?: string;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15"
          aria-hidden
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1 space-y-1 pt-0.5">
          <Label className="text-sm font-semibold leading-tight">{title}</Label>
          {description ? (
            <div className="text-xs leading-relaxed text-muted-foreground [&_code]:rounded [&_code]:bg-muted/80 [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[11px]">
              {description}
            </div>
          ) : null}
        </div>
      </div>
      <div
        className={cn(
          'min-h-[6.5rem] overflow-x-hidden overflow-y-auto rounded-xl border border-border/80 bg-gradient-to-b from-card via-card/95 to-muted/15 p-2.5 shadow-sm ring-1 ring-border/30',
          maxHeightClass,
        )}
      >
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  );
}

function rowShellClass(blocked: boolean, selected: boolean) {
  return cn(
    'flex min-w-0 flex-col gap-2 rounded-lg border px-2.5 py-2.5 transition-[border-color,box-shadow,background-color] sm:flex-row sm:items-stretch sm:gap-3',
    blocked
      ? 'border-border/40 bg-muted/45 opacity-[0.88]'
      : selected
        ? 'border-primary/35 bg-primary/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
        : 'border-border/50 bg-background/80 hover:border-muted-foreground/25 hover:bg-muted/25',
  );
}

export function AssetPickEquipmentRow({
  rowId,
  title: nativeTitle,
  deviceName,
  serial,
  blocked,
  hint,
  openEntries,
  checked,
  onCheckedChange,
  quantitySlot,
}: {
  rowId: string;
  /** Tooltip khi hover cả dòng */
  title?: string;
  deviceName: string;
  serial: string;
  blocked: boolean;
  hint?: string;
  /** Phiếu đang chiếm thiết bị (mã + loại) — ưu tiên hiển thị thay cho chuỗi `hint` dài. */
  openEntries?: EquipmentOpenRequestEntry[];
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Thiết bị thường không cần ô SL (mỗi serial = 1) — bỏ qua để ẩn cột số lượng. */
  quantitySlot?: ReactNode;
}) {
  const boxId = `asset-pick-eq-${rowId}`;
  return (
    <div className={rowShellClass(blocked, !blocked && checked)} title={nativeTitle}>
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="pt-0.5">
          <Checkbox
            id={boxId}
            checked={checked}
            disabled={blocked}
            onCheckedChange={v => {
              if (blocked) return;
              onCheckedChange(v === true);
            }}
          />
        </div>
        <label
          htmlFor={boxId}
          className={cn('min-w-0 flex-1 cursor-pointer select-none', blocked && 'cursor-not-allowed')}
        >
          <div className="space-y-1">
            <p className="text-sm font-medium leading-snug text-foreground">{deviceName}</p>
            <p className="text-xs text-muted-foreground">
              Serial{' '}
              <span className="rounded bg-muted/80 px-1 py-px font-mono text-[11px] tabular-nums text-foreground/90">
                {serial}
              </span>
            </p>
            {blocked ? (
              <div className="space-y-1 text-xs leading-snug text-amber-800 dark:text-amber-400">
                <p>Không chọn được — thiết bị đã nằm trong yêu cầu khác (chưa xử lý xong).</p>
                {openEntries && openEntries.length > 0 ? (
                  <ul className="space-y-0.5 border-l-2 border-amber-500/40 pl-2 text-[11px]">
                    {openEntries.map((e, i) => (
                      <li key={`${e.requestCode}-${e.kind}-${i}`}>
                        <span className="font-mono text-foreground/90">{formatBizCodeDisplay(e.requestCode)}</span>
                        {' — '}
                        {e.label}
                      </li>
                    ))}
                  </ul>
                ) : hint ? (
                  <p className="text-[11px] opacity-90">{hint}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </label>
      </div>
      {quantitySlot ? (
        <div className="flex shrink-0 flex-col justify-center gap-1.5 border-t border-border/50 pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-right">
            Số lượng
          </span>
          <div className="w-full min-w-[5.5rem] sm:ml-auto sm:w-[6.75rem]">{quantitySlot}</div>
        </div>
      ) : null}
    </div>
  );
}

export function AssetPickConsumableRow({
  rowId,
  title: nativeTitle,
  itemLabel,
  held,
  blocked,
  availableQty,
  pendingSummary,
  pendingEntries,
  checked,
  onCheckedChange,
  quantitySlot,
}: {
  rowId: string;
  title?: string;
  itemLabel: string;
  held: number;
  blocked: boolean;
  /** SL còn kê vào phiếu này (đã trừ phiếu khác). */
  availableQty?: number;
  pendingSummary?: string;
  pendingEntries?: ConsumableOpenRequestEntry[];
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  quantitySlot: ReactNode;
}) {
  const boxId = `asset-pick-co-${rowId}`;
  const heldStr = held.toLocaleString('vi-VN');
  const availStr = availableQty !== undefined ? availableQty.toLocaleString('vi-VN') : null;

  return (
    <div className={rowShellClass(blocked, !blocked && checked)} title={nativeTitle}>
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="pt-0.5">
          <Checkbox
            id={boxId}
            checked={checked}
            disabled={blocked}
            onCheckedChange={v => {
              if (blocked) return;
              onCheckedChange(v === true);
            }}
          />
        </div>
        <label
          htmlFor={boxId}
          className={cn('min-w-0 flex-1 cursor-pointer select-none', blocked && 'cursor-not-allowed')}
        >
          <div className="space-y-1">
            <p className="text-sm font-medium leading-snug text-foreground">{itemLabel}</p>
            {availStr != null ? (
              <p className="text-xs text-muted-foreground">
                Đang giữ{' '}
                <span className="font-medium tabular-nums text-foreground/90">{heldStr}</span>
                {' · '}
                Khả dụng cho phiếu này{' '}
                <span className="font-medium tabular-nums text-foreground">{availStr}</span>
                {blocked ? (
                  <span className="text-amber-800 dark:text-amber-400"> — hết khả dụng</span>
                ) : null}
              </p>
            ) : blocked && pendingSummary ? (
              <p className="text-xs leading-snug text-amber-800 dark:text-amber-400">
                Còn {heldStr} · đã có yêu cầu: {pendingSummary}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Đang giữ{' '}
                <span className="font-medium tabular-nums text-foreground/90">{heldStr}</span>
                <span className="text-muted-foreground/80"> · không vượt quá khi nhập SL</span>
              </p>
            )}
            {blocked ? (
              <p className="text-xs leading-snug text-amber-800 dark:text-amber-400">
                Không chọn được — vật tư đã nằm trong yêu cầu khác (chưa xử lý xong).
              </p>
            ) : null}
            {pendingEntries && pendingEntries.length > 0 ? (
              <ul
                className={cn(
                  'mt-1.5 space-y-0.5 border-l-2 pl-2 text-[11px] leading-snug',
                  blocked
                    ? 'border-amber-500/40 text-amber-800 dark:text-amber-400'
                    : 'border-muted text-muted-foreground',
                )}
              >
                {pendingEntries.map((e, i) => (
                  <li key={`${e.requestCode}-${e.kind}-${i}`}>
                    <span className="font-mono text-foreground/85">{formatBizCodeDisplay(e.requestCode)}</span>
                    {' — '}
                    {e.label} ·{' '}
                    <span className="tabular-nums font-medium text-foreground/90">{e.qty.toLocaleString('vi-VN')} SL</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </label>
      </div>
      {quantitySlot ? (
        <div className="flex shrink-0 flex-col justify-center gap-1.5 border-t border-border/50 pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-right">
            Số lượng
          </span>
          <div className="w-full min-w-[5.5rem] sm:ml-auto sm:w-[6.75rem]">{quantitySlot}</div>
        </div>
      ) : null}
    </div>
  );
}
