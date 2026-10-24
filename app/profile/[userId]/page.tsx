'use client'

// Public profile: name, AIT verification badge, rating and reviews, active
// listings. Everything is read from the database: the profile row
// (users.rating and users.reviews_count are kept up to date by submit_review),
// reviews about this user (reviews.subject_id) and their available listings.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { BadgeCheck, MapPin, Store } from 'lucide-react'
import { getProfile, listReviewsFor, searchListings } from '@/lib/api'
import { useMarketplace } from '@/lib/store'
import type { Listing, Review, User } from '@/lib/types'
import { ProductCard } from '@/components/listing-card'
import { Rating } from '@/components/rating'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/format'

interface ProfileData {
  userId: string
  user: User | null
  reviews: Review[]
  listings: Listing[]
  error?: string
}

const ROLE_LABEL: Record<string, string> = {
  buyer: 'Bought from them',
  seller: 'Sold to them',
  renter: 'Rented from them',
  owner: 'Rented to them',
}

/** Only @ait.asia addresses can sign up (enforce_ait_email trigger), so this is the verification. */
const isAitVerified = (email?: string) => Boolean(email && /@ait\.asia$/i.test(email))

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { currentUserId } = useMarketplace()
  const [data, setData] = useState<ProfileData | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getProfile(userId),
      listReviewsFor(userId),
      searchListings({ sellerId: userId, status: 'available', limit: 60 }),
    ]).then(
      ([user, reviews, listings]) => {
        if (!cancelled) setData({ userId, user, reviews, listings })
      },
      (error: Error) => {
        if (!cancelled) setData({ userId, user: null, reviews: [], listings: [], error: error.message })
      },
    )
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!data || data.userId !== userId) {
    return (
      <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen">
        <p className="text-[13px] text-muted-foreground">Loading profile…</p>
      </div>
    )
  }

  if (!data.user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-[14px] font-medium">Profile not found</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {data.error ?? 'This member may have left PassItOn.'}
        </p>
        <Link href="/browse" className="mt-5 inline-block text-[12px] font-semibold text-primary hover:underline">
          Browse items
        </Link>
      </div>
    )
  }

  const { user, reviews, listings } = data
  const isMe = currentUserId === user.id
  const verified = isAitVerified(user.email)
  const subtitle = [user.program, user.batch].filter(Boolean).join(' · ')
  // Rate from the reviews shown below (all of them are loaded), the same way
  // submit_review recomputes users.rating / reviews_count, so the header can't
  // disagree with the list when the stored columns are stale (e.g. seeded).
  const reviewsCount = reviews.length
  const rating = reviewsCount
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviewsCount) * 100) / 100
    : 0

  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen">
      {/* Profile Header */}
      <div className="mb-16 flex flex-col md:flex-row gap-8 items-start md:items-end">
        <Avatar className="h-24 w-24 border border-border rounded-none">
          <AvatarFallback className="bg-surface-tinted text-2xl font-bold text-muted-foreground rounded-none">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">{user.name}</h1>
            {verified && (
              <span
                className="inline-flex items-center gap-1 rounded-sm border border-primary/20 bg-primary-muted px-2 py-1 text-[11px] font-semibold text-primary"
                title="Signed up with an @ait.asia email address"
                data-testid="verified-badge"
              >
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified AIT member
              </span>
            )}
            {user.kind === 'shop' && (
              <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                <Store className="h-3.5 w-3.5" />
                Campus partner shop
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-2 text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">{subtitle}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            {reviewsCount > 0 ? (
              <Rating value={rating} count={reviewsCount} />
            ) : (
              <span className="text-[12px] text-muted-foreground">No ratings yet</span>
            )}
            {user.joined && <span className="text-[12px] text-muted-foreground">Member since {user.joined}</span>}
            {user.pickupLocation && (
              <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                <MapPin className="h-3 w-3" /> Usual pickup: {user.pickupLocation}
              </span>
            )}
          </div>
        </div>
        {isMe && (
          <Link
            href="/onboarding"
            className="rounded-sm border border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider hover:bg-surface"
          >
            Edit profile
          </Link>
        )}
      </div>

      <div className="grid gap-16 lg:grid-cols-[1fr_320px]">
        {/* Active Listings */}
        <section>
          <div className="mb-8 border-b border-border pb-4">
            <h2 className="text-xl font-semibold tracking-tight">
              Active listings <span className="text-muted-foreground font-normal">({listings.length})</span>
            </h2>
          </div>
          {listings.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3" data-testid="profile-listings">
              {listings.map((listing) => (
                <ProductCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">No active listings at the moment.</p>
          )}
        </section>

        {/* Reviews */}
        <section>
          <div className="mb-8 border-b border-border pb-4">
            <h2 className="text-xl font-semibold tracking-tight">Reviews</h2>
          </div>
          {reviews.length > 0 ? (
            <div className="divide-y divide-border border-b border-border" data-testid="profile-reviews">
              {reviews.map((review) => (
                <div key={review.id} className="py-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-8 w-8 border border-border rounded-none">
                      <AvatarFallback className="bg-surface-tinted text-[10px] font-bold text-muted-foreground rounded-none">
                        {initials(review.authorName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold">{review.authorName}</p>
                      <Rating value={review.rating} size={12} />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {[ROLE_LABEL[review.role], review.date].filter(Boolean).join(' · ')}
                  </p>
                  {review.comment && (
                    <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">&ldquo;{review.comment}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">No reviews yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}
