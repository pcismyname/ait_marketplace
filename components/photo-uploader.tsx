'use client'

// Listing photos: upload straight to the public listing-photos bucket
// (lib/api uploadListingPhoto, docs/Database.md §7), preview, remove and
// reorder. The first photo is the cover. Listings store the public URLs;
// seed photos under /images keep working because they are plain URLs too.

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, RotateCcw, Star, X } from 'lucide-react'
import { LISTING_PHOTOS_BUCKET, LISTING_PHOTO_MAX_BYTES, deleteListingPhoto, uploadListingPhoto } from '@/lib/api'
import { cn } from '@/lib/utils'

export const MAX_LISTING_PHOTOS = 5
/** What the forms accept (a subset of the bucket's types that every browser can preview). */
export const LISTING_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = LISTING_PHOTO_MAX_BYTES / 1024 / 1024

export interface PhotoItem {
  key: string
  /** Public URL once uploaded (or an existing /images/... URL); a blob: preview while uploading. */
  url: string
  state: 'uploading' | 'ready' | 'error'
  error?: string
  /** Uploaded in this session (not saved on the listing yet). */
  fresh: boolean
  file?: File
}

/** Error message for a file the form won't upload, or null. */
export function validateListingPhoto(file: File): string | null {
  if (!LISTING_PHOTO_TYPES.includes(file.type)) return `“${file.name}” isn't a JPG, PNG or WebP photo.`
  if (file.size > LISTING_PHOTO_MAX_BYTES) return `“${file.name}” is larger than ${MAX_MB} MB.`
  return null
}

/**
 * The declared MIME type can lie (a text file named fake.png is "image/png"),
 * so decode the file before uploading it. Resolves true when the browser can
 * read it as an image.
 */
export async function canDecodeImage(file: File): Promise<boolean> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      const ok = bitmap.width > 0 && bitmap.height > 0
      bitmap.close()
      return ok
    } catch {
      return false
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img.naturalWidth > 0) }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false) }
    img.src = url
  })
}

/** True for photos stored in our listing-photos bucket (as opposed to seed images). */
export function isStoredListingPhoto(url: string): boolean {
  return url.includes(`/storage/v1/object/public/${LISTING_PHOTOS_BUCKET}/`)
}

/** Best effort: remove stored photos that are no longer on the listing. */
export function deleteStoredPhotos(urls: string[]) {
  for (const url of urls.filter(isStoredListingPhoto)) {
    deleteListingPhoto(url).catch((error) => console.warn('Could not delete a listing photo:', error.message))
  }
}

const realImage = (url: string) => url !== '/placeholder.svg'

