import type { User } from '../../../generated/prisma/client';

/** True when the user's local time falls inside their configured quiet window. */
export function isInQuietHours(user: User, now: Date = new Date()): boolean {
  const start = user.quietHoursStart;
  const end = user.quietHoursEnd;

  if (start === null || end === null || start === end) {
    return false;
  }

  const timeZone = user.quietHoursTimezone || 'UTC';

  let current: string;

  try {
    current = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);
  } catch {
    return false;
  }

  const normalizedStart = start.length === 5 ? `${start}:00` : start;
  const normalizedEnd = end.length === 5 ? `${end}:00` : end;

  if (normalizedStart < normalizedEnd) {
    return current >= normalizedStart && current < normalizedEnd;
  }

  return current >= normalizedStart || current < normalizedEnd;
}
