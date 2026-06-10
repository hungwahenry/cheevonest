import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { ulid } from 'ulid';
import { Env } from '../../../config/env';
import { PrismaService } from '../../../database/prisma.service';
import { MailService } from '../../../integrations/mail/mail.service';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { OtpExpiredException } from '../exceptions/otp-expired.exception';
import { OtpInvalidException } from '../exceptions/otp-invalid.exception';
import { OtpMaxAttemptsException } from '../exceptions/otp-max-attempts.exception';
import { OtpThrottleException } from '../exceptions/otp-throttle.exception';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
    private readonly systemConfig: SystemConfigService,
  ) {}

  /** Issues a fresh code and delivers it synchronously; only the latest code is valid. */
  async send(email: string): Promise<void> {
    const normalized = this.normalize(email);

    await this.enforceResendCooldown(normalized);
    await this.prisma.otpCode.deleteMany({ where: { email: normalized } });

    const reviewCode = this.reviewCodeFor(normalized);
    const code = reviewCode ?? (await this.generateCode());
    const ttlMinutes = await this.systemConfig.int(
      'auth.otp_ttl_minutes',
      this.config.get('OTP_TTL_MINUTES', { infer: true }),
    );

    await this.prisma.otpCode.create({
      data: {
        id: ulid(),
        email: normalized,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });

    if (reviewCode === null) {
      await this.mail.send({
        to: normalized,
        subject: 'Your cheevo verification code',
        template: 'otp-code',
        context: { code, ttlMinutes },
      });
    }
  }

  /** Verifies a submitted code, consuming it on success. */
  async verify(email: string, code: string): Promise<void> {
    const normalized = this.normalize(email);

    const otp = await this.prisma.otpCode.findFirst({
      where: { email: normalized, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (otp === null) {
      throw new OtpInvalidException();
    }

    const maxAttempts = await this.systemConfig.int(
      'auth.otp_max_attempts',
      this.config.get('OTP_MAX_ATTEMPTS', { infer: true }),
    );

    if (otp.attempts >= maxAttempts) {
      throw new OtpMaxAttemptsException();
    }

    if (otp.expiresAt <= new Date()) {
      throw new OtpExpiredException();
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });

    if (!(await bcrypt.compare(code, otp.codeHash))) {
      throw new OtpInvalidException();
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }

  private async enforceResendCooldown(email: string): Promise<void> {
    const last = await this.prisma.otpCode.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    if (last === null) {
      return;
    }

    const cooldown = await this.systemConfig.int(
      'auth.otp_resend_cooldown_seconds',
      this.config.get('OTP_RESEND_COOLDOWN_SECONDS', { infer: true }),
    );
    const elapsed = Math.floor((Date.now() - last.createdAt.getTime()) / 1000);

    if (elapsed < cooldown) {
      throw new OtpThrottleException(cooldown - elapsed);
    }
  }

  private async generateCode(): Promise<string> {
    const length = await this.systemConfig.int(
      'auth.otp_length',
      this.config.get('OTP_LENGTH', { infer: true }),
    );
    const max = 10 ** length;

    return String(randomInt(0, max)).padStart(length, '0');
  }

  private normalize(email: string): string {
    return email.trim().toLowerCase();
  }

  private reviewCodeFor(email: string): string | null {
    const code = this.config.get('OTP_REVIEW_CODE', { infer: true });

    if (!code) {
      return null;
    }

    const allowed = this.config
      .get('OTP_REVIEW_EMAILS', { infer: true })
      .split(',')
      .map((entry) => this.normalize(entry))
      .filter((entry) => entry !== '');

    return allowed.includes(email) ? code : null;
  }
}
