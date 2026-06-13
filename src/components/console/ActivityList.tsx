import { ClientDate } from '@/components/ui/client-date';
import type { CommandCenterActivityItem } from '@/lib/command-center';

interface ActivityListProps {
  items: CommandCenterActivityItem[];
}

export function ActivityList({ items }: ActivityListProps) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-sm text-zinc-500">
        Brak ostatniej aktywności.
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/10">
      {items.map((item) => (
        <div
          key={item.id}
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-sm"
        >
          <div className="min-w-0">
            <div className="truncate font-medium text-zinc-100">
              {item.title}
            </div>
            <div className="mt-1 truncate text-xs text-zinc-500">
              {item.description}
            </div>
          </div>
          <div className="shrink-0 text-xs text-zinc-500">
            <ClientDate value={item.at} />
          </div>
        </div>
      ))}
    </div>
  );
}
