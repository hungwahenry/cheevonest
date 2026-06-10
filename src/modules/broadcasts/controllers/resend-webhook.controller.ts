import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SkipEnvelope } from '../../../common/decorators/api-response.decorators';
import { Public } from '../../auth/decorators/auth.decorators';
import { ResendWebhookService } from '../services/resend-webhook.service';

@Public()
@SkipEnvelope()
@Controller('webhooks')
export class ResendWebhookController {
  private readonly logger = new Logger(ResendWebhookController.name);

  constructor(private readonly resend: ResendWebhookService) {}

  @Post('resend')
  @HttpCode(200)
  async handle(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers('svix-id') svixId?: string,
    @Headers('svix-timestamp') svixTimestamp?: string,
    @Headers('svix-signature') svixSignature?: string,
  ): Promise<string> {
    const rawBody = request.rawBody ?? Buffer.from('');

    const verified = this.resend.verifySignature(rawBody, {
      'svix-id': svixId ?? '',
      'svix-timestamp': svixTimestamp ?? '',
      'svix-signature': svixSignature ?? '',
    });

    if (!verified) {
      this.logger.warn('resend webhook signature invalid');
      throw new UnauthorizedException();
    }

    await this.resend.record((request.body ?? {}) as Record<string, unknown>);

    return '';
  }
}
