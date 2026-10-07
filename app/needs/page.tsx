'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, CircleCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useMarketplace } from '@/lib/store'
import { CATEGORIES, categoryLabel, getUser } from '@/lib/data'
import type { CategoryId, Listing, Need } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ProductCard } from '@/components/listing-card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/format'

export default function NeedsPage() {
  const { needs, listings, currentUserId, addNeed } = useMarketplace()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<CategoryId | ''>('')
  const [note, setNote] = useState('')
  const [arrival, setArrival] = useState('')

  const matchesFor = useMemo(
    () => (need: Need) =>
      listings.filter((l) => l.category === need.category && l.status === 'available'),
    [listings],
  )

  const myNeeds = needs.filter((n) => n.userId === currentUserId)
  const communityNeeds = needs.filter((n) => n.userId !== currentUserId)
  const valid = title.trim() && category && arrival.trim()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) { toast.error('Please add a title, category and arrival date'); return }
    const need = addNeed({ title: title.trim(), category: category as CategoryId, note: note.trim(), arrivalDate: arrival.trim() })
    const count = listings.filter((l) => l.category === need.category && l.status === 'available').length
    toast.success('Need registered', {
      description: count ? `Found ${count} matching item${count === 1 ? '' : 's'} on campus.` : "We'll match you as outgoing students list items.",
    })
    setTitle(''); setCategory(''); setNote(''); setArrival('')
  }

  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen">
      {/* Header */}
      <div className="mb-16">
        <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight">Pre-arrival Needs</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Tell the community what you need before you arrive. We’ll match you against items that outgoing students are listing as they move out.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[340px_1fr]">
        {/* Form — sharp bordered box */}
        <form
          onSubmit={onSubmit}
          className="h-fit space-y-4 lg:sticky lg:top-20"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Register a need</p>

          <div className="space-y-1.5">
            <Label htmlFor="need-title" className="text-[12px]">What do you need?</Label>
            <Input id="need-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. A desk for my room" className="rounded-sm h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CategoryId)}>
              <SelectTrigger className="rounded-sm h-10">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="need-arrival" className="text-[12px]">Arrival date</Label>
            <Input id="need-arrival" value={arrival} onChange={(e) => setArrival(e.target.value)} placeholder="e.g. August 2026" className="rounded-sm h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="need-note" className="text-[12px]">Notes (optional)</Label>
            <Textarea id="need-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Budget, preferences, or anything else." className="resize-none rounded-sm" />
          </div>
          <button
            type="submit"
            disabled={!valid}
            className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-2.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Register need
          </button>
        </form>

        {/* Right: needs + community */}
        <div className="space-y-10">
          {/* Your needs */}
          <section>
            <p className="label-tag mb-4">Your needs</p>
            {myNeeds.length > 0 ? (
              <div className="space-y-6 divide-y divide-border">
                {myNeeds.map((need) => {
                  const matches = matchesFor(need)
                  return (
                    <div key={need.id} className="pt-6 first:pt-0">
                      <div className="flex items-baseline justify-between gap-4 mb-4">
                        <div>
                          <p className="text-[14px] font-semibold">{need.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {categoryLabel(need.category)} · arriving {need.arrivalDate}
                          </p>
                        </div>
                        {matches.length > 0 ? (
                          <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-primary">
                            <CircleCheck className="h-3.5 w-3.5" />
                            {matches.length} match{matches.length === 1 ? '' : 'es'}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11px] text-muted-foreground">No matches yet</span>
                        )}
                      </div>
                      {matches.length > 0 && (
                        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 mt-8">
                          {matches.slice(0, 3).map((l) => (
                            <ProductCard key={l.id} listing={l} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-12 text-[13px] text-muted-foreground">
                You haven&apos;t registered any needs yet.
              </div>
            )}
          </section>

          {/* Community needs */}
          {communityNeeds.length > 0 && (
            <section>
              <p className="label-tag mb-1">What others are looking for</p>
              <p className="mb-4 text-[12px] text-muted-foreground">
                Moving out? These incoming students want what you might be leaving behind.
              </p>
              <div className="divide-y divide-border">
                {communityNeeds.map((need) => {
                  const user = getUser(need.userId)
                  return (
                    <div key={need.id} className="flex items-start gap-3 py-4">
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarFallback className="bg-surface-tinted text-[10px] font-bold text-muted-foreground">
                          {initials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug">{need.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {user.name} · {categoryLabel(need.category)} · arriving {need.arrivalDate}
                        </p>
                        {need.note && <p className="mt-1 text-[11px] text-muted-foreground">{need.note}</p>}
                      </div>
                      <Link
                        href="/sell"
                        className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline underline-offset-2"
                      >
                        List one <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
