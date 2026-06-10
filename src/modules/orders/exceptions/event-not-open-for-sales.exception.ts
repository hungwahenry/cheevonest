import { ApiException } from '../../../common/exceptions/api.exception';

export class EventNotOpenForSalesException extends ApiException {
  private constructor(message: string, code: string) {
    super(message, 422, {}, code);
  }

  static notPublished(): EventNotOpenForSalesException {
    return new EventNotOpenForSalesException(
      "This event isn't selling tickets yet.",
      'event_not_open_for_sales',
    );
  }

  static ended(): EventNotOpenForSalesException {
    return new EventNotOpenForSalesException(
      'This event has already ended.',
      'event_ended',
    );
  }
}
