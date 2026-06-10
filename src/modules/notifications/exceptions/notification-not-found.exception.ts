import { ApiException } from '../../../common/exceptions/api.exception';

export class NotificationNotFoundException extends ApiException {
  constructor() {
    super('Notification not found.', 404, {}, 'notification_not_found');
  }
}
