import { redirect } from 'next/navigation'

export default function SearchRedirectPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  // Redirect to the browse page with the search query
  if (searchParams.q) {
    redirect(`/browse?q=${encodeURIComponent(searchParams.q)}`)
  }
  redirect('/browse')
}
