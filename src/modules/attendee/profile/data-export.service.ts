import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../config/env';
import { PrismaService } from '../../../database/prisma.service';
import type { User } from '../../../generated/prisma/client';
import { UserSerializer } from '../../users/serializers/user.serializer';

@Injectable()
export class DataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserSerializer,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Everything we hold about the user, as one JSON document. */
  async build(user: User): Promise<Record<string, unknown>> {
    const [
      profile,
      interests,
      memberships,
      subscriptions,
      blocks,
      preferences,
      rsvps,
      orders,
      tickets,
      comments,
    ] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId: user.id } }),
      this.prisma.interestUser.findMany({
        where: { userId: user.id },
        include: { interest: true },
      }),
      this.prisma.organisationMember.findMany({
        where: { userId: user.id },
        include: { organisation: true },
      }),
      this.prisma.subscription.findMany({
        where: { userId: user.id },
        include: { organisation: true },
      }),
      this.prisma.block.findMany({ where: { blockerUserId: user.id } }),
      this.prisma.notificationPreference.findMany({
        where: { userId: user.id },
      }),
      this.prisma.eventRsvp.findMany({
        where: { userId: user.id },
        include: { event: { select: { id: true, title: true } } },
      }),
      this.prisma.order.findMany({
        where: { userId: user.id },
        include: { event: { select: { id: true, title: true } } },
      }),
      this.prisma.issuedTicket.findMany({
        where: { holderUserId: user.id },
        include: { event: { select: { id: true, title: true } } },
      }),
      this.prisma.eventComment.findMany({
        where: { userId: user.id },
        include: { event: { select: { id: true, title: true } } },
      }),
    ]);

    return {
      exported_at: new Date().toISOString(),
      app: this.config.get('APP_NAME', { infer: true }),
      account: {
        id: user.id,
        email: user.email,
        email_verified_at: user.emailVerifiedAt?.toISOString() ?? null,
        created_at: user.createdAt.toISOString(),
        role: user.role,
      },
      profile: profile
        ? {
            first_name: profile.firstName,
            last_name: profile.lastName,
            username: profile.username,
            bio: profile.bio,
            gender: profile.gender,
            date_of_birth: profile.dateOfBirth?.toISOString().slice(0, 10),
            city: profile.city,
            place_name: profile.placeName,
            latitude: profile.latitude,
            longitude: profile.longitude,
            marketing_opt_in: profile.marketingOptIn,
            avatar_url: this.users.avatarUrl(profile),
            completed_at: profile.completedAt?.toISOString() ?? null,
          }
        : null,
      interests: interests.map(({ interest }) => ({
        slug: interest.slug,
        name: interest.name,
      })),
      organisations: memberships.map((membership) => ({
        id: membership.organisation.id,
        name: membership.organisation.name,
        slug: membership.organisation.slug,
        role: membership.role,
      })),
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.organisation.id,
        name: subscription.organisation.name,
        slug: subscription.organisation.slug,
      })),
      blocks: blocks.map((block) => ({
        type: block.blockableType,
        id: block.blockableId,
        created_at: block.createdAt.toISOString(),
      })),
      notification_preferences: preferences.map((preference) => ({
        type: preference.notificationType,
        channel: preference.channel,
        enabled: preference.enabled,
      })),
      rsvps: rsvps.map((rsvp) => ({
        event_id: rsvp.eventId,
        event_title: rsvp.event.title,
        created_at: rsvp.createdAt.toISOString(),
      })),
      orders: orders.map((order) => ({
        id: order.id,
        event_title: order.event.title,
        status: order.status,
        total_minor: Number(order.totalMinor),
        currency: order.currency,
        created_at: order.createdAt.toISOString(),
      })),
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        code: ticket.code,
        event_title: ticket.event.title,
        status: ticket.status,
        created_at: ticket.createdAt.toISOString(),
      })),
      comments: comments.map((comment) => ({
        id: comment.id,
        event_title: comment.event.title,
        body: comment.body,
        created_at: comment.createdAt.toISOString(),
      })),
    };
  }
}
