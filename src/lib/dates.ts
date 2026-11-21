export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

/**
 * Returns YYYY-MM-DD in Asia/Jakarta (or given timezone).
 */
export function getLocalDateString(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${d}`;
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

export function getLocalMonthString(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  return getLocalDateString(date, timeZone).slice(0, 7);
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function addMonthsToMonthString(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

export function getLastNDays(n: number, timeZone: string = DEFAULT_TIMEZONE): string[] {
  const today = getLocalDateString(new Date(), timeZone);
  const list: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    list.push(addDaysToDateString(today, -i));
  }
  return list;
}

export function getLastNMonths(n: number, timeZone: string = DEFAULT_TIMEZONE): string[] {
  const current = getLocalMonthString(new Date(), timeZone);
  const list: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    list.push(addMonthsToMonthString(current, -i));
  }
  return list;
}

export function formatMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 15));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

export function formatShortDate(dateStr: string): string {
  const today = getLocalDateString();
  const yesterday = addDaysToDateString(today, -1);
  const tomorrow = addDaysToDateString(today, 1);
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  if (dateStr === tomorrow) return 'Tomorrow';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

export function formatFullDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

/**
 * Converts a UTC ISO string into YYYY-MM-DD in Asia/Jakarta.
 */
export function isoToLocalDate(iso: string | null, timeZone: string = DEFAULT_TIMEZONE): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return getLocalDateString(d, timeZone);
}

/**
 * Formats a UTC ISO due_at into human readable local string like "Today, 14:30" or "Nov 22".
 */
export function formatDueAt(iso: string | null, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const localDate = getLocalDateString(dt, timeZone);
  const dayLabel = formatShortDate(localDate);

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dt);

  if (timeParts === '23:59') {
    return dayLabel;
  }
  return `${dayLabel}, ${timeParts}`;
}

/**
 * Converts a local date (YYYY-MM-DD) + optional HH:mm (in Asia/Jakarta UTC+7) into a UTC ISO string.
 */
export function localDateTimeToUtcIso(dateStr: string, timeStr?: string): string {
  const time = timeStr && /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : '23:59';
  // Asia/Jakarta is permanently UTC+07:00 (no DST)
  const dt = new Date(`${dateStr}T${time}:00+07:00`);
  return dt.toISOString();
}

export function isoToLocalTimeInput(iso: string | null, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dt);
  return formatted === '23:59' ? '' : formatted;
}

export function isTaskOverdue(dueAt: string | null, status: 'todo' | 'done'): boolean {
  if (!dueAt || status === 'done') return false;
  return new Date(dueAt).getTime() < Date.now();
}

export function isTaskDueToday(dueAt: string | null, timeZone: string = DEFAULT_TIMEZONE): boolean {
  if (!dueAt) return false;
  return isoToLocalDate(dueAt, timeZone) === getLocalDateString(new Date(), timeZone);
}

export function getGreeting(timeZone: string = DEFAULT_TIMEZONE): string {
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(new Date());
  const hour = Number(hourStr);
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
