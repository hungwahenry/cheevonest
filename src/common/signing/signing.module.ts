import { Global, Module } from '@nestjs/common';
import { UrlSignerService } from './url-signer.service';

@Global()
@Module({
  providers: [UrlSignerService],
  exports: [UrlSignerService],
})
export class SigningModule {}
