import { Injectable, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import type { Event, EventTicket } from '../../../../generated/prisma/client';
import { EventsService } from '../../../events/events.service';
import { ensureEventNotEnded } from '../../../events/rules/event.rules';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import {
  ensureAfterOrEqual,
  ensureBeforeOrEqual,
  parseEventDate,
} from '../rules/schedule.rules';

interface TicketDates {
  salesStartsAt?: Date | null;
  salesEndsAt?: Date | null;
  validFrom?: Date | null;
  validTo?: Date | null;
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async create(event: Event, dto: CreateTicketDto): Promise<EventTicket> {
    ensureEventNotEnded(event);

    const dates = this.parseDates(event, dto);
    this.ensureWindowsWithinEvent(event, dates);

    const maxSort = await this.prisma.eventTicket.aggregate({
      where: { eventId: event.id },
      _max: { sortOrder: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.eventTicket.create({
        data: {
          id: ulid(),
          eventId: event.id,
          name: dto.name,
          description: dto.description ?? null,
          grossPrice: dto.gross_price,
          displayPrice: dto.display_price ?? null,
          quantity: dto.quantity ?? null,
          status: dto.status ?? 'draft',
          salesStartsAt: dates.salesStartsAt ?? null,
          salesEndsAt: dates.salesEndsAt ?? null,
          validFrom: dates.validFrom ?? null,
          validTo: dates.validTo ?? null,
          maxPerOrder: dto.max_per_order ?? null,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        },
      });

      await this.events.recomputeTicketAggregates(event.id, tx);

      return ticket;
    });
  }

  async update(
    event: Event,
    ticketId: string,
    dto: UpdateTicketDto,
  ): Promise<EventTicket> {
    ensureEventNotEnded(event);

    const ticket = await this.findScoped(event, ticketId);
    const dates = this.parseDates(event, dto);
    this.ensureWindowsWithinEvent(event, dates);

    const data: Prisma.EventTicketUncheckedUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.gross_price !== undefined) data.grossPrice = dto.gross_price;
    if (dto.display_price !== undefined) data.displayPrice = dto.display_price;
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.sales_starts_at !== undefined)
      data.salesStartsAt = dates.salesStartsAt;
    if (dto.sales_ends_at !== undefined) data.salesEndsAt = dates.salesEndsAt;
    if (dto.valid_from !== undefined) data.validFrom = dates.validFrom;
    if (dto.valid_to !== undefined) data.validTo = dates.validTo;
    if (dto.max_per_order !== undefined) data.maxPerOrder = dto.max_per_order;

    const affectsAggregates =
      dto.gross_price !== undefined ||
      dto.status !== undefined ||
      dto.quantity !== undefined;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.eventTicket.update({
        where: { id: ticket.id },
        data,
      });

      if (affectsAggregates) {
        await this.events.recomputeTicketAggregates(event.id, tx);
      }

      return updated;
    });
  }

  async delete(event: Event, ticketId: string): Promise<void> {
    ensureEventNotEnded(event);

    const ticket = await this.findScoped(event, ticketId);

    await this.prisma.$transaction(async (tx) => {
      await tx.eventTicket.delete({ where: { id: ticket.id } });
      await this.events.recomputeTicketAggregates(event.id, tx);
    });
  }

  async reorder(event: Event, ids: string[]): Promise<void> {
    ensureEventNotEnded(event);

    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.eventTicket.updateMany({
          where: { id, eventId: event.id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
  }

  private async findScoped(
    event: Event,
    ticketId: string,
  ): Promise<EventTicket> {
    const ticket = await this.prisma.eventTicket.findFirst({
      where: { id: ticketId, eventId: event.id },
    });

    if (!ticket) {
      throw new NotFoundException();
    }

    return ticket;
  }

  private parseDates(
    event: Event,
    dto: CreateTicketDto | UpdateTicketDto,
  ): TicketDates {
    const timezone = event.timezone || 'Africa/Lagos';

    const parse = (
      value: string | null | undefined,
      field: string,
    ): Date | null | undefined => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null || value === '') {
        return null;
      }

      return parseEventDate(value, timezone, field);
    };

    const dates: TicketDates = {
      salesStartsAt: parse(dto.sales_starts_at, 'sales_starts_at'),
      salesEndsAt: parse(dto.sales_ends_at, 'sales_ends_at'),
      validFrom: parse(dto.valid_from, 'valid_from'),
      validTo: parse(dto.valid_to, 'valid_to'),
    };

    ensureAfterOrEqual(
      dates.salesEndsAt ?? undefined,
      dates.salesStartsAt ?? undefined,
      'sales_ends_at',
      'The sales_ends_at must be a date after or equal to sales_starts_at.',
    );
    ensureAfterOrEqual(
      dates.validTo ?? undefined,
      dates.validFrom ?? undefined,
      'valid_to',
      'The valid_to must be a date after or equal to valid_from.',
    );

    return dates;
  }

  private ensureWindowsWithinEvent(event: Event, dates: TicketDates): void {
    if (event.endsAt) {
      ensureBeforeOrEqual(
        dates.salesStartsAt ?? undefined,
        event.endsAt,
        'sales_starts_at',
        'Sales must start before the event ends.',
      );
      ensureBeforeOrEqual(
        dates.salesEndsAt ?? undefined,
        event.endsAt,
        'sales_ends_at',
        'The sales_ends_at must be before or equal to the event end.',
      );
      ensureBeforeOrEqual(
        dates.validFrom ?? undefined,
        event.endsAt,
        'valid_from',
        'Validity must start before the event ends.',
      );
    }

    if (event.startsAt) {
      ensureAfterOrEqual(
        dates.validTo ?? undefined,
        event.startsAt,
        'valid_to',
        'Validity must extend to or past the event start.',
      );
    }
  }
}
