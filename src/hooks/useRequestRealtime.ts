import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch, getStoredToken } from '@/api/http';

const REQUEST_QUERY_KEYS: readonly string[] = [
  'allocation-requests-view',
  'repair-requests-view',
  'return-requests-view',
  'loss-report-requests',
];

export function useRequestRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    let retryTimer: number | null = null;

    const invalidateAll = () => {
      for (const key of REQUEST_QUERY_KEYS) {
        void qc.invalidateQueries({ queryKey: ['api', key] });
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      retryTimer = window.setTimeout(connect, 1200);
    };

    const connect = async () => {
      if (cancelled) return;
      if (!getStoredToken()) {
        scheduleReconnect();
        return;
      }
      controller = new AbortController();
      try {
        const res = await apiFetch('/api/realtime/requests/stream', {
          method: 'GET',
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          scheduleReconnect();
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (!cancelled) {
          const next = await reader.read();
          if (next.done) break;
          buf += decoder.decode(next.value, { stream: true });
          let split = buf.search(/\r?\n\r?\n/);
          while (split >= 0) {
            const chunk = buf.slice(0, split);
            const separatorLen = buf.slice(split).startsWith('\r\n\r\n') ? 4 : 2;
            buf = buf.slice(split + separatorLen);
            if (/event:\s*request-change/m.test(chunk)) {
              invalidateAll();
            }
            split = buf.search(/\r?\n\r?\n/);
          }
        }
      } catch {
        // silent reconnect
      } finally {
        if (!cancelled) scheduleReconnect();
      }
    };

    void connect();
    return () => {
      cancelled = true;
      controller?.abort();
      if (retryTimer != null) window.clearTimeout(retryTimer);
    };
  }, [qc]);
}
