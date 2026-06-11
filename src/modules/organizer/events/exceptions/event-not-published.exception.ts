import { ApiException } from '../../../../common/exceptions/api.exception';

export class EventNotPublishedException extends ApiException {
  constructor() {
    super('Only published events can be unpublished.', 422, {}, 'event_not_published');
  }
}
