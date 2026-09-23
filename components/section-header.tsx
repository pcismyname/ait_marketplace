import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string
  subtitle?: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{subtitle}</p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {linkLabel ?? 'See all'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}
