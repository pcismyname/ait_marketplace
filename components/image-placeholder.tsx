import { cn } from '@/lib/utils'
import { CategoryIcon } from '@/components/category-icon'
import type { CategoryId } from '@/lib/types'

interface ImagePlaceholderProps {
  category?: CategoryId
  className?: string
  aspectClass?: string
}

/**
 * Tinted sage/sand placeholder for listings with no photo (or SVG illustrations).
 * Single thin-line category icon centred on a neutral ground.
 */
export function ImagePlaceholder({
  category,
  className,
  aspectClass = 'aspect-[3/4]',
}: ImagePlaceholderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-surface-tinted',
        aspectClass,
        className,
      )}
    >
      {category && (
        <CategoryIcon
          category={category}
          className="h-8 w-8 text-muted-foreground/30 stroke-[1.25]"
        />
      )}
    </div>
  )
}
