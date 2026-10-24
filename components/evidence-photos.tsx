'use client'

// Condition photos for rentals and protected sales (private
// `dispute-evidence` bucket, docs/Database.md §7):
//   <EvidenceGallery paths={…} />   shows stored photos through signed URLs
//   <PhotoPicker photos onChange /> picks new photos (previewed locally)
//   uploadPhotos(target, photos)    uploads them and returns the storage paths
//                                   to pass to confirmHandover / markReturned /
//                                   confirmReturn / confirmSaleHandover.

import { useEffect, useId, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { getEvidenceUrls, uploadEvidence, validateFile } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface PickedPhoto {
  file: File
  /** Local object URL for the preview. */
  url: string
}

export async function uploadPhotos(
  target: { kind: 'rental' | 'sale'; id: string },
  photos: PickedPhoto[],
): Promise<string[]> {
  const paths: string[] = []
  for (const photo of photos) paths.push(await uploadEvidence(target, photo.file))
  return paths
}

export function EvidenceGallery({
  paths,
  emptyLabel = 'No photos were added.',
  className,
}: {
  paths: string[]
  emptyLabel?: string
  className?: string
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState(false)
  const key = paths.join('|')

  useEffect(() => {
    if (!key) return
    let cancelled = false
    getEvidenceUrls(key.split('|')).then(
      (result) => {
        if (!cancelled) setUrls(result)
      },
      () => {
        if (!cancelled) setFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [key])

  if (paths.length === 0) {
    return <p className={cn('text-[12px] text-muted-foreground', className)}>{emptyLabel}</p>
  }
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {paths.map((path) => (
        <a
          key={path}
          href={urls[path]}
          target="_blank"
          rel="noreferrer"
          className="relative block aspect-square overflow-hidden border border-border bg-surface-tinted"
        >
          {urls[path] ? (
            // Signed URLs from the private bucket: a plain img avoids image-optimizer host config.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[path]} alt="Condition photo" className="h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
              {failed ? 'Unavailable' : 'Loading…'}
            </span>
          )}
        </a>
      ))}
    </div>
  )
}

export function PhotoPicker({
  photos,
  onChange,
  max = 6,
  label = 'Add photos',
  disabled,
}: {
  photos: PickedPhoto[]
  onChange: (photos: PickedPhoto[]) => void
  max?: number
  label?: string
  disabled?: boolean
}) {
  const inputId = useId()

  const add = (files: FileList | null) => {
    if (!files) return
    const next = [...photos]
    for (const file of Array.from(files)) {
      if (next.length >= max) {
        toast.error(`Up to ${max} photos.`)
        break
      }
      const problem = validateFile(file, 'evidence')
      if (problem) {
        toast.error(file.name, { description: problem })
        continue
      }
      next.push({ file, url: URL.createObjectURL(file) })
    }
    onChange(next)
  }

  const remove = (index: number) => {
    URL.revokeObjectURL(photos[index].url)
    onChange(photos.filter((_, i) => i !== index))
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo, index) => (
        <div key={photo.url} className="relative aspect-square overflow-hidden border border-border bg-surface-tinted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={`New photo ${index + 1}`} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => remove(index)}
            disabled={disabled}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm"
            aria-label={`Remove photo ${index + 1}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {photos.length < max && (
        <label
          htmlFor={inputId}
          className={cn(
            'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-border bg-surface text-[11px] text-muted-foreground transition-colors hover:bg-muted',
            disabled && 'pointer-events-none opacity-50',
          )}
        >
          <ImagePlus className="h-5 w-5" />
          {label}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              add(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}
