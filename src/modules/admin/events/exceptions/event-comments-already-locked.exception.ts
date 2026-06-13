import { ApiException } from '../../../../common/exceptions/api.exception';

export class EventCommentsAlreadyLockedException extends ApiException {
  constructor() {
    super(
      'Comments are already locked for this event.',
      409,
      {},
      'event_comments_already_locked',
    );
  }
}
