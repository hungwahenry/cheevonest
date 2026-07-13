export const PAYOUT_REQUESTED = 'payout.requested';

export class PayoutRequestedEvent {
  constructor(readonly payoutId: string) {}
}
