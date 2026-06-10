import { ApiException } from '../../../common/exceptions/api.exception';

export class EventNotOpenForCommentsException extends ApiException {
  constructor() {
    super(
      'This event is not open for comments yet.',
      422,
      {},
      'event_not_open_for_comments',
    );
  }
}
