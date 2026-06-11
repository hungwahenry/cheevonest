import type { Event } from '../../../../generated/prisma/client';
import { EventNotOpenForRsvpException } from '../exceptions/event-not-open-for-rsvp.exception';

export function ensureOpenForRsvp(event: Event): void {
  const ended =
    event.status === 'past' ||
    (event.endsAt !== null && event.endsAt <= new Date());

  if (ended) {
    throw EventNotOpenForRsvpException.ended();
  }

  if (event.status !== 'published') {
    throw EventNotOpenForRsvpException.notPublished();
  }
}
