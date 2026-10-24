'use client'

// Account settings. Profile fields are edited on /onboarding (the same form
// new students fill in, which saves to public.users). The password form calls
// Supabase Auth directly. Notifications are in-app only (email is P2), so
// there are no preferences to store yet.

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useMarketplace } from '@/lib/store'
import { createClient } from '@/utils/supabase/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const INPUT =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10'

export default function SettingsPage() {
  const { currentUserId, getUser } = useMarketplace()
  const me = getUser(currentUserId)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const mismatch = confirm.length > 0 && password !== confirm

  const onPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8 || password !== confirm) return
    setSaving(true)
    const { error } = await createClient().auth.updateUser({ password })
    setSaving(false)
    if (error) {
      toast.error('Could not change the password', { description: error.message })
      return
    }
    toast.success('Password changed', { description: 'Use the new password next time you log in.' })
    setPassword('')
    setConfirm('')
  }

  return (
    <div className="space-y-10">
      <div className="mb-12">
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">Settings</h1>
        <p className="mt-4 text-[14px] text-muted-foreground">Manage your account and preferences.</p>
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Public profile</h2>
            <p className="text-[13px] text-muted-foreground">This information is visible to other students.</p>
          </div>
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2 border border-border bg-card p-5 text-[13px]">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="truncate font-medium">{me.name}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="truncate">{me.email || '—'}</dd>
            <dt className="text-muted-foreground">Program</dt>
            <dd className="truncate">{me.program || '—'}</dd>
            <dt className="text-muted-foreground">Intake</dt>
            <dd className="truncate">{me.batch || '—'}</dd>
          </dl>
          <div className="flex flex-wrap gap-3">
            <Link href="/onboarding" className={buttonVariants()}>
              Edit profile
            </Link>
            {currentUserId && (
              <Link href={`/profile/${currentUserId}`} className={buttonVariants({ variant: 'outline' })}>
                View public profile
              </Link>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Notifications</h2>
            <p className="text-[13px] text-muted-foreground">
              You get in-app notifications for messages, booking requests and approvals, payouts, deadlines, disputes
              and pre-arrival matches. Email notifications aren&apos;t available yet.
            </p>
          </div>
          <Link href="/notifications" className={cn(buttonVariants({ variant: 'outline' }))}>
            Open notifications
          </Link>
        </section>

        <section className="space-y-6 md:col-span-2">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Security</h2>
            <p className="text-[13px] text-muted-foreground">
              Change your password. Forgot it? Use{' '}
              <Link href="/reset-password" className="font-medium text-primary hover:underline">
                reset password
              </Link>{' '}
              instead.
            </p>
          </div>

          <form onSubmit={onPassword} className="max-w-md space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="newPassword" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Repeat new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={mismatch}
                aria-describedby={mismatch ? 'password-mismatch' : undefined}
                className={INPUT}
              />
              {mismatch && (
                <p id="password-mismatch" role="alert" className="text-[11px] text-destructive">
                  The passwords don&apos;t match.
                </p>
              )}
            </div>
            <Button type="submit" disabled={saving || password.length < 8 || password !== confirm}>
              {saving ? 'Saving…' : 'Change password'}
            </Button>
          </form>
        </section>
      </div>
    </div>
  )
}
