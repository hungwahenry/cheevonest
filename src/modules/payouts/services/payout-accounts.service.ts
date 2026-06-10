import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../database/prisma.service';
import type {
  Organisation,
  PayoutAccount,
} from '../../../generated/prisma/client';
import { PaymentProviderRegistry } from '../../payments/services/payment-provider-registry.service';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { BankResolverService } from './bank-resolver.service';

@Injectable()
export class PayoutAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: BankResolverService,
    private readonly registry: PaymentProviderRegistry,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async find(organisationId: string): Promise<PayoutAccount | null> {
    return this.prisma.payoutAccount.findUnique({
      where: { organisationId },
    });
  }

  /** Resolves the account with the bank, registers a transfer recipient, and upserts the snapshot. */
  async upsert(
    organisation: Organisation,
    bankCode: string,
    accountNumber: string,
  ): Promise<PayoutAccount> {
    const resolved = await this.resolver.resolve(accountNumber, bankCode);
    const bankName = await this.resolver.bankName(bankCode);
    const providerName = await this.systemConfig.string(
      'payouts.bank_resolver',
      'paystack',
    );

    const recipientCode = await this.registry
      .get(providerName)
      .createTransferRecipient({
        name: resolved.account_name,
        accountNumber: resolved.account_number,
        bankCode,
        currency: 'NGN',
      });

    const data = {
      bankCode,
      bankName,
      accountNumber: resolved.account_number,
      accountName: resolved.account_name,
      currency: 'NGN' as const,
      provider: providerName,
      providerRecipientCode: recipientCode,
      verifiedAt: new Date(),
    };

    return this.prisma.payoutAccount.upsert({
      where: { organisationId: organisation.id },
      update: data,
      create: { id: ulid(), organisationId: organisation.id, ...data },
    });
  }

  async delete(organisationId: string): Promise<void> {
    await this.prisma.payoutAccount.deleteMany({
      where: { organisationId },
    });
  }
}
