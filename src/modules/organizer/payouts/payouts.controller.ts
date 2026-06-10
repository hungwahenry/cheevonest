import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiResult } from '../../../common/responses/api-result';
import { Paginated } from '../../../common/responses/paginated';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { OrganisationsPolicy } from '../../organisations/organisations.policy';
import { OrganisationsService } from '../../organisations/organisations.service';
import { PayoutSerializer } from '../../payouts/serializers/payout.serializer';
import { BalanceService } from '../../payouts/services/balance.service';
import { PayoutAccountsService } from '../../payouts/services/payout-accounts.service';
import { PayoutsService } from '../../payouts/services/payouts.service';
import {
  ListPayoutsDto,
  RequestPayoutDto,
  UpsertPayoutAccountDto,
} from './dto/payouts.dto';

@Controller('organizer/organisations/:organisationId')
export class OrganizerPayoutsController {
  constructor(
    private readonly organisations: OrganisationsService,
    private readonly policy: OrganisationsPolicy,
    private readonly accounts: PayoutAccountsService,
    private readonly payouts: PayoutsService,
    private readonly balance: BalanceService,
    private readonly serializer: PayoutSerializer,
  ) {}

  @Get('payout-account')
  async showAccount(
    @Param('organisationId') organisationId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const organisation = await this.organisations.findOrFail(organisationId);
    await this.policy.assertManage(organisation.id, user.id);

    const account = await this.accounts.find(organisation.id);

    return account ? this.serializer.account(account) : null;
  }

  @Put('payout-account')
  async upsertAccount(
    @Param('organisationId') organisationId: string,
    @Body() dto: UpsertPayoutAccountDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const organisation = await this.organisations.findOrFail(organisationId);
    await this.policy.assertManage(organisation.id, user.id);

    const account = await this.accounts.upsert(
      organisation,
      dto.bank_code,
      dto.account_number,
    );

    return new ApiResult(
      this.serializer.account(account),
      'Payout account saved.',
    );
  }

  @Delete('payout-account')
  @HttpCode(200)
  async deleteAccount(
    @Param('organisationId') organisationId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    const organisation = await this.organisations.findOrFail(organisationId);
    await this.policy.assertManage(organisation.id, user.id);

    await this.accounts.delete(organisation.id);

    return new ApiResult(null, 'Payout account removed.');
  }

  @Get('balance')
  async showBalance(
    @Param('organisationId') organisationId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const organisation = await this.organisations.findOrFail(organisationId);
    await this.policy.assertView(organisation.id, user.id);

    return this.balance.summary(organisation);
  }

  @Get('payouts')
  async list(
    @Param('organisationId') organisationId: string,
    @Query() dto: ListPayoutsDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const organisation = await this.organisations.findOrFail(organisationId);
    await this.policy.assertView(organisation.id, user.id);

    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 20, 50);

    const result = await this.payouts.pageForOrganisation(
      organisation.id,
      page,
      perPage,
    );

    return new Paginated(
      result.items.map((payout) => this.serializer.payout(payout)),
      page,
      perPage,
      result.total,
    );
  }

  @Post('payouts')
  @HttpCode(201)
  async request(
    @Param('organisationId') organisationId: string,
    @Body() dto: RequestPayoutDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const organisation = await this.organisations.findOrFail(organisationId);
    await this.policy.assertManage(organisation.id, user.id);

    const payout = await this.payouts.request(
      organisation,
      user,
      dto.amount_minor,
    );

    return new ApiResult(this.serializer.payout(payout), 'Payout requested.');
  }

  @Get('payouts/:payoutId')
  async show(
    @Param('organisationId') organisationId: string,
    @Param('payoutId') payoutId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const organisation = await this.organisations.findOrFail(organisationId);
    await this.policy.assertView(organisation.id, user.id);

    const payout = await this.payouts.findScoped(organisation.id, payoutId);

    return this.serializer.payout(payout);
  }
}
