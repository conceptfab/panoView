import Link from 'next/link';
import type { CommandCenterAttentionItem } from '@/lib/command-center';
import { cn } from '@/lib/utils';

interface AttentionListProps {
  items: CommandCenterAttentionItem[];
}

export function AttentionList({ items }: AttentionListProps) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-sm text-zinc-500">
        Brak elementów wymagających uwagi.
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/10">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="grid grid-cols-[10px_minmax(0,1fr)] gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/[0.015]"
        >
          <span
            className={cn(
              'mt-1.5 size-2 rounded-full',
              item.tone === 'warning' ? 'bg-amber-400' : 'bg-sky-400'
            )}
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block truncate font-medium text-zinc-100">
              {item.title}
            </span>
            <span className="mt-1 block text-xs leading-5 text-zinc-500">
              {item.description}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
