import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PayoutSerializer } from '../../payouts/serializers/payout.serializer';

export const ADMIN_PAYOUT_INCLUDE = {
  organisation: { select: { id: true, name: true, slug: true } },
  requestedBy: { select: { id: true, email: true } },
  reviewedBy: { select: { id: true, email: true } },
} satisfies Prisma.PayoutInclude;

export type AdminPayout = Prisma.PayoutGetPayload<{
  include: typeof ADMIN_PAYOUT_INCLUDE;
}>;

@Injectable()
export class AdminPayoutSerializer {
  constructor(private readonly base: PayoutSerializer) {}

  payout(payout: AdminPayout): Record<string, unknown> {
    return {
      ...this.base.payout(payout),
      bank_code: payout.bankCode,
      provider: payout.provider,
      transfer_method: payout.transferMethod,
      provider_reference: payout.providerReference,
      created_at: payout.createdAt.toISOString(),
      organisation: {
        id: payout.organisation.id,
        name: payout.organisation.name,
        slug: payout.organisation.slug,
      },
      requested_by: {
        id: payout.requestedBy.id,
        email: payout.requestedBy.email,
      },
      reviewed_by: payout.reviewedBy
        ? { id: payout.reviewedBy.id, email: payout.reviewedBy.email }
        : null,
    };
  }
}
