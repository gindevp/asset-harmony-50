import { apiGet, apiPatch, apiPost } from '@/api/http';

export type InAppNotificationKind = 'info' | 'success' | 'warning' | 'error';

export type InAppNotificationItem = {
  id: string;
  title: string;
  message: string;
  kind: InAppNotificationKind;
  createdAt: string;
  isRead: boolean;
  route?: string;
};

type CreateInAppNotificationInput = {
  title: string;
  message: string;
  kind?: InAppNotificationKind;
  route?: string;
};

const UPDATE_EVENT = 'asset-app:in-app-notifications-updated';

function broadcastNotificationsUpdate() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

function mapNotificationDto(raw: any): InAppNotificationItem {
  return {
    id: String(raw?.id ?? ''),
    title: String(raw?.title ?? ''),
    message: String(raw?.message ?? ''),
    kind: (String(raw?.kind ?? 'info').toLowerCase() as InAppNotificationKind) ?? 'info',
    createdAt: String(raw?.createdAt ?? new Date().toISOString()),
    isRead: Boolean(raw?.isRead),
    route: raw?.route ? String(raw.route) : undefined,
  };
}

export async function getInAppNotifications(): Promise<InAppNotificationItem[]> {
  const rows = await apiGet<any[]>('/api/app-notifications');
  return (rows ?? []).map(mapNotificationDto);
}

export function pushInAppNotification(input: CreateInAppNotificationInput) {
  void apiPost('/api/app-notifications/push', {
    title: input.title.trim(),
    message: input.message.trim(),
    kind: input.kind ?? 'info',
    route: input.route,
  }).then(() => broadcastNotificationsUpdate()).catch(() => undefined);
}

export async function markInAppNotificationRead(id: string) {
  await apiPatch(`/api/app-notifications/${encodeURIComponent(id)}/read`, {});
  broadcastNotificationsUpdate();
}

export async function markAllInAppNotificationsRead() {
  await apiPost('/api/app-notifications/read-all', {});
  broadcastNotificationsUpdate();
}

export function subscribeInAppNotifications(onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => onChange();
  window.addEventListener(UPDATE_EVENT, handler);
  return () => {
    window.removeEventListener(UPDATE_EVENT, handler);
  };
}
