import { Injectable } from '@nestjs/common';
import { ValidationFailedException } from '../../../common/exceptions/api.exception';
import { PrismaService } from '../../../database/prisma.service';
import type { StepUpFactor, User } from '../../../generated/prisma/client';
import { MailMessage } from '../../../integrations/mail/mail.service';
import { UserSerializer } from '../../users/serializers/user.serializer';
import { UsersService } from '../../users/services/users.service';
import { EmailAlreadyTakenException } from '../exceptions/email-already-taken.exception';
import { SameEmailException } from '../exceptions/same-email.exception';
import {
  FactorSpec,
  StepUpActionContract,
  StepUpExecutionContext,
} from './step-up-action.interface';

@Injectable()
export class ChangeEmailAction implements StepUpActionContract {
  readonly key = 'change_email';

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly serializer: UserSerializer,
  ) {}

  async validate(user: User, payload: Record<string, unknown>): Promise<void> {
    const newEmail = this.newEmail(payload);

    if (newEmail === '') {
      throw new ValidationFailedException({
        'payload.new_email': ['A new email is required.'],
      });
    }

    if (newEmail === user.email.toLowerCase()) {
      throw new SameEmailException();
    }

    const exists = await this.prisma.user.findFirst({
      where: {
        email: { equals: newEmail, mode: 'insensitive' },
        id: { not: user.id },
      },
      select: { id: true },
    });

    if (exists) {
      throw new EmailAlreadyTakenException();
    }
  }

  factors(user: User, payload: Record<string, unknown>): FactorSpec[] {
    return [
      { kind: 'otp', target: user.email.toLowerCase().trim() },
      { kind: 'otp', target: this.newEmail(payload) },
    ];
  }

  /** Applies the new email and revokes every other session. */
  async execute(
    user: User,
    payload: Record<string, unknown>,
    context: StepUpExecutionContext,
  ): Promise<unknown> {
    const newEmail = this.newEmail(payload);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { email: newEmail, emailVerifiedAt: new Date() },
      }),
      this.prisma.accessToken.deleteMany({
        where: { userId: user.id, id: { not: context.currentTokenId } },
      }),
    ]);

    const loaded = await this.users.findForResource(user.id);

    return { user: this.serializer.user(loaded) };
  }

  mailFor(
    factor: StepUpFactor,
    payload: Record<string, unknown>,
    code: string,
    ttlMinutes: number,
  ): Omit<MailMessage, 'to'> {
    return factor.sortOrder === 0
      ? {
          subject: 'Confirm your cheevo email change',
          template: 'change-email-current-otp',
          context: { code, ttlMinutes, newEmail: this.newEmail(payload) },
        }
      : {
          subject: 'Confirm this is your new cheevo email',
          template: 'change-email-new-otp',
          context: { code, ttlMinutes },
        };
  }

  private newEmail(payload: Record<string, unknown>): string {
    return typeof payload.new_email === 'string'
      ? payload.new_email.toLowerCase().trim()
      : '';
  }
}
