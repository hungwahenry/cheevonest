import { Global, Module } from '@nestjs/common';
import { HtmlPagesService } from './html-pages.service';

@Global()
@Module({
  providers: [HtmlPagesService],
  exports: [HtmlPagesService],
})
export class HtmlPagesModule {}
