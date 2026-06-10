import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { Env } from '../../config/env';
import { MailTemplatesService } from './mail-templates.service';

export interface MailMessage {
  to: string;
  subject: string;
  template: string;
  context?: Record<string, unknown>;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;
  private readonly resend: Resend | null;

  constructor(
    config: ConfigService<Env, true>,
    private readonly templates: MailTemplatesService,
  ) {
    this.from = `${config.get('MAIL_FROM_NAME', { infer: true })} <${config.get('MAIL_FROM_ADDRESS', { infer: true })}>`;
    this.resend =
      config.get('MAIL_DRIVER', { infer: true }) === 'resend'
        ? new Resend(config.get('RESEND_API_KEY', { infer: true }))
        : null;
  }

  async send(message: MailMessage): Promise<void> {
    const { html, text } = this.templates.render(
      message.template,
      message.context,
    );

    if (this.resend === null) {
      this.logger.log(
        `mail.sent to=${message.to} subject="${message.subject}"`,
      );
      this.logger.debug(text ?? html);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: message.from ?? this.from,
      to: message.to,
      subject: message.subject,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      ...(message.headers ? { headers: message.headers } : {}),
      html,
      text,
    });

    if (error) {
      throw new Error(`Mail delivery failed: ${error.message}`);
    }
  }
}
