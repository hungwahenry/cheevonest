import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { ulid } from 'ulid';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type {
  StepUpChallenge,
  StepUpFactor,
  User,
} from '../../../../generated/prisma/client';
import { MailService } from '../../../../integrations/mail/mail.service';
import { OtpExpiredException } from '../../../auth/exceptions/otp-expired.exception';
import { OtpInvalidException } from '../../../auth/exceptions/otp-invalid.exception';
import { OtpMaxAttemptsException } from '../../../auth/exceptions/otp-max-attempts.exception';
import { OtpThrottleException } from '../../../auth/exceptions/otp-throttle.exception';
import { SystemConfigService } from '../../../platform/system-config/system-config.service';
import {
  StepUpActionContract,
  StepUpExecutionContext,
} from '../actions/step-up-action.interface';
import { ChangeEmailAction } from '../actions/change-email.action';
import { DeleteAccountAction } from '../actions/delete-account.action';
import { ChallengeAlreadyCompletedException } from '../exceptions/challenge-already-completed.exception';
import { ChallengeExpiredException } from '../exceptions/challenge-expired.exception';
import { UnknownStepUpActionException } from '../exceptions/unknown-step-up-action.exception';
import { WrongFactorException } from '../exceptions/wrong-factor.exception';

export type ChallengeWithFactors = StepUpChallenge & {
  factors: StepUpFactor[];
};

export interface VerifiedChallenge {
  challenge: ChallengeWithFactors;
  result: unknown;
}

@Injectable()
export class StepUpService {
  private readonly actions: Map<string, StepUpActionContract>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly systemConfig: SystemConfigService,
    changeEmail: ChangeEmailAction,
    deleteAccount: DeleteAccountAction,
  ) {
    this.actions = new Map(
      [changeEmail, deleteAccount].map((action) => [action.key, action]),
    );
  }

  async create(
    user: User,
    actionKey: string,
    payload: Record<string, unknown>,
  ): Promise<ChallengeWithFactors> {
    const action = this.resolveAction(actionKey);

    await action.validate(user, payload);

    const factors = action.factors(user, payload);
    const ttlMinutes = await this.systemConfig.int(
      'auth.stepup_challenge_ttl_minutes',
      15,
    );

    const challengeId = ulid();

    await this.prisma.$transaction(async (tx) => {
      await tx.stepUpChallenge.create({
        data: {
          id: challengeId,
          userId: user.id,
          action: actionKey,
          payload: payload as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        },
      });

      for (const [index, spec] of factors.entries()) {
        await tx.stepUpFactor.create({
          data: {
            id: ulid(),
            challengeId,
            kind: spec.kind,
            target: spec.target,
            sortOrder: index,
          },
        });
      }
    });

    const challenge = await this.load(challengeId);
    const first = this.nextFactor(challenge);

    if (first) {
      await this.sendCode(challenge, first);
    }

    return this.load(challengeId);
  }

  /** Verifies the current factor; when it was the last one, executes the action. */
  async verify(
    challenge: ChallengeWithFactors,
    user: User,
    factorId: string,
    code: string,
    context: StepUpExecutionContext,
  ): Promise<VerifiedChallenge> {
    this.guardLifecycle(challenge);

    const next = this.nextFactor(challenge);

    if (!next || next.id !== factorId) {
      throw new WrongFactorException();
    }

    const maxAttempts = await this.systemConfig.int(
      'auth.stepup_max_attempts',
      5,
    );

    if (next.attempts >= maxAttempts) {
      throw new OtpMaxAttemptsException();
    }

    if (next.expiresAt !== null && next.expiresAt <= new Date()) {
      throw new OtpExpiredException();
    }

    await this.prisma.stepUpFactor.update({
      where: { id: next.id },
      data: { attempts: { increment: 1 } },
    });

    if (
      next.codeHash === null ||
      !(await bcrypt.compare(code, next.codeHash))
    ) {
      throw new OtpInvalidException();
    }

    await this.prisma.stepUpFactor.update({
      where: { id: next.id },
      data: { verifiedAt: new Date() },
    });

    let reloaded = await this.load(challenge.id);
    const following = this.nextFactor(reloaded);

    if (following) {
      await this.sendCode(reloaded, following);

      return { challenge: await this.load(challenge.id), result: null };
    }

    const action = this.resolveAction(challenge.action);
    const result = await action.execute(
      user,
      challenge.payload as Record<string, unknown>,
      context,
    );

    await this.prisma.stepUpChallenge.updateMany({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    reloaded =
      challenge.action === 'delete_account'
        ? { ...reloaded, consumedAt: new Date() }
        : await this.load(challenge.id);

    return { challenge: reloaded, result };
  }

  async resend(
    challenge: ChallengeWithFactors,
    factorId: string,
  ): Promise<void> {
    this.guardLifecycle(challenge);

    const next = this.nextFactor(challenge);

    if (!next || next.id !== factorId) {
      throw new WrongFactorException();
    }

    if (next.sentAt !== null) {
      const cooldown = await this.systemConfig.int(
        'auth.stepup_resend_cooldown_seconds',
        60,
      );
      const elapsed = Math.floor((Date.now() - next.sentAt.getTime()) / 1000);

      if (elapsed < cooldown) {
        throw new OtpThrottleException(cooldown - elapsed);
      }
    }

    await this.sendCode(challenge, next);
  }

  async findOwnedOrFail(
    challengeId: string,
    userId: string,
  ): Promise<ChallengeWithFactors> {
    const challenge = await this.prisma.stepUpChallenge.findUnique({
      where: { id: challengeId },
      include: { factors: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!challenge) {
      throw new NotFoundException();
    }

    // Hide other users' challenges behind the same error the client already handles.
    if (challenge.userId !== userId) {
      throw new ChallengeExpiredException();
    }

    return challenge;
  }

  private async load(challengeId: string): Promise<ChallengeWithFactors> {
    return this.prisma.stepUpChallenge.findUniqueOrThrow({
      where: { id: challengeId },
      include: { factors: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  nextFactor(challenge: ChallengeWithFactors): StepUpFactor | null {
    return (
      challenge.factors.find((factor) => factor.verifiedAt === null) ?? null
    );
  }

  isCompleted(challenge: ChallengeWithFactors): boolean {
    return challenge.consumedAt !== null;
  }

  private guardLifecycle(challenge: ChallengeWithFactors): void {
    if (this.isCompleted(challenge)) {
      throw new ChallengeAlreadyCompletedException();
    }

    if (challenge.expiresAt <= new Date()) {
      throw new ChallengeExpiredException();
    }
  }

  private async sendCode(
    challenge: ChallengeWithFactors,
    factor: StepUpFactor,
  ): Promise<void> {
    const length = await this.systemConfig.int('auth.otp_length', 6);
    const ttlMinutes = await this.systemConfig.int(
      'auth.stepup_factor_ttl_minutes',
      10,
    );
    const code = String(randomInt(0, 10 ** length)).padStart(length, '0');

    await this.prisma.stepUpFactor.update({
      where: { id: factor.id },
      data: {
        codeHash: await bcrypt.hash(code, 10),
        attempts: 0,
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });

    if (factor.kind === 'otp') {
      const action = this.resolveAction(challenge.action);

      await this.mail.send({
        to: factor.target,
        ...action.mailFor(
          factor,
          challenge.payload as Record<string, unknown>,
          code,
          ttlMinutes,
        ),
      });
    }
  }

  private resolveAction(key: string): StepUpActionContract {
    const action = this.actions.get(key);

    if (!action) {
      throw new UnknownStepUpActionException();
    }

    return action;
  }
}
