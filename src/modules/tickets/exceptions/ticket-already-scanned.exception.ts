import { ApiException } from '../../../common/exceptions/api.exception';

export class TicketAlreadyScannedException extends ApiException {
  constructor(scannedAt: string | null = null) {
    super(
      scannedAt
        ? `Ticket was already scanned at ${scannedAt}.`
        : 'Ticket was already scanned.',
      409,
      {},
      'ticket_already_scanned',
    );
  }
}
