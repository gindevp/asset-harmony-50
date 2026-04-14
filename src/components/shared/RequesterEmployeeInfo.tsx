import type { ReactNode } from 'react';
import type { EmployeeDto } from '@/api/types';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

type EmpLike = Pick<EmployeeDto, 'id' | 'code' | 'fullName' | 'jobTitle' | 'department' | 'location'>;

/**
 * Khối chỉ đọc: thông tin nhân viên gửi yêu cầu (không chỉnh sửa).
 * `hideLocation`: ẩn dòng vị trí (ví dụ chi tiết YC cấp phát — xem và sửa dùng chung).
 * `appendRows`: thêm dòng trong cùng lưới (ví dụ Ngày tạo / Trạng thái thay chỗ vị trí đã ẩn).
 */
export function RequesterEmployeeInfo({
  requesterId,
  employees,
  className,
  hideLocation,
  appendRows,
}: {
  requesterId: string | undefined;
  employees: EmpLike[];
  className?: string;
  hideLocation?: boolean;
  appendRows?: { label: string; value: ReactNode }[];
}) {
  const id = (requesterId ?? '').trim();
  const e = id ? employees.find(x => String(x.id) === id) : undefined;

  const rows: { label: string; value: string }[] = e
    ? [
        { label: 'Mã người dùng', value: (e.code ?? '').trim() || '—' },
        { label: 'Họ và tên', value: (e.fullName ?? '').trim() || '—' },
        { label: 'Chức danh', value: (e.jobTitle ?? '').trim() || '—' },
        { label: 'Phòng ban', value: (e.department?.name ?? '').trim() || '—' },
        ...(!hideLocation ? [{ label: 'Vị trí / khu vực', value: (e.location?.name ?? '').trim() || '—' }] : []),
      ]
    : [
        { label: 'Mã người dùng', value: id || '—' },
        { label: 'Họ và tên', value: 'Không tìm thấy trong danh sách nhân viên' },
        { label: 'Chức danh', value: '—' },
        { label: 'Phòng ban', value: '—' },
        ...(!hideLocation ? [{ label: 'Vị trí / khu vực', value: '—' }] : []),
      ];

  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 bg-muted/30 p-4',
        className,
      )}
      aria-readonly
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <User className="h-4 w-4 shrink-0" aria-hidden />
        Thông tin người dùng yêu cầu
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map(row => (
          <div key={row.label} className="min-w-0 sm:col-span-1">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{row.label}</dt>
            <dd className="mt-0.5 text-sm text-foreground">{row.value}</dd>
          </div>
        ))}
        {appendRows?.map(row => (
          <div key={row.label} className="min-w-0 sm:col-span-1">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{row.label}</dt>
            <dd className="mt-0.5 text-sm text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
