import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../config/env';
import type {
  Event,
  EventFeature,
  EventImage,
  EventTicket,
  Interest,
  Organisation,
} from '../../../generated/prisma/client';
import { StorageService } from '../../../integrations/storage/storage.service';
import { OrganisationSerializer } from '../../organisations/organisation.serializer';
import { OrganisationForResource } from '../../organisations/organisations.service';
import { EventForResource } from '../events.service';

type EventWithInterests = Event & {
  interests: Array<{ interest: Interest }>;
};

export type EventWithOrganisation = Event & { organisation: Organisation };

export type EventForFeed = EventWithInterests & {
  organisation: Organisation;
};

export type EventForPublicPage = Event & {
  organisation: Organisation;
  tickets: EventTicket[];
  features: EventFeature[];
  images: EventImage[];
};

export interface AttendeeEventFlags {
  isSubscribed: boolean;
  isRsvped: boolean;
  isMuted: boolean;
  interestOverlap: number;
  ownedByTicket: Map<string, number>;
}

@Injectable()
export class EventSerializer {
  private readonly webUrl: string;

  constructor(
    private readonly storage: StorageService,
    private readonly organisations: OrganisationSerializer,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true }).replace(/\/$/, '');
  }

  base(event: EventWithInterests): Record<string, unknown> {
    return {
      ...this.core(event),
      interests: event.interests.map(({ interest }) => ({
        id: interest.id,
        slug: interest.slug,
        name: interest.name,
      })),
    };
  }

  full(event: EventForResource): Record<string, unknown> {
    return {
      ...this.base(event),
      ...this.detailFields(event),
      tickets_sold: event.ticketsSold,
      revenue_minor: Number(event.revenueMinor),
      created_at: event.createdAt.toISOString(),
      images: event.images.map((image) => this.image(image)),
      features: event.features.map((feature) => this.feature(feature)),
      tickets: event.tickets.map((ticket) => this.ticket(ticket)),
    };
  }

  searchItem(event: EventWithOrganisation): Record<string, unknown> {
    return {
      ...this.core(event),
      status: event.status,
      organisation: {
        id: event.organisation.id,
        name: event.organisation.name,
        slug: event.organisation.slug,
        logo_url: this.organisations.logoUrl(event.organisation),
      },
    };
  }

  feedItem(
    event: EventForFeed,
    extras: { interestOverlap: number; isSubscribed: boolean },
  ): Record<string, unknown> {
    return {
      ...this.base(event),
      organisation: {
        id: event.organisation.id,
        name: event.organisation.name,
        slug: event.organisation.slug,
        logo_url: this.organisations.logoUrl(event.organisation),
        subscribers_count: event.organisation.subscribersCount,
      },
      interest_overlap: extras.interestOverlap,
      is_subscribed: extras.isSubscribed,
    };
  }

  attendeeDetail(
    event: EventForResource & { organisation: OrganisationForResource },
    flags: AttendeeEventFlags,
  ): Record<string, unknown> {
    return {
      ...this.base(event),
      ...this.detailFields(event),
      organisation: this.organisations.organisation(event.organisation),
      images: event.images.map((image) => this.image(image)),
      features: event.features.map((feature) => this.feature(feature)),
      tickets: event.tickets.map((ticket) => ({
        ...this.ticket(ticket),
        owned_by_me: flags.ownedByTicket.get(ticket.id) ?? 0,
      })),
      is_subscribed: flags.isSubscribed,
      is_rsvped: flags.isRsvped,
      is_muted: flags.isMuted,
      interest_overlap: flags.interestOverlap,
    };
  }

  publicPage(event: EventForPublicPage): Record<string, unknown> {
    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      web_url: `${this.webUrl}/events/${event.slug}`,
      description: event.description,
      flyer_url: this.flyerUrl(event),
      flyer_type: event.flyerType,
      flyer_poster_url: this.posterUrl(event),
      starts_at: event.startsAt?.toISOString() ?? null,
      ends_at: event.endsAt?.toISOString() ?? null,
      timezone: event.timezone,
      venue_name: event.venueName,
      city: event.city,
      address: event.address,
      tickets_min_price: event.ticketsMinPrice,
      tickets_max_price: event.ticketsMaxPrice,
      currency: event.currency,
      status: event.status,
      organisation: {
        name: event.organisation.name,
        slug: event.organisation.slug,
        logo_url: this.organisations.logoUrl(event.organisation),
      },
      tickets: event.tickets.map((ticket) => this.publicTicket(ticket)),
      features: event.features.map((feature) => this.feature(feature)),
      images: event.images.map((image) => this.image(image)),
    };
  }

  ticket(ticket: EventTicket): Record<string, unknown> {
    return {
      id: ticket.id,
      name: ticket.name,
      description: ticket.description,
      gross_price: ticket.grossPrice,
      display_price: ticket.displayPrice,
      quantity: ticket.quantity,
      sold_count: ticket.soldCount,
      sort_order: ticket.sortOrder,
      status: ticket.status,
      sales_starts_at: ticket.salesStartsAt?.toISOString() ?? null,
      sales_ends_at: ticket.salesEndsAt?.toISOString() ?? null,
      valid_from: ticket.validFrom?.toISOString() ?? null,
      valid_to: ticket.validTo?.toISOString() ?? null,
      max_per_order: ticket.maxPerOrder,
      max_per_user: ticket.maxPerUser,
    };
  }

  publicTicket(ticket: EventTicket): Record<string, unknown> {
    return {
      id: ticket.id,
      name: ticket.name,
      description: ticket.description,
      gross_price: ticket.grossPrice,
    };
  }

  image(image: EventImage): Record<string, unknown> {
    return {
      id: image.id,
      url: this.storage.url(image.path),
      sort_order: image.sortOrder,
    };
  }

  feature(feature: EventFeature): Record<string, unknown> {
    return {
      id: feature.id,
      title: feature.title,
      description: feature.description,
      image_url:
        feature.imagePath !== null ? this.storage.url(feature.imagePath) : null,
      link: feature.link,
      starts_at: feature.startsAt?.toISOString() ?? null,
      ends_at: feature.endsAt?.toISOString() ?? null,
      sort_order: feature.sortOrder,
    };
  }

  private core(event: Event): Record<string, unknown> {
    return {
      id: event.id,
      title: event.title,
      slug: event.slug,
      web_url: `${this.webUrl}/events/${event.slug}`,
      starts_at: event.startsAt?.toISOString() ?? null,
      ends_at: event.endsAt?.toISOString() ?? null,
      venue_name: event.venueName,
      city: event.city,
      flyer_url: this.flyerUrl(event),
      flyer_type: event.flyerType,
      flyer_poster_url: this.posterUrl(event),
      tickets_count: event.ticketsCount,
      tickets_min_price: event.ticketsMinPrice,
      tickets_max_price: event.ticketsMaxPrice,
      currency: event.currency,
    };
  }

  private detailFields(event: Event): Record<string, unknown> {
    return {
      description: event.description,
      timezone: event.timezone,
      place_id: event.placeId,
      address: event.address,
      latitude: event.latitude?.toFixed(7) ?? null,
      longitude: event.longitude?.toFixed(7) ?? null,
      video_url: event.videoUrl,
      status: event.status,
      published_at: event.publishedAt?.toISOString() ?? null,
      presale_until: event.presaleUntil?.toISOString() ?? null,
      rsvps_count: event.rsvpsCount,
      comments_count: event.commentsCount,
    };
  }

  private flyerUrl(event: Event): string | null {
    return event.flyerPath !== null ? this.storage.url(event.flyerPath) : null;
  }

  private posterUrl(event: Event): string | null {
    return event.flyerPosterPath !== null
      ? this.storage.url(event.flyerPosterPath)
      : null;
  }
}
