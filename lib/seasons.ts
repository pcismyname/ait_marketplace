export type SeasonKind = 'move-out' | 'new-arrival'

export interface SeasonEvent {
  kind: SeasonKind
  label: string
  /** month index 0-11 that the surge centers on */
  month: number
  day: number
  /** false when the date is our estimate, not taken from an AIT source */
  verified: boolean
}

// AIT runs two intakes a year: the academic year "consists of two semesters:
// January and August" (AIT admissions). New-arrival surges centre on the
// institute-wide orientation; move-out surges precede each semester break.
//
// Sources (accessed 2026-10-25; ait.ac.th blocks automated fetches, so the
// pages were read through web-search results):
// - Two semesters, January and August:
//   https://ait.ac.th/admissions/ and https://ait.ac.th/admissions/frequently-asked-questions/
// - January intake: orientation for new students held on 6 January 2026,
//   "New Academic Term begins at AIT with Hybrid Orientation":
//   https://ait.ac.th/2026/01/new-academic-term-begins-at-ait-with-hybrid-orientation/
// - August intake: institute-wide orientation on 4 August 2026 (school-level
//   orientations 5–11 August), "Guidelines for Applicants who were Offered
//   Admission": https://ait.ac.th/guidelines-for-applicants-who-were-offered-admission/
//   confirmed by "AIT Welcomes Diverse August 2026 Orientation Cohort":
//   https://ait.ac.th/2026/08/ait-welcomes-diverse-august-2026-orientation-cohort-from-31-countries/
//   (re-checked 2026-10-25 with a web search limited to ait.ac.th: both pages
//   are indexed and their snippets give 4 Aug 2026 and 517 students from 31
//   countries. Like the January source, this rests on search snippets because
//   ait.ac.th answers scripted requests with 403; open the pages in a browser
//   when updating these dates.)
// - The official calendar (https://ait.ac.th/academics/calendar/) is behind a
//   bot check and could not be read, so the semester END dates are not
//   verified: the May and December move-out dates below are estimates (the
//   January semester ends in May, the August semester in December; an AIT
//   exchange-partner page describes the terms as "January to June/July" and
//   "August to December": https://uol.de/en/going-abroad/outside-of-europe/asia/asian-institute-of-technology).
//   Check them against the AIT academic calendar each year.
// Previous values: January intake 10 Jan, August intake 10 Aug (both moved to
// the orientation dates above).
const SEASONS: SeasonEvent[] = [
  { kind: 'new-arrival', label: 'January intake', month: 0, day: 6, verified: true },
  { kind: 'move-out', label: 'May move-out', month: 4, day: 15, verified: false },
  { kind: 'new-arrival', label: 'August intake', month: 7, day: 4, verified: true },
  { kind: 'move-out', label: 'December move-out', month: 11, day: 10, verified: false },
]

/** Days either side of a season date that count as the surge. */
export const SURGE_WINDOW_DAYS = 18

export interface SeasonStatus {
  event: SeasonEvent
  date: Date
  daysUntil: number
  /** true when we are within the surge window (±SURGE_WINDOW_DAYS) */
  active: boolean
}

function candidates(now: Date) {
  const list: { event: SeasonEvent; date: Date; diff: number }[] = []
  for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
    for (const event of SEASONS) {
      const date = new Date(year, event.month, event.day)
      const diff = Math.round((date.getTime() - now.getTime()) / 86_400_000)
      list.push({ event, date, diff })
    }
  }
  return list
}

export function getSeasonStatus(now: Date = new Date()): SeasonStatus {
  const all = candidates(now)

  // Prefer an in-window season, otherwise the nearest upcoming one.
  const inWindow = all
    .filter((c) => Math.abs(c.diff) <= SURGE_WINDOW_DAYS)
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))[0]

  const upcoming = all
    .filter((c) => c.diff >= 0)
    .sort((a, b) => a.diff - b.diff)[0]

  const chosen = inWindow ?? upcoming

  return {
    event: chosen.event,
    date: chosen.date,
    daysUntil: chosen.diff,
    active: Math.abs(chosen.diff) <= SURGE_WINDOW_DAYS,
  }
}

/** The next intake (orientation) on or after `now`: a sensible default "needed by" date. */
export function nextIntake(now: Date = new Date()): { event: SeasonEvent; date: Date } {
  const next = candidates(now)
    .filter((c) => c.event.kind === 'new-arrival' && c.diff >= 0)
    .sort((a, b) => a.diff - b.diff)[0]
  return { event: next.event, date: next.date }
}

/** Local date as YYYY-MM-DD (for <input type="date">). */
export function toDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
