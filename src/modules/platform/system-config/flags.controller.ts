import { createHash } from 'node:crypto';
import { Controller, Get, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SkipEnvelope } from '../../../common/decorators/api-response.decorators';
import type { User } from '../../../generated/prisma/client';
import { Public } from '../../auth/decorators/auth.decorators';
import { FeatureFlagsService } from './feature-flags.service';
import { SystemConfigRepository } from './system-config.repository';

@Public()
@SkipEnvelope()
@Controller('flags')
export class FlagsController {
  constructor(
    private readonly repository: SystemConfigRepository,
    private readonly features: FeatureFlagsService,
  ) {}

  @Get()
  async show(
    @Req() request: FastifyRequest & { user?: User },
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const user = request.user ?? null;
    const flags = await this.repository.flags();

    const payload: Record<string, boolean> = {};

    for (const key of Object.keys(flags).sort()) {
      if (flags[key].isPublic) {
        payload[key] = await this.features.enabled(key, {
          userId: user?.id,
          ip: request.ip,
        });
      }
    }

    const fingerprint = createHash('sha256')
      .update(`${JSON.stringify(payload)}|${user?.id ?? 'anon'}`)
      .digest('hex')
      .slice(0, 12);

    const etag = `W/"flags-${await this.repository.flagsVersion()}-${fingerprint}"`;

    void reply.header('ETag', etag);

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    return reply.send({ status: 'success', message: 'OK', data: payload });
  }
}
