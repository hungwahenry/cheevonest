import { Module } from '@nestjs/common';
import { AdminCategoriesController } from './controllers/categories.controller';
import { AdminInterestsController } from './controllers/interests.controller';
import { AdminPlatformsController } from './controllers/platforms.controller';
import { AdminReportReasonsController } from './controllers/report-reasons.controller';
import { CatalogSerializer } from './serializers/catalog.serializer';
import { CatalogService } from './services/catalog.service';

@Module({
  controllers: [
    AdminInterestsController,
    AdminCategoriesController,
    AdminPlatformsController,
    AdminReportReasonsController,
  ],
  providers: [CatalogService, CatalogSerializer],
})
export class AdminCatalogsModule {}
