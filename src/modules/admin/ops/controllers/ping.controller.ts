import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../../config/env';
import { Roles } from '../../../auth/decorators/auth.decorators';

@Roles('admin')
@Controller('admin/ping')
export class PingController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  @Get()
  ping(): { ok: true; app: string; time: string } {
    return {
      ok: true,
      app: this.config.get('APP_NAME', { infer: true }),
      time: new Date().toISOString(),
    };
  }
}
