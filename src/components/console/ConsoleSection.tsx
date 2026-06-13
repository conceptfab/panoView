import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ConsoleSectionProps {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ConsoleSection({
  title,
  meta,
  action,
  children,
  className,
}: ConsoleSectionProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded border border-white/10 bg-[#080809]',
        className
      )}
    >
      <div className="flex h-11 items-center justify-between gap-3 border-b border-white/10 px-4">
        <div className="min-w-0 flex items-center gap-2">
          <h2 className="truncate text-sm font-medium text-zinc-100">
            {title}
          </h2>
          {meta ? (
            <div className="shrink-0 text-xs text-zinc-500">{meta}</div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}
