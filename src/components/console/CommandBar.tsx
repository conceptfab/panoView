'use client';

import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandBarProps {
  placeholder?: string;
  className?: string;
}

export function CommandBar({
  placeholder = 'Szukaj projektu lub wpisz akcję...',
  className,
}: CommandBarProps) {
  return (
    <search
      aria-label="Szukaj projektu lub akcji"
      className={cn(
        'grid h-10 grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 rounded border border-white/10 bg-[#080809] px-3 text-sm text-zinc-500',
        className
      )}
    >
      <Search className="size-4 text-zinc-500" aria-hidden="true" />
      <span className="truncate">{placeholder}</span>
      <kbd className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] leading-none text-zinc-400">
        ⌘ K
      </kbd>
    </search>
  );
}
