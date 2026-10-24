import { cn } from '@/lib/utils'

/** Shown wherever a dispute moves money: no gateway is integrated (BusinessRules §7). */
export function DemoNote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'rounded-md border border-dashed border-border bg-surface px-3 py-2 text-center text-[11px] font-medium text-foreground',
        className,
      )}
    >
      Demo mode — payments are simulated, no real money moves.
    </p>
  )
}
