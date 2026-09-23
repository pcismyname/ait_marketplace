export type SeasonKind = 'move-out' | 'new-arrival'

export interface SeasonEvent {
  kind: SeasonKind
  label: string
  /** month index 0-11 that the surge centers on */
  month: number
  day: number
}

// AIT runs two intakes a year. Move-out surges precede each semester break;
// new-arrival surges follow each intake.
const SEASONS: SeasonEvent[] = [
  { kind: 'new-arrival', label: 'January intake', month: 0, day: 10 },
  { kind: 'move-out', label: 'May move-out', month: 4, day: 15 },
  { kind: 'new-arrival', label: 'August intake', month: 7, day: 10 },
  { kind: 'move-out', label: 'December move-out', month: 11, day: 10 },
]

export interface SeasonStatus {
  event: SeasonEvent
  date: Date
  daysUntil: number
  /** true when we are within the surge window (±18 days) */
  active: boolean
}

export function getSeasonStatus(now: Date = new Date()): SeasonStatus {
  const candidates: { event: SeasonEvent; date: Date; diff: number }[] = []

  for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
    for (const event of SEASONS) {
      const date = new Date(year, event.month, event.day)
      const diff = Math.round((date.getTime() - now.getTime()) / 86_400_000)
      candidates.push({ event, date, diff })
    }
  }

  // Prefer an in-window season, otherwise the nearest upcoming one.
  const inWindow = candidates
    .filter((c) => Math.abs(c.diff) <= 18)
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))[0]

  const upcoming = candidates
    .filter((c) => c.diff >= 0)
    .sort((a, b) => a.diff - b.diff)[0]

  const chosen = inWindow ?? upcoming

  return {
    event: chosen.event,
    date: chosen.date,
    daysUntil: chosen.diff,
    active: Math.abs(chosen.diff) <= 18,
  }
}
