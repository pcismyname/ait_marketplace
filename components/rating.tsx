import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Rating({
  value,
  count,
  size = 14,
  className,
}: {
  value: number
  count?: number
  size?: number
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="inline-flex" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = value >= i + 0.5
          return (
            <Star
              key={i}
              width={size}
              height={size}
              className={filled ? 'text-surge' : 'text-muted-foreground/30'}
              fill={filled ? 'currentColor' : 'none'}
              strokeWidth={2}
            />
          )
        })}
      </span>
      <span className="text-sm font-medium tabular-nums">{value.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
      <span className="sr-only">
        {value.toFixed(1)} out of 5{count !== undefined ? ` from ${count} reviews` : ''}
      </span>
    </span>
  )
}
