'use client'

import { useMarketplace } from '@/lib/store'
import { getUser, getSellerReviews } from '@/lib/data'
import { ProductCard } from '@/components/listing-card'
import { Rating } from '@/components/rating'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/format'

export default function ProfilePage({ params }: { params: { userId: string } }) {
  const { listings } = useMarketplace()
  const user = getUser(params.userId)
  const reviews = getSellerReviews(params.userId)
  
  const userListings = listings.filter(l => l.sellerId === params.userId && l.status === 'available')
  
  // 4.9 average, 12 reviews
  const avgRating = reviews.length > 0 
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length 
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
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">{user.name}</h1>
          <p className="mt-2 text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
            {user.program} &middot; {user.batch}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Rating value={avgRating} />
            <span className="text-[12px] font-semibold text-foreground">
              {avgRating.toFixed(1)} <span className="font-normal text-muted-foreground">({reviews.length} reviews)</span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-16 lg:grid-cols-[1fr_320px]">
        {/* Active Listings */}
        <section>
          <div className="mb-8 border-b border-border pb-4">
            <h2 className="text-xl font-semibold tracking-tight">Active Listings</h2>
          </div>
          {userListings.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
              {userListings.map(listing => (
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
            <div className="divide-y divide-border border-b border-border">
              {reviews.map(review => {
                const reviewer = getUser(review.reviewerId)
                return (
                  <div key={review.id} className="py-6">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-8 w-8 border border-border rounded-none">
                        <AvatarFallback className="bg-surface-tinted text-[10px] font-bold text-muted-foreground rounded-none">
                          {initials(reviewer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-[13px] font-semibold">{reviewer.name}</p>
                        <Rating value={review.rating} />
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-[13px] text-muted-foreground leading-relaxed">"{review.comment}"</p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">No reviews yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}
