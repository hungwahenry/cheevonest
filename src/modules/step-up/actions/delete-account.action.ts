import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../config/env';
import { PrismaService } from '../../../database/prisma.service';
import type { StepUpFactor, User } from '../../../generated/prisma/client';
import { MailMessage } from '../../../integrations/mail/mail.service';
import { AccountOwnsOrganisationsException } from '../exceptions/account-owns-organisations.exception';
import { FactorSpec, StepUpActionContract } from './step-up-action.interface';

@Injectable()
export class DeleteAccountAction implements StepUpActionContract {
  readonly key = 'delete_account';

  async validate(user: User): Promise<void> {
    const ownsOrg = await this.prisma.organisationMember.findFirst({
      where: { userId: user.id, role: 'owner' },
      select: { userId: true },
    });

    if (ownsOrg) {
      throw new AccountOwnsOrganisationsException();
    }
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  factors(user: User): FactorSpec[] {
    return [{ kind: 'otp', target: user.email.toLowerCase().trim() }];
  }

  /** Polymorphic references have no FK — clear them, then let cascades wipe the rest. */
  async execute(user: User): Promise<unknown> {
    await this.prisma.$transaction([
      this.prisma.block.deleteMany({
        where: { blockableType: 'user', blockableId: user.id },
      }),
      this.prisma.report.deleteMany({
        where: { targetType: 'user', targetId: user.id },
      }),
      this.prisma.user.delete({ where: { id: user.id } }),
    ]);

    return { deleted: true };
  }

  mailFor(
    factor: StepUpFactor,
    payload: Record<string, unknown>,
    code: string,
    ttlMinutes: number,
  ): Omit<MailMessage, 'to'> {
    return {
      subject: `Confirm your ${this.config.get('APP_NAME', { infer: true })} account deletion`,
      template: 'delete-account-otp',
      context: { code, ttlMinutes },
    };
  }
}
