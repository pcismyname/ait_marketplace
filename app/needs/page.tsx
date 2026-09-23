'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, Plus, CircleCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useMarketplace } from '@/lib/store'
import { CATEGORIES, categoryLabel, getUser } from '@/lib/data'
import type { CategoryId, Listing, Need } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ListingCard } from '@/components/listing-card'
import { CategoryIcon } from '@/components/category-icon'
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
    if (!valid) {
      toast.error('Please add a title, category and arrival date')
      return
    }
    const need = addNeed({
      title: title.trim(),
      category: category as CategoryId,
      note: note.trim(),
      arrivalDate: arrival.trim(),
    })
    const count = listings.filter(
      (l) => l.category === need.category && l.status === 'available',
    ).length
    toast.success('Need registered', {
      description: count
        ? `We already found ${count} matching ${count === 1 ? 'item' : 'items'} on campus.`
        : 'We will match you as outgoing students list items.',
    })
    setTitle('')
    setCategory('')
    setNote('')
    setArrival('')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-surge-muted px-3 py-1 text-xs font-semibold text-surge-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          For incoming students
        </span>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl text-balance">
          Register what you need before you arrive
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Tell the community what you&apos;re looking for. We&apos;ll automatically match
          you against items that outgoing students are listing as they move out — so your
          room is ready on day one.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        {/* Form */}
        <form
          onSubmit={onSubmit}
          className="h-fit space-y-4 rounded-3xl border border-border bg-card p-6 lg:sticky lg:top-20"
        >
          <h2 className="font-display text-lg font-bold">Add a need</h2>
          <div className="space-y-2">
            <Label htmlFor="need-title">What do you need?</Label>
            <Input
              id="need-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. A desk for my room"
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CategoryId)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="need-arrival">Arrival date</Label>
            <Input
              id="need-arrival"
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
              placeholder="e.g. August 2026"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="need-note">Notes (optional)</Label>
            <Textarea
              id="need-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Budget, preferences, or anything else."
              className="resize-none"
            />
          </div>
          <Button type="submit" className="w-full" disabled={!valid}>
            <Plus className="h-4 w-4" />
            Register need
          </Button>
        </form>

        {/* Needs + matches */}
        <div className="space-y-8">
          <section>
            <h2 className="mb-1 font-display text-lg font-bold">Your needs</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Auto-matched against available listings across the community.
            </p>
            {myNeeds.length > 0 ? (
              <div className="space-y-4">
                {myNeeds.map((need) => (
                  <NeedMatchCard
                    key={need.id}
                    need={need}
                    matches={matchesFor(need)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                You haven&apos;t registered any needs yet. Add one to start matching.
              </div>
            )}
          </section>

          {communityNeeds.length > 0 && (
            <section>
              <h2 className="mb-1 font-display text-lg font-bold">
                What others are looking for
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Moving out? These incoming students want what you might be leaving behind.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {communityNeeds.map((need) => {
                  const user = getUser(need.userId)
                  return (
                    <div
                      key={need.id}
                      className="rounded-2xl border border-border bg-card p-4"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                            {initials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{need.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.name} · arriving {need.arrivalDate}
                          </p>
                        </div>
                      </div>
                      {need.note && (
                        <p className="mt-2 text-xs text-muted-foreground text-pretty">
                          {need.note}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                          <CategoryIcon category={need.category} className="h-3 w-3" />
                          {categoryLabel(need.category)}
                        </span>
                        <Link
                          href="/sell"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          List one
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
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

function NeedMatchCard({ need, matches }: { need: Need; matches: Listing[] }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
          <CategoryIcon category={need.category} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{need.title}</p>
          <p className="text-xs text-muted-foreground">
            {categoryLabel(need.category)} · arriving {need.arrivalDate}
          </p>
        </div>
        <span
          className={
            matches.length
              ? 'inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary'
              : 'rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground'
          }
        >
          {matches.length ? (
            <>
              <CircleCheck className="h-3.5 w-3.5" />
              {matches.length} match{matches.length === 1 ? '' : 'es'}
            </>
          ) : (
            'No matches yet'
          )}
        </span>
      </div>

      {matches.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {matches.slice(0, 3).map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  )
}
