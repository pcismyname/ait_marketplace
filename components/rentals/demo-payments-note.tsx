import { SimulatedPaymentsNote } from '@/components/simulated-payments-note'

/** Rental pages: the shared demo-mode note, boxed. */
export function DemoPaymentsNote({ className }: { className?: string }) {
  return <SimulatedPaymentsNote variant="boxed" className={className} />
}
