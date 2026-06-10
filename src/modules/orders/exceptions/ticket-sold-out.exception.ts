import { ApiException } from '../../../common/exceptions/api.exception';

export class TicketSoldOutException extends ApiException {
  private constructor(message: string, code: string) {
    super(message, 422, {}, code);
  }

  static noneLeft(ticketName: string): TicketSoldOutException {
    return new TicketSoldOutException(
      `"${ticketName}" is sold out.`,
      'ticket_sold_out',
    );
  }

  static notEnoughLeft(
    ticketName: string,
    available: number,
  ): TicketSoldOutException {
    return new TicketSoldOutException(
      `Only ${available} of "${ticketName}" left.`,
      'ticket_low_stock',
    );
  }
}
