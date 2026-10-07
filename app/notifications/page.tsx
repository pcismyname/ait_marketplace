'use client'

import { Bell, CheckCircle2, MessageCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const NOTIFICATIONS = [
  {
    id: 1,
    type: 'message',
    title: 'New message from Emma W.',
    message: 'Are you available to meet today at 5 PM for the desk lamp?',
    date: '10 minutes ago',
    unread: true,
    link: '/chat'
  },
  {
    id: 2,
    type: 'match',
    title: 'New Match: Calculus Textbook',
    message: 'An outgoing student just listed a Calculus textbook you requested.',
    date: '2 hours ago',
    unread: true,
    link: '/needs'
  },
  {
    id: 3,
    type: 'system',
    title: 'Deposit Released',
    message: 'Your deposit of ฿500 for "Mini Fridge" has been released to your wallet.',
    date: 'Yesterday',
    unread: false,
    link: '/dashboard/wallet'
  }
]

export default function NotificationsPage() {
  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen max-w-4xl mx-auto">
      <div className="mb-12">
        <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight">Notifications</h1>
      </div>

      <div className="border border-border bg-surface">
        <div className="divide-y divide-border">
          {NOTIFICATIONS.map((notification) => (
            <Link
              href={notification.link}
              key={notification.id}
              className={cn(
                'group flex items-start gap-4 p-5 sm:px-6 transition-colors hover:bg-muted/50',
                notification.unread ? 'bg-background' : 'bg-transparent'
              )}
            >
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center border',
                notification.unread ? 'border-primary bg-primary-muted text-primary' : 'border-border bg-muted text-muted-foreground'
              )}>
                {notification.type === 'message' && <MessageCircle className="h-4 w-4" />}
                {notification.type === 'match' && <Bell className="h-4 w-4" />}
                {notification.type === 'system' && <CheckCircle2 className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <p className={cn('text-[14px]', notification.unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80')}>
                    {notification.title}
                  </p>
                  <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
                    {notification.date}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
                  {notification.message}
                </p>
              </div>
              <div className="shrink-0 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="h-4 w-4 text-primary" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
