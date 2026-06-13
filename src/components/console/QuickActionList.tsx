import Link from 'next/link';
import {
  Archive,
  FolderPlus,
  type LucideIcon,
  RefreshCw,
  Share2,
  Upload,
} from 'lucide-react';
import type { CommandCenterQuickAction } from '@/lib/command-center';

interface QuickActionListProps {
  actions: CommandCenterQuickAction[];
}

const icons: Record<string, LucideIcon> = {
  'import-zip': Upload,
  'new-project': FolderPlus,
  'open-studio': Share2,
  'download-backup': Archive,
  'rebuild-metadata': RefreshCw,
};

export function QuickActionList({ actions }: QuickActionListProps) {
  return (
    <div className="divide-y divide-white/10">
      {actions.map((action) => {
        const Icon = icons[action.id] ?? Share2;

        return (
          <Link
            key={action.id}
            href={action.href}
            className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/[0.015]"
          >
            <span className="flex size-8 items-center justify-center rounded border border-white/10 bg-white/[0.02] text-zinc-400">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-zinc-100">
                {action.label}
              </span>
              <span className="mt-0.5 block truncate text-xs text-zinc-500">
                {action.description}
              </span>
            </span>
            <kbd className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] leading-none text-zinc-500">
              {action.shortcut}
            </kbd>
          </Link>
        );
      })}
    </div>
  );
}
