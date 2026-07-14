import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import type { Currency } from '../../../generated/prisma/client';
import {
  EVENT_PUBLISHED,
  EventPublishedEvent,
} from '../../events/events/event-published.event';
import {
  ORGANISATION_CREATED,
  OrganisationCreatedEvent,
} from '../../organizer/organisations/events/organisation-created.event';
import {
  ORDER_PAID,
  OrderPaidEvent,
} from '../../orders/events/order-paid.event';
import {
  PAYOUT_ACCOUNT_CHANGED,
  PayoutAccountChangedEvent,
} from '../../payouts/events/payout-account-changed.event';
import {
  PAYOUT_REQUESTED,
  PayoutRequestedEvent,
} from '../../payouts/events/payout-requested.event';
import {
  PAYOUT_SETTLED,
  PayoutSettledEvent,
} from '../../payouts/events/payout-settled.event';
import {
  REPORT_CREATED,
  ReportCreatedEvent,
} from '../../reports/events/report-created.event';
import { SystemConfigService } from '../../platform/system-config/system-config.service';
import { AdminAlertMessage } from '../messages';
import { NotifierService } from '../services/notifier.service';

@Injectable()
export class AdminAlertsListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifierService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  @OnEvent(PAYOUT_REQUESTED, { promisify: true })
  async onPayoutRequested(event: PayoutRequestedEvent): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: event.payoutId },
      include: { organisation: { select: { name: true } } },
    });
    if (!payout) return;

    const amount = money(payout.amountMinor, payout.currency);
    const heading = event.pendingReview
      ? 'Payout awaiting approval'
      : 'Payout requested';
    const summary = event.pendingReview
      ? `${payout.organisation.name} requested a ${amount} payout that needs your approval.`
      : `${payout.organisation.name} requested a ${amount} payout.`;

    await this.notifier.sendToAdmins(
      new AdminAlertMessage(
        'admin.payout_requested',
        heading,
        summary,
        [
          { label: 'Organisation', value: payout.organisation.name },
          { label: 'Amount', value: amount },
          { label: 'Bank', value: `${payout.bankName} · ${payout.accountNumber}` },
        ],
        { payout_id: payout.id, organisation_id: payout.organisationId },
      ),
    );
  }

  @OnEvent(PAYOUT_SETTLED, { promisify: true })
  async onPayoutSettled(event: PayoutSettledEvent): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: event.payoutId },
      include: { organisation: { select: { name: true } } },
    });
    if (!payout || payout.status !== 'failed') return;

    const amount = money(payout.amountMinor, payout.currency);
    await this.notifier.sendToAdmins(
      new AdminAlertMessage(
        'admin.payout_failed',
        'Payout failed',
        `${payout.organisation.name}'s ${amount} payout failed.`,
        [
          { label: 'Organisation', value: payout.organisation.name },
          { label: 'Amount', value: amount },
          { label: 'Reason', value: payout.failedReason ?? 'Unknown' },
        ],
        { payout_id: payout.id, organisation_id: payout.organisationId },
      ),
    );
  }

  @OnEvent(PAYOUT_ACCOUNT_CHANGED, { promisify: true })
  async onPayoutAccountChanged(
    event: PayoutAccountChangedEvent,
  ): Promise<void> {
    const account = await this.prisma.payoutAccount.findUnique({
      where: { organisationId: event.organisationId },
      include: { organisation: { select: { name: true } } },
    });
    if (!account) return;

    await this.notifier.sendToAdmins(
      new AdminAlertMessage(
        'admin.payout_account_changed',
        'Payout account changed',
        `${account.organisation.name} updated their payout bank account.`,
        [
          { label: 'Organisation', value: account.organisation.name },
          { label: 'Bank', value: account.bankName },
          {
            label: 'Account',
            value: `${account.accountName} · ${account.accountNumber}`,
          },
        ],
        { organisation_id: account.organisationId },
      ),
    );
  }

  @OnEvent(REPORT_CREATED, { promisify: true })
  async onReportCreated(event: ReportCreatedEvent): Promise<void> {
    await this.notifier.sendToAdmins(
      new AdminAlertMessage(
        'admin.report_created',
        'Content reported',
        `A ${event.targetType.replace(/_/g, ' ')} was reported for moderation.`,
        [
          { label: 'Type', value: event.targetType },
          { label: 'Target', value: event.targetId },
        ],
        {
          report_id: event.reportId,
          target_type: event.targetType,
          target_id: event.targetId,
        },
      ),
    );
  }

  @OnEvent(ORGANISATION_CREATED, { promisify: true })
  async onOrganisationCreated(
    event: OrganisationCreatedEvent,
  ): Promise<void> {
    const org = await this.prisma.organisation.findUnique({
      where: { id: event.organisationId },
      select: { name: true, slug: true },
    });
    if (!org) return;

    await this.notifier.sendToAdmins(
      new AdminAlertMessage(
        'admin.organisation_created',
        'New organisation',
        `${org.name} was just created.`,
        [
          { label: 'Name', value: org.name },
          { label: 'Slug', value: org.slug },
        ],
        { organisation_id: event.organisationId },
      ),
    );
  }

  @OnEvent(EVENT_PUBLISHED, { promisify: true })
  async onEventPublished(event: EventPublishedEvent): Promise<void> {
    const published = await this.prisma.event.findUnique({
      where: { id: event.eventId },
      include: { organisation: { select: { name: true } } },
    });
    if (!published) return;

    await this.notifier.sendToAdmins(
      new AdminAlertMessage(
        'admin.event_published',
        'Event published',
        `${published.organisation.name} published "${published.title}".`,
        [
          { label: 'Event', value: published.title },
          { label: 'Organisation', value: published.organisation.name },
        ],
        { event_id: published.id, organisation_id: published.organisationId },
      ),
    );
  }

  @OnEvent(ORDER_PAID, { promisify: true })
  async onOrderPaid(event: OrderPaidEvent): Promise<void> {
    const threshold = await this.systemConfig.int(
      'admin.large_order_threshold_minor',
      50_000_000,
    );
    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
      include: { event: { select: { title: true } } },
    });
    if (!order || Number(order.totalMinor) < threshold) return;

    const amount = money(order.totalMinor, order.currency);
    await this.notifier.sendToAdmins(
      new AdminAlertMessage(
        'admin.large_order',
        'Large order',
        `A ${amount} order was placed on "${order.event.title}".`,
        [
          { label: 'Amount', value: amount },
          { label: 'Event', value: order.event.title },
          { label: 'Tickets', value: String(order.itemsQuantityTotal) },
        ],
        { order_id: order.id },
      ),
    );
  }
}

function money(minor: bigint | number, currency: Currency): string {
  const symbol = currency === 'NGN' ? '₦' : `${currency} `;
  return `${symbol}${new Intl.NumberFormat('en-US').format(Number(minor) / 100)}`;
}
