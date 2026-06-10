import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { UploadedFile } from '../../../../common/http/uploaded-file';
import { ApiResult } from '../../../../common/responses/api-result';
import type { User } from '../../../../generated/prisma/client';
import { CurrentUser } from '../../../auth/decorators/auth.decorators';
import { EventsPolicy } from '../../../events/events.policy';
import { EventsService } from '../../../events/events.service';
import { EventSerializer } from '../../../events/serializers/event.serializer';
import { ReorderDto } from '../dto/reorder.dto';
import { EventMediaService } from '../services/event-media.service';

@Controller('organizer/events/:eventId/images')
export class ImagesController {
  constructor(
    private readonly events: EventsService,
    private readonly policy: EventsPolicy,
    private readonly media: EventMediaService,
    private readonly serializer: EventSerializer,
  ) {}

  @Post()
  @HttpCode(201)
  async add(
    @Param('eventId') eventId: string,
    @Body() body: { image?: UploadedFile },
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const image = await this.media.addImage(event, body.image);

    return new ApiResult(this.serializer.image(image), 'Image added.');
  }

  @Patch('reorder')
  async reorder(
    @Param('eventId') eventId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    await this.media.reorderImages(event, dto.ids);

    return new ApiResult(
      this.serializer.full(await this.events.loadForResource(event.id)),
      'Gallery reordered.',
    );
  }

  @Delete(':imageId')
  @HttpCode(200)
  async remove(
    @Param('eventId') eventId: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    await this.media.deleteImage(event, imageId);

    return new ApiResult(null, 'Image removed.');
  }
}
