export const PAYOUT_REJECTED = 'payout.rejected';

export class PayoutRejectedEvent {
  constructor(readonly payoutId: string) {}
}
