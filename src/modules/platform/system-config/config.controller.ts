import { Controller, Get, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SkipEnvelope } from '../../../common/decorators/api-response.decorators';
import { Public } from '../../auth/decorators/auth.decorators';
import { SystemConfigRepository } from './system-config.repository';

@Public()
@SkipEnvelope()
@Controller('config')
export class ConfigController {
  constructor(private readonly repository: SystemConfigRepository) {}

  @Get()
  async show(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const configs = await this.repository.configs();

    const payload: Record<string, unknown> = {};

    for (const key of Object.keys(configs).sort()) {
      if (configs[key].isPublic) {
        payload[key] = configs[key].value;
      }
    }

    const etag = `W/"config-${await this.repository.configsVersion()}"`;

    void reply.header('ETag', etag);

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    return reply.send({ status: 'success', message: 'OK', data: payload });
  }
}
