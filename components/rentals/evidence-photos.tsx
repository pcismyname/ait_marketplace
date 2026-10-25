'use client'

import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { getEvidenceUrls } from '@/lib/api'

/** Private handover / return photos, shown with short-lived signed URLs. */
export function EvidencePhotos({ label, paths }: { label: string; paths: string[] }) {
  const [open, setOpen] = useState(false)
  const [urls, setUrls] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = paths.join('|')

  useEffect(() => {
    if (!open || paths.length === 0) return
    let cancelled = false
    getEvidenceUrls(paths).then(
      (result) => !cancelled && setUrls(result),
      (e: Error) => !cancelled && setError(e.message),
    )
    return () => {
      cancelled = true
    }
    // `key` stands in for the paths array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key])

  if (paths.length === 0) return null

  return (
    <div className="text-[11px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-medium text-primary hover:underline underline-offset-2"
      >
        {open ? 'Hide' : 'Show'} {label.toLowerCase()} ({paths.length})
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-2">
          {error && <p className="text-destructive">{error}</p>}
          {!error && !urls && <p className="text-muted-foreground">Loading…</p>}
          {urls &&
            paths.map((path) => {
              const url = urls[path]
              if (!url) return null
              const isPdf = path.toLowerCase().endsWith('.pdf')
              return (
                <a
                  key={path}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-16 w-16 overflow-hidden rounded-md bg-surface-tinted ring-1 ring-border"
                >
                  {isPdf ? (
                    <span className="flex h-full items-center justify-center text-muted-foreground">
                      <FileText className="h-5 w-5" />
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={label} className="h-full w-full object-cover" />
                  )}
                </a>
              )
            })}
        </div>
      )}
    </div>
  )
}
