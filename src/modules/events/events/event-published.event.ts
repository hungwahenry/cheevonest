export const EVENT_PUBLISHED = 'event.published';

export class EventPublishedEvent {
  constructor(readonly eventId: string) {}
}
