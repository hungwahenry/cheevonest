import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { SkipEnvelope } from '../../../common/decorators/api-response.decorators';
import { ExportEngineService } from '../../../common/exports/export-engine.service';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { EventsPolicy } from '../../events/events.policy';
import { EventsService } from '../../events/events.service';
import { EventExportsService } from './services/event-exports.service';
import { ExportQueryDto } from './dto/export-query.dto';

@SkipEnvelope()
@Controller('organizer/events/:eventId')
export class OrganizerExportsController {
  constructor(
    private readonly events: EventsService,
    private readonly policy: EventsPolicy,
    private readonly exports: EventExportsService,
    private readonly engine: ExportEngineService,
  ) {}

  @Get('orders/export')
  async orders(
    @Param('eventId') eventId: string,
    @Query() dto: ExportQueryDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Buffer> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    return this.send(
      reply,
      await this.engine.render(this.exports.orders(event), dto.format ?? 'csv'),
    );
  }

  @Get('rsvps/export')
  async rsvps(
    @Param('eventId') eventId: string,
    @Query() dto: ExportQueryDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Buffer> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    return this.send(
      reply,
      await this.engine.render(this.exports.rsvps(event), dto.format ?? 'csv'),
    );
  }

  @Get('issued-tickets/export')
  async issuedTickets(
    @Param('eventId') eventId: string,
    @Query() dto: ExportQueryDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Buffer> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    return this.send(
      reply,
      await this.engine.render(
        this.exports.issuedTickets(event),
        dto.format ?? 'csv',
      ),
    );
  }

  private send(
    reply: FastifyReply,
    rendered: { filename: string; contentType: string; body: Buffer },
  ): Buffer {
    void reply.header('Content-Type', rendered.contentType);
    void reply.header(
      'Content-Disposition',
      `attachment; filename="${rendered.filename}"`,
    );

    return rendered.body;
  }
}
