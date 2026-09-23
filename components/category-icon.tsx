import {
  Sofa,
  Laptop,
  Bike,
  BookOpen,
  UtensilsCrossed,
  Dumbbell,
  Package,
  type LucideIcon,
} from 'lucide-react'
import type { CategoryId } from '@/lib/types'

const ICONS: Record<CategoryId, LucideIcon> = {
  furniture: Sofa,
  electronics: Laptop,
  bicycles: Bike,
  textbooks: BookOpen,
  kitchen: UtensilsCrossed,
  sports: Dumbbell,
  other: Package,
}

export function CategoryIcon({
  category,
  className,
}: {
  category: CategoryId
  className?: string
}) {
  const Icon = ICONS[category] ?? Package
  return <Icon className={className} aria-hidden="true" />
}
