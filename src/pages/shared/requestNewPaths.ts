/** Quay về danh sách đúng loại sau khi tạo yêu cầu. */
export function requestsListPath(
  kind: 'allocation' | 'repair' | 'return',
  isAdminArea: boolean,
): string {
  if (isAdminArea) {
    return `/admin/request-create?section=${kind}`;
  }
  if (kind === 'repair') return '/employee/repair-requests';
  if (kind === 'return') return '/employee/return-requests';
  return '/employee/allocation-requests';
}
