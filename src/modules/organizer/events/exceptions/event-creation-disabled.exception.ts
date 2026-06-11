import { ApiException } from '../../../../common/exceptions/api.exception';

export class EventCreationDisabledException extends ApiException {
  constructor() {
    super(
      'Creating new events is temporarily disabled.',
      422,
      {},
      'event_creation_disabled',
    );
  }
}
