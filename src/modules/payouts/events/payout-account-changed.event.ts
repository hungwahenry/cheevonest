export const PAYOUT_ACCOUNT_CHANGED = 'payout.account_changed';

export class PayoutAccountChangedEvent {
  constructor(readonly organisationId: string) {}
}
