// Supabase Storage.
//
//   listing-photos (public)    <uid>/<random>.<ext>
//       anyone reads; you upload / replace / delete only in your own folder.
//   dispute-evidence (private) rental/<rentalId>/<uid>/<random>.<ext>
//                              sale/<transactionId>/<uid>/<random>.<ext>
//       handover / return condition photos and dispute evidence. The parties
//       of that rental or purchase and admins can read; each party uploads
//       into their own sub-folder. Read with signed URLs.

import { ApiError, db, requireUserId } from './client'

export const LISTING_PHOTOS_BUCKET = 'listing-photos'
export const EVIDENCE_BUCKET = 'dispute-evidence'

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
export const EVIDENCE_TYPES = [...IMAGE_TYPES.filter((t) => t !== 'image/gif'), 'application/pdf']
export const LISTING_PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024

/** Error message for an unusable file, or null when it's fine. */
export function validateFile(file: File, kind: 'listing' | 'evidence'): string | null {
  const types = kind === 'listing' ? IMAGE_TYPES : EVIDENCE_TYPES
  const max = kind === 'listing' ? LISTING_PHOTO_MAX_BYTES : EVIDENCE_MAX_BYTES
  if (!types.includes(file.type)) {
    return kind === 'listing' ? 'Use a JPG, PNG, WebP, GIF or HEIC photo.' : 'Use a photo (JPG, PNG, WebP, HEIC) or a PDF.'
  }
  if (file.size > max) return `The file is larger than ${max / 1024 / 1024} MB.`
  return null
}

const extension = (file: File) => {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : undefined
  return (fromName ?? file.type.split('/')[1] ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Upload a listing photo; returns its storage path and public URL (store the URL in listings.images). */
export async function uploadListingPhoto(file: File): Promise<{ path: string; publicUrl: string }> {
  const problem = validateFile(file, 'listing')
  if (problem) throw new ApiError(problem)
  const uid = await requireUserId()
  const path = `${uid}/${crypto.randomUUID()}.${extension(file)}`
  const storage = db().storage.from(LISTING_PHOTOS_BUCKET)
  const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new ApiError(error.message)
  return { path, publicUrl: storage.getPublicUrl(path).data.publicUrl }
}

/** Delete one of your listing photos by its public URL or path. */
export async function deleteListingPhoto(urlOrPath: string): Promise<void> {
  const marker = `/${LISTING_PHOTOS_BUCKET}/`
  const path = urlOrPath.includes(marker) ? urlOrPath.split(marker)[1] : urlOrPath
  const { error } = await db().storage.from(LISTING_PHOTOS_BUCKET).remove([path])
  if (error) throw new ApiError(error.message)
}

/**
 * Upload a condition photo or dispute evidence for a rental or a protected
 * purchase. Returns the storage path to pass to confirmHandover /
 * markReturned / confirmReturn / confirmSaleHandover / fileDispute.
 */
export async function uploadEvidence(
  target: { kind: 'rental' | 'sale'; id: string },
  file: File,
): Promise<string> {
  const problem = validateFile(file, 'evidence')
  if (problem) throw new ApiError(problem)
  const uid = await requireUserId()
  const path = `${target.kind}/${target.id}/${uid}/${crypto.randomUUID()}.${extension(file)}`
  const { error } = await db().storage.from(EVIDENCE_BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw new ApiError(error.message)
  return path
}

/** Short-lived URLs to show private evidence (parties and admins only). */
export async function getEvidenceUrls(paths: string[], expiresInSeconds = 3600): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await db().storage.from(EVIDENCE_BUCKET).createSignedUrls(paths, expiresInSeconds)
  if (error) throw new ApiError(error.message)
  const urls: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
  }
  return urls
}
