import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the canonical site origin to use in auth redirect URLs.
 *
 * Priority:
 *  1. NEXT_PUBLIC_SITE_URL env var (set explicitly for the deployed environment)
 *  2. window.location.origin (correct in the browser for the current host)
 *
 * Using NEXT_PUBLIC_SITE_URL ensures that even if Supabase sends a confirmation
 * email from a server context, the redirect always points to the production URL
 * rather than localhost, regardless of where the signup request originated.
 */
export function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  )
}
