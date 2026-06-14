import { Module } from '@nestjs/common';
import { WelcomeModule } from '../../platform/welcome/welcome.module';
import { AdminPagesController } from './controllers/admin-pages.controller';
import { AdminWelcomeController } from './controllers/admin-welcome.controller';
import { AdminContentSerializer } from './serializers/admin-content.serializer';
import { AdminPagesService } from './services/admin-pages.service';

@Module({
  imports: [WelcomeModule],
  controllers: [AdminPagesController, AdminWelcomeController],
  providers: [AdminPagesService, AdminContentSerializer],
})
export class AdminContentModule {}
