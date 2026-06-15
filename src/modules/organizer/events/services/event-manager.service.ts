import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { Event, User } from '../../../../generated/prisma/client';
import { StorageService } from '../../../../integrations/storage/storage.service';
import { SearchIndexerService } from '../../../search/services/search-indexer.service';
import {
  EventForResource,
  EventsService,
} from '../../../events/events.service';
import { ensureEventNotEnded } from '../../../events/rules/event.rules';
import { CreateEventDto } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';
import { CannotDeleteWithSalesException } from '../exceptions/cannot-delete-with-sales.exception';
import { EventInterestRules } from '../rules/event-interests.rules';
import {
  ensureValidFlyer,
  ensureValidFlyerPoster,
  flyerTypeFor,
} from '../rules/media.rules';
import {
  ensureAfterOrEqual,
  ensureBeforeOrEqual,
  ensureFuture,
  ensureValidTimezone,
  parseEventDate,
} from '../rules/schedule.rules';

const DEFAULT_TIMEZONE = 'Africa/Lagos';

@Injectable()
export class EventManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: EventsService,
    private readonly interestRules: EventInterestRules,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  async create(user: User, dto: CreateEventDto): Promise<EventForResource> {
    const membership = await this.prisma.organisationMember.findFirstOrThrow({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    const timezone = dto.timezone || DEFAULT_TIMEZONE;

    if (dto.timezone) {
      ensureValidTimezone(dto.timezone);
    }

    const startsAt = this.parseOptional(dto.starts_at, timezone, 'starts_at');
    const endsAt = this.parseOptional(dto.ends_at, timezone, 'ends_at');
    ensureAfterOrEqual(
      endsAt,
      startsAt,
      'ends_at',
      'The ends_at must be a date after or equal to starts_at.',
    );

    const flyer = await this.storeFlyer(dto);

    const interestIds =
      dto.interests !== undefined
        ? await this.interestRules.resolveSlugs(dto.interests ?? [])
        : null;

    const eventId = ulid();

    await this.prisma.$transaction(async (tx) => {
      await tx.event.create({
        data: {
          id: eventId,
          organisationId: membership.organisationId,
          title: dto.title,
          slug: await this.uniqueSlug(dto.title),
          description: dto.description ?? null,
          startsAt,
          endsAt,
          timezone,
          venueName: dto.venue_name ?? null,
          placeId: dto.place_id ?? null,
          address: dto.address ?? null,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          city: dto.city ?? null,
          videoUrl: dto.video_url ?? null,
          ...(flyer
            ? {
                flyerPath: flyer.flyerPath,
                flyerType: flyer.flyerType,
                flyerPosterPath: flyer.flyerPosterPath,
              }
            : {}),
        },
      });

      await tx.organisation.update({
        where: { id: membership.organisationId },
        data: { eventsCount: { increment: 1 } },
      });

      if (interestIds !== null && interestIds.length > 0) {
        await tx.eventInterest.createMany({
          data: interestIds.map((interestId) => ({ eventId, interestId })),
        });
      }
    });

    const created = await this.events.loadForResource(eventId);
    await this.searchIndexer.indexEvent(created);

    return created;
  }

  async update(event: Event, dto: UpdateEventDto): Promise<EventForResource> {
    ensureEventNotEnded(event);

    const timezone = dto.timezone || event.timezone;

    if (dto.timezone) {
      ensureValidTimezone(dto.timezone);
    }

    const data: Prisma.EventUncheckedUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.timezone !== undefined && dto.timezone !== null) {
      data.timezone = dto.timezone;
    }
    if (dto.venue_name !== undefined) data.venueName = dto.venue_name;
    if (dto.place_id !== undefined) data.placeId = dto.place_id;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.video_url !== undefined) data.videoUrl = dto.video_url;

    const startsAt =
      dto.starts_at !== undefined
        ? this.parseOptional(dto.starts_at, timezone, 'starts_at')
        : undefined;
    const endsAt =
      dto.ends_at !== undefined
        ? this.parseOptional(dto.ends_at, timezone, 'ends_at')
        : undefined;

    ensureAfterOrEqual(
      endsAt ?? undefined,
      startsAt ?? undefined,
      'ends_at',
      'The ends_at must be a date after or equal to starts_at.',
    );

    if (startsAt !== undefined) data.startsAt = startsAt;
    if (endsAt !== undefined) data.endsAt = endsAt;

    if (dto.presale_until !== undefined) {
      const presaleUntil = this.parseOptional(
        dto.presale_until,
        timezone,
        'presale_until',
      );

      ensureFuture(
        presaleUntil,
        'presale_until',
        'The presale_until must be a date after now.',
      );
      ensureBeforeOrEqual(
        presaleUntil,
        startsAt ?? event.startsAt,
        'presale_until',
        'The presale_until must be a date before or equal to starts_at.',
      );

      data.presaleUntil = presaleUntil;
    }

    const flyer = await this.storeFlyer(dto);

    if (flyer) {
      if (event.flyerPath !== null) {
        await this.storage.delete(event.flyerPath);
      }
      if (event.flyerPosterPath !== null) {
        await this.storage.delete(event.flyerPosterPath);
      }
      data.flyerPath = flyer.flyerPath;
      data.flyerType = flyer.flyerType;
      data.flyerPosterPath = flyer.flyerPosterPath;
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.event.update({ where: { id: event.id }, data });
      }

      if (dto.interests !== undefined) {
        const interestIds = await this.interestRules.resolveSlugs(
          dto.interests ?? [],
        );

        await tx.eventInterest.deleteMany({ where: { eventId: event.id } });

        if (interestIds.length > 0) {
          await tx.eventInterest.createMany({
            data: interestIds.map((interestId) => ({
              eventId: event.id,
              interestId,
            })),
          });
        }
      }
    });

    const updated = await this.events.loadForResource(event.id);
    await this.searchIndexer.indexEvent(updated);

    return updated;
  }

  async delete(event: Event): Promise<void> {
    if (event.ticketsSold > 0) {
      throw new CannotDeleteWithSalesException();
    }

    await this.events.purge(event);
  }

  async uniqueSlug(title: string): Promise<string> {
    const base = this.slugify(title) || 'event';
    let slug = base;
    let suffix = 2;

    while (
      await this.prisma.event.findUnique({
        where: { slug },
        select: { id: true },
      })
    ) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private parseOptional(
    value: string | null | undefined,
    timezone: string,
    field: string,
  ): Date | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    return parseEventDate(value, timezone, field);
  }

  private async storeFlyer(dto: CreateEventDto | UpdateEventDto): Promise<{
    flyerPath: string;
    flyerType: 'image' | 'video';
    flyerPosterPath: string | null;
  } | null> {
    if (!dto.flyer) {
      return null;
    }

    ensureValidFlyer(dto.flyer);
    const flyerType = flyerTypeFor(dto.flyer);
    const flyerPath = await this.storage.put(dto.flyer, 'flyers');

    let flyerPosterPath: string | null = null;
    if (flyerType === 'video' && dto.flyer_poster) {
      ensureValidFlyerPoster(dto.flyer_poster);
      flyerPosterPath = await this.storage.put(dto.flyer_poster, 'flyers');
    }

    return { flyerPath, flyerType, flyerPosterPath };
  }
}
