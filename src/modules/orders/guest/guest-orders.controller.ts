import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/auth.decorators';
import { EventsService } from '../../events/events.service';
import { OrderSerializer } from '../serializers/order.serializer';
import { GuestCheckoutDto, GuestQuoteDto } from './dto/guest-checkout.dto';
import { GuestOrdersService } from './guest-orders.service';

@Public()
@Controller()
export class GuestOrdersController {
  constructor(
    private readonly events: EventsService,
    private readonly guest: GuestOrdersService,
    private readonly serializer: OrderSerializer,
  ) {}

  @Post('events/:eventId/guest-orders/quote')
  @HttpCode(200)
  async quote(
    @Param('eventId') eventId: string,
    @Body() dto: GuestQuoteDto,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);

    return this.serializer.quote(await this.guest.quote(event, dto.items));
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('events/:eventId/guest-orders')
  @HttpCode(200)
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: GuestCheckoutDto,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);
    const result = await this.guest.checkout(event, {
      email: dto.email,
      firstName: dto.first_name ?? null,
      lastName: dto.last_name ?? null,
      items: dto.items,
      callbackUrl: dto.callback_url,
      provider: dto.provider,
    });

    return {
      order: this.serializer.order(result.order),
      access_token: result.order.accessToken,
      authorization_url: result.authorizationUrl,
    };
  }

  @Get('orders/token/:token')
  async view(@Param('token') token: string): Promise<unknown> {
    return this.serializer.order(await this.guest.view(token));
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('orders/token/:token/verify')
  @HttpCode(200)
  async verify(@Param('token') token: string): Promise<unknown> {
    return this.serializer.order(await this.guest.verify(token));
  }
}
