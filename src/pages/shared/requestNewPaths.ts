/** Quay về danh sách đúng loại sau khi tạo / sửa yêu cầu (admin: màn QL riêng, không dùng hub `/admin/request-create`). */
export function requestsListPath(
  kind: 'allocation' | 'repair' | 'return' | 'loss',
  isAdminArea: boolean,
): string {
  if (isAdminArea) {
    const paths: Record<typeof kind, string> = {
      allocation: '/admin/allocation-requests',
      repair: '/admin/repair-requests',
      return: '/admin/return-requests',
      loss: '/admin/loss-report-requests',
    };
    return paths[kind];
  }
  if (kind === 'repair') return '/employee/repair-requests';
  if (kind === 'return') return '/employee/return-requests';
  if (kind === 'loss') return '/employee/loss-report-requests';
  return '/employee/allocation-requests';
}
