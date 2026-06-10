import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../config/env';
import type { Event, Organisation } from '../../../generated/prisma/client';
import { MailService } from '../../../integrations/mail/mail.service';
import { UrlSignerService } from '../../../common/signing/url-signer.service';

const UNSUBSCRIBE_TTL_SECONDS = 90 * 24 * 3600;

export interface BroadcastMailInput {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  organisation: Organisation;
  event: Event;
}

@Injectable()
export class BroadcastMailerService {
  private readonly fromAddress: string;

  constructor(
    private readonly mail: MailService,
    private readonly signer: UrlSignerService,
    config: ConfigService<Env, true>,
  ) {
    this.fromAddress = config.get('BROADCASTS_FROM_ADDRESS', { infer: true });
  }

  async send(input: BroadcastMailInput): Promise<void> {
    const orgName = input.organisation.name.replace(/["<>]/g, '');
    const unsubscribeUrl = this.unsubscribeUrl(input.organisation.id, input.to);

    await this.mail.send({
      to: input.to,
      subject: input.subject,
      template: 'broadcast',
      context: {
        organisationName: input.organisation.name,
        eventTitle: input.event.title,
        bodyHtml: input.bodyHtml,
        bodyText: input.bodyText,
        unsubscribeUrl,
      },
      from: `${orgName} via cheevo <${this.fromAddress}>`,
      replyTo: input.organisation.contactEmail ?? this.fromAddress,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  }

  unsubscribeUrl(organisationId: string, email: string): string {
    return this.signer.sign(
      `/unsubscribe/broadcasts/${organisationId}/${encodeURIComponent(email)}`,
      UNSUBSCRIBE_TTL_SECONDS,
    );
  }
}
