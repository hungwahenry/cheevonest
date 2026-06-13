import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { Paginated } from '../../../../common/responses/paginated';
import type { User } from '../../../../generated/prisma/client';
import { CurrentUser } from '../../../auth/decorators/auth.decorators';
import { EventsPolicy } from '../../../events/events.policy';
import { EventsService } from '../../../events/events.service';
import { EventReportingSerializer } from '../serializers/event-reporting.serializer';
import { EventAnalyticsService } from '../services/event-analytics.service';
import { EventReportingService } from '../services/event-reporting.service';
import { EventSalesService } from '../services/event-sales.service';
import { ReportingPageDto } from '../dto/reporting-page.dto';

@Controller('organizer/events/:eventId')
export class EventAnalyticsController {
  constructor(
    private readonly events: EventsService,
    private readonly policy: EventsPolicy,
    private readonly analytics: EventAnalyticsService,
    private readonly sales: EventSalesService,
    private readonly reporting: EventReportingService,
    private readonly serializer: EventReportingSerializer,
  ) {}

  @Get('analytics')
  async analyticsSummary(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    return this.analytics.summary(event);
  }

  @Get('sales')
  async salesSummary(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    return this.sales.summary(event);
  }

  @Get('orders')
  async orders(
    @Param('eventId') eventId: string,
    @Query() dto: ReportingPageDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 20, 50);

    const result = await this.reporting.ordersPage(event.id, {
      page,
      perPage,
      status: dto.status,
    });

    return new Paginated(
      result.items.map((order) => this.serializer.order(order)),
      page,
      perPage,
      result.total,
    );
  }

  @Get('orders/:orderId')
  async order(
    @Param('eventId') eventId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const order = await this.reporting.orderOne(event.id, orderId);

    if (!order) {
      throw new NotFoundException();
    }

    return this.serializer.order(order);
  }

  @Get('rsvps')
  async rsvps(
    @Param('eventId') eventId: string,
    @Query() dto: ReportingPageDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 20, 50);

    const result = await this.reporting.rsvpsPage(event.id, { page, perPage });

    return new Paginated(
      result.items.map((rsvp) => this.serializer.rsvp(rsvp)),
      page,
      perPage,
      result.total,
    );
  }
}
