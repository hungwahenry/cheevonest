export const TICKET_TRANSFERRED = 'ticket.transferred';

export class TicketTransferredEvent {
  constructor(
    readonly issuedTicketId: string,
    readonly fromUserId: string,
    readonly toUserId: string,
  ) {}
}
