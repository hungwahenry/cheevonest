import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../../platform/system-config/system-config.module';
import { AdminFeatureFlagsController } from './controllers/feature-flags.controller';
import { AdminSystemConfigsController } from './controllers/system-configs.controller';
import { SettingsSerializer } from './serializers/settings.serializer';
import { SettingsService } from './services/settings.service';

@Module({
  imports: [SystemConfigModule],
  controllers: [AdminFeatureFlagsController, AdminSystemConfigsController],
  providers: [SettingsService, SettingsSerializer],
})
export class AdminSettingsModule {}
