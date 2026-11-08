// Local-time helpers shared by the LLM prompt and transfer history. The model
// has no clock of its own, so every window is anchored to the user's local
// calendar days — never a rolling N*24h span.

import type { HistoryPeriod } from "./types"

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** Unix seconds → "YYYY-MM-DD HH:mm" in the user's local timezone. */
export function formatLocalDateTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

/** Unix seconds → "YYYY-MM-DD" in the user's local timezone. */
export function formatLocalDate(unixSeconds: number): string {
  return formatLocalDateTime(unixSeconds).slice(0, 10)
}

function timezoneLabel(): string {
  const mins = -new Date().getTimezoneOffset()
  const sign = mins >= 0 ? "+" : "-"
  const abs = Math.abs(mins)
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return `${zone} (UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)})`
}

/** Start of the local calendar day `offset` days from today, in unix seconds. */
function dayStart(offset = 0): number {
  const now = new Date()
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset).getTime() / 1000)
}

/** Unix seconds for the first instant of the local calendar day `days - 1` ago. days = 1 → start of today. */
export function localDayCutoff(days: number): number {
  return dayStart(-(Math.max(1, Math.floor(days)) - 1))
}

/** True for a valid "YYYY-MM-DD" date (rejects 2026-02-30 and similar). */
export function isLocalDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d
}

/** "YYYY-MM-DD" → start of that local day in unix seconds; null when invalid. */
export function localDateStart(value: string): number | null {
  if (!isLocalDate(value)) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())!
  return Math.floor(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() / 1000)
}

/** "YYYY-MM-DD" → start of the NEXT local day (exclusive upper bound); null when invalid. */
export function localDateEnd(value: string): number | null {
  if (!isLocalDate(value)) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())!
  return Math.floor(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1).getTime() / 1000)
}

/** Monday-first week offset for today (Mon = 0 … Sun = 6). */
function weekdayOffset(): number {
  const dow = new Date().getDay() // 0 = Sunday
  return dow === 0 ? 6 : dow - 1
}

export interface HistoryWindow {
  /** inclusive lower bound, unix seconds */
  since?: number
  /** exclusive upper bound, unix seconds */
  until?: number
}

/** Resolve a named period into a local-calendar window. */
function periodWindow(period: HistoryPeriod): HistoryWindow {
  switch (period) {
    case "today":
      return { since: dayStart(0) }
    case "yesterday":
      return { since: dayStart(-1), until: dayStart(0) }
    case "last_3_days":
      return { since: dayStart(-2) }
    case "last_7_days":
      return { since: dayStart(-6) }
    case "this_week":
      return { since: dayStart(-weekdayOffset()) }
    case "last_week": {
      const thisMonday = -weekdayOffset()
      return { since: dayStart(thisMonday - 7), until: dayStart(thisMonday) }
    }
    case "this_month": {
      const now = new Date()
      return { since: Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000) }
    }
    case "last_month": {
      const now = new Date()
      return {
        since: Math.floor(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000),
        until: Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000),
      }
    }
  }
}

/**
 * Turn the LLM's query filter into concrete bounds. Explicit dates win over a
 * named period, which wins over `days` (last N calendar days including today).
 */
export function resolveHistoryWindow(input: {
  period?: HistoryPeriod
  since?: string
  until?: string
  days?: number
}): HistoryWindow {
  const since = input.since ? localDateStart(input.since) : null
  const until = input.until ? localDateEnd(input.until) : null
  if (since !== null || until !== null) {
    // Tolerate a reversed range instead of returning nothing.
    if (since !== null && until !== null && since >= until) {
      return { since: localDateStart(input.until!)!, until: localDateEnd(input.since!)! }
    }
    return {
      ...(since !== null ? { since } : {}),
      ...(until !== null ? { until } : {}),
    }
  }
  if (input.period) return periodWindow(input.period)
  if (input.days && input.days > 0) return { since: localDayCutoff(input.days) }
  return {}
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/** Rendered into the system prompt so the model knows the real date and "today". */
export function formatNowForPrompt(): string {
  const now = new Date()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const thisMonday = -weekdayOffset()
  return (
    "\n\n## Current time\n" +
    `Now: ${formatLocalDateTime(now.getTime() / 1000)} (${WEEKDAYS[now.getDay()]}), ${timezoneLabel()}.\n` +
    `The user's "today" runs from ${formatLocalDateTime(dayStart(0))} to now.\n` +
    "Date reference (local, inclusive): " +
    `today ${formatLocalDate(dayStart(0))}; ` +
    `yesterday ${formatLocalDate(dayStart(-1))}; ` +
    `3 days ago ${formatLocalDate(dayStart(-3))}; ` +
    `7 days ago ${formatLocalDate(dayStart(-7))}; ` +
    `this week starts Mon ${formatLocalDate(dayStart(thisMonday))}; ` +
    `last week ${formatLocalDate(dayStart(thisMonday - 7))} – ${formatLocalDate(dayStart(thisMonday - 1))}; ` +
    `this month starts ${formatLocalDate(dayStart(1 - now.getDate()))}; ` +
    `last month ${formatLocalDate(lastMonthStart.getTime() / 1000)} – ${formatLocalDate(lastMonthEnd.getTime() / 1000)}.\n` +
    "All timestamps in tool results are already in this local timezone.\n"
  )
}
