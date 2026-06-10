import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Paginated } from '../../../../common/responses/paginated';
import { PrismaService } from '../../../../database/prisma.service';
import { EventStatus, Prisma } from '../../../../generated/prisma/client';
import type { User } from '../../../../generated/prisma/client';
import { CurrentUser } from '../../../auth/decorators/auth.decorators';
import { EventsPolicy } from '../../../events/events.policy';
import {
  EVENT_RESOURCE_INCLUDE,
  EventsService,
} from '../../../events/events.service';
import { EventSerializer } from '../../../events/serializers/event.serializer';
import { CreateEventDto } from '../dto/create-event.dto';
import { ListEventsDto } from '../dto/list-events.dto';
import { UpdateEventDto } from '../dto/update-event.dto';
import { EventDuplicatorService } from '../services/event-duplicator.service';
import { EventManagerService } from '../services/event-manager.service';
import { EventPublisherService } from '../services/event-publisher.service';

@Controller('organizer/events')
export class EventsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly policy: EventsPolicy,
    private readonly manager: EventManagerService,
    private readonly publisher: EventPublisherService,
    private readonly duplicator: EventDuplicatorService,
    private readonly serializer: EventSerializer,
  ) {}

  @Get()
  async list(
    @Query() dto: ListEventsDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const perPage = Math.min(dto.per_page ?? 20, 100);
    const page = dto.page ?? 1;
    const search = dto.q?.trim() ?? '';
    const status =
      dto.status &&
      Object.values(EventStatus).includes(dto.status as EventStatus)
        ? (dto.status as EventStatus)
        : undefined;

    const where: Prisma.EventWhereInput = {
      organisation: { members: { some: { userId: user.id } } },
      ...(status ? { status } : {}),
      ...(search !== ''
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              { venueName: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: EVENT_RESOURCE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return new Paginated(
      rows.map((event) => this.serializer.full(event)),
      page,
      perPage,
      total,
    );
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    await this.policy.ensureCanCreate(user.id);

    const event = await this.manager.create(user, dto);

    return new ApiResult(this.serializer.full(event), 'Event created.');
  }

  @Get(':eventId')
  async show(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    return new ApiResult(
      this.serializer.full(await this.events.loadForResource(event.id)),
    );
  }

  @Put(':eventId')
  async replace(
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    return this.update(eventId, dto, user);
  }

  @Patch(':eventId')
  async update(
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const updated = await this.manager.update(event, dto);

    return new ApiResult(this.serializer.full(updated), 'Event updated.');
  }

  @Post(':eventId/publish')
  @HttpCode(200)
  async publish(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const published = await this.publisher.publish(event);

    return new ApiResult(this.serializer.full(published), 'Event published.');
  }

  @Post(':eventId/duplicate')
  @HttpCode(201)
  async duplicate(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const clone = await this.duplicator.duplicate(event);

    return new ApiResult(this.serializer.full(clone), 'Event duplicated.');
  }

  @Delete(':eventId')
  @HttpCode(200)
  async remove(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    await this.manager.delete(event);

    return new ApiResult(null, 'Event deleted.');
  }
}
