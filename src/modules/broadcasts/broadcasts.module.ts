import { Module } from '@nestjs/common';
import { SigningModule } from '../../common/signing/signing.module';
import { MailModule } from '../../integrations/mail/mail.module';
import { OrganisationsModule } from '../organisations/organisations.module';
import { BroadcastSerializer } from './broadcast.serializer';
import { BroadcastsCronsService } from './broadcasts-crons.service';
import { ResendWebhookController } from './controllers/resend-webhook.controller';
import { UnsubscribeController } from './controllers/unsubscribe.controller';
import { BroadcastDispatcherService } from './services/broadcast-dispatcher.service';
import { BroadcastMailerService } from './services/broadcast-mailer.service';
import { BroadcastRecipientsService } from './services/broadcast-recipients.service';
import { BroadcastsService } from './services/broadcasts.service';
import { ResendWebhookService } from './services/resend-webhook.service';
import { SuppressionsService } from './services/suppressions.service';

@Module({
  imports: [MailModule, SigningModule, OrganisationsModule],
  controllers: [ResendWebhookController, UnsubscribeController],
  providers: [
    BroadcastsService,
    BroadcastRecipientsService,
    BroadcastDispatcherService,
    BroadcastMailerService,
    SuppressionsService,
    ResendWebhookService,
    BroadcastSerializer,
    BroadcastsCronsService,
  ],
  exports: [BroadcastsService, SuppressionsService, BroadcastSerializer],
})
export class BroadcastsModule {}
