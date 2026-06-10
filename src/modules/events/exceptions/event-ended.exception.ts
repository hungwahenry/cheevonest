import { ApiException } from '../../../common/exceptions/api.exception';

export class EventEndedException extends ApiException {
  constructor() {
    super(
      'This event has ended — you can no longer change its details.',
      422,
      {},
      'event_ended',
    );
  }
}
