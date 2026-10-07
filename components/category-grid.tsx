import Link from 'next/link'
import { CATEGORIES } from '@/lib/data'
import { CategoryIcon } from '@/components/category-icon'

export function CategoryGrid() {
  return (
    /* Horizontal scroll on mobile, wrap on tablet+ */
    <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
      {CATEGORIES.map((cat) => (
        <Link
          key={cat.id}
          href={`/browse?category=${cat.id}`}
          className="group flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 transition-all duration-150 hover:border-primary/40 hover:bg-primary-muted"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-tinted text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <CategoryIcon category={cat.id} className="h-3.5 w-3.5" />
          </span>
          <span className="whitespace-nowrap text-[12px] font-semibold text-foreground">
            {cat.label}
          </span>
        </Link>
      ))}
    </div>
  )
}
