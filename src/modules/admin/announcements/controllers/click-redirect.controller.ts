import {
  Controller,
  Get,
  Param,
  Res,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../../config/env';
import { SkipEnvelope } from '../../../../common/decorators/api-response.decorators';
import { Public } from '../../../auth/decorators/auth.decorators';
import { BroadcastTrackingService } from '../services/broadcast-tracking.service';

@Public()
@SkipEnvelope()
@Controller('r')
export class ClickRedirectController {
  private readonly fallback: string;

  constructor(
    private readonly tracking: BroadcastTrackingService,
    config: ConfigService<Env, true>,
  ) {
    this.fallback = config.get('APP_URL', { infer: true });
  }

  @Get(':id')
  @Version(VERSION_NEUTRAL)
  async redirect(
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const url = await this.tracking.resolveClick(id);

    void reply.redirect(url ?? this.fallback, 302);
  }
}
