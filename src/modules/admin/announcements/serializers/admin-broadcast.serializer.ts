import { Injectable } from '@nestjs/common';
import type {
  AdminBroadcast,
  AdminBroadcastLink,
} from '../../../../generated/prisma/client';
import type { BroadcastWithLinks } from '../services/admin-broadcast.service';
import type { SegmentDefinition } from '../services/audience-segment.service';

@Injectable()
export class AdminBroadcastSerializer {
  row(broadcast: AdminBroadcast): Record<string, unknown> {
    return {
      id: broadcast.id,
      kind: broadcast.kind,
      status: broadcast.status,
      title: broadcast.title,
      channels: broadcast.channels,
      recipients_count: broadcast.recipientsCount,
      scheduled_at: broadcast.scheduledAt?.toISOString() ?? null,
      sent_at: broadcast.sentAt?.toISOString() ?? null,
      created_at: broadcast.createdAt.toISOString(),
    };
  }

  detail(broadcast: BroadcastWithLinks): Record<string, unknown> {
    return {
      ...this.row(broadcast),
      body: broadcast.body,
      audience: this.audience(broadcast.audience as SegmentDefinition),
      stats: {
        recipients: broadcast.recipientsCount,
        email: broadcast.emailCount,
        push: broadcast.pushCount,
        inapp: broadcast.inappCount,
        failed: broadcast.failedCount,
        clicks: broadcast.clickCount,
      },
      links: broadcast.links.map((link) => this.link(link)),
      failure_reason: broadcast.failureReason,
      started_at: broadcast.startedAt?.toISOString() ?? null,
      updated_at: broadcast.updatedAt.toISOString(),
    };
  }

  private link(link: AdminBroadcastLink): Record<string, unknown> {
    return {
      id: link.id,
      url: link.url,
      click_count: link.clickCount,
    };
  }

  private audience(segment: SegmentDefinition): Record<string, unknown> {
    return {
      user_ids: segment.userIds ?? null,
      roles: segment.roles ?? null,
      interest_ids: segment.interestIds ?? null,
      cities: segment.cities ?? null,
      has_ordered: segment.hasOrdered ?? null,
      active_since: segment.activeSince ?? null,
      inactive_since: segment.inactiveSince ?? null,
      has_upcoming_rsvp: segment.hasUpcomingRsvp ?? null,
    };
  }
}
