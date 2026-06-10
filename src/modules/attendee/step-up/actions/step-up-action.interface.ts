import type { StepUpFactor, User } from '../../../../generated/prisma/client';
import { MailMessage } from '../../../../integrations/mail/mail.service';

export interface FactorSpec {
  kind: 'otp';
  target: string;
}

export interface StepUpExecutionContext {
  currentTokenId: string;
}

export interface StepUpActionContract {
  readonly key: string;
  validate(user: User, payload: Record<string, unknown>): Promise<void>;
  factors(user: User, payload: Record<string, unknown>): FactorSpec[];
  execute(
    user: User,
    payload: Record<string, unknown>,
    context: StepUpExecutionContext,
  ): Promise<unknown>;
  mailFor(
    factor: StepUpFactor,
    payload: Record<string, unknown>,
    code: string,
    ttlMinutes: number,
  ): Omit<MailMessage, 'to'>;
}
