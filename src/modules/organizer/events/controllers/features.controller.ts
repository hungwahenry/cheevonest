import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import type { User } from '../../../../generated/prisma/client';
import { CurrentUser } from '../../../auth/decorators/auth.decorators';
import { EventsPolicy } from '../../../events/events.policy';
import { EventsService } from '../../../events/events.service';
import { EventSerializer } from '../../../events/serializers/event.serializer';
import { CreateFeatureDto, UpdateFeatureDto } from '../dto/feature.dto';
import { ReorderDto } from '../dto/reorder.dto';
import { EventMediaService } from '../services/event-media.service';

@Controller('organizer/events/:eventId/features')
export class FeaturesController {
  constructor(
    private readonly events: EventsService,
    private readonly policy: EventsPolicy,
    private readonly media: EventMediaService,
    private readonly serializer: EventSerializer,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateFeatureDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const feature = await this.media.createFeature(event, dto);

    return new ApiResult(this.serializer.feature(feature), 'Feature added.');
  }

  @Patch('reorder')
  async reorder(
    @Param('eventId') eventId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    await this.media.reorderFeatures(event, dto.ids);

    return new ApiResult(
      this.serializer.full(await this.events.loadForResource(event.id)),
      'Features reordered.',
    );
  }

  @Put(':featureId')
  async replace(
    @Param('eventId') eventId: string,
    @Param('featureId') featureId: string,
    @Body() dto: UpdateFeatureDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    return this.update(eventId, featureId, dto, user);
  }

  @Patch(':featureId')
  async update(
    @Param('eventId') eventId: string,
    @Param('featureId') featureId: string,
    @Body() dto: UpdateFeatureDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const feature = await this.media.updateFeature(event, featureId, dto);

    return new ApiResult(this.serializer.feature(feature), 'Feature updated.');
  }

  @Delete(':featureId')
  @HttpCode(200)
  async remove(
    @Param('eventId') eventId: string,
    @Param('featureId') featureId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    await this.media.deleteFeature(event, featureId);

    return new ApiResult(null, 'Feature removed.');
  }
}
