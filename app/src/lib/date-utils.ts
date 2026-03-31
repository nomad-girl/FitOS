/**
 * Returns today's date as YYYY-MM-DD in the user's local timezone.
 * Unlike toISOString().split('T')[0], this won't shift to the next day
 * for users in negative-UTC timezones (e.g. Argentina UTC-3 after 9pm).
 */
export function todayLocal(): string {
  return dateToLocal(new Date())
}

/**
 * Converts a Date object to YYYY-MM-DD in the user's local timezone.
 */
export function dateToLocal(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parses a YYYY-MM-DD string as a local-timezone Date (midnight local).
 * Unlike `new Date("2026-03-28")` which parses as UTC midnight
 * (and shifts back a day in negative-UTC timezones like Argentina UTC-3).
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}
