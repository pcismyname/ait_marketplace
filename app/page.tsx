'use client'

import { useMarketplace } from '@/lib/store'
import { HomeHero } from '@/components/home-hero'
import { SeasonalBanner } from '@/components/seasonal-banner'
import { CategoryGrid } from '@/components/category-grid'
import { ListingCard } from '@/components/listing-card'
import { SectionHeader } from '@/components/section-header'
import { WhySection } from '@/components/why-section'

export default function HomePage() {
  const { listings } = useMarketplace()

  const featured = listings.filter((l) => l.featured).slice(0, 4)
  const recent = [...listings]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 8)

  return (
    <div>
      <HomeHero listingCount={listings.length} />

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        <SeasonalBanner />

        <section>
          <SectionHeader
            title="Browse by category"
            subtitle="Find exactly what your room is missing."
          />
          <CategoryGrid />
        </section>

        {featured.length > 0 && (
          <section>
            <SectionHeader
              title="Featured this week"
              subtitle="Premium placements and items moving fast around campus."
              href="/browse"
            />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {featured.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </section>
        )}

        <WhySection />

        <section>
          <SectionHeader
            title="Freshly listed"
            subtitle="The latest items posted by students and campus shops."
            href="/browse"
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {recent.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
