import { fromZonedTime } from 'date-fns-tz';
import { ValidationFailedException } from '../../../../common/exceptions/api.exception';

const OFFSET_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/;

export function ensureValidTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
  } catch {
    throw new ValidationFailedException({
      timezone: ['The timezone must be a valid timezone.'],
    });
  }
}

/** Values without an offset are wall-clock times in the given timezone. */
export function parseEventDate(
  value: string,
  timezone: string,
  field: string,
): Date {
  const date = OFFSET_PATTERN.test(value)
    ? new Date(value)
    : fromZonedTime(value, timezone);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationFailedException({
      [field]: [`The ${field} must be a valid date.`],
    });
  }

  return date;
}

export function ensureAfterOrEqual(
  later: Date | null | undefined,
  earlier: Date | null | undefined,
  field: string,
  message: string,
): void {
  if (later && earlier && later < earlier) {
    throw new ValidationFailedException({ [field]: [message] });
  }
}

export function ensureBeforeOrEqual(
  earlier: Date | null | undefined,
  later: Date | null | undefined,
  field: string,
  message: string,
): void {
  if (earlier && later && earlier > later) {
    throw new ValidationFailedException({ [field]: [message] });
  }
}

export function ensureFuture(
  date: Date | null | undefined,
  field: string,
  message: string,
): void {
  if (date && date <= new Date()) {
    throw new ValidationFailedException({ [field]: [message] });
  }
}
