'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { USERS, LISTINGS, NEEDS, THREADS, RENTALS, SELLER_REVIEWS } from '@/lib/data'
import { Button } from '@/components/ui/button'
import type { Listing } from '@/lib/types'

export default function SeedPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSeed = async () => {
    setLoading(true)
    setMessage('Seeding started... check console for logs.')
    const supabase = createClient()

    try {
      // 1. Users
      setMessage('Seeding users...')
      for (const u of USERS) {
        await supabase.from('users').upsert({
          id: u.id,
          name: u.name,
          program: u.program,
          batch: u.batch,
          rating: u.rating,
          reviews_count: u.reviewsCount,
          kind: u.kind || 'student',
        })
      }

      // 2. Listings
      setMessage('Seeding listings...')
      for (const l of LISTINGS) {
        await supabase.from('listings').upsert({
          id: l.id,
          seller_id: l.sellerId,
          title: l.title,
          description: l.description,
          category: l.category,
          type: l.type,
          price: l.price,
          deposit: l.deposit,
          rental_period: l.rentalPeriod,
          condition: l.condition,
          images: l.images,
          pickup_location: l.pickupLocation,
          status: l.status,
          times_changed_hands: l.timesChangedHands,
          featured: l.featured || false,
          created_at: l.createdAt,
        })
        
        // Listing history
        if (l.history) {
          for (const h of l.history) {
            await supabase.from('listing_history').upsert({
              listing_id: l.id,
              owner_name: h.ownerName,
              action: h.action,
              date: h.date
            })
          }
        }
      }

      // 3. Needs
      setMessage('Seeding needs...')
      for (const n of NEEDS) {
        await supabase.from('needs').upsert({
          id: n.id,
          user_id: n.userId,
          title: n.title,
          category: n.category,
          note: n.note,
          arrival_date: n.arrivalDate,
          created_at: n.createdAt,
        })
      }

      // 4. Threads & Messages
      setMessage('Seeding threads & messages...')
      for (const t of THREADS) {
        await supabase.from('threads').upsert({ id: t.id, listing_id: t.listingId })
        for (const pId of t.participantIds) {
          await supabase.from('thread_participants').upsert({ thread_id: t.id, user_id: pId })
        }
        for (const m of t.messages) {
          await supabase.from('messages').upsert({
            id: m.id,
            thread_id: t.id,
            sender_id: m.senderId,
            text: m.text,
            created_at: m.createdAt,
          })
        }
      }

      // 5. Rentals
      setMessage('Seeding rentals...')
      for (const r of RENTALS) {
        await supabase.from('rentals').upsert({
          id: r.id,
          listing_id: r.listingId,
          renter_id: r.renterId,
          deposit: r.deposit,
          start_date: r.startDate,
          due_date: r.dueDate,
          phase: r.phase,
        })
      }

      setMessage('Seeding complete! You can now navigate to the home page.')
      
    } catch (e: any) {
      console.error(e)
      setMessage(`Error: ${e.message}`)
    }
    setLoading(false)
  }

  return (
    <div className="p-20 text-center space-y-4 max-w-2xl mx-auto flex flex-col items-center">
      <h1 className="text-2xl font-bold">Database Seed Utility</h1>
      <p className="text-sm text-muted-foreground">Click below to populate your Supabase database with the mock data from lib/data.ts. This will upload all sample listings, users, messages, and rentals so the app isn't empty.</p>
      <Button onClick={handleSeed} disabled={loading} size="lg">
        {loading ? 'Seeding...' : 'Seed Database'}
      </Button>
      <p className="font-mono text-sm pt-4">{message}</p>
    </div>
  )
}
