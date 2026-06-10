import { Module } from '@nestjs/common';
import { MailModule } from '../../integrations/mail/mail.module';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';
import { NotificationsController } from './controllers/notifications.controller';
import { CommentRepliedListener } from './listeners/comment-replied.listener';
import { EventPublishedListener } from './listeners/event-published.listener';
import { OrderPaidListener } from './listeners/order-paid.listener';
import { PayoutSettledListener } from './listeners/payout-settled.listener';
import { ReportCreatedListener } from './listeners/report-created.listener';
import { NotificationsCronsService } from './notifications-crons.service';
import { NotificationSerializer } from './serializers/notification.serializer';
import { ExpoPushService } from './services/expo-push.service';
import { InboxService } from './services/inbox.service';
import { MutesService } from './services/mutes.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { NotifierService } from './services/notifier.service';
import { PushTokensService } from './services/push-tokens.service';
import { ScheduledNotificationsService } from './services/scheduled-notifications.service';

@Module({
  imports: [MailModule, EventsModule, UsersModule],
  controllers: [NotificationsController],
  providers: [
    NotifierService,
    NotificationPreferencesService,
    ExpoPushService,
    InboxService,
    PushTokensService,
    MutesService,
    ScheduledNotificationsService,
    NotificationsCronsService,
    NotificationSerializer,
    OrderPaidListener,
    PayoutSettledListener,
    CommentRepliedListener,
    EventPublishedListener,
    ReportCreatedListener,
  ],
  exports: [NotifierService, MutesService],
})
export class NotificationsModule {}
