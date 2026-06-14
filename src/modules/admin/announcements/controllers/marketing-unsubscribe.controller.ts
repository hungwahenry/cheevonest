import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Res,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { SkipEnvelope } from '../../../../common/decorators/api-response.decorators';
import { HtmlPagesService } from '../../../../common/html/html-pages.service';
import { UrlSignerService } from '../../../../common/signing/url-signer.service';
import { Public } from '../../../auth/decorators/auth.decorators';
import { BroadcastTrackingService } from '../services/broadcast-tracking.service';

@Public()
@SkipEnvelope()
@Controller('unsubscribe/marketing')
export class MarketingUnsubscribeController {
  constructor(
    private readonly signer: UrlSignerService,
    private readonly tracking: BroadcastTrackingService,
    private readonly pages: HtmlPagesService,
  ) {}

  @Get(':userId')
  @Version(VERSION_NEUTRAL)
  async unsubscribe(
    @Param('userId') userId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Query('expires') expires?: string,
    @Query('signature') signature?: string,
  ): Promise<string> {
    return this.process(reply, userId, expires, signature);
  }

  /** RFC 8058 one-click: mail clients POST the same signed URL. */
  @Post(':userId')
  @Version(VERSION_NEUTRAL)
  async oneClick(
    @Param('userId') userId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Query('expires') expires?: string,
    @Query('signature') signature?: string,
  ): Promise<string> {
    return this.process(reply, userId, expires, signature);
  }

  private async process(
    reply: FastifyReply,
    userId: string,
    expires?: string,
    signature?: string,
  ): Promise<string> {
    const path = `/unsubscribe/marketing/${userId}`;

    if (!this.signer.verify(path, expires, signature)) {
      throw new ForbiddenException('Invalid or expired unsubscribe link.');
    }

    await this.tracking.unsubscribeMarketing(userId);

    void reply.header('Content-Type', 'text/html; charset=utf-8');

    return this.pages.render('marketing-unsubscribed');
  }
}
