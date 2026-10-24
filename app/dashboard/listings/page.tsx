import { redirect } from 'next/navigation'

// The owner dashboard lives at /my-listings (linked from the dashboard nav);
// keep /dashboard/listings working, including ?tab=.
export default async function DashboardListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { tab } = await searchParams
  redirect(typeof tab === 'string' ? `/my-listings?tab=${encodeURIComponent(tab)}` : '/my-listings')
}
