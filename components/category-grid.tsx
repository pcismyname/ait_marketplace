import Link from 'next/link'
import { CATEGORIES } from '@/lib/data'
import { CategoryIcon } from '@/components/category-icon'

export function CategoryGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {CATEGORIES.map((cat) => (
        <Link
          key={cat.id}
          href={`/browse?category=${cat.id}`}
          className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-secondary/40"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <CategoryIcon category={cat.id} className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{cat.label}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {cat.blurb}
            </span>
          </span>
        </Link>
      ))}
    </div>
  )
}
