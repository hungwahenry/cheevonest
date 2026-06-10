import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import {
  REPORT_CREATED,
  ReportCreatedEvent,
} from '../../reports/events/report-created.event';
import { CommentFlaggedMessage } from '../messages';
import { NotifierService } from '../services/notifier.service';

@Injectable()
export class ReportCreatedListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifierService,
  ) {}

  @OnEvent(REPORT_CREATED, { promisify: true })
  async handle(event: ReportCreatedEvent): Promise<void> {
    if (event.targetType !== 'event_comment') {
      return;
    }

    const comment = await this.prisma.eventComment.findUnique({
      where: { id: event.targetId },
      include: { event: true },
    });

    if (!comment) {
      return;
    }

    await this.notifier.sendToOrganisation(
      comment.event.organisationId,
      new CommentFlaggedMessage(comment),
    );
  }
}
