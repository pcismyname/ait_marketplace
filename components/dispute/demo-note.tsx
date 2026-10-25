import { SimulatedPaymentsNote } from '@/components/simulated-payments-note'

/** Dispute and admin pages: the shared demo-mode note, boxed. */
export function DemoNote({ className }: { className?: string }) {
  return <SimulatedPaymentsNote variant="boxed" className={className} />
}
