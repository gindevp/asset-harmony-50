import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  status?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export const Timeline = ({ events, className }: TimelineProps) => (
  <div className={cn('relative space-y-0', className)}>
    {events.map((event, idx) => (
      <div key={event.id} className="flex gap-4 pb-6 last:pb-0">
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-primary border-2 border-primary-foreground ring-2 ring-primary flex-shrink-0" />
          {idx < events.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
        </div>
        <div className="flex-1 pb-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">{event.title}</span>
            {event.status && (
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{event.status}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{event.description}</p>
          <span className="text-xs text-muted-foreground/70 mt-1 block">{event.date}</span>
        </div>
      </div>
    ))}
  </div>
);
