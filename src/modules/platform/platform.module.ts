import { Module } from '@nestjs/common';
import { AppLinksModule } from './app-links/app-links.module';
import { HealthModule } from './health/health.module';
import { PagesModule } from './pages/pages.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { WelcomeModule } from './welcome/welcome.module';

@Module({
  imports: [
    SystemConfigModule,
    HealthModule,
    PagesModule,
    WelcomeModule,
    AppLinksModule,
  ],
})
export class PlatformModule {}
