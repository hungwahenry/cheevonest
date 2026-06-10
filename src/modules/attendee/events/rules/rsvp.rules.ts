import { ValidationFailedException } from '../../../../common/exceptions/api.exception';
import type { Event } from '../../../../generated/prisma/client';

export function ensureOpenForRsvp(event: Event): void {
  const ended =
    event.status === 'past' ||
    (event.endsAt !== null && event.endsAt <= new Date());

  if (ended) {
    throw new ValidationFailedException({
      event: ['This event has already ended.'],
    });
  }

  if (event.status !== 'published') {
    throw new ValidationFailedException({
      event: ['This event is not open for RSVPs yet.'],
    });
  }
}
