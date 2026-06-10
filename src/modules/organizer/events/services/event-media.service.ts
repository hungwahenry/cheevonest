import { Injectable, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import { ValidationFailedException } from '../../../../common/exceptions/api.exception';
import { UploadedFile } from '../../../../common/http/uploaded-file';
import { ensureValidImage } from '../../../../common/validation/image.rules';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type {
  Event,
  EventFeature,
  EventImage,
} from '../../../../generated/prisma/client';
import { StorageService } from '../../../../integrations/storage/storage.service';
import { ensureEventNotEnded } from '../../../events/rules/event.rules';
import { CreateFeatureDto, UpdateFeatureDto } from '../dto/feature.dto';
import { ensureValidEventImage } from '../rules/media.rules';
import { ensureAfterOrEqual, parseEventDate } from '../rules/schedule.rules';

const FEATURE_IMAGE_MAX_KB = 8192;

@Injectable()
export class EventMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async addImage(event: Event, file?: UploadedFile): Promise<EventImage> {
    ensureEventNotEnded(event);

    if (!file) {
      throw new ValidationFailedException({
        image: ['The image field is required.'],
      });
    }

    ensureValidEventImage(file);

    return this.prisma.eventImage.create({
      data: {
        id: ulid(),
        eventId: event.id,
        path: await this.storage.put(file, 'event-images'),
        sortOrder: (await this.maxSortOrder('eventImage', event.id)) + 1,
      },
    });
  }

  async deleteImage(event: Event, imageId: string): Promise<void> {
    ensureEventNotEnded(event);

    const image = await this.prisma.eventImage.findFirst({
      where: { id: imageId, eventId: event.id },
    });

    if (!image) {
      throw new NotFoundException();
    }

    await this.storage.delete(image.path);
    await this.prisma.eventImage.delete({ where: { id: image.id } });
  }

  async reorderImages(event: Event, ids: string[]): Promise<void> {
    ensureEventNotEnded(event);

    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.eventImage.updateMany({
          where: { id, eventId: event.id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
  }

  async createFeature(
    event: Event,
    dto: CreateFeatureDto,
  ): Promise<EventFeature> {
    ensureEventNotEnded(event);

    const { startsAt, endsAt } = this.parseFeatureDates(event, dto);
    const imagePath = await this.storeFeatureImage(dto.image);

    return this.prisma.eventFeature.create({
      data: {
        id: ulid(),
        eventId: event.id,
        title: dto.title,
        description: dto.description ?? null,
        link: dto.link ?? null,
        startsAt: startsAt ?? null,
        endsAt: endsAt ?? null,
        imagePath,
        sortOrder: (await this.maxSortOrder('eventFeature', event.id)) + 1,
      },
    });
  }

  async updateFeature(
    event: Event,
    featureId: string,
    dto: UpdateFeatureDto,
  ): Promise<EventFeature> {
    ensureEventNotEnded(event);

    const feature = await this.prisma.eventFeature.findFirst({
      where: { id: featureId, eventId: event.id },
    });

    if (!feature) {
      throw new NotFoundException();
    }

    const { startsAt, endsAt } = this.parseFeatureDates(event, dto);
    const data: Prisma.EventFeatureUncheckedUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.link !== undefined) data.link = dto.link;
    if (dto.starts_at !== undefined) data.startsAt = startsAt;
    if (dto.ends_at !== undefined) data.endsAt = endsAt;

    if (dto.image) {
      if (feature.imagePath !== null) {
        await this.storage.delete(feature.imagePath);
      }
      data.imagePath = await this.storeFeatureImage(dto.image);
    }

    return this.prisma.eventFeature.update({
      where: { id: feature.id },
      data,
    });
  }

  async deleteFeature(event: Event, featureId: string): Promise<void> {
    ensureEventNotEnded(event);

    const feature = await this.prisma.eventFeature.findFirst({
      where: { id: featureId, eventId: event.id },
    });

    if (!feature) {
      throw new NotFoundException();
    }

    if (feature.imagePath !== null) {
      await this.storage.delete(feature.imagePath);
    }

    await this.prisma.eventFeature.delete({ where: { id: feature.id } });
  }

  async reorderFeatures(event: Event, ids: string[]): Promise<void> {
    ensureEventNotEnded(event);

    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.eventFeature.updateMany({
          where: { id, eventId: event.id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
  }

  private parseFeatureDates(
    event: Event,
    dto: CreateFeatureDto | UpdateFeatureDto,
  ): { startsAt: Date | null; endsAt: Date | null } {
    const timezone = event.timezone || 'Africa/Lagos';

    const startsAt =
      dto.starts_at != null && dto.starts_at !== ''
        ? parseEventDate(dto.starts_at, timezone, 'starts_at')
        : null;
    const endsAt =
      dto.ends_at != null && dto.ends_at !== ''
        ? parseEventDate(dto.ends_at, timezone, 'ends_at')
        : null;

    ensureAfterOrEqual(
      endsAt,
      startsAt,
      'ends_at',
      'The ends_at must be a date after or equal to starts_at.',
    );

    return { startsAt, endsAt };
  }

  private async storeFeatureImage(file?: UploadedFile): Promise<string | null> {
    if (!file) {
      return null;
    }

    ensureValidImage(file, 'image', FEATURE_IMAGE_MAX_KB);

    return this.storage.put(file, 'event-features');
  }

  private async maxSortOrder(
    model: 'eventImage' | 'eventFeature',
    eventId: string,
  ): Promise<number> {
    if (model === 'eventImage') {
      const result = await this.prisma.eventImage.aggregate({
        where: { eventId },
        _max: { sortOrder: true },
      });

      return result._max.sortOrder ?? 0;
    }

    const result = await this.prisma.eventFeature.aggregate({
      where: { eventId },
      _max: { sortOrder: true },
    });

    return result._max.sortOrder ?? 0;
  }
}
