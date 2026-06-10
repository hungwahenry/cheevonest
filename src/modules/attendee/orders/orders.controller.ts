import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Paginated } from '../../../common/responses/paginated';
import { toNumber } from '../../../common/validation/transforms';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { EventsService } from '../../events/events.service';
import { OrderSerializer } from '../../orders/serializers/order.serializer';
import { OrderQuotingService } from '../../orders/services/order-quoting.service';
import { OrdersService } from '../../orders/services/orders.service';
import { CreateOrderDto, QuoteOrderDto, VerifyOrderDto } from './dto/order.dto';

class ListOrdersDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  per_page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;
}

@Controller('attendee')
export class AttendeeOrdersController {
  constructor(
    private readonly events: EventsService,
    private readonly orders: OrdersService,
    private readonly quoting: OrderQuotingService,
    private readonly serializer: OrderSerializer,
  ) {}

  @Post('events/:eventId/orders/quote')
  @HttpCode(200)
  async quote(
    @Param('eventId') eventId: string,
    @Body() dto: QuoteOrderDto,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);

    return this.serializer.quote(await this.quoting.quote(event, dto.items));
  }

  @Post('events/:eventId/orders')
  @HttpCode(200)
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);
    const result = await this.orders.create(
      user,
      event,
      dto.items,
      dto.callback_url,
      dto.provider,
    );

    return {
      order: this.serializer.order(result.order),
      authorization_url: result.authorizationUrl,
    };
  }

  @Get('orders')
  async list(
    @Query() dto: ListOrdersDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 20, 50);

    const result = await this.orders.listFor(user.id, page, perPage);

    return new Paginated(
      result.items.map((order) => this.serializer.order(order)),
      page,
      perPage,
      result.total,
    );
  }

  @Get('orders/:orderId')
  async show(
    @Param('orderId') orderId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    await this.orders.findOwnedOrFail(orderId, user.id);

    return this.serializer.order(await this.orders.loadForResource(orderId));
  }

  @Post('orders/:orderId/verify')
  @HttpCode(200)
  async verify(
    @Param('orderId') orderId: string,
    @Body() dto: VerifyOrderDto,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const order = await this.orders.findOwnedOrFail(orderId, user.id);

    return this.serializer.order(
      await this.orders.verifyWithProvider(order, dto.lookup_key),
    );
  }

  @Post('orders/:orderId/cancel')
  @HttpCode(200)
  async cancel(
    @Param('orderId') orderId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    await this.orders.findOwnedOrFail(orderId, user.id);

    return this.serializer.order(await this.orders.cancel(orderId));
  }
}
