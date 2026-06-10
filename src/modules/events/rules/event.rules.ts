import type { Event } from '../../../generated/prisma/client';
import { EventEndedException } from '../exceptions/event-ended.exception';

export function ensureEventNotEnded(event: Pick<Event, 'status'>): void {
  if (event.status === 'past') {
    throw new EventEndedException();
  }
}
