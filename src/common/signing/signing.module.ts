import { Global, Module } from '@nestjs/common';
import { SignedUrlGuard } from './signed-url.guard';
import { UrlSignerService } from './url-signer.service';

@Global()
@Module({
  providers: [UrlSignerService, SignedUrlGuard],
  exports: [UrlSignerService, SignedUrlGuard],
})
export class SigningModule {}
