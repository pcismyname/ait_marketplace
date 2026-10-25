'use client'

import { useEffect, useId, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Camera, FileText, X } from 'lucide-react'
import { uploadEvidence, validateFile } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const MAX_PHOTOS = 6

/**
 * Condition photos for a handover or a return (BusinessRules §4, §9). Files go
 * to the private dispute-evidence bucket (rental/<id>/<uid>/…) and their paths
 * are passed to the RPC, so an admin can compare before and after.
 */
export function PhotoActionDialog({
  rentalId,
  trigger,
  title,
  description,
  confirmLabel,
  requirePhotos,
  children,
  onConfirm,
}: {
  rentalId: string
  trigger: ReactElement
  title: string
  description: string
  confirmLabel: string
  /** At least one photo is needed before confirming. */
  requirePhotos: boolean
  /** Extra content above the photo picker (amounts, warnings). */
  children?: ReactNode
  /** Runs the RPC with the uploaded paths. Throw (ApiError) to keep the dialog open. */
  onConfirm: (paths: string[]) => Promise<void>
}) {
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null })),
    [files],
  )
  useEffect(() => () => previews.forEach((p) => p.url && URL.revokeObjectURL(p.url)), [previews])

  const onOpenChange = (next: boolean) => {
    if (busy) return
    setOpen(next)
    if (!next) setFiles([])
  }

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const accepted: File[] = []
    for (const file of Array.from(list)) {
      const problem = validateFile(file, 'evidence')
      if (problem) toast.error(`Can't use ${file.name}`, { description: problem })
      else accepted.push(file)
    }
    setFiles((prev) => [...prev, ...accepted].slice(0, MAX_PHOTOS))
  }

  const confirm = async () => {
    if (requirePhotos && files.length === 0) {
      toast.error('Add at least one photo', { description: 'Photos of the condition protect both of you if there is a dispute.' })
      return
    }
    setBusy(true)
    try {
      const paths: string[] = []
      for (const file of files) paths.push(await uploadEvidence({ kind: 'rental', id: rentalId }, file))
      await onConfirm(paths)
      setOpen(false)
      setFiles([])
    } catch (error) {
      toast.error('Could not update the rental', {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {children}

        <div className="space-y-2">
          <p className="label-tag">
            Condition photos {requirePhotos ? '(required)' : '(optional)'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {previews.map(({ file, url }, i) => (
              <div key={`${file.name}-${i}`} className="relative aspect-square overflow-hidden rounded-md bg-surface-tinted">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={file.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 p-1 text-center text-[10px] text-muted-foreground">
                    <FileText className="h-5 w-5" />
                    <span className="line-clamp-2 break-all">{file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/85 text-foreground"
                  aria-label={`Remove ${file.name}`}
                  disabled={busy}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {files.length < MAX_PHOTOS && (
              <label
                htmlFor={inputId}
                className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Camera className="h-5 w-5" />
                Add photo
              </label>
            )}
          </div>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            multiple
            className="sr-only"
            data-testid="photo-input"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <p className="text-[11px] text-muted-foreground">
            JPG, PNG, WebP, HEIC or PDF, up to 10 MB each. Only the two of you and the platform&apos;s admins can see them.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={busy}>
            {busy ? 'Saving…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
