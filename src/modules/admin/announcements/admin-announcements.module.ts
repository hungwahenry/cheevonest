import { Module } from '@nestjs/common';
import { AdminBroadcastsController } from './controllers/admin-broadcasts.controller';
import { ClickRedirectController } from './controllers/click-redirect.controller';
import { MarketingUnsubscribeController } from './controllers/marketing-unsubscribe.controller';
import { AdminBroadcastCronsService } from './services/admin-broadcast-crons.service';
import { AdminBroadcastService } from './services/admin-broadcast.service';
import { AudienceSegmentService } from './services/audience-segment.service';
import { BroadcastSenderService } from './services/broadcast-sender.service';
import { BroadcastTrackingService } from './services/broadcast-tracking.service';
import { AdminBroadcastSerializer } from './serializers/admin-broadcast.serializer';

@Module({
  controllers: [
    AdminBroadcastsController,
    ClickRedirectController,
    MarketingUnsubscribeController,
  ],
  providers: [
    AudienceSegmentService,
    BroadcastSenderService,
    AdminBroadcastService,
    BroadcastTrackingService,
    AdminBroadcastCronsService,
    AdminBroadcastSerializer,
  ],
})
export class AdminAnnouncementsModule {}
