import { Injectable } from '@nestjs/common';
import { ExportDefinition } from '../../../../common/exports/export-definition';
import { PrismaService } from '../../../../database/prisma.service';
import type { Event } from '../../../../generated/prisma/client';
import {
  EVENT_ORDER_INCLUDE,
  EVENT_RSVP_INCLUDE,
  EventOrder,
  EventRsvp,
} from '../../analytics/services/event-reporting.service';

const CHUNK = 500;

interface IssuedTicketRow {
  code: string;
  status: string;
  orderId: string;
  scannedAt: Date | null;
  createdAt: Date;
  holderName: string;
  holderEmail: string;
  ticketName: string;
  scannedByName: string;
}

function displayName(
  profile: {
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  } | null,
): string {
  if (!profile) {
    return '';
  }

  const full = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();

  return full !== '' ? full : (profile.username ?? '');
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'event'
  );
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class EventExportsService {
  constructor(private readonly prisma: PrismaService) {}

  orders(event: Event): ExportDefinition<EventOrder> {
    const prisma = this.prisma;

    return {
      filename: `${slugify(event.title)}-orders-${stamp()}`,
      title: `Orders \u2014 ${event.title}`,
      columns: [
        { header: 'Order ID', value: (order) => order.id },
        {
          header: 'Buyer Name',
          value: (order) => displayName(order.user.profile),
        },
        { header: 'Buyer Email', value: (order) => order.user.email },
        {
          header: 'Items',
          value: (order) => order.itemsQuantityTotal,
          format: 'integer',
        },
        {
          header: 'Subtotal',
          value: (order) => Number(order.subtotalMinor),
          format: 'money',
        },
        {
          header: 'Fees',
          value: (order) => Number(order.feesMinor),
          format: 'money',
        },
        {
          header: 'Total',
          value: (order) => Number(order.totalMinor),
          format: 'money',
        },
        { header: 'Currency', value: (order) => order.currency },
        { header: 'Status', value: (order) => order.status },
        {
          header: 'Paid At',
          value: (order) => order.paidAt?.toISOString() ?? '',
        },
        {
          header: 'Created At',
          value: (order) => order.createdAt.toISOString(),
        },
      ],
      rows: (async function* () {
        let cursor: string | undefined;

        for (;;) {
          const batch: EventOrder[] = await prisma.order.findMany({
            where: { eventId: event.id },
            include: EVENT_ORDER_INCLUDE,
            orderBy: { id: 'desc' },
            take: CHUNK,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          });

          for (const order of batch) {
            yield order;
          }

          if (batch.length < CHUNK) {
            return;
          }

          cursor = batch[batch.length - 1].id;
        }
      })(),
    };
  }

  rsvps(event: Event): ExportDefinition<EventRsvp> {
    const prisma = this.prisma;

    return {
      filename: `${slugify(event.title)}-rsvps-${stamp()}`,
      title: `RSVPs \u2014 ${event.title}`,
      columns: [
        {
          header: 'Display Name',
          value: (rsvp) => displayName(rsvp.user.profile),
        },
        {
          header: 'Username',
          value: (rsvp) => rsvp.user.profile?.username ?? '',
        },
        { header: 'Email', value: (rsvp) => rsvp.user.email },
        {
          header: 'RSVPed At',
          value: (rsvp) => rsvp.createdAt.toISOString(),
        },
      ],
      rows: (async function* () {
        let page = 0;

        for (;;) {
          const batch: EventRsvp[] = await prisma.eventRsvp.findMany({
            where: { eventId: event.id },
            include: EVENT_RSVP_INCLUDE,
            orderBy: { createdAt: 'desc' },
            take: CHUNK,
            skip: page * CHUNK,
          });

          for (const rsvp of batch) {
            yield rsvp;
          }

          if (batch.length < CHUNK) {
            return;
          }

          page += 1;
        }
      })(),
    };
  }

  issuedTickets(event: Event): ExportDefinition<IssuedTicketRow> {
    const prisma = this.prisma;

    return {
      filename: `${slugify(event.title)}-tickets-${stamp()}`,
      title: `Tickets \u2014 ${event.title}`,
      columns: [
        { header: 'Ticket Code', value: (row) => row.code },
        { header: 'Holder Name', value: (row) => row.holderName },
        { header: 'Holder Email', value: (row) => row.holderEmail },
        { header: 'Ticket Type', value: (row) => row.ticketName },
        { header: 'Status', value: (row) => row.status },
        { header: 'Order ID', value: (row) => row.orderId },
        {
          header: 'Scanned At',
          value: (row) => row.scannedAt?.toISOString() ?? '',
        },
        { header: 'Scanned By', value: (row) => row.scannedByName },
        {
          header: 'Created At',
          value: (row) => row.createdAt.toISOString(),
        },
      ],
      rows: (async function* () {
        let cursor: string | undefined;

        for (;;) {
          const batch = await prisma.issuedTicket.findMany({
            where: { eventId: event.id },
            include: {
              holder: { include: { profile: true } },
              ticket: { select: { name: true } },
              scannedBy: { include: { profile: true } },
            },
            orderBy: { id: 'desc' },
            take: CHUNK,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          });

          for (const ticket of batch) {
            yield {
              code: ticket.code,
              status: ticket.status,
              orderId: ticket.orderId,
              scannedAt: ticket.scannedAt,
              createdAt: ticket.createdAt,
              holderName: displayName(ticket.holder.profile),
              holderEmail: ticket.holder.email,
              ticketName: ticket.ticket.name,
              scannedByName: ticket.scannedBy
                ? displayName(ticket.scannedBy.profile)
                : '',
            };
          }

          if (batch.length < CHUNK) {
            return;
          }

          cursor = batch[batch.length - 1].id;
        }
      })(),
    };
  }
}