export function usePhotoUploads() {
  const [items, setItems] = useState<PhotoItem[]>([])
  const removedKeys = useRef(new Set<string>())
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const reset = useCallback((urls: string[]) => {
    setItems(urls.filter(realImage).map((url) => ({ key: url, url, state: 'ready', fresh: false })))
  }, [])

  const upload = useCallback((item: PhotoItem) => {
    if (!item.file) return
    const file = item.file
    uploadListingPhoto(file).then(
      ({ publicUrl }) => {
        const now = itemsRef.current.find((p) => p.key === item.key)
        // Removed meanwhile, or the preview turned out unreadable (markBroken).
        if (removedKeys.current.has(item.key) || (now?.state === 'error' && !now.file)) {
          deleteStoredPhotos([publicUrl])
          return
        }
        URL.revokeObjectURL(item.url)
        setItems((prev) => prev.map((p) => (p.key === item.key
          ? { ...p, url: publicUrl, state: 'ready', error: undefined, file: undefined }
          : p)))
      },
      (error: Error) => {
        setItems((prev) => prev.map((p) => (p.key === item.key ? { ...p, state: 'error', error: error.message } : p)))
      },
    )
  }, [])

  const [checking, setChecking] = useState(0)

  const add = useCallback(async (files: FileList | File[] | null) => {
    if (!files) return
    const list = Array.from(files)
    const problems: string[] = []
    const typed = list.filter((file) => {
      const problem = validateListingPhoto(file)
      if (problem) problems.push(problem)
      return !problem
    })
    setChecking((n) => n + 1)
    let decoded: boolean[]
    try {
      decoded = await Promise.all(typed.map(canDecodeImage))
    } finally {
      setChecking((n) => n - 1)
    }
    const room = MAX_LISTING_PHOTOS - itemsRef.current.length
    const accepted: PhotoItem[] = []
    for (const [i, file] of typed.entries()) {
      if (!decoded[i]) { problems.push(`“${file.name}” isn't a readable photo.`); continue }
      if (accepted.length >= room) {
        problems.push(`You can add up to ${MAX_LISTING_PHOTOS} photos.`)
        break
      }
      accepted.push({ key: crypto.randomUUID(), url: URL.createObjectURL(file), state: 'uploading', fresh: true, file })
    }
    if (problems.length > 0) toast.error('Some photos were not added', { description: problems.join(' ') })
    if (accepted.length === 0) return
    itemsRef.current = [...itemsRef.current, ...accepted]
    setItems((prev) => [...prev, ...accepted])
    accepted.forEach(upload)
  }, [upload])

  /** A fresh photo that the browser can't display after all: don't let it be saved. */
  const markBroken = useCallback((key: string) => {
    const item = itemsRef.current.find((p) => p.key === key)
    if (!item?.fresh || (item.state === 'error' && !item.file)) return
    if (item.state === 'ready') deleteStoredPhotos([item.url])
    itemsRef.current = itemsRef.current.map((p) => (p.key === key ? { ...p, state: 'error', file: undefined } : p))
    setItems((prev) => prev.map((p) => (p.key === key && p.fresh && p.state !== 'error'
      ? { ...p, state: 'error', error: "This photo can't be displayed. Remove it and pick another.", file: undefined }
      : p)))
  }, [])

  const retry = useCallback((key: string) => {
    const item = itemsRef.current.find((p) => p.key === key)
    if (!item?.file) return
    const next = { ...item, state: 'uploading' as const, error: undefined }
    setItems((prev) => prev.map((p) => (p.key === key ? next : p)))
    upload(next)
  }, [upload])

  const remove = useCallback((key: string) => {
    const item = itemsRef.current.find((p) => p.key === key)
    if (!item) return
    removedKeys.current.add(key)
    // Fresh uploads aren't on the listing yet: drop them from storage now.
    // Saved photos are deleted only after the listing is saved without them.
    if (item.fresh && item.state === 'ready') deleteStoredPhotos([item.url])
    if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url)
    setItems((prev) => prev.filter((p) => p.key !== key))
  }, [])

  const move = useCallback((key: string, to: number) => {
    setItems((prev) => {
      const from = prev.findIndex((p) => p.key === key)
      if (from === -1 || to < 0 || to >= prev.length || from === to) return prev
      const next = prev.slice()
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }, [])

  /** Delete this session's uploads (the form was abandoned). */
  const discardFresh = useCallback(() => {
    deleteStoredPhotos(itemsRef.current.filter((p) => p.fresh && p.state === 'ready').map((p) => p.url))
  }, [])

  const busy = checking > 0 || items.some((p) => p.state === 'uploading')
  const failed = items.some((p) => p.state === 'error')
  const urls = items.filter((p) => p.state === 'ready').map((p) => p.url)

  return { items, reset, add, retry, remove, move, markBroken, discardFresh, busy, failed, urls }
}

export type PhotoUploads = ReturnType<typeof usePhotoUploads>

export function PhotoUploader({
  photos,
  tileClassName = 'h-24 w-24',
  inputId = 'listing-photos',
}: {
  photos: PhotoUploads
  tileClassName?: string
  inputId?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const { items } = photos

  return (
    <div className="space-y-2">
      <div
        className={cn('flex flex-wrap gap-2.5 rounded-sm transition-colors', dropActive && 'bg-primary-muted/40')}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropActive(true) }
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          setDropActive(false)
          if (e.dataTransfer.files.length > 0) { e.preventDefault(); void photos.add(Array.from(e.dataTransfer.files)) }
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.key}
            draggable={item.state === 'ready'}
            onDragStart={() => setDragKey(item.key)}
            onDragEnd={() => setDragKey(null)}
            onDragOver={(e) => { if (dragKey) e.preventDefault() }}
            onDrop={(e) => {
              if (!dragKey) return
              e.preventDefault()
              e.stopPropagation()
              photos.move(dragKey, index)
              setDragKey(null)
            }}
            data-testid="photo-tile"
            className={cn(
              'group/photo relative overflow-hidden border bg-surface-tinted',
              tileClassName,
              index === 0 ? 'border-primary' : 'border-border',
              dragKey === item.key && 'opacity-50',
              item.state === 'ready' && 'cursor-grab',
            )}
          >
            <Image
              src={item.url}
              alt={index === 0 ? 'Cover photo' : `Photo ${index + 1}`}
              fill
              sizes="96px"
              className={cn('object-cover', item.state !== 'ready' && 'opacity-50')}
              onError={() => photos.markBroken(item.key)}
            />
            {index === 0 && (
              <span className="absolute left-1 top-1 rounded-sm bg-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary-foreground">
                Cover
              </span>
            )}
            <button
              type="button"
              onClick={() => photos.remove(item.key)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
              aria-label={`Remove photo ${index + 1}`}
            >
              <X className="h-3 w-3" />
            </button>

            {item.state === 'uploading' && (
              <div className="absolute inset-0 flex items-center justify-center" aria-label="Uploading">
                <Loader2 className="h-5 w-5 animate-spin text-foreground/70" />
              </div>
            )}
            {item.state === 'error' && !item.file && (
              <span
                role="alert"
                title={item.error}
                className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-destructive/90 py-1 text-[10px] font-semibold text-white"
              >
                Can&apos;t display
              </span>
            )}
            {item.state === 'error' && item.file && (
              <button
                type="button"
                onClick={() => photos.retry(item.key)}
                title={item.error}
                className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-destructive/90 py-1 text-[10px] font-semibold text-white"
              >
                <RotateCcw className="h-3 w-3" /> Retry
              </button>
            )}

            {item.state === 'ready' && items.length > 1 && (
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-background/85 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/photo:opacity-100 sm:focus-within:opacity-100">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => photos.move(item.key, index - 1)}
                  className="flex h-6 w-6 items-center justify-center text-foreground disabled:opacity-30"
                  aria-label={`Move photo ${index + 1} left`}
                >
                  <ArrowLeft className="h-3 w-3" />
                </button>
                {index !== 0 && (
                  <button
                    type="button"
                    onClick={() => photos.move(item.key, 0)}
                    className="flex h-6 w-6 items-center justify-center text-foreground"
                    aria-label={`Make photo ${index + 1} the cover`}
                    title="Make cover"
                  >
                    <Star className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={index === items.length - 1}
                  onClick={() => photos.move(item.key, index + 1)}
                  className="flex h-6 w-6 items-center justify-center text-foreground disabled:opacity-30"
                  aria-label={`Move photo ${index + 1} right`}
                >
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        ))}

        {items.length < MAX_LISTING_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-1 border border-dashed border-border text-muted-foreground transition hover:border-primary/40 hover:bg-surface-tinted hover:text-foreground',
              tileClassName,
            )}
          >
            <ImagePlus className="h-4 w-4" />
            <span className="text-[11px]">Add photo</span>
          </button>
        )}
      </div>
      <input
        id={inputId}
        ref={fileRef}
        type="file"
        accept={LISTING_PHOTO_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={(e) => { void photos.add(e.target.files ? Array.from(e.target.files) : null); e.target.value = '' }}
      />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        JPG, PNG or WebP, up to {MAX_MB} MB each. The first photo is the cover; drag or use the arrows to reorder.
        {photos.failed && <span className="text-destructive"> A photo failed to upload: retry or remove it.</span>}
      </p>
    </div>
  )
}
