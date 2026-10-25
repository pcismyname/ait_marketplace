'use client'

// Profile setup after sign-up (and "Edit profile" later). Saves the profile
// columns from docs/Database.md §2: name, program, batch, pickup_location
// (dorm / usual pickup point), role_intents, arrival_date, departure_date,
// and onboarded_at on finish. Arrival dates feed the pre-arrival needs form.

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PICKUP_LOCATIONS } from '@/lib/data'
import { updateMyProfile } from '@/lib/api'
import { ROLE_INTENTS, getMyOnboarding, type MyOnboarding, type RoleIntent } from '@/lib/api/onboarding'
import { useMarketplace } from '@/lib/store'
import { safeNext } from '@/components/auth-guard'
import { AuthNotice } from '@/components/auth-notice'
import { cn } from '@/lib/utils'
import { toDateInput } from '@/lib/seasons'

const inputClass =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10'
const labelClass = 'text-[12px] font-semibold uppercase tracking-wider text-muted-foreground'

function OnboardingForm({ initial, next }: { initial: MyOnboarding; next: string | null }) {
  const router = useRouter()
  const { refresh } = useMarketplace()
  const first = !initial.onboardedAt
  const p = initial.profile
  const [name, setName] = useState(p.name ?? '')
  const [program, setProgram] = useState(p.program ?? '')
  const [batch, setBatch] = useState(p.batch ?? '')
  const [pickup, setPickup] = useState(p.pickupLocation ?? '')
  const [intents, setIntents] = useState<RoleIntent[]>(initial.roleIntents)
  const [arrival, setArrival] = useState(p.arrivalDate ?? '')
  const [departure, setDeparture] = useState(p.departureDate ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleIntent = (id: RoleIntent) =>
    setIntents((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Add a display name so other students know who they are trading with.')
    if (!pickup) return setError('Choose where you usually hand items over.')
    if (intents.length === 0) return setError('Pick at least one thing you want to do on PassItOn.')
    if (arrival && departure && departure < arrival) return setError('Your departure date must be after your arrival date.')

    setSaving(true)
    try {
      await updateMyProfile({
        name: name.trim(),
        program: program.trim(),
        batch: batch.trim(),
        pickupLocation: pickup,
        roleIntents: intents,
        arrivalDate: arrival || null,
        departureDate: departure || null,
        // Only stamp onboarded_at on the first finish; later edits keep it.
        onboarded: first,
      })
      await refresh()
      toast.success(first ? 'Welcome to PassItOn' : 'Profile saved')
      const today = toDateInput(new Date())
      const incoming = arrival && arrival > today && (intents.includes('buy') || intents.includes('rent'))
      router.replace(safeNext(next) ?? (first && incoming ? '/needs' : first ? '/browse' : `/profile/${p.id}`))
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <div className="text-center mb-10">
        <p className="label-tag mb-2 text-primary">{first ? 'Welcome to PassItOn' : 'Your profile'}</p>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          {first ? 'Complete your profile' : 'Edit your profile'}
        </h1>
        <p className="mt-4 text-[14px] text-muted-foreground">
          A few details so other students know who they are trading with, and so we can match you with
          items before you arrive.
        </p>
      </div>

      <div className="mt-8 border border-border bg-card p-6 md:p-8">
        {error && <AuthNotice tone="error" className="mb-5" testId="onboarding-error">{error}</AuthNotice>}
        <form onSubmit={onSubmit} className="space-y-5" noValidate data-testid="onboarding-form">
          <div className="space-y-1.5">
            <label htmlFor="name" className={labelClass}>Display name</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex W." maxLength={80} className={inputClass} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="program" className={labelClass}>Program</label>
              <input id="program" type="text" value={program} onChange={(e) => setProgram(e.target.value)} placeholder="e.g. Data Science" maxLength={80} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="batch" className={labelClass}>Batch / intake</label>
              <input id="batch" type="text" value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="e.g. Aug 2026" maxLength={40} className={inputClass} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Dorm / usual pickup point</label>
            <Select value={pickup} onValueChange={(v) => setPickup(v as string)}>
              <SelectTrigger className="h-10 w-full rounded-md" aria-label="Dorm or pickup point">
                <SelectValue placeholder="Choose a campus location" />
              </SelectTrigger>
              <SelectContent>
                {PICKUP_LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Handover happens on campus. No shipping.</p>
          </div>

          <fieldset className="space-y-2">
            <legend className={cn(labelClass, 'mb-2')}>I want to</legend>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_INTENTS.map((r) => {
                const on = intents.includes(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    data-intent={r.id}
                    onClick={() => toggleIntent(r.id)}
                    className={cn(
                      'flex items-start gap-2 rounded-sm border px-3 py-2.5 text-left transition-colors',
                      on ? 'border-primary bg-primary-muted' : 'border-border hover:bg-surface',
                    )}
                  >
                    <span className={cn(
                      'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    )}>
                      {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                    <span>
                      <span className="block text-[12px] font-semibold">{r.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{r.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="arrival" className={labelClass}>Arrival</label>
              <input id="arrival" type="date" value={arrival} onChange={(e) => setArrival(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="departure" className={labelClass}>Departure</label>
              <input id="departure" type="date" value={departure} min={arrival || undefined} onChange={(e) => setDeparture(e.target.value)} className={inputClass} />
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            Optional. Arriving soon? We use it as the default needed-by date for pre-arrival needs. Leaving? It
            helps incoming students know when your items free up.
          </p>

          <Button type="submit" disabled={saving} className="w-full h-11 text-[13px] font-semibold mt-2">
            {saving ? 'Saving…' : first ? <>Finish setup <ArrowRight className="ml-2 h-4 w-4" /></> : 'Save profile'}
          </Button>
        </form>
      </div>
    </div>
  )
}

function OnboardingInner() {
  const searchParams = useSearchParams()
  const { currentUserId } = useMarketplace()
  const [data, setData] = useState<{ uid: string; me: MyOnboarding | null; error?: string } | null>(null)

  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    getMyOnboarding().then(
      (me) => !cancelled && setData({ uid: currentUserId, me }),
      (error: Error) => !cancelled && setData({ uid: currentUserId, me: null, error: error.message }),
    )
    return () => {
      cancelled = true
    }
  }, [currentUserId])

  if (!data || data.uid !== currentUserId) {
    return <p className="px-4 py-24 text-center text-[13px] text-muted-foreground">Loading your profile…</p>
  }
  if (!data.me) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <AuthNotice tone="error">{data.error ?? 'Your profile could not be found. Try logging in again.'}</AuthNotice>
      </div>
    )
  }
  return <OnboardingForm key={data.uid} initial={data.me} next={searchParams.get('next')} />
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  )
}
