import { Module } from '@nestjs/common';
import { ConfigController } from './controllers/config.controller';
import { FlagsController } from './controllers/flags.controller';
import { HealthController } from './controllers/health.controller';
import { PagesController } from './controllers/pages.controller';
import { WelcomeController } from './controllers/welcome.controller';
import { WellKnownController } from './controllers/well-known.controller';
import { SystemConfigModule } from './system-config/system-config.module';

@Module({
  imports: [SystemConfigModule],
  controllers: [
    HealthController,
    ConfigController,
    FlagsController,
    PagesController,
    WelcomeController,
    WellKnownController,
  ],
})
export class PlatformModule {}
