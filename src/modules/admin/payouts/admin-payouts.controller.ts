import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { ApiResult } from '../../../common/responses/api-result';
import { Paginated } from '../../../common/responses/paginated';

import type { User } from '../../../generated/prisma/client';
import { CurrentUser, Roles } from '../../auth/decorators/auth.decorators';
import { PayoutsService } from '../../payouts/services/payouts.service';
import { AdminPayoutSerializer } from './admin-payout.serializer';
import { AdminPayoutsService } from './admin-payouts.service';
import {
  ListAdminPayoutsDto,
  ReviewPayoutDto,
} from './dto/admin-payouts.dto';

@Roles('admin')
@Controller('admin/payouts')
export class AdminPayoutsController {
  constructor(
    private readonly payouts: PayoutsService,
    private readonly adminPayouts: AdminPayoutsService,
    private readonly serializer: AdminPayoutSerializer,
  ) {}

  @Get()
  async list(@Query() dto: ListAdminPayoutsDto): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = dto.per_page ?? 25;

    const result = await this.adminPayouts.page({
      page,
      perPage,
      status: dto.status,
      organisationId: dto.organisation_id,
      from: dto.from,
      to: dto.to,
    });

    return new Paginated(
      result.items.map((payout) => this.serializer.payout(payout)),
      page,
      perPage,
      result.total,
    );
  }

  @Get(':payoutId')
  async show(@Param('payoutId') payoutId: string): Promise<unknown> {
    await this.payouts.findOrFail(payoutId);

    return this.serializer.payout(await this.adminPayouts.loadOne(payoutId));
  }

  @Post(':payoutId/retry')
  @HttpCode(200)
  async retry(
    @Param('payoutId') payoutId: string,
    @CurrentUser() admin: User,
  ): Promise<ApiResult<unknown>> {
    const payout = await this.payouts.findOrFail(payoutId);
    const retried = await this.payouts.retry(payout, admin);

    return new ApiResult(
      this.serializer.payout(await this.adminPayouts.loadOne(retried.id)),
      'Payout transfer re-initiated.',
    );
  }

  @Post(':payoutId/approve')
  @HttpCode(200)
  async approve(
    @Param('payoutId') payoutId: string,
    @CurrentUser() admin: User,
  ): Promise<ApiResult<unknown>> {
    const payout = await this.payouts.findOrFail(payoutId);
    const approved = await this.payouts.approve(payout, admin);

    return new ApiResult(
      this.serializer.payout(await this.adminPayouts.loadOne(approved.id)),
      'Payout approved.',
    );
  }

  @Post(':payoutId/reject')
  @HttpCode(200)
  async reject(
    @Param('payoutId') payoutId: string,
    @Body() dto: ReviewPayoutDto,
    @CurrentUser() admin: User,
  ): Promise<ApiResult<unknown>> {
    const payout = await this.payouts.findOrFail(payoutId);
    const rejected = await this.payouts.reject(payout, admin, dto.notes);

    return new ApiResult(
      this.serializer.payout(await this.adminPayouts.loadOne(rejected.id)),
      'Payout rejected.',
    );
  }
}
