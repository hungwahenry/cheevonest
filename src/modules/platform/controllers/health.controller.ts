import { Controller, Get, Logger, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply } from 'fastify';
import { ApiResult } from '../../../common/responses/api-result';
import { Env } from '../../../config/env';
import { PrismaService } from '../../../database/prisma.service';

interface HealthReport {
  service: string;
  database: 'ok' | 'down';
  time: string;
}

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  async check(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<ApiResult<HealthReport>> {
    let database: 'ok' | 'down' = 'ok';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      database = 'down';
      this.logger.error(
        `health.db_check_failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const healthy = database === 'ok';

    if (!healthy) {
      reply.status(503);
    }

    return new ApiResult(
      {
        service: this.config.get('APP_NAME', { infer: true }),
        database,
        time: new Date().toISOString(),
      },
      healthy ? 'Service healthy.' : 'Service degraded.',
    );
  }
}
