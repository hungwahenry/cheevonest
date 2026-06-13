import { Global, Module } from '@nestjs/common';
import { EntityRefBuilder } from './entity-ref.builder';

@Global()
@Module({
  providers: [EntityRefBuilder],
  exports: [EntityRefBuilder],
})
export class AdminCommonModule {}
