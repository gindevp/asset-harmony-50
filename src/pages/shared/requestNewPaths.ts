/** Quay về danh sách đúng loại sau khi tạo yêu cầu. */
export function requestsListPath(
  kind: 'allocation' | 'repair' | 'return' | 'loss',
  isAdminArea: boolean,
): string {
  if (isAdminArea) {
    if (kind === 'loss') return '/admin/loss-report-requests';
    return `/admin/request-create?section=${kind}`;
  }
  if (kind === 'repair') return '/employee/repair-requests';
  if (kind === 'return') return '/employee/return-requests';
  if (kind === 'loss') return '/employee/loss-report-requests';
  return '/employee/allocation-requests';
}
