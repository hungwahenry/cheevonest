import { Global, Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { SystemConfigRepository } from './system-config.repository';
import { SystemConfigService } from './system-config.service';

@Global()
@Module({
  providers: [SystemConfigRepository, SystemConfigService, FeatureFlagsService],
  exports: [SystemConfigRepository, SystemConfigService, FeatureFlagsService],
})
export class SystemConfigModule {}
