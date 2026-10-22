'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { LISTINGS, NEEDS, THREADS, RENTALS, SELLER_REVIEWS } from '@/lib/data'
import { Button } from '@/components/ui/button'

const uuidFor = (index: number) =>
  `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`

function describeError(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const value = error as Record<string, unknown>
    const parts = ['message', 'details', 'hint', 'code']
      .map((key) => value[key])
      .filter((item): item is string => typeof item === 'string' && item.length > 0)
    if (parts.length > 0) return parts.join(' — ')
    return JSON.stringify(error)
  }
  return String(error)
}

export default function SeedPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSeed = async () => {
    setLoading(true)
    const supabase = createClient()
    let step = 'starting'

    try {
      const failIfError = (error: unknown, operation: string): void => {
        if (error) throw new Error(`${operation}: ${describeError(error)}`)
      }

      step = 'checking authentication'
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      failIfError(authError, 'Authentication check failed')
      if (!user) throw new Error('Log in before opening the seed utility.')

      const userId = user.id
      const listingIds = new Map(LISTINGS.map((listing, index) => [
        listing.id,
        uuidFor(1000 + index),
      ]))
      const threadIds = new Map(THREADS.map((thread, index) => [
        thread.id,
        uuidFor(2000 + index),
      ]))
      const messageIds = new Map(
        THREADS.flatMap((thread) => thread.messages).map((message, index) => [
          message.id,
          uuidFor(3000 + index),
        ]),
      )
      const needIds = new Map(NEEDS.map((need, index) => [need.id, uuidFor(4000 + index)]))
      const rentalIds = new Map(RENTALS.map((rental, index) => [rental.id, uuidFor(5000 + index)]))

      step = 'creating the profile'
      setMessage('Creating your Supabase profile...')
      const { error: profileError } = await supabase.from('users').upsert({
        id: userId,
        name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'AIT Student',
        email: user.email,
        program: user.user_metadata?.program ?? 'AIT Student',
        batch: user.user_metadata?.batch ?? 'Current intake',
        kind: 'student',
      })
      failIfError(profileError, 'Profile upsert failed')

      step = 'seeding listings'
      setMessage('Seeding listings and history...')
      for (const listing of LISTINGS) {
        const listingId = listingIds.get(listing.id)
        if (!listingId) throw new Error(`Missing UUID for listing ${listing.id}`)

        const { error } = await supabase.from('listings').upsert({
          id: listingId,
          seller_id: userId,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          type: listing.type,
          price: listing.price,
          deposit: listing.deposit ?? null,
          rental_period: listing.rentalPeriod ?? null,
          condition: listing.condition,
          images: listing.images,
          pickup_location: listing.pickupLocation,
          status: listing.status,
          times_changed_hands: listing.timesChangedHands,
          featured: listing.featured ?? false,
          view_count: listing.viewCount ?? 0,
          created_at: listing.createdAt,
        })
        failIfError(error, `Listing "${listing.title}" failed`)

        for (const [historyIndex, history] of listing.history.entries()) {
          const { error: historyError } = await supabase.from('listing_history').upsert({
            id: uuidFor(6000 + LISTINGS.indexOf(listing) * 100 + historyIndex),
            listing_id: listingId,
            owner_name: history.ownerName,
            action: history.action,
            date: history.date,
          })
          failIfError(historyError, `History for "${listing.title}" failed`)
        }

        for (const [reviewIndex, review] of (SELLER_REVIEWS[listing.sellerId] ?? []).entries()) {
          const { error: reviewError } = await supabase.from('reviews').upsert({
            id: uuidFor(7000 + LISTINGS.indexOf(listing) * 100 + reviewIndex),
            listing_id: listingId,
            author_id: userId,
            author_name: review.authorName,
            author_avatar: review.authorAvatar || null,
            role: review.role,
            rating: review.rating,
            comment: review.comment || null,
            date: review.date,
          })
          failIfError(reviewError, `Review for "${listing.title}" failed`)
        }
      }

      step = 'seeding needs'
      setMessage('Seeding needs...')
      for (const need of NEEDS) {
        const { error } = await supabase.from('needs').upsert({
          id: needIds.get(need.id),
          user_id: userId,
          title: need.title,
          category: need.category,
          note: need.note || null,
          arrival_date: need.arrivalDate,
          created_at: need.createdAt,
        })
        failIfError(error, `Need "${need.title}" failed`)
      }

      step = 'seeding threads and messages'
      setMessage('Seeding threads and messages...')
      for (const thread of THREADS) {
        const threadId = threadIds.get(thread.id)
        if (!threadId) throw new Error(`Missing UUID for thread ${thread.id}`)

        const { error: threadError } = await supabase.from('threads').upsert({
          id: threadId,
          listing_id: listingIds.get(thread.listingId),
        })
        failIfError(threadError, `Thread "${thread.id}" failed`)

        const { error: participantError } = await supabase
          .from('thread_participants')
          .upsert({ thread_id: threadId, user_id: userId })
        failIfError(participantError, `Participants for "${thread.id}" failed`)

        for (const message of thread.messages) {
          const { error: messageError } = await supabase.from('messages').upsert({
            id: messageIds.get(message.id),
            thread_id: threadId,
            sender_id: userId,
            text: message.text,
            created_at: message.createdAt,
          })
          failIfError(messageError, `Message "${message.id}" failed`)
        }
      }

      step = 'seeding rentals'
      setMessage('Seeding rentals...')
      for (const rental of RENTALS) {
        const { error } = await supabase.from('rentals').upsert({
          id: rentalIds.get(rental.id),
          listing_id: listingIds.get(rental.listingId),
          renter_id: userId,
          deposit: rental.deposit,
          start_date: rental.startDate,
          due_date: rental.dueDate,
          phase: rental.phase,
          quote: rental.quote ?? null,
          payment_method: rental.paymentMethod ?? null,
        })
        failIfError(error, `Rental "${rental.id}" failed`)
      }

      setMessage('Seed complete. Refresh the marketplace to load the Supabase data.')
    } catch (error) {
      const detail = describeError(error)
      console.error('Supabase seed failed', { step, detail, error: describeError(error) })
      setMessage(`Seed failed during ${step}: ${detail}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center space-y-4 p-20 text-center">
      <h1 className="text-2xl font-bold">Database Seed Utility</h1>
      <p className="text-sm text-muted-foreground">
        Seeds the current Supabase account with valid UUIDs and the complete relational sample dataset.
      </p>
      <Button onClick={handleSeed} disabled={loading} size="lg">
        {loading ? 'Seeding...' : 'Seed Database'}
      </Button>
      <p className="pt-4 font-mono text-sm">{message}</p>
    </div>
  )
}
