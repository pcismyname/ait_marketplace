import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/** "Demo mode" note shown wherever money moves (BusinessRules §7: no gateway). */
export function SimulatedPaymentsNote({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground', className)}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>Demo mode — payments are simulated. No real money moves.</span>
    </p>
  )
}
