import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../config/env';
import type {
  EventFeature,
  EventImage,
  EventTicket,
} from '../../../generated/prisma/client';
import { StorageService } from '../../../integrations/storage/storage.service';
import { EventForResource } from '../events.service';

@Injectable()
export class EventSerializer {
  private readonly webUrl: string;

  constructor(
    private readonly storage: StorageService,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true }).replace(/\/$/, '');
  }

  base(event: EventForResource): Record<string, unknown> {
    return {
      id: event.id,
      title: event.title,
      slug: event.slug,
      web_url: `${this.webUrl}/events/${event.slug}`,
      starts_at: event.startsAt?.toISOString() ?? null,
      ends_at: event.endsAt?.toISOString() ?? null,
      venue_name: event.venueName,
      city: event.city,
      flyer_url:
        event.flyerPath !== null ? this.storage.url(event.flyerPath) : null,
      flyer_type: event.flyerType,
      tickets_count: event.ticketsCount,
      tickets_min_price: event.ticketsMinPrice,
      tickets_max_price: event.ticketsMaxPrice,
      currency: event.currency,
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
      tickets_sold: event.ticketsSold,
      revenue_minor: Number(event.revenueMinor),
      created_at: event.createdAt.toISOString(),
      images: event.images.map((image) => this.image(image)),
      features: event.features.map((feature) => this.feature(feature)),
      tickets: event.tickets.map((ticket) => this.ticket(ticket)),
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
}
