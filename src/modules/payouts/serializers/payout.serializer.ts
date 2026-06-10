import { Injectable } from '@nestjs/common';
import type { Payout, PayoutAccount } from '../../../generated/prisma/client';

@Injectable()
export class PayoutSerializer {
  payout(payout: Payout): Record<string, unknown> {
    return {
      id: payout.id,
      amount_minor: Number(payout.amountMinor),
      fees_minor: Number(payout.feesMinor),
      net_minor: Number(payout.netMinor),
      currency: payout.currency,
      status: payout.status,
      bank_name: payout.bankName,
      account_number: payout.accountNumber,
      account_name: payout.accountName,
      failed_reason: payout.failedReason,
      review_notes: payout.reviewNotes,
      requested_at: payout.requestedAt.toISOString(),
      approved_at: payout.approvedAt?.toISOString() ?? null,
      paid_at: payout.paidAt?.toISOString() ?? null,
      failed_at: payout.failedAt?.toISOString() ?? null,
      rejected_at: payout.rejectedAt?.toISOString() ?? null,
    };
  }

  account(account: PayoutAccount): Record<string, unknown> {
    return {
      id: account.id,
      bank_code: account.bankCode,
      bank_name: account.bankName,
      account_number: account.accountNumber,
      account_name: account.accountName,
      currency: account.currency,
      verified_at: account.verifiedAt?.toISOString() ?? null,
    };
  }
}
