import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  getInAppNotifications,
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
  subscribeInAppNotifications,
  type InAppNotificationItem,
} from '@/lib/inAppNotifications';
import { formatDateTime } from '@/data/mockData';

export function InAppNotificationsBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<InAppNotificationItem[]>([]);

  const reload = async () => {
    try {
      setItems(await getInAppNotifications());
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    void reload();
    return subscribeInAppNotifications(() => {
      void reload();
    });
  }, []);

  const unreadCount = useMemo(() => items.filter(x => !x.isRead).length, [items]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Thông báo</p>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => markAllInAppNotificationsRead()}>
            Đánh dấu đã đọc
          </Button>
        </div>
        <ScrollArea className="h-[360px]">
          <div className="p-2">
            {items.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs text-muted-foreground">Chưa có thông báo.</p>
            ) : (
              items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`mb-2 w-full rounded-md border px-2.5 py-2 text-left hover:bg-muted/50 ${item.isRead ? 'opacity-80' : 'bg-primary/5'}`}
                  onClick={async () => {
                    await markInAppNotificationRead(item.id);
                    if (item.route) navigate(item.route);
                  }}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">{item.title}</p>
                    {!item.isRead ? <Badge className="h-5 px-1.5 text-[10px]">Mới</Badge> : null}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
