import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { OrdersModule } from '../../orders/orders.module';
import { OrganisationsModule } from '../../organisations/organisations.module';
import { UsersModule } from '../../users/users.module';
import { DashboardController } from './controllers/dashboard.controller';
import { EventAnalyticsController } from './controllers/event-analytics.controller';
import { EventReportingSerializer } from './serializers/event-reporting.serializer';
import { DashboardService } from './services/dashboard.service';
import { EventAnalyticsService } from './services/event-analytics.service';
import { EventReportingService } from './services/event-reporting.service';
import { EventSalesService } from './services/event-sales.service';

@Module({
  imports: [OrganisationsModule, EventsModule, OrdersModule, UsersModule],
  controllers: [DashboardController, EventAnalyticsController],
  providers: [
    DashboardService,
    EventAnalyticsService,
    EventSalesService,
    EventReportingService,
    EventReportingSerializer,
  ],
  exports: [EventReportingService],
})
export class OrganizerAnalyticsModule {}
