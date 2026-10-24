'use client'

// Header bell with the signed-in user's unread notification count. Stays
// live through Realtime (notifications table) and the NOTIFICATIONS_CHANGED_EVENT
// the notifications page dispatches after marking items read.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { countUnreadNotifications, subscribeToNotifications } from '@/lib/api'
import { useMarketplace } from '@/lib/store'
import { cn } from '@/lib/utils'

export const NOTIFICATIONS_CHANGED_EVENT = 'pio:notifications-changed'

export function NotificationBell({ className }: { className?: string }) {
  const { currentUserId } = useMarketplace()
  const pathname = usePathname()
  const [count, setCount] = useState(0)

  const reload = useCallback(() => {
    countUnreadNotifications().then(setCount, () => setCount(0))
  }, [])

  useEffect(() => {
    if (!currentUserId) return
    let timer: number | undefined
    // Debounce bursts (several notifications are often written together).
    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(reload, 300)
    }
    const unsubscribe = subscribeToNotifications(currentUserId, schedule)
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, schedule)
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, schedule)
    }
  }, [currentUserId, reload])

  // Re-count on sign-in and on every navigation (cheap head-only count query).
  useEffect(() => {
    if (currentUserId) reload()
  }, [currentUserId, pathname, reload])

  if (!currentUserId) return null
  const shown = count > 9 ? '9+' : String(count)

  return (
    <Link
      href="/notifications"
      className={cn(
        'relative flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
      aria-label={`Notifications${count ? ` (${count} unread)` : ''}`}
      data-testid="notification-bell"
    >
      <Bell className="h-[18px] w-[18px]" />
      {count > 0 && (
        <span
          className="absolute right-1 top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-bold text-primary-foreground"
          data-testid="notification-count"
        >
          {shown}
        </span>
      )}
    </Link>
  )
}
