import { redirect } from 'next/navigation'

// /search?q=desk&type=rent… is an alias of /browse: keep every query param so
// shared links land on the same results.
export default async function SearchRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, v)
  }
  const query = params.toString()
  redirect(query ? `/browse?${query}` : '/browse')
}
