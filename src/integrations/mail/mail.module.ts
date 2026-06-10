import { Global, Module } from '@nestjs/common';
import { MailTemplatesService } from './mail-templates.service';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [MailService, MailTemplatesService],
  exports: [MailService],
})
export class MailModule {}
