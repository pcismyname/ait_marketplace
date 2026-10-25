'use client'

// Pre-arrival needs. Matching runs in the database (match_needs: same
// category, a fitting listing type, the needed-by window, live listings only,
// featured first) and the need's owner is notified when a matching listing
// goes live (kind 'need_match'), which also refreshes this page live.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, CircleCheck, ArrowRight, Trash2, CalendarClock } from 'lucide-react'
import Link from 'next/link'
import { useMarketplace } from '@/lib/store'
import { CATEGORIES, categoryLabel } from '@/lib/data'
import type { CategoryId, Listing } from '@/lib/types'
import { getListing, subscribeToNotifications } from '@/lib/api'
import {
  NEED_MATCH_GRACE_DAYS,
  createNeed,
  deleteNeed,
  isNeedOpen,
  listNeeds,
  matchNeeds,
  updateNeedDate,
  type NeedListingType,
  type NeedMatch,
  type NeedRecord,
} from '@/lib/api/needs'
import { nextIntake, toDateInput } from '@/lib/seasons'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ProductCard } from '@/components/listing-card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/format'

const TYPE_LABEL: Record<NeedListingType, string> = {
  any: 'Buy or rent',
  sale: 'Buy',
  rent: 'Rent',
}

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const neededByText = (need: NeedRecord) => (need.neededBy ? prettyDate(need.neededBy) : need.arrivalDate)

