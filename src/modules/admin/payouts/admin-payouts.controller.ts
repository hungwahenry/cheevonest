import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiResult } from '../../../common/responses/api-result';
import { Paginated } from '../../../common/responses/paginated';
import { toNumber } from '../../../common/validation/transforms';
import type { PayoutStatus, User } from '../../../generated/prisma/client';
import { CurrentUser, Roles } from '../../auth/decorators/auth.decorators';
import { PayoutsService } from '../../payouts/services/payouts.service';
import { AdminPayoutSerializer } from './admin-payout.serializer';
import { AdminPayoutsService } from './admin-payouts.service';

const PAYOUT_STATUSES = [
  'requested',
  'approved',
  'processing',
  'paid',
  'rejected',
  'failed',
];

class ListAdminPayoutsDto {
  @IsOptional()
  @IsIn(PAYOUT_STATUSES)
  status?: PayoutStatus;

  @IsOptional()
  @IsString()
  @Length(26, 26)
  organisation_id?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;
}

class ApprovePayoutDto {
  @IsIn(['provider', 'manual'])
  method!: 'provider' | 'manual';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

class ReviewNoteDto {
  @IsString()
  @MaxLength(1000)
  note!: string;
}

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

  @Post(':payoutId/approve')
  @HttpCode(200)
  async approve(
    @Param('payoutId') payoutId: string,
    @Body() dto: ApprovePayoutDto,
    @CurrentUser() admin: User,
  ): Promise<ApiResult<unknown>> {
    const payout = await this.payouts.findOrFail(payoutId);

    const approved =
      dto.method === 'provider'
        ? await this.payouts.approveWithProvider(
            payout,
            admin,
            dto.note ?? null,
          )
        : await this.payouts.approveManually(payout, admin, dto.note ?? null);

    return new ApiResult(
      this.serializer.payout(await this.adminPayouts.loadOne(approved.id)),
      dto.method === 'provider'
        ? 'Payout approved and transfer initiated.'
        : 'Payout approved for manual processing.',
    );
  }

  @Post(':payoutId/reject')
  @HttpCode(200)
  async reject(
    @Param('payoutId') payoutId: string,
    @Body() dto: ReviewNoteDto,
    @CurrentUser() admin: User,
  ): Promise<ApiResult<unknown>> {
    const payout = await this.payouts.findOrFail(payoutId);
    const rejected = await this.payouts.reject(payout, admin, dto.note);

    return new ApiResult(
      this.serializer.payout(await this.adminPayouts.loadOne(rejected.id)),
      'Payout rejected.',
    );
  }

  @Post(':payoutId/mark-paid')
  @HttpCode(200)
  async markPaid(
    @Param('payoutId') payoutId: string,
    @Body() dto: ReviewNoteDto,
    @CurrentUser() admin: User,
  ): Promise<ApiResult<unknown>> {
    const payout = await this.payouts.findOrFail(payoutId);
    const paid = await this.payouts.markPaid(payout, admin, dto.note);

    return new ApiResult(
      this.serializer.payout(await this.adminPayouts.loadOne(paid.id)),
      'Payout marked paid.',
    );
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
}
