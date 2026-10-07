'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="relative bg-primary text-primary-foreground">
      <p className="px-4 py-2 text-center text-[11px] font-medium tracking-wide">
        PassItOn — campus pickup only. Move-out listings surge in Nov–Dec.{' '}
        <a href="/sell" className="underline underline-offset-2 opacity-90 hover:opacity-100">
          List your items before you leave
        </a>
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss announcement"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
