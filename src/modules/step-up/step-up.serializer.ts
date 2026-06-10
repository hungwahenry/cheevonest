import { Injectable } from '@nestjs/common';
import type { StepUpFactor } from '../../generated/prisma/client';
import {
  ChallengeWithFactors,
  StepUpService,
} from './services/step-up.service';

@Injectable()
export class StepUpSerializer {
  constructor(private readonly stepUp: StepUpService) {}

  challenge(
    challenge: ChallengeWithFactors,
    result: unknown = null,
  ): Record<string, unknown> {
    return {
      id: challenge.id,
      action: challenge.action,
      expires_at: challenge.expiresAt.toISOString(),
      completed: this.stepUp.isCompleted(challenge),
      factors: challenge.factors.map((factor) => this.factor(factor)),
      next_factor_id: this.stepUp.nextFactor(challenge)?.id ?? null,
      ...(result !== null ? { result } : {}),
    };
  }

  factor(factor: StepUpFactor): Record<string, unknown> {
    return {
      id: factor.id,
      kind: factor.kind,
      target_masked: this.maskTarget(factor),
      position: factor.sortOrder,
      verified: factor.verifiedAt !== null,
      sent_at: factor.sentAt?.toISOString() ?? null,
    };
  }

  private maskTarget(factor: StepUpFactor): string {
    if (factor.kind !== 'otp' || !factor.target.includes('@')) {
      return factor.target;
    }

    const [local, domain] = factor.target.split('@', 2);

    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }

    return `${local[0]}${'*'.repeat(Math.max(1, local.length - 2))}${local.slice(-1)}@${domain}`;
  }
}
