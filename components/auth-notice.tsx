import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Inline message box for the auth pages (errors stay on screen, unlike a toast). */
export function AuthNotice({
  tone,
  children,
  className,
  testId,
}: {
  tone: 'error' | 'success' | 'info'
  children: React.ReactNode
  className?: string
  testId?: string
}) {
  const Icon = tone === 'error' ? CircleAlert : tone === 'success' ? CircleCheck : Info
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      data-testid={testId}
      className={cn(
        'flex items-start gap-2.5 rounded-sm border px-3.5 py-3 text-left text-[12px] leading-relaxed',
        tone === 'error' && 'border-destructive/30 bg-destructive/5 text-destructive',
        tone === 'success' && 'border-primary/20 bg-primary-muted text-primary',
        tone === 'info' && 'border-border bg-surface text-muted-foreground',
        className,
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
