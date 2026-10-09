/**
 * Date-only columns (crd1a_duedate, crd1a_auditdate) use "User Local" behaviour, so Dataverse stores a UTC instant.
 * We write noon UTC (the calendar day survives any viewer timezone from UTC-12 to UTC+11) and read the value back
 * converted into the configured business timezone.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Strict calendar check: rejects shapes like 2026-02-30 that Date.parse would silently roll over. */
export const isDateOnly = (v: unknown): v is string => {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

export function toDvDate(day: string | null | undefined): string | null {
  if (!day) return null;
  if (!isDateOnly(day)) throw new Error(`Invalid date: ${day}`);
  return `${day}T12:00:00Z`;
}

export function fromDvDate(value: string | null | undefined, timeZone: string): string | null {
  if (!value) return null;
  if (DATE_RE.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
