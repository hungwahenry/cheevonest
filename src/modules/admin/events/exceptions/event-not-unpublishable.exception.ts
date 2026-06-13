import { ApiException } from '../../../../common/exceptions/api.exception';

export class EventNotUnpublishableException extends ApiException {
  constructor(status: string) {
    super(
      `Only published events can be unpublished; this one is ${status}.`,
      409,
      {},
      'event_not_unpublishable',
    );
  }
}
