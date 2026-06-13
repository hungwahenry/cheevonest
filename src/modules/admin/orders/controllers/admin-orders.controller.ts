import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Paginated } from '../../../../common/responses/paginated';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import { ListOrdersDto, RefundOrderDto } from '../dto/admin-orders.dto';
import { AdminOrderSerializer } from '../serializers/admin-order.serializer';
import { AdminOrdersService } from '../services/admin-orders.service';
import { OrderModerationService } from '../services/order-moderation.service';

@Roles('admin')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: AdminOrdersService,
    private readonly moderation: OrderModerationService,
    private readonly serializer: AdminOrderSerializer,
  ) {}

  @Get()
  async list(@Query() dto: ListOrdersDto): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 25, 100);

    const result = await this.orders.page({
      page,
      perPage,
      status: dto.status,
      eventId: dto.event_id,
    });

    return new Paginated(
      result.items.map((order) => this.serializer.row(order)),
      page,
      perPage,
      result.total,
    );
  }

  @Get(':id')
  async show(@Param('id') id: string): Promise<unknown> {
    return this.serializer.detail(await this.orders.detail(id));
  }

  @Post(':id/refund')
  @HttpCode(200)
  @AuditAction('orders.refund')
  async refund(
    @Param('id') id: string,
    @Body() dto: RefundOrderDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const order = await this.moderation.findOrFail(id);
    await this.moderation.refund(order, dto.amount_minor);

    audit({
      targetType: 'order',
      targetId: order.id,
      payload: { amount_minor: dto.amount_minor },
      reason: dto.reason,
    });

    return new ApiResult(
      await this.serializer.detail(await this.orders.detail(id)),
      'Order refunded.',
    );
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @AuditAction('orders.cancel')
  async cancel(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const order = await this.moderation.findOrFail(id);
    await this.moderation.cancel(order);

    audit({ targetType: 'order', targetId: order.id });

    return new ApiResult(
      await this.serializer.detail(await this.orders.detail(id)),
      'Order cancelled.',
    );
  }

  @Post(':id/mark-paid')
  @HttpCode(200)
  @AuditAction('orders.mark_paid')
  async markPaid(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const order = await this.moderation.findOrFail(id);
    await this.moderation.markPaid(order);

    audit({ targetType: 'order', targetId: order.id });

    return new ApiResult(
      await this.serializer.detail(await this.orders.detail(id)),
      'Order marked paid.',
    );
  }
}
