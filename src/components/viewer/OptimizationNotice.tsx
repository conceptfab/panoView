import { cn } from '@/lib/utils';

interface OptimizationNoticeProps {
  width: number;
  height: number;
  className?: string;
}

/** Jednorazowy badge o zoptymalizowanej panoramie (pierwsze załadowanie). */
export function OptimizationNotice({
  width,
  height,
  className,
}: OptimizationNoticeProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute bottom-4 left-1/2 z-40 -translate-x-1/2 sm:bottom-6',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/70 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur-md whitespace-nowrap sm:text-sm">
        <span className="text-white/75">Zoptymalizowana</span>
        <span aria-hidden className="text-white/35">
          ·
        </span>
        <span className="font-mono tabular-nums tracking-tight">
          {width}×{height}
        </span>
      </div>
    </div>
  );
}
