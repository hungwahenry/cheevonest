import { Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import type { User } from '../../../../generated/prisma/client';
import { CurrentUser } from '../../../auth/decorators/auth.decorators';
import { OrganisationSerializer } from '../../../organisations/organisation.serializer';
import { OrganisationsService } from '../../../organisations/organisations.service';
import { SubscriptionsService } from '../services/subscriptions.service';

@Controller('attendee/organisations/:organisationId/subscribe')
export class SubscriptionsController {
  constructor(
    private readonly organisations: OrganisationsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly serializer: OrganisationSerializer,
  ) {}

  @Post()
  @HttpCode(200)
  async subscribe(
    @Param('organisationId') organisationId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const organisation = await this.organisations.findOrFail(organisationId);

    await this.subscriptions.subscribe(user, organisation);

    return new ApiResult(
      this.serializer.bare(await this.organisations.findOrFail(organisationId)),
      'Subscribed.',
    );
  }

  @Delete()
  @HttpCode(200)
  async unsubscribe(
    @Param('organisationId') organisationId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const organisation = await this.organisations.findOrFail(organisationId);

    await this.subscriptions.unsubscribe(user.id, organisation.id);

    return new ApiResult(
      this.serializer.bare(await this.organisations.findOrFail(organisationId)),
      'Unsubscribed.',
    );
  }
}
