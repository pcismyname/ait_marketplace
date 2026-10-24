'use client'

import { useEffect, useState } from 'react'
import { FileText, ImageOff } from 'lucide-react'
import { getEvidenceUrls } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * Private dispute-evidence files (photos or PDFs), shown with short-lived
 * signed URLs. Only the parties of the deal and admins can read them.
 */
export function EvidenceGallery({
  paths,
  title,
  empty = 'No photos.',
  className,
}: {
  paths: string[]
  title?: string
  empty?: string
  className?: string
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const key = paths.join('|')

  useEffect(() => {
    let cancelled = false
    const list = key ? key.split('|') : []
    if (list.length === 0) return
    getEvidenceUrls(list).then(
      (result) => {
        if (!cancelled) setUrls(result)
      },
      (e: Error) => {
        if (!cancelled) setError(e.message)
      },
    )
    return () => {
      cancelled = true
    }
  }, [key])

  return (
    <div className={className}>
      {title && <p className="label-tag mb-2">{title}</p>}
      {paths.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">{empty}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {paths.map((path) => {
            const url = urls[path]
            const isPdf = path.toLowerCase().endsWith('.pdf')
            return (
              <a
                key={path}
                href={url}
                target="_blank"
                rel="noreferrer"
                data-testid="evidence-item"
                className={cn(
                  'group relative flex aspect-square items-center justify-center overflow-hidden rounded-md border border-border bg-surface',
                  !url && 'pointer-events-none',
                )}
              >
                {url && !isPdf ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URLs from private storage
                  <img src={url} alt="Evidence" className="h-full w-full object-cover transition-opacity group-hover:opacity-90" />
                ) : isPdf ? (
                  <span className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
                    <FileText className="h-5 w-5" /> PDF
                  </span>
                ) : (
                  <ImageOff className="h-5 w-5 text-muted-foreground" />
                )}
              </a>
            )
          })}
        </div>
      )}
      {error && <p className="mt-2 text-[11px] text-destructive">Could not load the photos: {error}</p>}
    </div>
  )
}
