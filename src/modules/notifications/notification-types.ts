export const NOTIFICATION_CHANNELS = ['email', 'push', 'inapp'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationAudience = 'organizer' | 'attendee' | 'admin';

export type NotificationType =
  | 'order.first_sale'
  | 'order.daily_digest'
  | 'event.starting_soon'
  | 'payout.completed'
  | 'payout.failed'
  | 'comment.flagged'
  | 'broadcast.finished'
  | 'attendee.order_paid'
  | 'attendee.event_starting_soon'
  | 'attendee.new_event_from_subscription'
  | 'attendee.comment_reply'
  | 'attendee.ticket_transfer_received'
  | 'admin.payout_requested'
  | 'admin.payout_failed'
  | 'admin.payout_account_changed'
  | 'admin.report_created'
  | 'admin.organisation_created'
  | 'admin.event_published'
  | 'admin.large_order';

export interface NotificationTypeMeta {
  audience: NotificationAudience;
  label: string;
  description: string;
  defaultChannels: NotificationChannel[];
  allowedChannels: NotificationChannel[];
}

const PUSH_INAPP: NotificationChannel[] = ['push', 'inapp'];
const ALL: NotificationChannel[] = ['push', 'inapp', 'email'];
const ADMIN: NotificationChannel[] = ['inapp', 'email'];

export const NOTIFICATION_TYPES: Record<
  NotificationType,
  NotificationTypeMeta
> = {
  'order.first_sale': {
    audience: 'organizer',
    label: 'First sale on an event',
    description: "We'll celebrate the first paid order on each event.",
    defaultChannels: PUSH_INAPP,
    allowedChannels: ALL,
  },
  'order.daily_digest': {
    audience: 'organizer',
    label: 'Daily sales digest',
    description: 'Daily summary of revenue and tickets sold per event.',
    defaultChannels: ['email'],
    allowedChannels: ['email'],
  },
  'event.starting_soon': {
    audience: 'organizer',
    label: 'Event starts in 24 hours',
    description: 'Day-before reminder so you can finalise setup.',
    defaultChannels: PUSH_INAPP,
    allowedChannels: ALL,
  },
  'payout.completed': {
    audience: 'organizer',
    label: 'Payout completed',
    description: 'Confirmation when a payout settles in your bank.',
    defaultChannels: PUSH_INAPP,
    allowedChannels: ALL,
  },
  'payout.failed': {
    audience: 'organizer',
    label: 'Payout failed',
    description: 'Alert if a payout is rejected by the bank.',
    defaultChannels: PUSH_INAPP,
    allowedChannels: ALL,
  },
  'comment.flagged': {
    audience: 'organizer',
    label: 'Comment flagged on your event',
    description: 'Heads-up when attendees report a comment for moderation.',
    defaultChannels: PUSH_INAPP,
    allowedChannels: ALL,
  },
  'broadcast.finished': {
    audience: 'organizer',
    label: 'Broadcast finished sending',
    description: 'Stats summary once a broadcast finishes sending.',
    defaultChannels: PUSH_INAPP,
    allowedChannels: ALL,
  },
  'attendee.order_paid': {
    audience: 'attendee',
    label: 'Your tickets are ready',
    description: 'Confirmation when your order settles and tickets are issued.',
    defaultChannels: PUSH_INAPP,
    allowedChannels: ALL,
  },
  'attendee.event_starting_soon': {
    audience: 'attendee',
    label: 'Event starts in 24 hours',
    description:
      "Reminder the day before an event you bought tickets for or RSVP'd to.",
    defaultChannels: PUSH_INAPP,
    allowedChannels: ALL,
  },
  'attendee.new_event_from_subscription': {
    audience: 'attendee',
    label: 'New event from an organisation you follow',
    description: 'When an organisation you follow publishes a new event.',
    defaultChannels: PUSH_INAPP,
    allowedChannels: ALL,
  },
  'attendee.comment_reply': {
    audience: 'attendee',
    label: 'Someone replied to your comment',
    description: 'When someone replies to a comment you posted.',
    defaultChannels: PUSH_INAPP,
    allowedChannels: ALL,
  },
  'attendee.ticket_transfer_received': {
    audience: 'attendee',
    label: 'You received a ticket',
    description: 'When another user transfers one of their tickets to you.',
    defaultChannels: PUSH_INAPP,
    allowedChannels: PUSH_INAPP,
  },
  'admin.payout_requested': {
    audience: 'admin',
    label: 'Payout requested',
    description: 'An organiser requested a payout.',
    defaultChannels: ADMIN,
    allowedChannels: ADMIN,
  },
  'admin.payout_failed': {
    audience: 'admin',
    label: 'Payout failed or reversed',
    description: 'A payout failed or was reversed by the provider.',
    defaultChannels: ADMIN,
    allowedChannels: ADMIN,
  },
  'admin.payout_account_changed': {
    audience: 'admin',
    label: 'Payout account changed',
    description: 'An organiser added or changed their bank account.',
    defaultChannels: ADMIN,
    allowedChannels: ADMIN,
  },
  'admin.report_created': {
    audience: 'admin',
    label: 'Content reported',
    description: 'A user reported content for moderation.',
    defaultChannels: ADMIN,
    allowedChannels: ADMIN,
  },
  'admin.organisation_created': {
    audience: 'admin',
    label: 'New organisation',
    description: 'A new organisation was created.',
    defaultChannels: ADMIN,
    allowedChannels: ADMIN,
  },
  'admin.event_published': {
    audience: 'admin',
    label: 'Event published',
    description: 'An organiser published an event.',
    defaultChannels: ADMIN,
    allowedChannels: ADMIN,
  },
  'admin.large_order': {
    audience: 'admin',
    label: 'Large order',
    description: 'An order settled above the large-order threshold.',
    defaultChannels: ADMIN,
    allowedChannels: ADMIN,
  },
};

export const NOTIFICATION_TYPE_VALUES = Object.keys(
  NOTIFICATION_TYPES,
) as NotificationType[];

export function notificationTypesForAudience(
  audience: NotificationAudience,
): NotificationType[] {
  return NOTIFICATION_TYPE_VALUES.filter(
    (type) => NOTIFICATION_TYPES[type].audience === audience,
  );
}

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  push: 'Push',
  inapp: 'In-app',
};
