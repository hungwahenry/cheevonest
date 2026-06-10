import { Injectable } from '@nestjs/common';
import type { Broadcast } from '../../generated/prisma/client';

@Injectable()
export class BroadcastSerializer {
  broadcast(broadcast: Broadcast): Record<string, unknown> {
    return {
      id: broadcast.id,
      audience: broadcast.audience,
      subject: broadcast.subject,
      body_html: broadcast.bodyHtml,
      body_text: broadcast.bodyText,
      recipients_count: broadcast.recipientsCount,
      sent_count: broadcast.sentCount,
      failed_count: broadcast.failedCount,
      status: broadcast.status,
      failure_reason: broadcast.failureReason,
      sent_at: broadcast.sentAt?.toISOString() ?? null,
      created_at: broadcast.createdAt.toISOString(),
    };
  }
}
