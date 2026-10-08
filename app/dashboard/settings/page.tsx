'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useMarketplace } from '@/lib/store'
import { getUser } from '@/lib/data'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  const { currentUserId } = useMarketplace()
  const me = getUser(currentUserId)

  const [name, setName] = useState(me?.name || '')
  const [program, setProgram] = useState(me?.program || '')
  const [batch, setBatch] = useState(me?.batch || '')

  const onSave = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, this would update the backend
    toast.success('Settings saved successfully.')
  }

  return (
    <div className="space-y-10">
      <div className="mb-12">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Settings</h1>
        <p className="mt-4 text-[14px] text-muted-foreground">Manage your account and preferences.</p>
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        {/* Profile Settings */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Public Profile</h2>
            <p className="text-[13px] text-muted-foreground">This information will be visible to other students.</p>
          </div>

          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Display Name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="program" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Program
                </label>
                <input
                  id="program"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  placeholder="e.g. CS, SET"
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="batch" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Batch
                </label>
                <input
                  id="batch"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  placeholder="e.g. Fall '24"
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>

            <Button type="submit" className="w-full">
              Save Changes
            </Button>
          </form>
        </section>

        {/* Notifications */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Notifications</h2>
            <p className="text-[13px] text-muted-foreground">Choose what updates you want to receive.</p>
          </div>

          <div className="space-y-4 border border-border bg-card p-5">
            {[
              { id: 'msg', title: 'New Messages', desc: 'When someone messages you about a listing' },
              { id: 'req', title: 'Rental Requests', desc: 'When someone wants to rent your item' },
              { id: 'match', title: 'Need Matches', desc: 'When a listing matches your pre-arrival need' },
            ].map((pref) => (
              <div key={pref.id} className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <label htmlFor={pref.id} className="text-[13px] font-medium leading-none">
                    {pref.title}
                  </label>
                  <p className="text-[12px] text-muted-foreground">{pref.desc}</p>
                </div>
                <input
                  type="checkbox"
                  id={pref.id}
                  defaultChecked
                  className="mt-1 h-4 w-4 shrink-0 rounded-sm border-primary text-primary focus:ring-primary"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Security Settings */}
        <section className="space-y-6 md:col-span-2">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Security</h2>
            <p className="text-[13px] text-muted-foreground">Update your password to keep your account secure.</p>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault()
            toast.success('Password updated successfully.')
            // Reset form fields
            const form = e.target as HTMLFormElement
            form.reset()
          }} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <label htmlFor="currentPassword" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                required
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="newPassword" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <Button type="submit">
              Update Password
            </Button>
          </form>
        </section>
      </div>
    </div>
  )
}