export default function NeedsPage() {
  const { listings, currentUserId, currentUser, getUser } = useMarketplace()

  const [needs, setNeeds] = useState<NeedRecord[] | null>(null)
  const [matches, setMatches] = useState<NeedMatch[]>([])
  const [extraListings, setExtraListings] = useState<Map<string, Listing>>(new Map())

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<CategoryId | ''>('')
  const [listingType, setListingType] = useState<NeedListingType>('any')
  const [note, setNote] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [saving, setSaving] = useState(false)
  const [reopenDates, setReopenDates] = useState<Record<string, string>>({})

  const today = toDateInput(new Date())
  // Default: the student's arrival date from onboarding if still ahead, else the next AIT intake.
  const defaultNeededBy =
    currentUser?.arrivalDate && currentUser.arrivalDate >= today
      ? currentUser.arrivalDate
      : toDateInput(nextIntake().date)
  const neededByValue = neededBy || defaultNeededBy

  const apply = useCallback(([allNeeds, myMatches]: [NeedRecord[], NeedMatch[]]) => {
    setNeeds(allNeeds)
    setMatches(myMatches)
    return myMatches
  }, [])
  const reload = useCallback(() => Promise.all([listNeeds(), matchNeeds()]).then(apply), [apply])

  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    Promise.all([listNeeds(), matchNeeds()]).then(
      (data) => {
        if (!cancelled) apply(data)
      },
      (error: Error) => toast.error('Could not load needs', { description: error.message }),
    )
    return () => {
      cancelled = true
    }
  }, [currentUserId, apply])

  // A new matching listing notifies the owner: refresh the matches live.
  useEffect(() => {
    if (!currentUserId) return
    return subscribeToNotifications(currentUserId, (n) => {
      if (n.kind === 'need_match') void reload().catch(() => {})
    })
  }, [currentUserId, reload])

  // Listings aren't on Realtime, so a matched listing that gets reserved, sold
  // or paused would linger: re-ask the server (match_needs only returns
  // available listings) when the tab regains focus and once a minute.
  useEffect(() => {
    if (!currentUserId) return
    const refresh = () => {
      if (document.visibilityState === 'visible') void reload().catch(() => {})
    }
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [currentUserId, reload])

  const listingById = useMemo(() => {
    const map = new Map(extraListings)
    for (const l of listings) map.set(l.id, l)
    return map
  }, [listings, extraListings])

  // Matched listings the store hasn't loaded yet (posted since the page opened).
  const missingIds = useMemo(
    () => [...new Set(matches.map((m) => m.listingId))].filter((id) => !listingById.has(id)),
    [matches, listingById],
  )
  useEffect(() => {
    if (missingIds.length === 0) return
    let cancelled = false
    Promise.all(missingIds.map((id) => getListing(id))).then(
      (rows) => {
        if (cancelled) return
        setExtraListings((prev) => {
          const next = new Map(prev)
          for (const l of rows) if (l) next.set(l.id, l)
          return next
        })
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [missingIds])

  const matchesFor = (needId: string) =>
    matches
      .filter((m) => m.needId === needId)
      .map((m) => listingById.get(m.listingId))
      .filter((l): l is Listing => Boolean(l) && l?.status === 'available')

  const myNeeds = (needs ?? []).filter((n) => n.userId === currentUserId)
  const communityNeeds = (needs ?? []).filter((n) => n.userId !== currentUserId && isNeedOpen(n))
  const valid = Boolean(title.trim() && category && neededByValue && neededByValue >= today)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) {
      toast.error('Add a title, a category and a needed-by date from today on')
      return
    }
    setSaving(true)
    try {
      const need = await createNeed({
        title: title.trim(),
        category: category as CategoryId,
        note: note.trim(),
        neededBy: neededByValue,
        listingType,
      })
      const fresh = await reload()
      const count = fresh.filter((m) => m.needId === need.id).length
      toast.success('Need registered', {
        description: count
          ? `Found ${count} matching item${count === 1 ? '' : 's'} on campus.`
          : "We'll notify you when an outgoing student lists a match.",
      })
      setTitle(''); setCategory(''); setNote(''); setNeededBy(''); setListingType('any')
    } catch (error) {
      toast.error('Could not save your need', { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (need: NeedRecord) => {
    try {
      await deleteNeed(need.id)
      await reload()
      toast.success('Need removed')
    } catch (error) {
      toast.error('Could not remove the need', { description: error instanceof Error ? error.message : String(error) })
    }
  }

  const onReopen = async (need: NeedRecord) => {
    const date = reopenDates[need.id]
    if (!date || date < today) {
      toast.error('Pick a needed-by date from today on')
      return
    }
    try {
      await updateNeedDate(need.id, date)
      await reload()
      toast.success('Need updated')
    } catch (error) {
      toast.error('Could not update the need', { description: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen">
      {/* Header */}
      <div className="mb-16">
        <p className="label-tag mb-2">Incoming students</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pre-arrival Needs</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
          Tell the community what you need before you arrive. We match you with items outgoing students list as
          they move out, and let you know as soon as a new one appears. Matches are held until you arrive.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[340px_1fr]">
        {/* Form */}
        <form onSubmit={onSubmit} className="h-fit space-y-4 lg:sticky lg:top-20" data-testid="need-form">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Register a need</p>

          <div className="space-y-1.5">
            <Label htmlFor="need-title" className="text-[12px]">What do you need?</Label>
            <Input id="need-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. A desk for my room" className="rounded-sm h-10" maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CategoryId)}>
              <SelectTrigger className="rounded-sm h-10" aria-label="Category">
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
            <Label className="text-[12px]">Buy or rent?</Label>
            <div className="grid grid-cols-3 gap-1 rounded-sm border border-border p-1" role="radiogroup" aria-label="Buy or rent">
              {(['any', 'sale', 'rent'] as NeedListingType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={listingType === t}
                  onClick={() => setListingType(t)}
                  className={
                    'rounded-sm py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ' +
                    (listingType === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface')
                  }
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="need-by" className="text-[12px]">Needed by</Label>
            <Input
              id="need-by"
              type="date"
              min={today}
              value={neededByValue}
              onChange={(e) => setNeededBy(e.target.value)}
              className="rounded-sm h-10"
            />
            <p className="text-[11px] text-muted-foreground">
              Usually your arrival date. Matching keeps running for {NEED_MATCH_GRACE_DAYS} days after it.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="need-note" className="text-[12px]">Notes (optional)</Label>
            <Textarea id="need-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Budget, preferences, or anything else." className="resize-none rounded-sm" maxLength={500} />
          </div>
          <button
            type="submit"
            disabled={!valid || saving}
            className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-2.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Register need'}
          </button>
        </form>

        {/* Right: needs + community */}
        <div className="space-y-10">
          {/* Your needs */}
          <section>
            <p className="label-tag mb-4">Your needs</p>
            {needs === null ? (
              <p className="py-12 text-[13px] text-muted-foreground">Loading your needs…</p>
            ) : myNeeds.length > 0 ? (
              <div className="space-y-6 divide-y divide-border" data-testid="my-needs">
                {myNeeds.map((need) => {
                  const open = isNeedOpen(need)
                  const found = open ? matchesFor(need.id) : []
                  return (
                    <div key={need.id} className="pt-6 first:pt-0" data-need-id={need.id}>
                      <div className="flex items-baseline justify-between gap-4 mb-4">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold">{need.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {categoryLabel(need.category)} · {TYPE_LABEL[need.listingType]} · needed by {neededByText(need)}
                          </p>
                          {need.note && <p className="mt-1 text-[11px] text-muted-foreground">{need.note}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {!open ? (
                            <span className="text-[11px] text-muted-foreground">Closed</span>
                          ) : found.length > 0 ? (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-primary" data-testid="match-count">
                              <CircleCheck className="h-3.5 w-3.5" />
                              {found.length} match{found.length === 1 ? '' : 'es'}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground" data-testid="match-count">No matches yet</span>
                          )}
                          <button
                            type="button"
                            onClick={() => void onDelete(need)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Remove need ${need.title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {!open && (
                        <div className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2.5 text-[12px]">
                          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Matching stopped {NEED_MATCH_GRACE_DAYS} days after your date. Still looking?
                          </span>
                          <input
                            type="date"
                            min={today}
                            value={reopenDates[need.id] ?? ''}
                            onChange={(e) => setReopenDates((prev) => ({ ...prev, [need.id]: e.target.value }))}
                            className="h-8 rounded-sm border border-input bg-background px-2 text-[12px]"
                            aria-label="New needed-by date"
                          />
                          <button
                            type="button"
                            onClick={() => void onReopen(need)}
                            className="rounded-sm border border-border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider hover:bg-background"
                          >
                            Update date
                          </button>
                        </div>
                      )}
                      {found.length > 0 && (
                        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 mt-8">
                          {found.slice(0, 6).map((l) => (
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
                          <Link href={`/profile/${need.userId}`} className="hover:underline">{user.name}</Link>
                          {' '}· {categoryLabel(need.category)} · {TYPE_LABEL[need.listingType]} · needed by {neededByText(need)}
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
