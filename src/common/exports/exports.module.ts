import { Global, Module } from '@nestjs/common';
import { ExportEngineService } from './export-engine.service';

@Global()
@Module({
  providers: [ExportEngineService],
  exports: [ExportEngineService],
})
export class ExportsEngineModule {}
