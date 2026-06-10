import { Global, Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { FeatureFlagsService } from './feature-flags.service';
import { FlagsController } from './flags.controller';
import { SystemConfigRepository } from './system-config.repository';
import { SystemConfigService } from './system-config.service';

@Global()
@Module({
  controllers: [ConfigController, FlagsController],
  providers: [SystemConfigRepository, SystemConfigService, FeatureFlagsService],
  exports: [SystemConfigRepository, SystemConfigService, FeatureFlagsService],
})
export class SystemConfigModule {}
