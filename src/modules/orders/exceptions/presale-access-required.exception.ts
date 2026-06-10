import { ApiException } from '../../../common/exceptions/api.exception';

export class PresaleAccessRequiredException extends ApiException {
  constructor(until: string) {
    super(
      `Tickets are RSVP-only until ${until}. RSVP to unlock.`,
      422,
      { presale_until: until },
      'presale_access_required',
    );
  }
}
