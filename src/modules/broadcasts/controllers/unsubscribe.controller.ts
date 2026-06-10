import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  Version,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { VERSION_NEUTRAL } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { SkipEnvelope } from '../../../common/decorators/api-response.decorators';
import { UrlSignerService } from '../../../common/signing/url-signer.service';
import { Public } from '../../auth/decorators/auth.decorators';
import { OrganisationsService } from '../../organisations/organisations.service';
import { SuppressionsService } from '../services/suppressions.service';

@Public()
@SkipEnvelope()
@Controller('unsubscribe/broadcasts')
export class UnsubscribeController {
  constructor(
    private readonly signer: UrlSignerService,
    private readonly organisations: OrganisationsService,
    private readonly suppressions: SuppressionsService,
  ) {}

  @Get(':organisationId/:email')
  @Version(VERSION_NEUTRAL)
  async unsubscribe(
    @Param('organisationId') organisationId: string,
    @Param('email') email: string,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Query('expires') expires?: string,
    @Query('signature') signature?: string,
  ): Promise<string> {
    return this.process(reply, organisationId, email, expires, signature);
  }

  /** RFC 8058 one-click: mail clients POST the same signed URL. */
  @Post(':organisationId/:email')
  @Version(VERSION_NEUTRAL)
  async oneClick(
    @Param('organisationId') organisationId: string,
    @Param('email') email: string,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Query('expires') expires?: string,
    @Query('signature') signature?: string,
  ): Promise<string> {
    return this.process(reply, organisationId, email, expires, signature);
  }

  private async process(
    reply: FastifyReply,
    organisationId: string,
    email: string,
    expires?: string,
    signature?: string,
  ): Promise<string> {
    const path = `/unsubscribe/broadcasts/${organisationId}/${encodeURIComponent(email)}`;

    if (!this.signer.verify(path, expires, signature)) {
      throw new ForbiddenException('Invalid or expired unsubscribe link.');
    }

    const organisation = await this.organisations.findOrFail(organisationId);

    await this.suppressions.suppress(
      decodeURIComponent(email),
      organisation.id,
      'unsubscribed',
    );

    void reply.header('Content-Type', 'text/html; charset=utf-8');

    const safeName = organisation.name
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;');

    return `<!doctype html><meta charset="utf-8"><title>Unsubscribed</title><body style="font-family:-apple-system,sans-serif;max-width:480px;margin:80px auto;text-align:center;padding:0 16px;"><h1 style="font-size:20px;">You're unsubscribed</h1><p style="color:#71717a;">You won't receive emails from <strong>${safeName}</strong> via cheevo anymore.</p></body>`;
  }
}
