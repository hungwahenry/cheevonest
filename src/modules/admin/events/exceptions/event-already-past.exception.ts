import { ApiException } from '../../../../common/exceptions/api.exception';

export class EventAlreadyPastException extends ApiException {
  constructor() {
    super('This event is already marked past.', 409, {}, 'event_already_past');
  }
}
