import { ApiException } from '../../../../common/exceptions/api.exception';

export class EventCommentsNotLockedException extends ApiException {
  constructor() {
    super(
      'Comments are not currently locked for this event.',
      409,
      {},
      'event_comments_not_locked',
    );
  }
}
