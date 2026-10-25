import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The one "Demo mode" note, shown wherever money moves (BusinessRules §7: no
 * gateway). `inline` is a small muted line (forms, summaries); `boxed` is a
 * dashed card (end of a page or panel).
 */
export function SimulatedPaymentsNote({
  className,
  variant = 'inline',
}: {
  className?: string
  variant?: 'inline' | 'boxed'
}) {
  return (
    <p
      className={cn(
        'flex gap-2 text-[11px] leading-relaxed',
        variant === 'inline'
          ? 'items-start text-muted-foreground'
          : 'items-center justify-center rounded-md border border-dashed border-border bg-surface px-3 py-2 text-center font-medium text-foreground',
        className,
      )}
      data-testid="demo-mode-note"
    >
      <Info className={cn('h-3.5 w-3.5 shrink-0', variant === 'inline' && 'mt-0.5')} aria-hidden="true" />
      <span>Demo mode — payments are simulated. No real money moves.</span>
    </p>
  )
}
