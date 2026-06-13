import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Paginated } from '../../../../common/responses/paginated';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import { ListPaymentsDto } from '../dto/admin-payments.dto';
import { AdminPaymentSerializer } from '../serializers/admin-payment.serializer';
import { AdminPaymentsService } from '../services/admin-payments.service';
import { PaymentModerationService } from '../services/payment-moderation.service';

@Roles('admin')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(
    private readonly payments: AdminPaymentsService,
    private readonly moderation: PaymentModerationService,
    private readonly serializer: AdminPaymentSerializer,
  ) {}

  @Get()
  async list(@Query() dto: ListPaymentsDto): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 25, 100);

    const result = await this.payments.page({
      page,
      perPage,
      status: dto.status,
      provider: dto.provider,
    });

    return new Paginated(
      result.items.map((payment) => this.serializer.row(payment)),
      page,
      perPage,
      result.total,
    );
  }

  @Get(':id')
  async show(@Param('id') id: string): Promise<unknown> {
    return this.serializer.detail(await this.payments.detail(id));
  }

  @Post(':id/resync')
  @HttpCode(200)
  @AuditAction('payments.resync')
  async resync(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const payment = await this.moderation.findOrFail(id);
    const before = payment.status;
    const updated = await this.moderation.resync(payment);

    audit({
      targetType: 'payment',
      targetId: payment.id,
      payload: { before, after: updated.status },
    });

    return new ApiResult(
      await this.serializer.detail(await this.payments.detail(id)),
      'Payment resynced.',
    );
  }

  @Post(':id/mark-success')
  @HttpCode(200)
  @AuditAction('payments.mark_success')
  async markSuccess(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<unknown>> {
    const payment = await this.moderation.findOrFail(id);
    await this.moderation.markSuccess(payment);

    audit({ targetType: 'payment', targetId: payment.id });

    return new ApiResult(
      await this.serializer.detail(await this.payments.detail(id)),
      'Payment marked successful.',
    );
  }
}
