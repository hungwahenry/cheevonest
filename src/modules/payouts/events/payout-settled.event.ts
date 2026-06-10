export const PAYOUT_SETTLED = 'payout.settled';

export class PayoutSettledEvent {
  constructor(readonly payoutId: string) {}
}
