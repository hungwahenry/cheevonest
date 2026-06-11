import { ApiException } from '../../../../common/exceptions/api.exception';

export class EventNotOpenForRsvpException extends ApiException {
  private constructor(message: string, code: string) {
    super(message, 422, {}, code);
  }

  static notPublished(): EventNotOpenForRsvpException {
    return new EventNotOpenForRsvpException(
      'This event is not open for RSVPs yet.',
      'event_not_open_for_rsvp',
    );
  }

  static ended(): EventNotOpenForRsvpException {
    return new EventNotOpenForRsvpException(
      'This event has already ended.',
      'event_ended',
    );
  }
}
