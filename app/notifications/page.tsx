'use client'

// In-app notifications (docs/Database.md §1.5, §8): written by the server
// (RPCs, the escrow job, chat triggers), read here with Realtime updates.
// Opening one marks it read (mark_notifications_read) and follows its link
// (/transaction/<id>, /dispute/<id>, /chat?thread=<id>, requests, profiles).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCheck,
  Clock,
  Key,
  MessageCircle,
  ShoppingBag,
  Star,
  Trash2,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteNotification,
  listNotifications,
  markNotificationsRead,
  subscribeToNotifications,
} from '@/lib/api'
import type { AppNotification } from '@/lib/types'
import { useMarketplace } from '@/lib/store'
import { relativeTime } from '@/lib/format'
import { NOTIFICATIONS_CHANGED_EVENT } from '@/components/notification-bell'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function iconFor(kind: string) {
  if (kind === 'message') return MessageCircle
  if (kind === 'review') return Star
  if (kind === 'window_reminder') return Clock
  if (kind === 'rental_payout' || kind.endsWith('_released') || kind === 'sale_resolved' || kind === 'rental_resolved') return Wallet
  if (kind === 'rental_overdue' || kind === 'rental_missing') return CalendarClock
  if (kind.startsWith('dispute')) return AlertTriangle
  if (kind.startsWith('rental')) return Key
  if (kind.startsWith('sale')) return ShoppingBag
  return Bell
}

function upsert(list: AppNotification[], n: AppNotification): AppNotification[] {
  const index = list.findIndex((x) => x.id === n.id)
  if (index === -1) return [n, ...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const next = list.slice()
  next[index] = n
  return next
}

const changed = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))

export default function NotificationsPage() {
  const router = useRouter()
  const { currentUserId } = useMarketplace()
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [onlyUnread, setOnlyUnread] = useState(false)

  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    listNotifications(100).then(
      (rows) => {
        if (!cancelled) setItems(rows)
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      },
    )
    const unsubscribe = subscribeToNotifications(currentUserId, (n) => {
      setItems((prev) => (prev ? upsert(prev, n) : [n]))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [currentUserId])

  const unread = useMemo(() => (items ?? []).filter((n) => !n.readAt).length, [items])
  const shown = useMemo(() => (items ?? []).filter((n) => !onlyUnread || !n.readAt), [items, onlyUnread])

  const markRead = useCallback(async (ids?: string[]) => {
    const stamp = new Date().toISOString()
    setItems((prev) => prev?.map((n) => (!n.readAt && (!ids || ids.includes(n.id)) ? { ...n, readAt: stamp } : n)) ?? prev)
    try {
      await markNotificationsRead(ids)
    } catch (e) {
      toast.error('Could not mark as read', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      changed()
    }
  }, [])

  const open = async (n: AppNotification) => {
    if (!n.readAt) await markRead([n.id])
    if (n.link) router.push(n.link)
  }

  const remove = async (n: AppNotification) => {
    setItems((prev) => prev?.filter((x) => x.id !== n.id) ?? prev)
    try {
      await deleteNotification(n.id)
    } catch (e) {
      toast.error('Could not delete', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      changed()
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 md:px-6 md:py-16">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-tag mb-2">Inbox</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Notifications</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {unread > 0 ? `${unread} unread` : 'You are all caught up.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9"
            onClick={() => setOnlyUnread((v) => !v)}
            aria-pressed={onlyUnread}
          >
            {onlyUnread ? 'Show all' : 'Unread only'}
          </Button>
          <Button className="h-9" disabled={unread === 0} onClick={() => markRead()} data-testid="mark-all-read">
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-6 border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          Could not load notifications: {error}
        </p>
      )}

      <div className="border border-border bg-surface" data-testid="notifications">
        {items === null ? (
          <p className="p-6 text-[13px] text-muted-foreground">Loading…</p>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Bell className="h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-[14px] font-medium">{onlyUnread ? 'No unread notifications' : 'No notifications yet'}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Booking requests, payments, handovers, payouts and disputes show up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((n) => {
              const Icon = iconFor(n.kind)
              const isUnread = !n.readAt
              return (
                <li key={n.id} className={cn('group relative flex items-start gap-4 p-5 sm:px-6', isUnread && 'bg-background')}>
                  <button
                    type="button"
                    onClick={() => void open(n)}
                    className="flex min-w-0 flex-1 items-start gap-4 text-left"
                    data-testid="notification"
                    data-unread={isUnread ? 'true' : 'false'}
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center border',
                        isUnread ? 'border-primary bg-primary-muted text-primary' : 'border-border bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-4">
                        <span className={cn('text-[14px]', isUnread ? 'font-semibold' : 'font-medium text-foreground/80')}>
                          {isUnread && <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" aria-label="Unread" />}
                          {n.title}
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                          {relativeTime(n.createdAt)}
                        </span>
                      </span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">{n.body}</span>
                    </span>
                    {n.link && (
                      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(n)}
                    className="mt-2 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
